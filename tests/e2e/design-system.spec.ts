import { expect, test, type Page } from "@playwright/test";

const envelope = (data: unknown) => ({ success: true, data, message: "UI fixture", meta: {} });

async function protectWrites(page: Page) {
  await page.route("https://maps.google.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Map fixture</title><p>External map excluded from UI verification.</p>" }));
  await page.route("**/api/**", async (route) => {
    if (!["GET", "OPTIONS"].includes(route.request().method())) throw new Error("UI review must not mutate application data");
    await route.fulfill({ status: 503, json: { success: false, message: "UI review: unavailable data fixture", errors: [] } });
  });
}

test("shared selector supports keyboard selection, cancellation, and focus return", async ({ page }) => {
  await protectWrites(page);
  await page.goto("/contact");
  await page.waitForLoadState("networkidle");
  const priority = page.getByRole("combobox", { name: "Priority: Normal", exact: true });
  await priority.focus();
  await priority.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option", { name: "Priority: Normal", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("option", { name: "Priority: Urgent", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  const urgent = page.getByRole("combobox", { name: "Priority: Urgent", exact: true });
  await expect(urgent).toBeFocused();
  await urgent.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Priority: Urgent", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("option", { name: "Priority: Low", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(urgent).toBeFocused();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await urgent.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Priority: Urgent", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("option", { name: "Priority: Low", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: "Priority: Low", exact: true })).toBeFocused();
});

test("sign-in remains scrollable at short mobile height; password labels are associated", async ({ page }) => {
  await protectWrites(page);
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "Sign in to account", exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  const contact = page.getByRole("link", { name: "cooperative contact page", exact: true });
  await contact.scrollIntoViewIfNeeded();
  await expect(contact).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/force-change-password");
  await expect(page.getByLabel("Current Password (Track_coop123)", { exact: true })).toBeVisible();
  await expect(page.getByLabel("New Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByLabel("Confirm New Password", { exact: true })).toBeVisible();
});

for (const width of [1440, 768, 390]) {
  test(`staff shell and financial hierarchy remain usable at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await protectWrites(page);
    // Exercise the internal page with browser-only auth fixtures. Do not change the proxy or a real session.
    await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: envelope({ id: "ui-review", displayName: "UI Review", email: "ui-review@example.invalid", username: "review", role: "bookkeeper" }) }));
    await page.route("**/api/payment-references/summary", (route) => route.fulfill({ json: envelope({ total: 4, pendingTotal: 2, pendingManual: 2, needsClarification: 1, validatedToday: 1, validatedTotal: 2, paymongoTestPayments: 0, rejected: 0, reversed: 0, validatedAmount: 12345678.5 }) }));
    await page.route("**/api/financial-records/summary", (route) => route.fulfill({ json: envelope({ incomeTotal: 2000, expenseTotal: 500, adjustmentTotal: 0, netTotal: 1500, activeRecords: 3, voidedRecords: 0 }) }));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/bookkeeper/financial-dashboard");
    await expect(page.getByRole("heading", { name: "Financial Dashboard", exact: true })).toBeVisible();
    await expect(page.getByText("₱12,345,678.50", { exact: true })).toBeVisible();
    const heading = page.getByRole("heading", { name: "Bookkeeper action center", exact: true });
    const chart = page.getByRole("heading", { name: "Financial snapshot", exact: true });
    expect(await heading.evaluate((element) => {
      const next = [...document.querySelectorAll("h2")].find((item) => item.textContent === "Financial snapshot");
      return next ? Boolean(element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
    })).toBe(true);
    await expect(chart).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`finance-${width}.png`), fullPage: true });
    if (width < 1024) {
      await expect(page.getByRole("dialog", { name: "Portal navigation" })).toHaveCount(0);
      const trigger = page.getByRole("button", { name: "Open navigation", exact: true });
      await trigger.click();
      const drawer = page.getByRole("dialog", { name: "Portal navigation" });
      await expect(drawer).toBeVisible();
      for (let index = 0; index < 12; index++) {
        await page.keyboard.press("Tab");
        expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect(drawer).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Open account menu", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Sign out", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
}

test("shared table remains a named scroll region with real row context on a phone", async ({ page }, testInfo) => {
  await protectWrites(page);
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: envelope({ id: "ui-review", displayName: "UI Review", email: "ui-review@example.invalid", role: "bookkeeper" }) }));
  await page.route("**/api/financial-categories", (route) => route.fulfill({ json: envelope([
    { id: "ui-income", categoryCode: "UI-INCOME", categoryName: "Cooperative services and product income", categoryType: "Income", isActive: true },
    { id: "ui-expense", categoryCode: "UI-EXPENSE", categoryName: "Equipment maintenance and operating supplies", categoryType: "Expense", isActive: true },
  ]) }));
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/bookkeeper/financial-categories");
  const region = page.getByRole("region", { name: "Data table, scroll horizontally for more columns", exact: true });
  await expect(region.getByRole("table")).toBeVisible();
  await expect(region.getByRole("row").filter({ hasText: "UI-INCOME" })).toContainText("Cooperative services and product income");
  await region.focus();
  await expect(region).toBeFocused();
  await region.press("ArrowRight");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("table-mobile.png"), fullPage: true });
});
