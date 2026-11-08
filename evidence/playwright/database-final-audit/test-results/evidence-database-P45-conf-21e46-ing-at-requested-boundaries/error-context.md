# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-database.spec.ts >> P45 configured contribution scoring at requested boundaries
- Location: tests\e2e\evidence-database.spec.ts:218:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 3
+ Received  + 3

  Array [
    1,
+   1,
    2,
-   2,
    3,
    3,
-   4,
-   4,
+   3,
+   5,
    5,
  ]
```

# Test source

```ts
  120 | });
  121 | 
  122 | test("P07 other member cannot read a private document or alter owner records", async ({ browser }) => {
  123 |   const db=await database(), chairman=await browser.newContext(), owner=await browser.newContext(), other=await browser.newContext();
  124 |   try {
  125 |     await login(chairman,"chairman"); await login(owner,"member"); await login(other,"associate");
  126 |     const [members]=await db.query<RowDataPacket[]>("SELECT member_id,full_name FROM member_profiles WHERE member_code='NFFAC-SEED-0001'");
  127 |     const id=String(members[0].member_id), title=`Private fixture ${randomUUID()}`, bytes=Buffer.from("%PDF-1.4\n% synthetic private document\n%%EOF\n");
  128 |     const upload=await chairman.request.post(`${api}/api/documents`,{multipart:{title,category:"OTHER",documentType:"Other",accessLevel:"MEMBER_ONLY",file:{name:"fixture.pdf",mimeType:"application/pdf",buffer:bytes}}}); expect(upload.status()).toBe(201);
  129 |     const [documents]=await db.execute<RowDataPacket[]>("SELECT document_id FROM documents WHERE title=?",[title]); const documentId=String(documents[0].document_id);
  130 |     await db.execute("UPDATE documents SET member_id=? WHERE document_id=?",[id,documentId]);
  131 |     const own=await owner.request.get(`${api}/api/documents/${documentId}/file?action=download`); expect(own.status()).toBe(200); expect(await own.body()).toEqual(bytes);
  132 |     expect((await other.request.get(`${api}/api/documents/${documentId}/file?action=download`)).status()).toBe(404);
  133 |     expect((await other.request.get(`${api}/api/members/${id}`)).status()).toBe(403);
  134 |     expect((await other.request.patch(`${api}/api/members/${id}`,{data:{fullName:"Forbidden Synthetic Change"}})).status()).toBe(403);
  135 |     expect((await other.request.get(`${api}/api/share-capital/member/${id}`)).status()).toBe(403);
  136 |     const [after]=await db.execute<RowDataPacket[]>("SELECT member_id,full_name FROM member_profiles WHERE member_id=?",[id]); expect(after[0]).toEqual(members[0]);
  137 |   } finally { await chairman.close(); await owner.close(); await other.close(); await db.end(); }
  138 | });
  139 | 
  140 | test("P08 Public pages are reachable while a private backend route is denied", async ({ page, context }) => {
  141 |   await page.goto("/login");
  142 |   await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  143 |   await page.goto("/membership/apply");
  144 |   await expect(page.getByRole("heading", { name: "Become a Member" })).toBeVisible();
  145 |   expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(401);
  146 |   await screenshot(page, "P08-public-application");
  147 |   const message = `Synthetic inquiry ${randomUUID()}`;
  148 |   const response = await context.request.post(`${api}/api/requests/public`, { data: { requesterName: "Synthetic Visitor", requestType: "General", message, consent: true } });
  149 |   expect(response.status()).toBe(201);
  150 |   const db = await database();
  151 |   try {
  152 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT message,request_source FROM requests_inquiries WHERE message=?", [message]);
  153 |     expect(rows).toHaveLength(1);
  154 |     expect(rows[0].request_source).toBe("Public Website");
  155 |   } finally { await db.end(); }
  156 | });
  157 | 
  158 | test("P09 Valid synthetic public application persists expected fields", async ({ request }) => {
  159 |   const email = `playwright-${randomUUID()}@example.invalid`;
  160 |   const data = { firstName: "Synthetic", lastName: "Applicant", email, contactNumber: "9171112222", dateOfBirth: "1990-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: "Synthetic Applicant", signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  161 |   const response = await request.post(`${api}/api/membership-applications/public`, { data });
  162 |   expect(response.status()).toBe(201);
  163 |   const code = (await response.json()).data.applicationCode;
  164 |   const db = await database();
  165 |   try {
  166 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT application_code, first_name, last_name, email, application_status FROM membership_applications WHERE application_code=?", [code]);
  167 |     expect(rows).toHaveLength(1);
  168 |     expect(rows[0]).toMatchObject({ application_code: code, first_name: "Synthetic", last_name: "Applicant", email, application_status: "Submitted" });
  169 |   } finally { await db.end(); }
  170 | });
  171 | 
  172 | test("P10 Incomplete membership application is rejected without insertion", async ({ request }) => {
  173 |   const db = await database();
  174 |   try {
  175 |     const [before] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
  176 |     const response = await request.post(`${api}/api/membership-applications/public`, { data: { firstName: "Incomplete" } });
  177 |     expect(response.status()).toBe(400);
  178 |     expect((await response.json()).success).toBe(false);
  179 |     const [after] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
  180 |     expect(after[0].n).toBe(before[0].n);
  181 |   } finally { await db.end(); }
  182 | });
  183 | 
  184 | test("P12 Unauthorized roles cannot approve an application", async ({ browser }) => {
  185 |   const db = await database();
  186 |   const member = await browser.newContext();
  187 |   const bookkeeper = await browser.newContext();
  188 |   try {
  189 |     const [before] = await db.query<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications ORDER BY membership_application_id LIMIT 1");
  190 |     const id = before[0].membership_application_id;
  191 |     await login(member, "member"); await login(bookkeeper, "bookkeeper");
  192 |     for (const context of [member, bookkeeper]) {
  193 |       expect((await context.request.post(`${api}/api/membership-applications/${id}/approve`, { data: {} })).status()).toBe(403);
  194 |     }
  195 |     const [after] = await db.execute<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications WHERE membership_application_id=?", [id]);
  196 |     expect(after[0]).toEqual(before[0]);
  197 |   } finally { await member.close(); await bookkeeper.close(); await db.end(); }
  198 | });
  199 | 
  200 | async function rfmSettings() {
  201 |   const db = await database();
  202 |   try {
  203 |     const [rows] = await db.query<RowDataPacket[]>("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'member_indicators.%'");
  204 |     return configurationFromSettings(new Map(rows.map(row => [String(row.setting_key), String(row.setting_value)])));
  205 |   } finally { await db.end(); }
  206 | }
  207 | 
  208 | test("P43 configured recency scoring at requested boundaries", async () => {
  209 |   const { thresholds } = await rfmSettings();
  210 |   expect([0, 30, 31, 90, 91, 180, 181, 365, 366, null].map(v => scoreRecency(v, thresholds.recencyDays))).toEqual([5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
  211 | });
  212 | 
  213 | test("P44 configured frequency scoring at requested boundaries", async () => {
  214 |   const { thresholds } = await rfmSettings();
  215 |   expect([0, 1, 2, 3, 5, 6, 11, 12].map(v => scoreMinimum(v, thresholds.frequencyCount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  216 | });
  217 | 
  218 | test("P45 configured contribution scoring at requested boundaries", async () => {
  219 |   const { thresholds } = await rfmSettings();
> 220 |   expect([0, 0.01, 1499.99, 1500, 2999.99, 3000, 14999.99, 15000].map(v => scoreMinimum(v, thresholds.contributionAmount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
      |                                                                                                                             ^ Error: expect(received).toEqual(expected) // deep equality
  221 | });
  222 | 
  223 | test("P46 configured combined labels respect score bands", async () => {
  224 |   const settings = await rfmSettings();
  225 |   for (const recencyDays of [null, 365, 180, 90, 30]) for (const frequencyCount of [0, 1, 3, 6, 12]) for (const validatedShareCapital of [0, 1, 1500, 5000, 10000]) {
  226 |     const result = calculateMemberIndicator({ recencyDays, frequencyCount, validatedShareCapital, ...settings });
  227 |     if (!result.inactiveForNoRecentParticipation) expect(result.statusLabel).toBe(result.totalScore >= 12 ? "Active" : result.totalScore >= 7 ? "Needs Monitoring" : "Inactive");
  228 |   }
  229 | });
  230 | 
  231 | test("P47 inactivity safeguard overrides a higher combined label", async () => {
  232 |   const settings = await rfmSettings();
  233 |   for (const recencyDays of [null, 366]) {
  234 |     const result = calculateMemberIndicator({ recencyDays, frequencyCount: 0, validatedShareCapital: 15000, ...settings });
  235 |     expect(result.totalScore).toBeGreaterThanOrEqual(7);
  236 |     expect(result.inactiveForNoRecentParticipation).toBe(true);
  237 |     expect(result.statusLabel).toBe("Inactive");
  238 |   }
  239 | });
  240 | 
  241 | test("P16 configured capital completion deadline matches six-month requirement", async () => {
  242 |   const db = await database();
  243 |   try {
  244 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key=?", ["membership.share_capital_deadline_months"]);
  245 |     expect(Number(rows[0].setting_value)).toBe(6);
  246 |   } finally { await db.end(); }
  247 | });
  248 | 
  249 | test("P48 RFM recalculation does not change official membership status", async ({ context }) => {
  250 |   const db = await database();
  251 |   try {
  252 |     const [before] = await db.query<RowDataPacket[]>("SELECT member_id,official_member_status FROM member_profiles WHERE member_code='NFFAC-SEED-0001'");
  253 |     const memberId = String(before[0].member_id);
  254 |     await login(context, "chairman");
  255 |     const data = { memberId, basisPeriodEnd: "2026-10-31" };
  256 |     const preview = await context.request.post(`${api}/api/member-indicators/workspace/preview`, { data });
  257 |     expect(preview.status()).toBe(200);
  258 |     const fingerprint = (await preview.json()).data.previewFingerprint;
  259 |     expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  260 |     const commit = await context.request.post(`${api}/api/member-indicators/workspace/recalculate`, { data: { ...data, confirmed: true, previewFingerprint: fingerprint } });
  261 |     expect(commit.status()).toBe(200);
  262 |     const [after] = await db.execute<RowDataPacket[]>("SELECT member_id,official_member_status FROM member_profiles WHERE member_id=?", [memberId]);
  263 |     expect(after[0]).toEqual(before[0]);
  264 |     const [indicators] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM member_status_indicators WHERE member_id=? AND basis_period_end=?", [memberId, data.basisPeriodEnd]);
  265 |     expect(Number(indicators[0].n)).toBeGreaterThan(0);
  266 |   } finally { await db.end(); }
  267 | });
  268 | 
  269 | test("P24 Bookkeeper saves classified income and expense records", async ({ context }) => {
  270 |   const db = await database();
  271 |   try {
  272 |     await login(context, "bookkeeper");
  273 |     const tag = `P24-${randomUUID().slice(0, 8)}`;
  274 |     const [cats] = await db.query<RowDataPacket[]>("SELECT financial_category_id,category_code FROM financial_categories WHERE category_code IN ('OTHER_INCOME','OFFICE_SUPPLIES')");
  275 |     for (const [suffix, type, code, amount] of [["I", "Income", "OTHER_INCOME", 5000], ["E", "Expense", "OFFICE_SUPPLIES", 1700]] as const) {
  276 |       const category = cats.find(row => row.category_code === code)!;
  277 |       const recordNumber = `${tag}-${suffix}`;
  278 |       const response = await context.request.post(`${api}/api/financial-records`, { data: { recordNumber, financialCategoryId: String(category.financial_category_id), recordType: type, sourceModule: "Manual", amount, recordDate: "2020-02-29" } });
  279 |       expect(response.status()).toBe(201);
  280 |       const [rows] = await db.execute<RowDataPacket[]>("SELECT record_type, financial_category_id, amount FROM financial_records WHERE record_number=?", [recordNumber]);
  281 |       expect(rows).toHaveLength(1);
  282 |       expect(rows[0].record_type).toBe(type);
  283 |       expect(String(rows[0].financial_category_id)).toBe(String(category.financial_category_id));
  284 |       expect(Number(rows[0].amount)).toBe(amount);
  285 |     }
  286 |   } finally { await db.end(); }
  287 | });
  288 | 
  289 | test("P25 P26 posted operating surplus excludes separately recorded share capital", async ({ context }) => {
  290 |   const db = await database();
  291 |   try {
  292 |     const tag = `P26-${randomUUID().slice(0, 8)}`;
  293 |     const [users] = await db.query<RowDataPacket[]>("SELECT user_id FROM users WHERE username='bookkeeper.test'");
  294 |     await db.query("INSERT IGNORE INTO financial_categories(category_code,category_name,category_type,is_system_category,is_active) VALUES('INTERNAL_TRANSFER','Synthetic Internal Transfer','Income',0,1),('CAPITAL_EXPENDITURE','Synthetic Capital Expenditure','Expense',0,1)");
  295 |     const [cats] = await db.query<RowDataPacket[]>("SELECT financial_category_id,category_code FROM financial_categories WHERE category_code IN ('OTHER_INCOME','OFFICE_SUPPLIES','SHARE_CAPITAL','INTERNAL_TRANSFER','CAPITAL_EXPENDITURE')");
  296 |     for (const [suffix, type, source, code, amount] of [["I", "Income", "Manual", "OTHER_INCOME", 5000], ["E", "Expense", "Manual", "OFFICE_SUPPLIES", 1700], ["C", "Income", "Share Capital", "SHARE_CAPITAL", 1000], ["T", "Income", "Manual", "INTERNAL_TRANSFER", 400], ["X", "Expense", "Manual", "CAPITAL_EXPENDITURE", 500]] as const) {
  297 |       const category = cats.find(row => row.category_code === code)!;
  298 |       await db.execute("INSERT INTO financial_records(record_number,financial_category_id,recorded_by,approved_by,record_type,source_module,amount,record_date,record_status) VALUES(?,?,?,?,?,?,?,'2020-02-29','Active')", [`${tag}-${suffix}`, category.financial_category_id, users[0].user_id, users[0].user_id, type, source, amount]);
  299 |     }
  300 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT record_type,source_module,amount FROM financial_records WHERE record_number LIKE ?", [`${tag}%`]);
  301 |     expect(rows).toHaveLength(5);
  302 |     await login(context, "chairman");
  303 |     const query = new URLSearchParams({ period: "custom", start: "2020-02-29", end: "2020-02-29", compare: "none", reference: tag });
  304 |     const response = await context.request.get(`${api}/api/chairman/financial-analytics?${query}`);
  305 |     expect(response.status()).toBe(200);
  306 |     const overview = (await response.json()).data.overview;
  307 |     expect(overview).toMatchObject({ income: 5000, expenses: 1700, net: 3300 });
  308 |   } finally { await db.end(); }
  309 | });
  310 | 
  311 | test("P50 analytics endpoints use separate reports and deny member access", async ({ browser }) => {
  312 |   const chairman = await browser.newContext();
  313 |   const member = await browser.newContext();
  314 |   try {
  315 |     await login(chairman, "chairman"); await login(member, "member");
  316 |     const finance = `${api}/api/chairman/financial-analytics`;
  317 |     const membership = `${api}/api/chairman/member-analytics`;
  318 |     const financialReport = await chairman.request.get(finance);
  319 |     const memberReport = await chairman.request.get(membership);
  320 |     expect(financialReport.status()).toBe(200);
```