import { expect, test, type Page } from "@playwright/test";
import { REPORT_CATALOG } from "../../src/features/records/record-constants";
import type { ReportResult } from "../../src/features/records/records-types";

const catalog = REPORT_CATALOG.filter((item) => item.allowedRoles.includes("bookkeeper"));
const notes = ["Current: 2026-01-01 to 2026-11-10. Previous equal-length period: 2025-02-21 to 2025-12-31.", "Income, sales, rental payments, and capital contributions overlap and must not be added together."];
const overview: ReportResult = {
  reportId: "1", reportReference: "RPT-2026-001", reportKey: "cooperative-overview", reportName: "Cooperative Overview", category: "FINANCIAL", generatedAt: "2026-11-10T00:00:00Z", generatedBy: "UI Review", periodLabel: "2026-01-01 to 2026-11-10", appliedFilters: { dateFrom: "2026-01-01", dateTo: "2026-11-10" }, notes,
  summary: [{ label: "Posted income", value: 1000, format: "currency" }], columns: [{ key: "metric", label: "Metric" }, { key: "currentValue", label: "Current", format: "currency" }],
  rows: [{ metric: "Posted income", currentValue: 1000, previousValue: 500, change: 500, changePercent: 100, source: "Approved active ledger income" }, { metric: "Capital contributions", currentValue: 100, previousValue: 0, change: 100, changePercent: null, source: "Validated capital payments" }], total: 2,
};
const trends = { ...overview, reportKey: "performance-trends", rows: [{ period: "2026-01", value0: 500, value1: 100, value2: 400, value3: 200, value4: 300, value5: 0 }, { period: "2026-02", value0: 0, value1: 100, value2: -100, value3: 0, value4: 0, value5: 100 }], total: 2 };
const attention = { ...overview, reportKey: "attention-needed", notes: ["Current snapshot at generation time; not a historical backlog."], rows: [{ area: "Payments", reference: "PAY-1", subject: "Rental", issue: "Pending", amount: 1500, nextStep: "Check proof and saved details" }], total: 1 };

async function fixtures(page: Page) {
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/me")) return route.fulfill({ json: { success: true, data: { id: "review", role: "bookkeeper", displayName: "UI Review" }, meta: {} } });
    if (url.pathname.endsWith("/reports/progress")) return route.fulfill({ json: { overview, trends, attention } });
    if (url.pathname.includes("/reports/generate/") && route.request().method() === "POST") return route.fulfill({ json: { ...overview, appliedFilters: route.request().postDataJSON().filters } });
    if (route.request().method() !== "GET") throw Error("Unexpected application mutation during report UI verification");
    if (url.pathname.endsWith("/reports")) return route.fulfill({ json: {
      catalog, summary: { available: catalog.length, generatedThisMonth: 2, financial: 15, operational: 20 },
      recent: [{ id: "1", reference: "RPT-2026-001", reportKey: "cooperative-overview", title: "Cooperative Overview", periodLabel: "January 2026", generatedAt: "2026-11-10T00:00:00Z", status: "Generated", filters: { dateFrom: "2026-01-01", dateTo: "2026-01-31" } }],
      filterOptions: { barangays: [], sectors: [], paymentMethods: ["Cash"], rentalAssets: [], products: [], productCategories: [], documentCategories: [], relatedModules: [], users: [], roles: [] },
    } });
    return route.fulfill({ status: 503, json: { error: "Excluded from UI verification" } });
  });
}

for (const width of [1440, 768, 390]) {
  test(`report hub is responsive and keeps comparisons distinct at ${width}px`, async ({ page }, testInfo) => {
    await fixtures(page); const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/bookkeeper/reports");
    const hub = page.getByRole("region", { name: "Cooperative reporting hub" });
    await expect(hub.getByText("Posted income", { exact: true })).toBeVisible();
    await expect(hub.getByText(/No percentage baseline/)).toBeVisible();
    await page.getByRole("button", { name: "Progress trends", exact: true }).click();
    await expect(page.getByRole("region", { name: "Monthly progress chart" })).toBeVisible();
    const metric = page.getByRole("combobox", { name: "Trend metric" });
    await metric.click(); await page.getByRole("option", { name: "Net result", exact: true }).click();
    await expect(page.getByRole("img", { name: /2026-02:/ })).toHaveAttribute("aria-label", /-.*100/);
    await page.getByRole("button", { name: "Needs attention", exact: true }).click();
    await expect(page.getByText("Payments · PAY-1", { exact: true })).toBeVisible();
    const areas = page.getByRole("combobox", { name: "Attention area", exact: true });
    await areas.click(); await page.getByRole("option", { name: "Payments (1)", exact: true }).click();
    await expect(page.getByRole("link", { name: "Review payments", exact: true })).toHaveAttribute("href", "/portal/bookkeeper/payment-validation");
    await expect(hub.getByText(/not a historical backlog/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await hub.evaluate((element) => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`report-hub-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("report library supports favorites, recent filters, generation and matching export dates", async ({ page }) => {
  await fixtures(page); await page.goto("/bookkeeper/reports");
  await page.getByRole("button", { name: "Report library", exact: true }).click();
  await page.getByRole("textbox", { name: "Search report library" }).fill("Cooperative Overview");
  const favorite = page.getByRole("button", { name: "Favorite Cooperative Overview", exact: true });
  await favorite.click(); await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await page.reload(); await page.getByRole("button", { name: "Report library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Favorite Cooperative Overview", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Run again", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Cooperative Overview", exact: true });
  await expect(dialog).toBeVisible();
  const request = page.waitForRequest((request) => request.method() === "POST" && request.url().includes("/reports/generate/cooperative-overview"));
  await dialog.getByRole("button", { name: "Generate", exact: true }).click();
  expect((await request).postDataJSON().filters).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-01-31" });
  await expect(page.getByRole("link", { name: "Export CSV", exact: true })).toHaveAttribute("href", /dateTo=2026-01-31/);
  await expect(page.getByRole("link", { name: "Export Excel", exact: true })).toHaveAttribute("href", /dateFrom=2026-01-01/);
});

test("progress failures do not show stale zero totals and can be retried", async ({ page }) => {
  await fixtures(page); let failing = true;
  await page.route("**/api/reports/progress?**", (route) => route.fulfill(failing ? { status: 503, json: { error: "Progress temporarily unavailable" } } : { json: { overview, trends, attention } }));
  await page.goto("/bookkeeper/reports");
  const hub = page.getByRole("region", { name: "Cooperative reporting hub" });
  await expect(hub.getByText("Progress temporarily unavailable", { exact: true })).toBeVisible();
  await expect(hub.getByText("Posted income", { exact: true })).toHaveCount(0);
  failing = false; await hub.getByRole("button", { name: /Retry|Try again/i }).click();
  await expect(hub.getByText("Posted income", { exact: true })).toBeVisible();
});

test("applying progress dates requests the selected reporting period", async ({ page }) => {
  await fixtures(page); await page.goto("/bookkeeper/reports");
  await page.getByLabel("Progress from", { exact: true }).fill("2026-03-01");
  await page.getByLabel("Progress to", { exact: true }).fill("2026-03-31");
  const request = page.waitForRequest((request) => request.url().includes("/reports/progress?") && request.url().includes("dateFrom=2026-03-01") && request.url().includes("dateTo=2026-03-31"));
  await page.getByRole("button", { name: "Apply period", exact: true }).click();
  await request;
});
