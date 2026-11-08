# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-database.spec.ts >> P16 configured capital completion deadline matches six-month requirement
- Location: tests\e2e\evidence-database.spec.ts:200:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 6
Received: 1
```

# Test source

```ts
  104 |   expect((await context.request.get(`${api}/api/members/2`)).status()).toBe(403);
  105 |   expect((await context.request.patch(`${api}/api/members/2`, { data: { fullName: "Synthetic forbidden update" } })).status()).toBe(403);
  106 | });
  107 | 
  108 | test("P08 Public pages are reachable while a private backend route is denied", async ({ page, context }) => {
  109 |   await page.goto("/login");
  110 |   await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  111 |   await page.goto("/membership/apply");
  112 |   await expect(page.getByRole("heading", { name: "Become a Member" })).toBeVisible();
  113 |   expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(401);
  114 |   await screenshot(page, "P08-public-application");
  115 | });
  116 | 
  117 | test("P09 Valid synthetic public application persists expected fields", async ({ request }) => {
  118 |   const email = `playwright-${randomUUID()}@example.invalid`;
  119 |   const data = { firstName: "Synthetic", lastName: "Applicant", email, contactNumber: "9171112222", dateOfBirth: "1990-01-02", currentAddress: "Synthetic address", barangay: "Lumbangan", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: "Synthetic Applicant", signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  120 |   const response = await request.post(`${api}/api/membership-applications/public`, { data });
  121 |   expect(response.status()).toBe(201);
  122 |   const code = (await response.json()).data.applicationCode;
  123 |   const db = await database();
  124 |   try {
  125 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT application_code, first_name, last_name, email, application_status FROM membership_applications WHERE application_code=?", [code]);
  126 |     expect(rows).toHaveLength(1);
  127 |     expect(rows[0]).toMatchObject({ application_code: code, first_name: "Synthetic", last_name: "Applicant", email, application_status: "Submitted" });
  128 |   } finally { await db.end(); }
  129 | });
  130 | 
  131 | test("P10 Incomplete membership application is rejected without insertion", async ({ request }) => {
  132 |   const db = await database();
  133 |   try {
  134 |     const [before] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
  135 |     const response = await request.post(`${api}/api/membership-applications/public`, { data: { firstName: "Incomplete" } });
  136 |     expect(response.status()).toBe(400);
  137 |     expect((await response.json()).success).toBe(false);
  138 |     const [after] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
  139 |     expect(after[0].n).toBe(before[0].n);
  140 |   } finally { await db.end(); }
  141 | });
  142 | 
  143 | test("P12 Unauthorized roles cannot approve an application", async ({ browser }) => {
  144 |   const db = await database();
  145 |   const member = await browser.newContext();
  146 |   const bookkeeper = await browser.newContext();
  147 |   try {
  148 |     const [before] = await db.query<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications ORDER BY membership_application_id LIMIT 1");
  149 |     const id = before[0].membership_application_id;
  150 |     await login(member, "member"); await login(bookkeeper, "bookkeeper");
  151 |     for (const context of [member, bookkeeper]) {
  152 |       expect((await context.request.post(`${api}/api/membership-applications/${id}/approve`, { data: {} })).status()).toBe(403);
  153 |     }
  154 |     const [after] = await db.execute<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications WHERE membership_application_id=?", [id]);
  155 |     expect(after[0]).toEqual(before[0]);
  156 |   } finally { await member.close(); await bookkeeper.close(); await db.end(); }
  157 | });
  158 | 
  159 | async function rfmSettings() {
  160 |   const db = await database();
  161 |   try {
  162 |     const [rows] = await db.query<RowDataPacket[]>("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'member_indicators.%'");
  163 |     return configurationFromSettings(new Map(rows.map(row => [String(row.setting_key), String(row.setting_value)])));
  164 |   } finally { await db.end(); }
  165 | }
  166 | 
  167 | test("P43 configured recency scoring at requested boundaries", async () => {
  168 |   const { thresholds } = await rfmSettings();
  169 |   expect([0, 30, 31, 90, 91, 180, 181, 365, 366, null].map(v => scoreRecency(v, thresholds.recencyDays))).toEqual([5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
  170 | });
  171 | 
  172 | test("P44 configured frequency scoring at requested boundaries", async () => {
  173 |   const { thresholds } = await rfmSettings();
  174 |   expect([0, 1, 2, 3, 5, 6, 11, 12].map(v => scoreMinimum(v, thresholds.frequencyCount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  175 | });
  176 | 
  177 | test("P45 configured contribution scoring at requested boundaries", async () => {
  178 |   const { thresholds } = await rfmSettings();
  179 |   expect([0, 0.01, 1499.99, 1500, 2999.99, 3000, 14999.99, 15000].map(v => scoreMinimum(v, thresholds.contributionAmount))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  180 | });
  181 | 
  182 | test("P46 configured combined labels respect score bands", async () => {
  183 |   const settings = await rfmSettings();
  184 |   for (const recencyDays of [null, 365, 180, 90, 30]) for (const frequencyCount of [0, 1, 3, 6, 12]) for (const validatedShareCapital of [0, 1, 1500, 5000, 10000]) {
  185 |     const result = calculateMemberIndicator({ recencyDays, frequencyCount, validatedShareCapital, ...settings });
  186 |     if (!result.inactiveForNoRecentParticipation) expect(result.statusLabel).toBe(result.totalScore >= 12 ? "Active" : result.totalScore >= 7 ? "Needs Monitoring" : "Inactive");
  187 |   }
  188 | });
  189 | 
  190 | test("P47 inactivity safeguard overrides a higher combined label", async () => {
  191 |   const settings = await rfmSettings();
  192 |   for (const recencyDays of [null, 366]) {
  193 |     const result = calculateMemberIndicator({ recencyDays, frequencyCount: 0, validatedShareCapital: 15000, ...settings });
  194 |     expect(result.totalScore).toBeGreaterThanOrEqual(7);
  195 |     expect(result.inactiveForNoRecentParticipation).toBe(true);
  196 |     expect(result.statusLabel).toBe("Inactive");
  197 |   }
  198 | });
  199 | 
  200 | test("P16 configured capital completion deadline matches six-month requirement", async () => {
  201 |   const db = await database();
  202 |   try {
  203 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key=?", ["membership.share_capital_deadline_months"]);
> 204 |     expect(Number(rows[0].setting_value)).toBe(6);
      |                                           ^ Error: expect(received).toBe(expected) // Object.is equality
  205 |   } finally { await db.end(); }
  206 | });
  207 | 
```