import { expect, test, type Page } from "@playwright/test";
import { createFinancialAnalyticsEngine } from "../../server/src/modules/financial-analytics/financial-analytics.engine";
import { closeAllTime, parseFinancialAnalyticsFilters } from "../../server/src/modules/financial-analytics/financial-analytics.filters";
import { fixtureSources } from "../../server/src/modules/financial-analytics/financial-analytics.test-fixture";
import type { FinancialAnalyticsSources, IntegrityIssue } from "../../server/src/modules/financial-analytics/financial-analytics.types";

const NOW = new Date("2026-11-02T01:00:00Z");
const envelope = (data: unknown, meta = {}) => ({ success: true, data, message: "Financial analytics test fixture", meta });
const range = { from: "2026-10-01", to: "2026-10-31" };
const issue = (code: IntegrityIssue["code"], title: string, label: IntegrityIssue["label"], count: number, extra: Partial<IntegrityIssue> = {}): IntegrityIssue => ({
  code, title, label, available: true, count, amount: count ? 1250 : 0, dateRange: range, rule: `${title} validation rule.`, limitation: null,
  references: count ? [{ reference: "FIN-2026-000900", date: "2026-10-12", amount: 1250, module: "Manual" }] : [], truncated: false, modules: count ? ["Manual"] : [],
  ledgerQuery: { startDate: range.from, endDate: range.to, posting: "unposted" }, link: { href: "/portal/chairman/financial-ledger", label: "Open in Financial Ledger" }, ...extra,
});
function sources(): FinancialAnalyticsSources {
  return fixtureSources({ integrity: {
    postedCount: 8,
    issues: [issue("unposted", "Unposted records", "Unposted", 2), issue("classification", "Category type mismatch", "Classification Issue", 0), issue("voided", "Voided records", "Informational", 1),
      issue("unmatched-payment-postings", "Validated payments without a ledger posting", "Unmatched", 0, { link: { href: "/portal/chairman/payments", label: "Open Payment Validation" }, ledgerQuery: null }),
      issue("pos-reconciliation", "Operational totals differ from ledger postings", "Reconciliation Difference", 1)],
    reconciliation: [{ module: "POS", operationalLabel: "Paid and completed POS sales", operationalAmount: 12500, postedAmount: 12000, difference: 500, operationalCount: 6, postedCount: 5, available: true, caveat: "Timing and refunds can differ." }],
  } });
}
const engineFor = (url: URL) => {
  const data = sources();
  const filters = closeAllTime(parseFinancialAnalyticsFilters(Object.fromEntries(url.searchParams), NOW), data.firstRecordDate);
  return createFinancialAnalyticsEngine(data, filters, NOW);
};

async function setup(page: Page, options: { failFirst?: boolean; failSecond?: boolean } = {}) {
  const requests: URL[] = []; const exports: URL[] = [];
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  // The suite supplies auth at the browser boundary and reads canonical /portal links through the internal route.
  await page.route("**/portal/chairman/**", route => route.continue({ url: route.request().url().replace("/portal/chairman/", "/chairman/") }));
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET") throw new Error("Financial analytics browser tests must not mutate application data");
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: envelope({ id: "fa-review", displayName: "Financial Review", email: "review@example.invalid", username: "review", role: "chairman" }) });
    if (url.pathname === "/api/chairman/financial-analytics") {
      requests.push(url);
      if ((options.failFirst && requests.length === 1) || (options.failSecond && requests.length === 2)) return route.fulfill({ status: 503, json: { success: false, message: "Financial analytics fixture temporarily unavailable", errors: [] } });
      return route.fulfill({ json: envelope(engineFor(url).result) });
    }
    if (url.pathname === "/api/chairman/financial-analytics/matrix") {
      const engine = engineFor(url);
      return route.fulfill({ json: envelope({ filters: engine.result.filters, periodLabel: engine.result.periodLabel, comparisonLabel: engine.result.comparisonLabel, comparison: engine.result.comparison, income: engine.matrix("Income"), expense: engine.matrix("Expense") }) });
    }
    if (url.pathname === "/api/chairman/financial-analytics/period") return route.fulfill({ json: envelope(engineFor(url).periodDetail({ from: url.searchParams.get("from")!, to: url.searchParams.get("to")! })) });
    if (url.pathname === "/api/chairman/financial-analytics/export") { exports.push(url); return route.fulfill({ contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers: { "content-disposition": 'attachment; filename="financial-analytics.xlsx"' }, body: "Browser fixture download; real OOXML is validated in API tests" }); }
    return route.fulfill({ json: envelope([], { total: 0, page: 1, pageSize: 10 }) });
  });
  return { requests, exports };
}
const query = "period=custom&start=2026-10-01&end=2026-10-31&compare=custom&compareStart=2026-09-01&compareEnd=2026-09-30&granularity=weekly";
const path = `/chairman/financial-dashboard?${query}`;
const kpis = (page: Page) => page.getByRole("region", { name: "Financial performance KPIs" });

for (const width of [1440, 1024, 768, 390]) test(`financial analytics renders every section without overflow at ${width}px`, async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await setup(page); await page.setViewportSize({ width, height: 1000 }); await page.goto(path);
  if (width === 1440) {
    const source = await page.getByLabel("Other", { exact: true }).boundingBox();
    const apply = await page.getByRole("button", { name: "Apply filters" }).boundingBox();
    expect(Math.abs((source!.y + source!.height / 2) - (apply!.y + apply!.height / 2))).toBeLessThan(12);
    expect(apply!.x).toBeGreaterThan(source!.x);
  }
  await expect(kpis(page).getByRole("button")).toHaveCount(4);
  await expect(kpis(page).getByRole("button", { name: /^Recorded operating income/ }).locator("strong")).toHaveText("₱15,000.00");
  await expect(kpis(page).getByRole("button", { name: /^Recorded operating expenses/ }).locator("strong")).toHaveText("₱4,500.00");
  await expect(kpis(page).getByRole("button", { name: /^Recorded net surplus/ }).locator("strong")).toHaveText("₱10,500.00");
  await expect(kpis(page).getByRole("button", { name: /^Recorded surplus margin/ }).locator("strong")).toHaveText("70%");
  await expect(kpis(page).getByRole("button", { name: /^Recorded net surplus/ })).toHaveAttribute("data-tone", "good");
  for (const heading of ["Financial performance", "What changed?", "Income sources", "Financial categories", "Expense drivers", "Historical patterns", "Financial data integrity", "Financial analytics insights"]) await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Share capital information, separate from operating results" })).toContainText("Separate from operating income");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Scenario Planner")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`financial-analytics-${width}.png`), fullPage: true });
  expect(errors).toEqual([]);
});

test("KPI drawers open, explain the calculation, close with Escape and return focus", async ({ page }) => {
  await setup(page); await page.goto(path);
  const income = kpis(page).getByRole("button", { name: /^Recorded operating income/ });
  await income.click();
  const dialog = page.getByRole("dialog", { name: "Income details" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Operating income = sum of eligible posted Income records");
  await expect(dialog.getByRole("link", { name: /View income records in Financial Ledger/ })).toHaveAttribute("href", /financial-ledger\?startDate=2026-10-01&endDate=2026-10-31&recordType=Income/);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(income).toBeFocused();

  await kpis(page).getByRole("button", { name: /^Recorded operating expenses/ }).click();
  const expense = page.getByRole("dialog", { name: "Expense driver details" });
  await expect(expense).toContainText("Fuel");
  await expect(expense).toContainText("does not set budgets or limits");
  await page.getByRole("button", { name: "Close details" }).click();

  await kpis(page).getByRole("button", { name: /^Recorded net surplus/ }).click();
  const bridge = page.getByRole("dialog", { name: "Net surplus change analysis" });
  await expect(bridge).toContainText("+₱500.00");
  await expect(bridge).toContainText("equal to this period");
  await expect(bridge.getByRole("table", { name: "Net surplus drivers" }).getByRole("row")).toHaveCount(8);
  await bridge.getByRole("button", { name: "Sort Net surplus drivers by Effect on net surplus" }).click();
  await expect(bridge.getByRole("columnheader", { name: /Effect on net surplus/ })).toHaveAttribute("aria-sort", "descending");
  await expect(bridge.getByRole("table", { name: "Net surplus drivers" }).getByRole("row").nth(1)).toContainText("Donations and Grants");
  await bridge.getByRole("button", { name: "Sort Net surplus drivers by Effect on net surplus" }).click();
  await expect(bridge.getByRole("columnheader", { name: /Effect on net surplus/ })).toHaveAttribute("aria-sort", "ascending");
  await expect(bridge.getByRole("table", { name: "Net surplus drivers" }).getByRole("row").nth(1)).toContainText("Equipment Rental");
});

test("What changed lists the largest positive and negative contributors and opens the bridge", async ({ page }) => {
  await setup(page); await page.goto(path);
  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "What changed?", exact: true }) });
  await expect(card).toContainText("Equipment Rental");
  await expect(card).toContainText("−₱5,000.00");
  await expect(card).toContainText("+₱3,000.00");
  await card.getByRole("button", { name: "Open bridge" }).click();
  await expect(page.getByRole("dialog", { name: "Net surplus change analysis" })).toBeVisible();
});

test("the source and category matrix is a hidden left drawer with reconciled, selectable cells", async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(path);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Compare sources & categories" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Compare sources & categories" });
  await expect(drawer).toBeVisible();
  expect((await drawer.boundingBox())!.x).toBeLessThanOrEqual(1);
  const table = drawer.getByRole("table", { name: /Income by financial category and source module/ });
  await expect(table.getByRole("row", { name: /POS Sales/ })).toContainText("₱12,000.00");
  await expect(drawer).toContainText("Reconciles to the eligible total");
  await table.getByRole("button", { name: /^POS Sales, POS:/ }).click();
  await expect(drawer.getByRole("heading", { name: "POS Sales · POS" })).toBeVisible();
  await expect(drawer).toContainText("80% of income total");
  await expect(drawer.getByRole("link", { name: /View these records in Financial Ledger/ })).toHaveAttribute("href", /financialCategoryIds=1&sourceModules=POS&recordType=Income/);
  await drawer.getByLabel("Classification").click();
  await page.getByRole("option", { name: "Expense" }).click();
  await expect(drawer.getByRole("table", { name: /Expense by financial category and source module/ })).toContainText("Fuel");
  await drawer.getByLabel("Search categories").fill("zzz");
  await expect(drawer).toContainText("No expense records match these filters.");
  await drawer.getByRole("button", { name: "Reset comparison" }).click();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
});

test("a period opens from the chart's table alternative with its own breakdown and ledger link", async ({ page }) => {
  await setup(page); await page.goto(path);
  await page.getByText("View financial performance as a table").click();
  const alternative = page.getByRole("region", { name: "financial performance" });
  await expect(alternative.getByRole("row")).toHaveCount(6);
  await alternative.getByRole("button", { name: "Open details for Oct 1–4, 2026" }).click();
  const drawer = page.getByRole("dialog", { name: "Financial performance details" });
  await expect(drawer.getByRole("heading", { name: "Income by category" })).toBeVisible();
  await expect(drawer).toContainText("₱12,000.00");
  await expect(drawer.getByRole("link", { name: /View these records in Financial Ledger/ })).toHaveAttribute("href", /startDate=2026-10-01&endDate=2026-10-04/);
  await expect(drawer.getByRole("button", { name: /Export this period/ })).toBeVisible();
});

test("filters persist in the URL, produce removable chips and explain out-of-scope metrics", async ({ page }) => {
  const { requests } = await setup(page); await page.goto(path);
  await page.getByLabel("Financial record type").click();
  await page.getByRole("option", { name: "Income" }).click();
  await page.getByRole("button", { name: "More filters" }).click();
  await page.getByLabel("Minimum record amount (₱)").fill("100");
  await page.getByLabel("Maximum record amount (₱)").fill("50");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "minimum amount must not exceed" })).toBeVisible();
  await page.getByLabel("Maximum record amount (₱)").fill("5000");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/recordType=Income/);
  await expect(page).toHaveURL(/minAmount=100/);
  await expect(page).toHaveURL(/maxAmount=5000/);
  await expect.poll(() => requests.at(-1)?.searchParams.get("recordType")).toBe("Income");
  await expect(page.getByText("Record type is limited to Income")).toBeVisible();
  await expect(kpis(page).getByRole("button", { name: /^Recorded net surplus/ }).locator("strong")).toHaveText("N/A");
  await expect(kpis(page).getByRole("button", { name: /^Recorded operating expenses/ }).locator("strong")).toHaveText("Not in selected type");
  await page.getByRole("button", { name: "Remove filter Type: Income" }).click();
  await expect(page).not.toHaveURL(/recordType=Income/);
  await expect(page).toHaveURL(/minAmount=100/);
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page).not.toHaveURL(/minAmount|maxAmount|recordType/);
  await expect(kpis(page).getByRole("button", { name: /^Recorded net surplus/ }).locator("strong")).not.toHaveText("N/A");
});

test("integrity cards open the matching check with references and a ledger link", async ({ page }) => {
  await setup(page); await page.goto(path);
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Financial data integrity", exact: true }) });
  await expect(section).toContainText("A flagged record means the ledger needs review, not that money is missing");
  await section.getByRole("button", { name: /Unposted records/ }).click();
  const drawer = page.getByRole("dialog", { name: "Financial data integrity" });
  await expect(drawer.locator("details[open]")).toContainText("Unposted records validation rule.");
  await expect(drawer).toContainText("FIN-2026-000900");
  await expect(drawer.getByRole("link", { name: "Open in Financial Ledger" }).first()).toHaveAttribute("href", /financial-ledger\?.*posting=unposted/);
  await expect(drawer.getByRole("button", { name: /^(Create|Void|Post|Correct|Approve|Reverse|Delete|Save)\b/ })).toHaveCount(0);
  await expect(drawer).toContainText("Operational reconciliation");
});

test("insights are traceable and each action opens its supporting drawer", async ({ page }) => {
  await setup(page); await page.goto(path);
  const insights = page.locator("section").filter({ has: page.getByRole("heading", { name: "Financial analytics insights", exact: true }) });
  await expect(insights.locator("article").first()).toContainText("require review");
  await expect(insights).toContainText("Largest source");
  await insights.locator("article").first().getByRole("button", { name: "Review" }).click();
  await expect(page.getByRole("dialog", { name: "Financial data integrity" })).toBeVisible();
});

test("a failed first load offers retry, and a failed refresh keeps the last results with a stale notice", async ({ page }) => {
  const first = await setup(page, { failFirst: true }); await page.goto(path);
  await expect(page.getByRole("alert").filter({ hasText: "temporarily unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Retry analytics" }).click();
  await expect(kpis(page)).toBeVisible();
  expect(first.requests.length).toBe(2);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const second = await setup(page, { failSecond: true }); await page.goto(path);
  await expect(kpis(page)).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Showing the results loaded at" })).toBeVisible();
  await expect(kpis(page).getByRole("button", { name: /^Recorded operating income/ }).locator("strong")).toHaveText("₱15,000.00");
  expect(second.requests.length).toBe(2);
});

test("Open Ledger Search navigates to the ledger with the term and exports request the full filtered report", async ({ page }) => {
  const { exports } = await setup(page); await page.goto(path);
  const search = page.getByRole("button", { name: "Open Ledger Search" });
  await expect(search).toBeDisabled();
  await page.getByLabel("Look up a ledger record").fill("FIN-2026-000317");
  const navigation = page.waitForRequest(request => request.url().includes("/financial-ledger") && request.url().includes("search=FIN-2026-000317"));
  await search.click();
  await navigation;
  await expect(page.getByRole("heading", { name: "Financial Ledger", exact: true })).toBeVisible();
  await page.goto(path);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  expect((await download).suggestedFilename()).toBe("financial-analytics-full.xlsx");
  expect(exports[0].searchParams.get("scope")).toBe("full");
  expect(exports[0].searchParams.get("start")).toBe("2026-10-01");
});

test("methodology drawer documents definitions, limits and thresholds", async ({ page }) => {
  await setup(page); await page.goto(path);
  await page.getByRole("button", { name: "Definitions & limits" }).click();
  const drawer = page.getByRole("dialog", { name: "Definitions, limits and rules" });
  await expect(drawer).toContainText("Recorded Net Surplus");
  await expect(drawer).toContainText("never added to headline totals");
  await expect(drawer).toContainText(/not an audited/);
});

test("reduced motion removes drawer animation and focus stays inside the open drawer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page); await page.goto(path);
  await kpis(page).getByRole("button", { name: /^Recorded operating income/ }).click();
  const drawer = page.getByRole("dialog", { name: "Income details" });
  await expect(drawer).toHaveCSS("animation-name", "none");
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("[role='dialog']"))).toBe(true);
});
