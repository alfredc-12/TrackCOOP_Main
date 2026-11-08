# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-database.spec.ts >> P09 Valid synthetic public application persists expected fields
- Location: tests\e2e\evidence-database.spec.ts:115:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 400
```

# Test source

```ts
  19  |   await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? "database-run"}/screenshots/${name}.png`, fullPage: true });
  20  | }
  21  | 
  22  | async function database() {
  23  |   const connection = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  24  |   const [rows] = await connection.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  25  |   const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  26  |   if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) {
  27  |     await connection.end();
  28  |     throw new Error("Refusing an unverified database target");
  29  |   }
  30  |   return connection;
  31  | }
  32  | 
  33  | test.beforeAll(async () => { const db = await database(); await db.end(); });
  34  | 
  35  | test("P01 Chairman login grants authenticated member directory access", async ({ context, page }) => {
  36  |   await login(context, "chairman");
  37  |   expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(200);
  38  |   expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(200);
  39  |   await page.goto("/portal/chairman/dashboard");
  40  |   await expect(page).toHaveURL(/\/portal\/chairman\/dashboard/);
  41  |   await expect(page.locator("main")).toBeVisible();
  42  |   await screenshot(page, "P01-chairman-dashboard");
  43  | });
  44  | 
  45  | test("P02 Bookkeeper login grants financial category access", async ({ context, page }) => {
  46  |   await login(context, "bookkeeper");
  47  |   expect((await context.request.get(`${api}/api/financial-categories`)).status()).toBe(200);
  48  |   await page.goto("/portal/bookkeeper/financial-dashboard");
  49  |   await expect(page).toHaveURL(/\/portal\/bookkeeper\/financial-dashboard/);
  50  |   await expect(page.locator("main")).toBeVisible();
  51  |   await screenshot(page, "P02-bookkeeper-dashboard");
  52  | });
  53  | 
  54  | test("P03 Member login grants access to own profile", async ({ context, page }) => {
  55  |   await login(context, "member");
  56  |   const profile = await context.request.get(`${api}/api/members/me/profile`);
  57  |   expect(profile.status()).toBe(200);
  58  |   expect((await profile.json()).email).toBe("maria.member@trackcoop.local");
  59  |   await page.goto("/portal/member/dashboard");
  60  |   await expect(page).toHaveURL(/\/portal\/member\/dashboard/);
  61  |   await expect(page.locator("main")).toBeVisible();
  62  |   await screenshot(page, "P03-member-dashboard");
  63  | });
  64  | 
  65  | test("P04 Invalid credentials are rejected with feedback", async ({ context, page }) => {
  66  |   await page.goto("/login");
  67  |   await page.getByLabel("Email or username", { exact: true }).fill("nobody.evidence@example.invalid");
  68  |   await page.getByLabel("Password", { exact: true }).fill("WrongPassword123!");
  69  |   await page.getByRole("button", { name: "Sign in to account" }).click();
  70  |   await expect(page.getByRole("region", { name: "Account sign in" }).getByRole("alert")).toContainText(/incorrect/i);
  71  |   expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  72  |   await screenshot(page, "P04-invalid-login");
  73  | });
  74  | 
  75  | test("P05 Logout revokes the existing server session", async ({ context, browser }) => {
  76  |   await login(context, "member");
  77  |   const cookie = (await context.cookies(api)).find(c => c.name === "trackcoop_session");
  78  |   expect(cookie).toBeTruthy();
  79  |   expect((await context.request.post(`${api}/api/auth/logout`)).status()).toBe(200);
  80  |   expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  81  |   const replay = await browser.newContext();
  82  |   await replay.addCookies([cookie!]);
  83  |   expect((await replay.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  84  |   await replay.close();
  85  | });
  86  | 
  87  | test("P06 Member and bookkeeper are denied restricted backend operations", async ({ browser }) => {
  88  |   const member = await browser.newContext();
  89  |   const bookkeeper = await browser.newContext();
  90  |   try {
  91  |     await login(member, "member");
  92  |     await login(bookkeeper, "bookkeeper");
  93  |     expect((await member.request.get(`${api}/api/members/summary`)).status()).toBe(403);
  94  |     expect((await member.request.post(`${api}/api/financial-records`, { data: {} })).status()).toBe(403);
  95  |     expect((await bookkeeper.request.get(`${api}/api/members/summary`)).status()).toBe(403);
  96  |     expect((await bookkeeper.request.post(`${api}/api/members`, { data: {} })).status()).toBe(403);
  97  |   } finally { await member.close(); await bookkeeper.close(); }
  98  | });
  99  | 
  100 | test("P07 Member cannot read or alter another member through staff record routes", async ({ context }) => {
  101 |   await login(context, "member");
  102 |   expect((await context.request.get(`${api}/api/members/2`)).status()).toBe(403);
  103 |   expect((await context.request.patch(`${api}/api/members/2`, { data: { fullName: "Synthetic forbidden update" } })).status()).toBe(403);
  104 | });
  105 | 
  106 | test("P08 Public pages are reachable while a private backend route is denied", async ({ page, context }) => {
  107 |   await page.goto("/login");
  108 |   await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  109 |   await page.goto("/membership/apply");
  110 |   await expect(page.getByRole("heading", { name: "Become a Member" })).toBeVisible();
  111 |   expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(401);
  112 |   await screenshot(page, "P08-public-application");
  113 | });
  114 | 
  115 | test("P09 Valid synthetic public application persists expected fields", async ({ request }) => {
  116 |   const email = `playwright-${randomUUID()}@example.invalid`;
  117 |   const data = { firstName: "Synthetic", lastName: "Applicant", email, contactNumber: "9171112222", dateOfBirth: "1990-01-02", currentAddress: "Synthetic address", municipality: "Nasugbu", province: "Batangas", sector: "Rice", fatherName: "Synthetic Father", motherName: "Synthetic Mother", occupation: "Farmer", orientationCommitmentAccepted: true, membershipFeeCommitmentAccepted: true, shareSubscriptionCommitmentAccepted: true, bylawsAgreementAccepted: true, privacyConsentAccepted: true, applicantSignatureName: "Synthetic Applicant", signedAt: "2026-01-01", signedPlace: "Nasugbu" };
  118 |   const response = await request.post(`${api}/api/membership-applications/public`, { data });
> 119 |   expect(response.status()).toBe(201);
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  120 |   const code = (await response.json()).data.applicationCode;
  121 |   const db = await database();
  122 |   try {
  123 |     const [rows] = await db.execute<RowDataPacket[]>("SELECT application_code, first_name, last_name, email, application_status FROM membership_applications WHERE application_code=?", [code]);
  124 |     expect(rows).toHaveLength(1);
  125 |     expect(rows[0]).toMatchObject({ application_code: code, first_name: "Synthetic", last_name: "Applicant", email, application_status: "Submitted" });
  126 |   } finally { await db.end(); }
  127 | });
  128 | 
  129 | test("P10 Incomplete membership application is rejected without insertion", async ({ request }) => {
  130 |   const db = await database();
  131 |   try {
  132 |     const [before] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
  133 |     const response = await request.post(`${api}/api/membership-applications/public`, { data: { firstName: "Incomplete" } });
  134 |     expect(response.status()).toBe(400);
  135 |     expect((await response.json()).success).toBe(false);
  136 |     const [after] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM membership_applications");
  137 |     expect(after[0].n).toBe(before[0].n);
  138 |   } finally { await db.end(); }
  139 | });
  140 | 
  141 | test("P12 Unauthorized roles cannot approve an application", async ({ browser }) => {
  142 |   const db = await database();
  143 |   const member = await browser.newContext();
  144 |   const bookkeeper = await browser.newContext();
  145 |   try {
  146 |     const [before] = await db.query<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications ORDER BY membership_application_id LIMIT 1");
  147 |     const id = before[0].membership_application_id;
  148 |     await login(member, "member"); await login(bookkeeper, "bookkeeper");
  149 |     for (const context of [member, bookkeeper]) {
  150 |       expect((await context.request.post(`${api}/api/membership-applications/${id}/approve`, { data: {} })).status()).toBe(403);
  151 |     }
  152 |     const [after] = await db.execute<RowDataPacket[]>("SELECT membership_application_id, application_status, converted_member_id FROM membership_applications WHERE membership_application_id=?", [id]);
  153 |     expect(after[0]).toEqual(before[0]);
  154 |   } finally { await member.close(); await bookkeeper.close(); await db.end(); }
  155 | });
  156 | 
```