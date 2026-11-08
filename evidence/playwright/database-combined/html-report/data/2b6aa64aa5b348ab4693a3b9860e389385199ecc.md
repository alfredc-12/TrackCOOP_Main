# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-database.spec.ts >> P27 Bookkeeper edits a category while Chairman cannot edit it
- Location: tests\e2e\evidence-database.spec.ts:321:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 500
```

# Test source

```ts
  233 |     const [before] = await db.query<RowDataPacket[]>("SELECT member_id,official_member_status FROM member_profiles WHERE member_code='NFFAC-SEED-0001'");
  234 |     const memberId = String(before[0].member_id);
  235 |     await login(context, "chairman");
  236 |     const data = { memberId, basisPeriodEnd: "2026-10-31" };
  237 |     const preview = await context.request.post(`${api}/api/member-indicators/workspace/preview`, { data });
  238 |     expect(preview.status()).toBe(200);
  239 |     const fingerprint = (await preview.json()).data.previewFingerprint;
  240 |     expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  241 |     const commit = await context.request.post(`${api}/api/member-indicators/workspace/recalculate`, { data: { ...data, confirmed: true, previewFingerprint: fingerprint } });
  242 |     expect(commit.status()).toBe(200);
  243 |     const [after] = await db.execute<RowDataPacket[]>("SELECT member_id,official_member_status FROM member_profiles WHERE member_id=?", [memberId]);
  244 |     expect(after[0]).toEqual(before[0]);
  245 |     const [indicators] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM member_status_indicators WHERE member_id=? AND basis_period_end=?", [memberId, data.basisPeriodEnd]);
  246 |     expect(Number(indicators[0].n)).toBeGreaterThan(0);
  247 |   } finally { await db.end(); }
  248 | });
  249 | 
  250 | test("P24 Bookkeeper saves classified income and expense records", async ({ context }) => {
  251 |   const db = await database();
  252 |   try {
  253 |     await login(context, "bookkeeper");
  254 |     const tag = `P24-${randomUUID().slice(0, 8)}`;
  255 |     const [cats] = await db.query<RowDataPacket[]>("SELECT financial_category_id,category_code FROM financial_categories WHERE category_code IN ('OTHER_INCOME','OFFICE_SUPPLIES')");
  256 |     for (const [suffix, type, code, amount] of [["I", "Income", "OTHER_INCOME", 5000], ["E", "Expense", "OFFICE_SUPPLIES", 1700]] as const) {
  257 |       const category = cats.find(row => row.category_code === code)!;
  258 |       const recordNumber = `${tag}-${suffix}`;
  259 |       const response = await context.request.post(`${api}/api/financial-records`, { data: { recordNumber, financialCategoryId: String(category.financial_category_id), recordType: type, sourceModule: "Manual", amount, recordDate: "2020-02-29" } });
  260 |       expect(response.status()).toBe(201);
  261 |       const [rows] = await db.execute<RowDataPacket[]>("SELECT record_type, financial_category_id, amount FROM financial_records WHERE record_number=?", [recordNumber]);
  262 |       expect(rows).toHaveLength(1);
  263 |       expect(rows[0].record_type).toBe(type);
  264 |       expect(String(rows[0].financial_category_id)).toBe(String(category.financial_category_id));
  265 |       expect(Number(rows[0].amount)).toBe(amount);
  266 |     }
  267 |   } finally { await db.end(); }
  268 | });
  269 | 
  270 | test("P25 P26 posted operating surplus excludes separately recorded share capital", async ({ context }) => {
  271 |   const db = await database();
  272 |   try {
  273 |     const tag = `P26-${randomUUID().slice(0, 8)}`;
  274 |     const [users] = await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='bookkeeper.test'");
  275 |     const [cats] = await db.query<RowDataPacket[]>("SELECT financial_category_id,category_code FROM financial_categories WHERE category_code IN ('OTHER_INCOME','OFFICE_SUPPLIES','SHARE_CAPITAL')");
  276 |     for (const [suffix, type, source, code, amount] of [["I", "Income", "Manual", "OTHER_INCOME", 5000], ["E", "Expense", "Manual", "OFFICE_SUPPLIES", 1700], ["C", "Income", "Share Capital", "SHARE_CAPITAL", 1000]] as const) {
  277 |       const category = cats.find(row => row.category_code === code)!;
  278 |       await db.execute("INSERT INTO financial_records(record_number,financial_category_id,recorded_by,approved_by,record_type,source_module,amount,record_date,record_status) VALUES(?,?,?,?,?,?,?,'2020-02-29','Active')", [`${tag}-${suffix}`, category.financial_category_id, users[0].user_id, users[0].user_id, type, source, amount]);
  279 |     }
  280 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT record_type,source_module,amount FROM financial_records WHERE record_number LIKE ?", [`${tag}%`]);
  281 |     expect(rows).toHaveLength(3);
  282 |     await login(context, "chairman");
  283 |     const query = new URLSearchParams({ period: "custom", start: "2020-02-29", end: "2020-02-29", compare: "none", reference: tag });
  284 |     const response = await context.request.get(`${api}/api/chairman/financial-analytics?${query}`);
  285 |     expect(response.status()).toBe(200);
  286 |     const overview = (await response.json()).data.overview;
  287 |     expect(overview).toMatchObject({ income: 5000, expenses: 1700, net: 3300 });
  288 |   } finally { await db.end(); }
  289 | });
  290 | 
  291 | test("P50 analytics endpoints use separate reports and deny member access", async ({ browser }) => {
  292 |   const chairman = await browser.newContext();
  293 |   const member = await browser.newContext();
  294 |   try {
  295 |     await login(chairman, "chairman"); await login(member, "member");
  296 |     const finance = `${api}/api/chairman/financial-analytics`;
  297 |     const membership = `${api}/api/chairman/member-analytics`;
  298 |     const financialReport = await chairman.request.get(finance);
  299 |     const memberReport = await chairman.request.get(membership);
  300 |     expect(financialReport.status()).toBe(200);
  301 |     expect(memberReport.status()).toBe(200);
  302 |     expect((await financialReport.json()).data).toHaveProperty("overview.income");
  303 |     expect((await memberReport.json()).data).not.toHaveProperty("overview.income");
  304 |     expect((await member.request.get(finance)).status()).toBe(403);
  305 |     expect((await member.request.get(membership)).status()).toBe(403);
  306 |   } finally { await chairman.close(); await member.close(); }
  307 | });
  308 | 
  309 | test("P54 repeated member login and logout consistently revoke sessions", async ({ browser }) => {
  310 |   for (let attempt = 0; attempt < 2; attempt++) {
  311 |     const context = await browser.newContext();
  312 |     try {
  313 |       await login(context, "member");
  314 |       expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(200);
  315 |       expect((await context.request.post(`${api}/api/auth/logout`)).status()).toBe(200);
  316 |       expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  317 |     } finally { await context.close(); }
  318 |   }
  319 | });
  320 | 
  321 | test("P27 Bookkeeper edits a category while Chairman cannot edit it", async ({ browser }) => {
  322 |   const db = await database();
  323 |   const bookkeeper = await browser.newContext();
  324 |   const chairman = await browser.newContext();
  325 |   try {
  326 |     await login(bookkeeper, "bookkeeper"); await login(chairman, "chairman");
  327 |     const code = `P27_${randomUUID().slice(0, 8).toUpperCase()}`;
  328 |     const created = await bookkeeper.request.post(`${api}/api/financial-categories`, { data: { categoryCode: code, categoryName: "Synthetic category", categoryType: "Expense", isActive: true } });
  329 |     expect(created.status()).toBe(201);
  330 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT financial_category_id FROM financial_categories WHERE category_code=?", [code]);
  331 |     const id = rows[0].financial_category_id;
  332 |     expect((await chairman.request.patch(`${api}/api/financial-categories/${id}`, { data: { categoryName: "Forbidden" } })).status()).toBe(403);
> 333 |     expect((await bookkeeper.request.patch(`${api}/api/financial-categories/${id}`, { data: { categoryName: "Synthetic updated category" } })).status()).toBe(200);
      |                                                                                                                                                          ^ Error: expect(received).toBe(expected) // Object.is equality
  334 |     const [after] = await db.execute<RowDataPacket[]>("SELECT category_name,category_type FROM financial_categories WHERE financial_category_id=?", [id]);
  335 |     expect(after[0]).toMatchObject({ category_name: "Synthetic updated category", category_type: "Expense" });
  336 |   } finally { await bookkeeper.close(); await chairman.close(); await db.end(); }
  337 | });
  338 | 
```