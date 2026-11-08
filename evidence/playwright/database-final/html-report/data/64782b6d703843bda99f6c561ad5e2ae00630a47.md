# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-database.spec.ts >> P16 configured capital completion deadline matches six-month requirement
- Location: tests\e2e\evidence-database.spec.ts:222:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 6
Received: 1
```

# Test source

```ts
  126 |   expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(401);
  127 |   await screenshot(page, "P08-public-application");
  128 |   const message = `Synthetic inquiry ${randomUUID()}`;
  129 |   const response = await context.request.post(`${api}/api/requests/public`, { data: { requesterName: "Synthetic Visitor", requestType: "General", message, consent: true } });
  130 |   expect(response.status()).toBe(201);
  131 |   const db = await database();
  132 |   try {
  133 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT message,request_source FROM requests_inquiries WHERE message=?", [message]);
  134 |     expect(rows).toHaveLength(1);
  135 |     expect(rows[0].request_source).toBe("Public Website");
  136 |   } finally { await db.end(); }
  137 | });
  138 | 
  139 | test("P09 Valid synthetic public application persists expected fields", async ({ request }) => {
  140 |   const email = `playwright-${randomUUID()}@example.invalid`;
  141 |   const data = { firstName: "Synthetic", lastName: "Applicant", email, contactNumber: "9171112222", dateOfBirth: "1990-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: "Synthetic Applicant", signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  142 |   const response = await request.post(`${api}/api/membership-applications/public`, { data });
  143 |   expect(response.status()).toBe(201);
  144 |   const code = (await response.json()).data.applicationCode;
  145 |   const db = await database();
  146 |   try {
  147 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT application_code, first_name, last_name, email, application_status FROM membership_applications WHERE application_code=?", [code]);
  148 |     expect(rows).toHaveLength(1);
  149 |     expect(rows[0]).toMatchObject({ application_code: code, first_name: "Synthetic", last_name: "Applicant", email, application_status: "Submitted" });
  150 |   } finally { await db.end(); }
  151 | });
  152 | 
  153 | test("P10 Incomplete membership application is rejected without insertion", async ({ request }) => {
  154 |   const db = await database();
  155 |   try {
  156 |     const [before] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
  157 |     const response = await request.post(`${api}/api/membership-applications/public`, { data: { firstName: "Incomplete" } });
  158 |     expect(response.status()).toBe(400);
  159 |     expect((await response.json()).success).toBe(false);
  160 |     const [after] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
  161 |     expect(after[0].n).toBe(before[0].n);
  162 |   } finally { await db.end(); }
  163 | });
  164 | 
  165 | test("P12 Unauthorized roles cannot approve an application", async ({ browser }) => {
  166 |   const db = await database();
  167 |   const member = await browser.newContext();
  168 |   const bookkeeper = await browser.newContext();
  169 |   try {
  170 |     const [before] = await db.query<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications ORDER BY membership_application_id LIMIT 1");
  171 |     const id = before[0].membership_application_id;
  172 |     await login(member, "member"); await login(bookkeeper, "bookkeeper");
  173 |     for (const context of [member, bookkeeper]) {
  174 |       expect((await context.request.post(`${api}/api/membership-applications/${id}/approve`, { data: {} })).status()).toBe(403);
  175 |     }
  176 |     const [after] = await db.execute<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications WHERE membership_application_id=?", [id]);
  177 |     expect(after[0]).toEqual(before[0]);
  178 |   } finally { await member.close(); await bookkeeper.close(); await db.end(); }
  179 | });
  180 | 
  181 | async function rfmSettings() {
  182 |   const db = await database();
  183 |   try {
  184 |     const [rows] = await db.query<RowDataPacket[]>("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'member_indicators.%'");
  185 |     return configurationFromSettings(new Map(rows.map(row => [String(row.setting_key), String(row.setting_value)])));
  186 |   } finally { await db.end(); }
  187 | }
  188 | 
  189 | test("P43 configured recency scoring at requested boundaries", async () => {
  190 |   const { thresholds } = await rfmSettings();
  191 |   expect([0, 30, 31, 90, 91, 180, 181, 365, 366, null].map(v => scoreRecency(v, thresholds.recencyDays))).toEqual([5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
  192 | });
  193 | 
  194 | test("P44 configured frequency scoring at requested boundaries", async () => {
  195 |   const { thresholds } = await rfmSettings();
  196 |   expect([0, 1, 2, 3, 5, 6, 11, 12].map(v => scoreMinimum(v, thresholds.frequencyCount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  197 | });
  198 | 
  199 | test("P45 configured contribution scoring at requested boundaries", async () => {
  200 |   const { thresholds } = await rfmSettings();
  201 |   expect([0, 0.01, 1499.99, 1500, 2999.99, 3000, 14999.99, 15000].map(v => scoreMinimum(v, thresholds.contributionAmount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  202 | });
  203 | 
  204 | test("P46 configured combined labels respect score bands", async () => {
  205 |   const settings = await rfmSettings();
  206 |   for (const recencyDays of [null, 365, 180, 90, 30]) for (const frequencyCount of [0, 1, 3, 6, 12]) for (const validatedShareCapital of [0, 1, 1500, 5000, 10000]) {
  207 |     const result = calculateMemberIndicator({ recencyDays, frequencyCount, validatedShareCapital, ...settings });
  208 |     if (!result.inactiveForNoRecentParticipation) expect(result.statusLabel).toBe(result.totalScore >= 12 ? "Active" : result.totalScore >= 7 ? "Needs Monitoring" : "Inactive");
  209 |   }
  210 | });
  211 | 
  212 | test("P47 inactivity safeguard overrides a higher combined label", async () => {
  213 |   const settings = await rfmSettings();
  214 |   for (const recencyDays of [null, 366]) {
  215 |     const result = calculateMemberIndicator({ recencyDays, frequencyCount: 0, validatedShareCapital: 15000, ...settings });
  216 |     expect(result.totalScore).toBeGreaterThanOrEqual(7);
  217 |     expect(result.inactiveForNoRecentParticipation).toBe(true);
  218 |     expect(result.statusLabel).toBe("Inactive");
  219 |   }
  220 | });
  221 | 
  222 | test("P16 configured capital completion deadline matches six-month requirement", async () => {
  223 |   const db = await database();
  224 |   try {
  225 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key=?", ["membership.share_capital_deadline_months"]);
> 226 |     expect(Number(rows[0].setting_value)).toBe(6);
      |                                           ^ Error: expect(received).toBe(expected) // Object.is equality
  227 |   } finally { await db.end(); }
  228 | });
  229 | 
  230 | test("P48 RFM recalculation does not change official membership status", async ({ context }) => {
  231 |   const db = await database();
  232 |   try {
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
```