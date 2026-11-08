# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: evidence-screenshots.spec.ts >> capture chairman system views with synthetic data
- Location: tests\e2e\evidence-screenshots.spec.ts:15:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | const accounts = {
  4  |   chairman: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" },
  5  |   bookkeeper: { identifier: "bookkeeper.test@trackcoop.local", password: "BookkeeperTest123!" },
  6  |   member: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" },
  7  | } as const;
  8  | const routes = {
  9  |   chairman: [["member-analytics", "/portal/chairman/dashboard"], ["membership-applications", "/portal/chairman/members/applications"], ["financial-analytics", "/portal/chairman/financial-dashboard"], ["announcements", "/portal/chairman/announcements"], ["rentals", "/portal/chairman/rentals/bookings"]],
  10 |   bookkeeper: [["financial-dashboard", "/portal/bookkeeper/financial-dashboard"], ["financial-ledger", "/portal/bookkeeper/financial-ledger"], ["payment-validation", "/portal/bookkeeper/payment-validation"], ["documents", "/portal/bookkeeper/documents"], ["products", "/portal/bookkeeper/products-inventory"]],
  11 |   member: [["dashboard", "/portal/member/dashboard"], ["share-capital", "/portal/member/share-capital"]],
  12 | } as const;
  13 | 
  14 | for (const role of ["chairman", "bookkeeper", "member"] as const) {
  15 |   test(`capture ${role} system views with synthetic data`, async ({ context, page }) => {
  16 |     const response = await context.request.post("http://127.0.0.1:3218/api/auth/login", { data: accounts[role] });
> 17 |     expect(response.status()).toBe(200);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  18 |     await page.setViewportSize({ width: 1440, height: 900 });
  19 |     for (const [label, route] of routes[role]) {
  20 |       await page.goto(route);
  21 |       await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/")));
  22 |       await expect(page.locator("main")).toBeVisible();
  23 |       await expect(page.getByText("Loading TrackCOOP...", { exact: true })).toHaveCount(0);
  24 |       await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
  25 |       if (role === "member" && label === "dashboard") await expect(page.getByRole("heading", { name: /Welcome back, Maria/i })).toBeVisible();
  26 |       await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? "database-run"}/screenshots/${role}-${label}.png`, fullPage: true });
  27 |     }
  28 |   });
  29 | }
  30 | 
```