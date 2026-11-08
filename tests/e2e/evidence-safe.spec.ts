import { expect, test } from "@playwright/test";

// Only the Next.js frontend is contacted. Every API and external request is
// intercepted; these checks do not exercise a real account or database.
test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ status: 401, json: { success: false, message: "Signed out", errors: [] } });
    }
    if (url.hostname !== "127.0.0.1" || url.port !== "3217" || url.pathname.startsWith("/api/")) {
      return route.abort();
    }
    return route.continue();
  });
});

test("P51 login required field is marked invalid", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in to account" }).click();
  await expect(page.getByLabel("Email or username", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? ""}/screenshots/P51-login-validation.png`, fullPage: true });
});

test("P52 login controls work on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-test-only");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? ""}/screenshots/P52-login-mobile.png`, fullPage: true });
});

test("P53 login displays a simulated server error", async ({ page }) => {
  await page.route("**/api/auth/login", route => route.fulfill({ status: 401, json: { success: false, message: "Synthetic invalid credentials", errors: [] } }));
  await page.goto("/login");
  await page.getByLabel("Email or username", { exact: true }).fill("test@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-test-only");
  await page.getByRole("button", { name: "Sign in to account" }).click();
  await expect(page.getByRole("region", { name: "Account sign in" }).getByRole("alert")).toContainText("Synthetic invalid credentials");
  await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? ""}/screenshots/P53-login-error.png`, fullPage: true });
});
