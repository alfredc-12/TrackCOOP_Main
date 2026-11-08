# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-safe.spec.ts >> P53 login displays a simulated server error
- Location: tests\e2e\evidence-safe.spec.ts:37:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('alert')
Expected substring: "Synthetic invalid credentials"
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <p role="alert" class="flex items-start gap-2 rounded-lg bg-coop-danger-bg p-3 text-sm leading-6 text-coop-danger">…</p> aka getByRole('region', { name: 'Account sign in' }).getByRole('alert')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toContainText" with timeout 10000ms
  - waiting for getByRole('alert')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - region "Our cooperative" [ref=e4]:
        - img "TrackCOOP cooperative members" [ref=e5]
        - paragraph [ref=e8]: Shared records, clearer service, and accountable cooperative work.
      - region "Account sign in" [ref=e9]:
        - generic [ref=e10]:
          - link "Back to the cooperative site" [ref=e11] [cursor=pointer]:
            - /url: /
            - img [ref=e12]
            - text: Back to the cooperative site
          - generic [ref=e14]:
            - generic [ref=e15]:
              - img "TrackCOOP logo" [ref=e17]
              - generic [ref=e18]:
                - paragraph [ref=e19]: TrackCOOP
                - paragraph [ref=e20]: Cooperative Management System
            - generic [ref=e21]:
              - paragraph [ref=e22]: Good morning
              - heading "Sign in to your account" [level=1] [ref=e23]
              - paragraph [ref=e24]: Use your assigned email address or username.
            - generic [ref=e25]:
              - generic [ref=e26]:
                - generic [ref=e27]: Email or username
                - textbox "Email or username" [ref=e28]: test@example.invalid
              - generic [ref=e29]:
                - generic [ref=e30]: Password
                - generic [ref=e31]:
                  - textbox "Password" [ref=e32]: synthetic-test-only
                  - button "Show password" [ref=e33]:
                    - img [ref=e34]
              - alert [ref=e37]:
                - img [ref=e38]
                - generic [ref=e40]: Synthetic invalid credentials
              - button "Sign in to account" [ref=e41]:
                - img [ref=e42]
                - text: Sign in to account
            - paragraph [ref=e45]:
              - text: Need an account? Contact the Chairman or send a request through the
              - link "cooperative contact page" [ref=e46] [cursor=pointer]:
                - /url: /contact
              - text: .
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e52] [cursor=pointer]:
    - img [ref=e53]
  - alert [ref=e56]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | // Only the Next.js frontend is contacted. Every API and external request is
  4  | // intercepted; these checks do not exercise a real account or database.
  5  | test.beforeEach(async ({ page }) => {
  6  |   await page.route("**/*", async (route) => {
  7  |     const url = new URL(route.request().url());
  8  |     if (url.pathname === "/api/auth/me") {
  9  |       return route.fulfill({ status: 401, json: { success: false, message: "Signed out", errors: [] } });
  10 |     }
  11 |     if (url.hostname !== "127.0.0.1" || url.port !== "3217" || url.pathname.startsWith("/api/")) {
  12 |       return route.abort();
  13 |     }
  14 |     return route.continue();
  15 |   });
  16 | });
  17 | 
  18 | test("P51 login required fields are rejected before a request", async ({ page }) => {
  19 |   await page.goto("/login");
  20 |   await page.getByRole("button", { name: "Sign in to account" }).click();
  21 |   await expect(page.getByLabel("Email or username", { exact: true })).toHaveAttribute("aria-invalid", "true");
  22 |   await page.screenshot({ path: "evidence/playwright/screenshots/P51-login-validation.png", fullPage: true });
  23 | });
  24 | 
  25 | test("P52 login controls work on a narrow viewport", async ({ page }) => {
  26 |   await page.setViewportSize({ width: 390, height: 844 });
  27 |   await page.goto("/login");
  28 |   await page.getByLabel("Password", { exact: true }).fill("synthetic-test-only");
  29 |   await page.getByRole("button", { name: "Show password" }).click();
  30 |   await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  31 |   await page.getByRole("button", { name: "Hide password" }).click();
  32 |   await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  33 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  34 |   await page.screenshot({ path: "evidence/playwright/screenshots/P52-login-mobile.png", fullPage: true });
  35 | });
  36 | 
  37 | test("P53 login displays a simulated server error", async ({ page }) => {
  38 |   await page.route("**/api/auth/login", route => route.fulfill({ status: 401, json: { success: false, message: "Synthetic invalid credentials", errors: [] } }));
  39 |   await page.goto("/login");
  40 |   await page.getByLabel("Email or username", { exact: true }).fill("test@example.invalid");
  41 |   await page.getByLabel("Password", { exact: true }).fill("synthetic-test-only");
  42 |   await page.getByRole("button", { name: "Sign in to account" }).click();
> 43 |   await expect(page.getByRole("alert")).toContainText("Synthetic invalid credentials");
     |                                         ^ Error: expect(locator).toContainText(expected) failed
  44 |   await page.screenshot({ path: "evidence/playwright/screenshots/P53-login-error.png", fullPage: true });
  45 | });
  46 | 
```