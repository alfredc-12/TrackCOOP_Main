# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-database.spec.ts >> P27 Bookkeeper edits a category while Chairman cannot edit it
- Location: tests\e2e\evidence-database.spec.ts:484:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1   | import { expect, test, type BrowserContext, type Page } from "@playwright/test";
  2   | import mysql, { type RowDataPacket } from "mysql2/promise";
  3   | import { randomUUID } from "node:crypto";
  4   | import { calculateMemberIndicator, scoreMinimum, scoreRecency } from "../../server/src/modules/member-indicators/member-indicator.scoring";
  5   | import { configurationFromSettings } from "../../server/src/modules/member-indicators/member-indicator.policy";
  6   | 
  7   | const api = "http://127.0.0.1:3218";
  8   | const accounts = {
  9   |   chairman: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" },
  10  |   bookkeeper: { identifier: "bookkeeper.test@trackcoop.local", password: "BookkeeperTest123!" },
  11  |   member: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" },
  12  |   associate: { identifier: "benito.member@trackcoop.local", password: "MemberTest123!" },
  13  | } as const;
  14  | 
  15  | async function login(context: BrowserContext, role: keyof typeof accounts) {
  16  |   const response = await context.request.post(`${api}/api/auth/login`, { data: accounts[role] });
> 17  |   expect(response.status()).toBe(200);
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  18  |   expect((await response.json()).data.role).toBe(role === "associate" ? "member" : role);
  19  | }
  20  | 
  21  | async function screenshot(page: Page, name: string) {
  22  |   await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? "database-run"}/screenshots/${name}.png` });
  23  | }
  24  | 
  25  | async function database() {
  26  |   const connection = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
  27  |   const [rows] = await connection.query<RowDataPacket[]>("SELECT @@port AS port, @@datadir AS dir, DATABASE() AS db");
  28  |   const dir = String(rows[0].dir).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  29  |   if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) {
  30  |     await connection.end();
  31  |     throw new Error("Refusing an unverified database target");
  32  |   }
  33  |   return connection;
  34  | }
  35  | 
  36  | test.beforeAll(async () => { const db = await database(); await db.end(); });
  37  | 
  38  | test("P01 Chairman login grants authenticated member directory access", async ({ context, page }) => {
  39  |   await login(context, "chairman");
  40  |   expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(200);
  41  |   expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(200);
  42  |   await page.goto("/portal/chairman/dashboard");
  43  |   await expect(page).toHaveURL(/\/portal\/chairman\/dashboard/);
  44  |   await expect(page.getByRole("heading", { name: "Member analytics", exact: true })).toBeVisible();
  45  |   await screenshot(page, "P01-chairman-dashboard");
  46  | });
  47  | 
  48  | test("P02 Bookkeeper login grants financial category access", async ({ context, page }) => {
  49  |   await login(context, "bookkeeper");
  50  |   expect((await context.request.get(`${api}/api/financial-categories`)).status()).toBe(200);
  51  |   await page.goto("/portal/bookkeeper/financial-dashboard");
  52  |   await expect(page).toHaveURL(/\/portal\/bookkeeper\/financial-dashboard/);
  53  |   await expect(page.locator("main")).toBeVisible();
  54  |   await screenshot(page, "P02-bookkeeper-dashboard");
  55  | });
  56  | 
  57  | test("P03 Member login grants access to own profile", async ({ context, page }) => {
  58  |   await login(context, "member");
  59  |   const profile = await context.request.get(`${api}/api/members/me/profile`);
  60  |   expect(profile.status()).toBe(200);
  61  |   expect((await profile.json()).email).toBe("maria.member@trackcoop.local");
  62  |   await page.goto("/portal/member/dashboard");
  63  |   await expect(page).toHaveURL(/\/portal\/member\/dashboard/);
  64  |   await expect(page.getByRole("heading", { name: /Welcome back, Maria/i })).toBeVisible();
  65  |   await screenshot(page, "P03-member-dashboard");
  66  | });
  67  | 
  68  | test("P04 Invalid credentials are rejected with feedback", async ({ context, page }) => {
  69  |   await page.goto("/login");
  70  |   await page.getByLabel("Email or username", { exact: true }).fill("nobody.evidence@example.invalid");
  71  |   await page.getByLabel("Password", { exact: true }).fill("WrongPassword123!");
  72  |   await page.getByRole("button", { name: "Sign in to account" }).click();
  73  |   await expect(page.getByRole("region", { name: "Account sign in" }).getByRole("alert")).toContainText(/incorrect/i);
  74  |   expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  75  |   await screenshot(page, "P04-invalid-login");
  76  | });
  77  | 
  78  | test("P05 Logout revokes the existing server session", async ({ context, browser }) => {
  79  |   await login(context, "member");
  80  |   const cookie = (await context.cookies(api)).find(c => c.name === "trackcoop_session");
  81  |   expect(cookie).toBeTruthy();
  82  |   expect((await context.request.post(`${api}/api/auth/logout`)).status()).toBe(200);
  83  |   expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  84  |   const replay = await browser.newContext();
  85  |   await replay.addCookies([cookie!]);
  86  |   expect((await replay.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  87  |   await replay.close();
  88  | });
  89  | 
  90  | test("P06 Member and bookkeeper are denied restricted backend operations", async ({ browser }) => {
  91  |   const member = await browser.newContext();
  92  |   const bookkeeper = await browser.newContext();
  93  |   try {
  94  |     await login(member, "member");
  95  |     await login(bookkeeper, "bookkeeper");
  96  |     expect((await member.request.get(`${api}/api/members/summary`)).status()).toBe(403);
  97  |     expect((await member.request.post(`${api}/api/financial-records`, { data: {} })).status()).toBe(403);
  98  |     expect((await bookkeeper.request.get(`${api}/api/members/summary`)).status()).toBe(403);
  99  |     expect((await bookkeeper.request.post(`${api}/api/members`, { data: {} })).status()).toBe(403);
  100 |     const memberPage = await member.newPage();
  101 |     await memberPage.goto("/portal/chairman/dashboard");
  102 |     await expect(memberPage).toHaveURL(/\/portal\/member\/dashboard/);
  103 |     const bookkeeperPage = await bookkeeper.newPage();
  104 |     await bookkeeperPage.goto("/portal/chairman/dashboard");
  105 |     await expect(bookkeeperPage).toHaveURL(/\/portal\/bookkeeper\/financial-dashboard/);
  106 |   } finally { await member.close(); await bookkeeper.close(); }
  107 | });
  108 | 
  109 | test("P07 Member cannot read or alter another member through staff record routes", async ({ context }) => {
  110 |   const db = await database();
  111 |   try {
  112 |     const [before] = await db.query<RowDataPacket[]>("SELECT member_id,full_name FROM member_profiles WHERE member_code='NFFAC-SEED-0002'");
  113 |     const id = before[0].member_id;
  114 |     await login(context, "member");
  115 |     expect((await context.request.get(`${api}/api/members/${id}`)).status()).toBe(403);
  116 |     expect((await context.request.patch(`${api}/api/members/${id}`, { data: { fullName: "Synthetic forbidden update" } })).status()).toBe(403);
  117 |     const [after] = await db.execute<RowDataPacket[]>("SELECT member_id,full_name FROM member_profiles WHERE member_id=?", [id]);
```