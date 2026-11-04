import { expect, test, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 5055);
const user = { id: "1", username: "chairman", email: "chairman@example.com", displayName: "Test Chairman", role: "chairman", accountStatus: "Active" };
let authServer: Server;

test.beforeAll(async () => {
  authServer = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ success: true, data: request.url === "/api/auth/me" ? user : {} }));
  });
  await new Promise<void>((resolve, reject) => {
    authServer.once("error", reject);
    authServer.listen(apiPort, resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => authServer?.close(() => resolve()));
});

async function choose(page: Page, field: "Month" | "Year", option: string) {
  await page.getByRole("button", { name: field, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

for (const width of [1440, 390]) {
  test(`calendar retains a draft across dismissal and month/year changes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/membership/application-status");
    const trigger = page.getByRole("button", { name: "Applicant date of birth", exact: true });
    await trigger.click();
    await choose(page, "Year", "2024");
    await choose(page, "Month", "February");
    await page.getByRole("button", { name: "18", exact: true }).click();
    await page.getByRole("heading", { name: "Application Status", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await trigger.click();
    await expect(page.getByRole("button", { name: "Month", exact: true })).toHaveText("February");
    await expect(page.getByRole("button", { name: "Year", exact: true })).toHaveText("2024");
    await expect(page.getByRole("button", { name: "18", exact: true, pressed: true })).toBeVisible();
    await choose(page, "Month", "March");
    await choose(page, "Year", "2023");
    await expect(page.getByRole("button", { name: "18", exact: true, pressed: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await trigger.click();
    await expect(page.getByRole("button", { name: "Month", exact: true })).toHaveText("March");
    await expect(page.getByRole("button", { name: "Year", exact: true })).toHaveText("2023");
    await expect(trigger).toHaveText("Select birth date");
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(trigger).toHaveText("March 18, 2023");
    await trigger.click();
    await choose(page, "Month", "April");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await trigger.click();
    await expect(page.getByRole("button", { name: "Month", exact: true })).toHaveText("March");
    await expect(page.getByRole("button", { name: "18", exact: true, pressed: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("calendar restores day 31 after short months and handles leap-year changes", async ({ page }) => {
  await page.goto("/membership/application-status");
  const trigger = page.getByRole("button", { name: "Applicant date of birth", exact: true });
  await trigger.click();
  await choose(page, "Year", "2024");
  await choose(page, "Month", "January");
  // January's grid also includes December 31 in its leading week.
  await page.getByRole("button", { name: "31", exact: true }).last().click();
  await choose(page, "Month", "February");
  await expect(page.getByRole("button", { name: "29", exact: true, pressed: true })).toBeVisible();
  await choose(page, "Year", "2023");
  await expect(page.getByRole("button", { name: "28", exact: true, pressed: true })).toBeVisible();
  await choose(page, "Month", "March");
  await expect(page.getByRole("button", { name: "31", exact: true, pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(trigger).toHaveText("March 31, 2023");
});

test("Reports date filters retain selection and remember the preferred day", async ({ page, context, baseURL }) => {
  page.on("pageerror", (error) => { throw error; });
  await page.clock.install({ time: new Date("2024-01-18T12:00:00") });
  await context.addCookies([{ name: "trackcoop_session", value: "calendar-test", url: baseURL! }]);
  await page.route(`http://localhost:${apiPort}/api/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === "/api/reports" ? {
      catalog: [{ key: "financial-summary", name: "Financial Summary", category: "FINANCIAL", description: "Financial report", dataSource: "Financial ledger", filters: ["dateFrom", "dateTo"], allowedRoles: ["chairman", "bookkeeper"] }],
      summary: { available: 1, generatedThisMonth: 0, financial: 1, operational: 0 },
      recent: [],
      filterOptions: { barangays: [], sectors: [], paymentMethods: [], rentalAssets: [], products: [], productCategories: [], documentCategories: [], relatedModules: [], users: [], roles: [] },
    } : { success: true, data: path === "/api/auth/me" ? user : [] };
    return route.fulfill({ json: body });
  });
  await page.goto("/portal/chairman/reports");
  await expect(page.getByText("Available Reports", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate Report", exact: true }).click();
  const field = page.getByText("Date from", { exact: true }).locator("..");
  const trigger = field.locator("button[aria-expanded]");
  await expect(trigger).toHaveText("Select date");
  await trigger.click();
  await field.getByRole("button", { name: "31", exact: true }).click();
  await expect(trigger).toHaveText("Jan 31, 2024");
  await trigger.click();
  await field.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(field.getByRole("button", { name: "29", exact: true, pressed: true })).toBeVisible();
  await field.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(field.getByRole("button", { name: "31", exact: true, pressed: true })).toBeVisible();
  await page.getByRole("heading", { name: "Financial Summary", exact: true }).click();
  await expect(trigger).toHaveText("Mar 31, 2024");
  await trigger.click();
  await expect(field.getByRole("button", { name: "31", exact: true, pressed: true })).toBeVisible();
  await field.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(trigger).toHaveText("Select date");
  await trigger.click();
  await expect(field.getByRole("button", { pressed: true })).toHaveCount(0);
  await field.getByRole("button", { name: "Today", exact: true }).click();
  await expect(trigger).toHaveText("Jan 18, 2024");
  const endField = page.getByText("Date to", { exact: true }).locator("..");
  await expect(endField.locator("button[aria-expanded]")).toHaveText("Select date");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(trigger).toHaveText("Select date");
  await trigger.click();
  await expect(field.getByRole("button", { pressed: true })).toHaveCount(0);
});
