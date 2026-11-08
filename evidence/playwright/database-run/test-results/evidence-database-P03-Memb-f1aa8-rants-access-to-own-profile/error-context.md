# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-database.spec.ts >> P03 Member login grants access to own profile
- Location: tests\e2e\evidence-database.spec.ts:39:5

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "Maria Santos"
Received string:    "{\"membership_type\":\"True Member\",\"contact_number\":\"09171234567\",\"email\":\"maria.member@trackcoop.local\",\"barangay\":\"Lumbangan\",\"municipality\":\"Nasugbu\",\"province\":\"Batangas\",\"livelihoods\":[],\"occupation\":\"Rice Farmer\"}"
```

# Test source

```ts
  1  | import { expect, test, type BrowserContext, type Page } from "@playwright/test";
  2  | 
  3  | const api = "http://127.0.0.1:3218";
  4  | const accounts = {
  5  |   chairman: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" },
  6  |   bookkeeper: { identifier: "bookkeeper.test@trackcoop.local", password: "BookkeeperTest123!" },
  7  |   member: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" },
  8  | } as const;
  9  | 
  10 | async function login(context: BrowserContext, role: keyof typeof accounts) {
  11 |   const response = await context.request.post(`${api}/api/auth/login`, { data: accounts[role] });
  12 |   expect(response.status()).toBe(200);
  13 |   expect((await response.json()).data.role).toBe(role);
  14 | }
  15 | 
  16 | async function screenshot(page: Page, name: string) {
  17 |   await page.screenshot({ path: `evidence/playwright/database-run/screenshots/${name}.png`, fullPage: true });
  18 | }
  19 | 
  20 | test("P01 Chairman login grants authenticated member directory access", async ({ context, page }) => {
  21 |   await login(context, "chairman");
  22 |   expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(200);
  23 |   expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(200);
  24 |   await page.goto("/portal/chairman/dashboard");
  25 |   await expect(page).toHaveURL(/\/portal\/chairman\/dashboard/);
  26 |   await expect(page.locator("main")).toBeVisible();
  27 |   await screenshot(page, "P01-chairman-dashboard");
  28 | });
  29 | 
  30 | test("P02 Bookkeeper login grants financial category access", async ({ context, page }) => {
  31 |   await login(context, "bookkeeper");
  32 |   expect((await context.request.get(`${api}/api/financial-categories`)).status()).toBe(200);
  33 |   await page.goto("/portal/bookkeeper/financial-dashboard");
  34 |   await expect(page).toHaveURL(/\/portal\/bookkeeper\/financial-dashboard/);
  35 |   await expect(page.locator("main")).toBeVisible();
  36 |   await screenshot(page, "P02-bookkeeper-dashboard");
  37 | });
  38 | 
  39 | test("P03 Member login grants access to own profile", async ({ context, page }) => {
  40 |   await login(context, "member");
  41 |   const profile = await context.request.get(`${api}/api/members/me/profile`);
  42 |   expect(profile.status()).toBe(200);
> 43 |   expect(JSON.stringify(await profile.json())).toContain("Maria Santos");
     |                                                ^ Error: expect(received).toContain(expected) // indexOf
  44 |   await page.goto("/portal/member/dashboard");
  45 |   await expect(page).toHaveURL(/\/portal\/member\/dashboard/);
  46 |   await expect(page.locator("main")).toBeVisible();
  47 |   await screenshot(page, "P03-member-dashboard");
  48 | });
  49 | 
  50 | test("P04 Invalid credentials are rejected with feedback", async ({ context, page }) => {
  51 |   await page.goto("/login");
  52 |   await page.getByLabel("Email or username", { exact: true }).fill("nobody.evidence@example.invalid");
  53 |   await page.getByLabel("Password", { exact: true }).fill("WrongPassword123!");
  54 |   await page.getByRole("button", { name: "Sign in to account" }).click();
  55 |   await expect(page.getByRole("region", { name: "Account sign in" }).getByRole("alert")).toContainText(/incorrect/i);
  56 |   expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  57 |   await screenshot(page, "P04-invalid-login");
  58 | });
  59 | 
  60 | test("P05 Logout revokes the existing server session", async ({ context, browser }) => {
  61 |   await login(context, "member");
  62 |   const cookie = (await context.cookies(api)).find(c => c.name === "trackcoop_session");
  63 |   expect(cookie).toBeTruthy();
  64 |   expect((await context.request.post(`${api}/api/auth/logout`)).status()).toBe(200);
  65 |   expect((await context.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  66 |   const replay = await browser.newContext();
  67 |   await replay.addCookies([cookie!]);
  68 |   expect((await replay.request.get(`${api}/api/auth/me`)).status()).toBe(401);
  69 |   await replay.close();
  70 | });
  71 | 
  72 | test("P06 Member and bookkeeper are denied restricted backend operations", async ({ browser }) => {
  73 |   const member = await browser.newContext();
  74 |   const bookkeeper = await browser.newContext();
  75 |   try {
  76 |     await login(member, "member");
  77 |     await login(bookkeeper, "bookkeeper");
  78 |     expect((await member.request.get(`${api}/api/members/summary`)).status()).toBe(403);
  79 |     expect((await member.request.post(`${api}/api/financial-records`, { data: {} })).status()).toBe(403);
  80 |     expect((await bookkeeper.request.get(`${api}/api/members/summary`)).status()).toBe(403);
  81 |     expect((await bookkeeper.request.post(`${api}/api/members`, { data: {} })).status()).toBe(403);
  82 |   } finally { await member.close(); await bookkeeper.close(); }
  83 | });
  84 | 
  85 | test("P07 Member cannot read or alter another member through staff record routes", async ({ context }) => {
  86 |   await login(context, "member");
  87 |   expect((await context.request.get(`${api}/api/members/2`)).status()).toBe(403);
  88 |   expect((await context.request.patch(`${api}/api/members/2`, { data: { fullName: "Synthetic forbidden update" } })).status()).toBe(403);
  89 | });
  90 | 
  91 | test("P08 Public pages are reachable while a private backend route is denied", async ({ page, context }) => {
  92 |   await page.goto("/login");
  93 |   await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  94 |   await page.goto("/membership/apply");
  95 |   await expect(page.getByRole("heading", { name: "Become a Member" })).toBeVisible();
  96 |   expect((await context.request.get(`${api}/api/members/summary`)).status()).toBe(401);
  97 |   await screenshot(page, "P08-public-application");
  98 | });
  99 | 
```