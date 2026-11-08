# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-database.spec.ts >> P16 configured capital completion deadline matches six-month requirement
- Location: tests\e2e\evidence-database.spec.ts:223:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 6
Received: 1
```

# Test source

```ts
  127 |   expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(401);
  128 |   await screenshot(page, "P08-public-application");
  129 |   const message = `Synthetic inquiry ${randomUUID()}`;
  130 |   const response = await context.request.post(`${api}/api/requests/public`, { data: { requesterName: "Synthetic Visitor", requestType: "General", message, consent: true } });
  131 |   expect(response.status()).toBe(201);
  132 |   const db = await database();
  133 |   try {
  134 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT message,request_source FROM requests_inquiries WHERE message=?", [message]);
  135 |     expect(rows).toHaveLength(1);
  136 |     expect(rows[0].request_source).toBe("Public Website");
  137 |   } finally { await db.end(); }
  138 | });
  139 | 
  140 | test("P09 Valid synthetic public application persists expected fields", async ({ request }) => {
  141 |   const email = `playwright-${randomUUID()}@example.invalid`;
  142 |   const data = { firstName: "Synthetic", lastName: "Applicant", email, contactNumber: "9171112222", dateOfBirth: "1990-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: "Synthetic Applicant", signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  143 |   const response = await request.post(`${api}/api/membership-applications/public`, { data });
  144 |   expect(response.status()).toBe(201);
  145 |   const code = (await response.json()).data.applicationCode;
  146 |   const db = await database();
  147 |   try {
  148 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT application_code, first_name, last_name, email, application_status FROM membership_applications WHERE application_code=?", [code]);
  149 |     expect(rows).toHaveLength(1);
  150 |     expect(rows[0]).toMatchObject({ application_code: code, first_name: "Synthetic", last_name: "Applicant", email, application_status: "Submitted" });
  151 |   } finally { await db.end(); }
  152 | });
  153 | 
  154 | test("P10 Incomplete membership application is rejected without insertion", async ({ request }) => {
  155 |   const db = await database();
  156 |   try {
  157 |     const [before] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
  158 |     const response = await request.post(`${api}/api/membership-applications/public`, { data: { firstName: "Incomplete" } });
  159 |     expect(response.status()).toBe(400);
  160 |     expect((await response.json()).success).toBe(false);
  161 |     const [after] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
  162 |     expect(after[0].n).toBe(before[0].n);
  163 |   } finally { await db.end(); }
  164 | });
  165 | 
  166 | test("P12 Unauthorized roles cannot approve an application", async ({ browser }) => {
  167 |   const db = await database();
  168 |   const member = await browser.newContext();
  169 |   const bookkeeper = await browser.newContext();
  170 |   try {
  171 |     const [before] = await db.query<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications ORDER BY membership_application_id LIMIT 1");
  172 |     const id = before[0].membership_application_id;
  173 |     await login(member, "member"); await login(bookkeeper, "bookkeeper");
  174 |     for (const context of [member, bookkeeper]) {
  175 |       expect((await context.request.post(`${api}/api/membership-applications/${id}/approve`, { data: {} })).status()).toBe(403);
  176 |     }
  177 |     const [after] = await db.execute<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications WHERE membership_application_id=?", [id]);
  178 |     expect(after[0]).toEqual(before[0]);
  179 |   } finally { await member.close(); await bookkeeper.close(); await db.end(); }
  180 | });
  181 | 
  182 | async function rfmSettings() {
  183 |   const db = await database();
  184 |   try {
  185 |     const [rows] = await db.query<RowDataPacket[]>("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'member_indicators.%'");
  186 |     return configurationFromSettings(new Map(rows.map(row => [String(row.setting_key), String(row.setting_value)])));
  187 |   } finally { await db.end(); }
  188 | }
  189 | 
  190 | test("P43 configured recency scoring at requested boundaries", async () => {
  191 |   const { thresholds } = await rfmSettings();
  192 |   expect([0, 30, 31, 90, 91, 180, 181, 365, 366, null].map(v => scoreRecency(v, thresholds.recencyDays))).toEqual([5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
  193 | });
  194 | 
  195 | test("P44 configured frequency scoring at requested boundaries", async () => {
  196 |   const { thresholds } = await rfmSettings();
  197 |   expect([0, 1, 2, 3, 5, 6, 11, 12].map(v => scoreMinimum(v, thresholds.frequencyCount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  198 | });
  199 | 
  200 | test("P45 configured contribution scoring at requested boundaries", async () => {
  201 |   const { thresholds } = await rfmSettings();
  202 |   expect([0, 0.01, 1499.99, 1500, 2999.99, 3000, 14999.99, 15000].map(v => scoreMinimum(v, thresholds.contributionAmount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  203 | });
  204 | 
  205 | test("P46 configured combined labels respect score bands", async () => {
  206 |   const settings = await rfmSettings();
  207 |   for (const recencyDays of [null, 365, 180, 90, 30]) for (const frequencyCount of [0, 1, 3, 6, 12]) for (const validatedShareCapital of [0, 1, 1500, 5000, 10000]) {
  208 |     const result = calculateMemberIndicator({ recencyDays, frequencyCount, validatedShareCapital, ...settings });
  209 |     if (!result.inactiveForNoRecentParticipation) expect(result.statusLabel).toBe(result.totalScore >= 12 ? "Active" : result.totalScore >= 7 ? "Needs Monitoring" : "Inactive");
  210 |   }
  211 | });
  212 | 
  213 | test("P47 inactivity safeguard overrides a higher combined label", async () => {
  214 |   const settings = await rfmSettings();
  215 |   for (const recencyDays of [null, 366]) {
  216 |     const result = calculateMemberIndicator({ recencyDays, frequencyCount: 0, validatedShareCapital: 15000, ...settings });
  217 |     expect(result.totalScore).toBeGreaterThanOrEqual(7);
  218 |     expect(result.inactiveForNoRecentParticipation).toBe(true);
  219 |     expect(result.statusLabel).toBe("Inactive");
  220 |   }
  221 | });
  222 | 
  223 | test("P16 configured capital completion deadline matches six-month requirement", async () => {
  224 |   const db = await database();
  225 |   try {
  226 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key=?", ["membership.share_capital_deadline_months"]);
> 227 |     expect(Number(rows[0].setting_value)).toBe(6);
      |                                           ^ Error: expect(received).toBe(expected) // Object.is equality
  228 |   } finally { await db.end(); }
  229 | });
  230 | 
  231 | test("P48 RFM recalculation does not change official membership status", async ({ context }) => {
  232 |   const db = await database();
  233 |   try {
  234 |     const [before] = await db.query<RowDataPacket[]>("SELECT member_id,official_member_status FROM member_profiles WHERE member_code='NFFAC-SEED-0001'");
  235 |     const memberId = String(before[0].member_id);
  236 |     await login(context, "chairman");
  237 |     const data = { memberId, basisPeriodEnd: "2026-10-31" };
  238 |     const preview = await context.request.post(`${api}/api/member-indicators/workspace/preview`, { data });
  239 |     expect(preview.status()).toBe(200);
  240 |     const fingerprint = (await preview.json()).data.previewFingerprint;
  241 |     expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  242 |     const commit = await context.request.post(`${api}/api/member-indicators/workspace/recalculate`, { data: { ...data, confirmed: true, previewFingerprint: fingerprint } });
  243 |     expect(commit.status()).toBe(200);
  244 |     const [after] = await db.execute<RowDataPacket[]>("SELECT member_id,official_member_status FROM member_profiles WHERE member_id=?", [memberId]);
  245 |     expect(after[0]).toEqual(before[0]);
  246 |     const [indicators] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM member_status_indicators WHERE member_id=? AND basis_period_end=?", [memberId, data.basisPeriodEnd]);
  247 |     expect(Number(indicators[0].n)).toBeGreaterThan(0);
  248 |   } finally { await db.end(); }
  249 | });
  250 | 
  251 | test("P24 Bookkeeper saves classified income and expense records", async ({ context }) => {
  252 |   const db = await database();
  253 |   try {
  254 |     await login(context, "bookkeeper");
  255 |     const tag = `P24-${randomUUID().slice(0, 8)}`;
  256 |     const [cats] = await db.query<RowDataPacket[]>("SELECT financial_category_id,category_code FROM financial_categories WHERE category_code IN ('OTHER_INCOME','OFFICE_SUPPLIES')");
  257 |     for (const [suffix, type, code, amount] of [["I", "Income", "OTHER_INCOME", 5000], ["E", "Expense", "OFFICE_SUPPLIES", 1700]] as const) {
  258 |       const category = cats.find(row => row.category_code === code)!;
  259 |       const recordNumber = `${tag}-${suffix}`;
  260 |       const response = await context.request.post(`${api}/api/financial-records`, { data: { recordNumber, financialCategoryId: String(category.financial_category_id), recordType: type, sourceModule: "Manual", amount, recordDate: "2020-02-29" } });
  261 |       expect(response.status()).toBe(201);
  262 |       const [rows] = await db.execute<RowDataPacket[]>("SELECT record_type, financial_category_id, amount FROM financial_records WHERE record_number=?", [recordNumber]);
  263 |       expect(rows).toHaveLength(1);
  264 |       expect(rows[0].record_type).toBe(type);
  265 |       expect(String(rows[0].financial_category_id)).toBe(String(category.financial_category_id));
  266 |       expect(Number(rows[0].amount)).toBe(amount);
  267 |     }
  268 |   } finally { await db.end(); }
  269 | });
  270 | 
  271 | test("P25 P26 posted operating surplus excludes separately recorded share capital", async ({ context }) => {
  272 |   const db = await database();
  273 |   try {
  274 |     const tag = `P26-${randomUUID().slice(0, 8)}`;
  275 |     const [users] = await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='bookkeeper.test'");
  276 |     const [cats] = await db.query<RowDataPacket[]>("SELECT financial_category_id,category_code FROM financial_categories WHERE category_code IN ('OTHER_INCOME','OFFICE_SUPPLIES','SHARE_CAPITAL')");
  277 |     for (const [suffix, type, source, code, amount] of [["I", "Income", "Manual", "OTHER_INCOME", 5000], ["E", "Expense", "Manual", "OFFICE_SUPPLIES", 1700], ["C", "Income", "Share Capital", "SHARE_CAPITAL", 1000]] as const) {
  278 |       const category = cats.find(row => row.category_code === code)!;
  279 |       await db.execute("INSERT INTO financial_records(record_number,financial_category_id,recorded_by,approved_by,record_type,source_module,amount,record_date,record_status) VALUES(?,?,?,?,?,?,?,'2020-02-29','Active')", [`${tag}-${suffix}`, category.financial_category_id, users[0].user_id, users[0].user_id, type, source, amount]);
  280 |     }
  281 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT record_type,source_module,amount FROM financial_records WHERE record_number LIKE ?", [`${tag}%`]);
  282 |     expect(rows).toHaveLength(3);
  283 |     await login(context, "chairman");
  284 |     const query = new URLSearchParams({ period: "custom", start: "2020-02-29", end: "2020-02-29", compare: "none", reference: tag });
  285 |     const response = await context.request.get(`${api}/api/chairman/financial-analytics?${query}`);
  286 |     expect(response.status()).toBe(200);
  287 |     const overview = (await response.json()).data.overview;
  288 |     expect(overview).toMatchObject({ income: 5000, expenses: 1700, net: 3300 });
  289 |   } finally { await db.end(); }
  290 | });
  291 | 
  292 | test("P50 analytics endpoints use separate reports and deny member access", async ({ browser }) => {
  293 |   const chairman = await browser.newContext();
  294 |   const member = await browser.newContext();
  295 |   try {
  296 |     await login(chairman, "chairman"); await login(member, "member");
  297 |     const finance = `${api}/api/chairman/financial-analytics`;
  298 |     const membership = `${api}/api/chairman/member-analytics`;
  299 |     const financialReport = await chairman.request.get(finance);
  300 |     const memberReport = await chairman.request.get(membership);
  301 |     expect(financialReport.status()).toBe(200);
  302 |     expect(memberReport.status()).toBe(200);
  303 |     expect((await financialReport.json()).data).toHaveProperty("overview.income");
  304 |     expect((await memberReport.json()).data).not.toHaveProperty("overview.income");
  305 |     expect((await member.request.get(finance)).status()).toBe(403);
  306 |     expect((await member.request.get(membership)).status()).toBe(403);
  307 |   } finally { await chairman.close(); await member.close(); }
  308 | });
  309 | 
  310 | test("P54 repeated member login and logout consistently revoke sessions", async ({ browser }) => {
  311 |   for (let attempt = 0; attempt < 2; attempt++) {
  312 |     const context = await browser.newContext();
  313 |     try {
  314 |       await login(context, "member");
  315 |       expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(200);
  316 |       expect((await context.request.post(`${api}/api/auth/logout`)).status()).toBe(200);
  317 |       expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  318 |     } finally { await context.close(); }
  319 |   }
  320 | });
  321 | 
  322 | test("P36 authorized document upload persists metadata and retrieves bytes", async ({ context }) => {
  323 |   const db = await database();
  324 |   try {
  325 |     await login(context, "chairman");
  326 |     const title = `Synthetic P36 ${randomUUID()}`;
  327 |     const bytes = Buffer.from("%PDF-1.4\n% synthetic document\n%%EOF\n");
```