import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";

/**
 * Chairman Financial Overview against a mocked API. The mock records every request so the tests can assert
 * what the page asks the server for, and its figures follow the same arithmetic as the real API (category
 * and source totals add up to the headline; drivers add up to the change).
 */

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 5055);
const apiUrl = `http://localhost:${apiPort}`;
const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const base = "/api/financial-overview/expenses";

type Seen = Array<{ url: URL; method: string }>;

const chairman = { id: "1", username: "chair", email: "chair@example.test", displayName: "Chair", role: "chairman", accountStatus: "Active" };

let sessionServer: Server | null = null;

test.beforeAll(async () => {
  sessionServer = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.writeHead(200);
    response.end(request.url === "/api/auth/me" ? JSON.stringify({ success: true, message: "ok", data: chairman, meta: {} }) : JSON.stringify({ success: true, message: "ok", data: [], meta: {} }));
  });
  await new Promise<void>((resolve, reject) => {
    sessionServer?.once("error", reject);
    sessionServer?.listen(apiPort, resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => sessionServer?.close(() => resolve()));
});

const envelope = (data: unknown, meta: Record<string, unknown> = {}) => JSON.stringify({ success: true, message: "ok", data, meta });

const categories = [
  { categoryId: "5", code: "SALARIES_WAGES", name: "Salaries and Wages", isActive: true, expenseClass: "operating", amount: 5000, records: 1, share: 56.05, previousAmount: 0 },
  { categoryId: "3", code: "UTILITIES", name: "Utilities", isActive: true, expenseClass: "operating", amount: 2000, records: 1, share: 22.42, previousAmount: 2000 },
  { categoryId: "2", code: "FUEL_GASOLINE", name: "Fuel and Gasoline", isActive: true, expenseClass: "operating", amount: 1500.3, records: 2, share: 16.82, previousAmount: 800 },
  { categoryId: "9", code: "TRAINING_COSTS", name: "Training Costs", isActive: true, expenseClass: "operating", amount: 300, records: 1, share: 3.36, previousAmount: 0 },
  { categoryId: "4", code: "OFFICE_SUPPLIES", name: "Office Supplies", isActive: true, expenseClass: "operating", amount: 120, records: 1, share: 1.35, previousAmount: 100 },
];

const period = {
  preset: "this_month", label: "This month", today: "2026-11-12", selected: { startDate: "2026-11-01", endDate: "2026-11-30" },
  effective: { startDate: "2026-11-01", endDate: "2026-11-12", days: 12, periodDays: 30, partial: true },
  compare: "previous", previous: { startDate: "2026-10-01", endDate: "2026-10-12", days: 12 }, comparisonNote: null,
};

const summary = (overrides: Record<string, unknown> = {}) => ({
  period,
  capabilities: { seasons: true, budgets: true },
  totals: { amount: 8920.3, records: 6, averageAmount: 1486.72 },
  previousTotals: { amount: 3300, records: 4 },
  change: { amount: 5620.3, percent: 170.31, basis: "ok" },
  largestCategory: { categoryId: "5", name: "Salaries and Wages", amount: 5000, records: 1, share: 56.05 },
  secondary: { unposted: { records: 1, amount: 250 }, voided: { records: 1, amount: 123 }, correctedOrReversed: { records: 1, amount: 800 }, needsClassification: { records: 1, amount: 77 } },
  reconciliation: {
    selectedClasses: ["operating"],
    classTotals: [
      { expenseClass: "operating", records: 6, amount: 8920.3 }, { expenseClass: "other_recognized", records: 3, amount: 730 }, { expenseClass: "capital", records: 1, amount: 9000 },
      { expenseClass: "non_expense_disbursement", records: 2, amount: 4010 }, { expenseClass: "unclassified", records: 1, amount: 77 },
    ],
    recognizedExpenseTotal: 18727.3, analyticsComparableTotal: 18727.3, nonExpenseDisbursementTotal: 4010, reconciles: true,
  },
  limitations: ["Amounts are posted expense records from the ledger. The ledger does not record when or how an expense was paid, so this is not a cash-outflow figure."],
  ...overrides,
});

const buckets = Array.from({ length: 12 }, (_, index) => {
  const day = String(index + 1).padStart(2, "0");
  const amounts = [0, 300, 1000.1, 0, 500.2, 0, 0, 0, 0, 2000, 0, 5120];
  return {
    key: `2026-11-${day}`, label: `Nov ${index + 1}, 2026`, startDate: `2026-11-${day}`, endDate: `2026-11-${day}`, amount: amounts[index], records: amounts[index] > 0 ? 1 : 0,
    topCategory: amounts[index] > 0 ? { name: index === 11 ? "Salaries and Wages" : "Utilities", amount: amounts[index] } : null,
    previous: { label: `Oct ${index + 1}, 2026`, amount: index === 3 ? 800 : 0, records: index === 3 ? 1 : 0 },
  };
});

const record = (id: string, status = "Posted", amount = 5000) => ({
  id, recordNumber: `T-0000${id}`, recordDate: "2026-11-12", categoryId: "5", categoryCode: "SALARIES_WAGES", categoryName: "Salaries and Wages", expenseClass: "operating", classificationBasis: "registry",
  sourceModule: "Manual", sourceRecordId: null, amount, recordStatus: status === "Posted" || status === "Unposted" ? "Active" : status, postingStatus: status, description: "November payroll",
  recordedBy: { id: "2", name: "Book Keeper" }, postedBy: status === "Posted" ? { id: "1", name: "Chair Person" } : null, season: null, createdAt: "2026-11-12T01:00:00.000Z",
});

const recordDetail = (id: string) => ({
  ...record(id), remarks: "November payroll", rental: null, correctionOf: null, reversalOf: null, correctedBy: [], reversedBy: [],
  history: [{ action: "financial_record.posted", at: "2026-11-12T02:00:00.000Z", by: "Book Keeper", description: "posted" }],
  evidence: { available: false, note: "Supporting documents are not linked to financial records in the current database, so evidence coverage cannot be reported." },
  disbursement: { verified: false, note: "The ledger records when an expense was booked, not when or how it was paid. Actual disbursement is not verified here." },
  budget: null,
});

const options = {
  capabilities: { seasons: true, budgets: true },
  categories: categories.map((item) => ({ id: item.categoryId, code: item.code, name: item.name, isActive: true, expenseClass: "operating", records: item.records })),
  sourceModules: [{ value: "Manual", records: 4 }, { value: "Rental", records: 1 }, { value: "POS", records: 1 }],
  classes: [{ value: "operating", records: 6 }, { value: "capital", records: 1 }],
  recordedBy: [{ id: "2", name: "Book Keeper" }], postedBy: [{ id: "1", name: "Chair Person" }], seasons: [{ id: "1", name: "Wet 2026" }],
};

type Overrides = Partial<Record<string, (url: URL) => unknown>>;

async function mockApi(page: Page, seen: Seen, overrides: Overrides = {}, status: Record<string, number> = {}) {
  await page.context().addCookies([{ name: "trackcoop_session", value: "test-session", url: origin }]);
  await page.route(`${apiUrl}/api/**`, async (route) => {
    const url = new URL(route.request().url());
    seen.push({ url, method: route.request().method() });
    const path = url.pathname;
    const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" };
    const respond = (data: unknown) => route.fulfill({ status: 200, contentType: "application/json", headers, body: envelope(data) });
    if (status[path]) return route.fulfill({ status: status[path], contentType: "application/json", headers, body: JSON.stringify({ success: false, message: "The summary could not be loaded.", errors: [] }) });
    const override = overrides[path];
    if (override) return respond(override(url));

    if (path === "/api/auth/me") return respond(chairman);
    if (path === `${base}/summary`) return respond(summary());
    if (path === `${base}/trends`) return respond({ granularity: "day", buckets, total: 8920.3, records: 6, previousTotal: 3300 });
    if (path === `${base}/categories`) {
      const ids = url.searchParams.get("categoryIds")?.split(",") ?? [];
      const items = ids.length ? categories.filter((item) => ids.includes(item.categoryId)) : categories;
      return respond({ items, total: items.reduce((sum, item) => sum + item.amount, 0), records: items.length });
    }
    if (path === `${base}/sources`) {
      return respond({ total: 8920.3, items: [
        { sourceModule: "Manual", amount: 8300.1, records: 4, share: 93.05, previousAmount: 3300, change: 5000.1 },
        { sourceModule: "Rental", amount: 500.2, records: 1, share: 5.61, previousAmount: 0, change: 500.2 },
        { sourceModule: "POS", amount: 120, records: 1, share: 1.35, previousAmount: 0, change: 120 },
      ] });
    }
    if (path === `${base}/drivers`) {
      const items = [
        { categoryId: "5", name: "Salaries and Wages", current: 5000, previous: 0, change: 5000, changePercent: null, contribution: 88.96, state: "new" },
        { categoryId: "2", name: "Fuel and Gasoline", current: 1500.3, previous: 800, change: 700.3, changePercent: 87.54, contribution: 12.46, state: "increase" },
        { categoryId: "9", name: "Training Costs", current: 300, previous: 0, change: 300, changePercent: null, contribution: 5.34, state: "new" },
        { categoryId: "7", name: "Repair and Maintenance", current: 0, previous: 400, change: -400, changePercent: -100, contribution: -7.12, state: "stopped" },
      ];
      return respond({ available: true, unavailableReason: null, currentTotal: 8920.3, previousTotal: 3300, totalChange: 5620.3, items, largestIncrease: items[0], largestDecrease: items[3], reconciles: true });
    }
    if (path === `${base}/matrix`) {
      return respond({
        categories: [{ categoryId: "5", name: "Salaries and Wages", amount: 5000, records: 1 }, { categoryId: "2", name: "Fuel and Gasoline", amount: 1500.3, records: 2 }],
        sources: [{ sourceModule: "Manual", amount: 6000.1, records: 2 }, { sourceModule: "Rental", amount: 500.2, records: 1 }],
        cells: [
          { categoryId: "5", sourceModule: "Manual", amount: 5000, records: 1, share: 76.92, previousAmount: 0 },
          { categoryId: "2", sourceModule: "Manual", amount: 1000.1, records: 1, share: 15.39, previousAmount: 800 },
          { categoryId: "2", sourceModule: "Rental", amount: 500.2, records: 1, share: 7.7, previousAmount: 0 },
        ],
        total: 6500.3, records: 3, reconciles: true, hasPrevious: true,
      });
    }
    if (path === `${base}/integrity`) {
      return respond({ reviewCount: 2, checks: [
        { id: "unposted", label: "Unposted", status: "review", records: 1, amount: 250, description: "Active expense records still waiting for a posting approver.", drill: { view: "unposted" } },
        { id: "classification", label: "Classification missing", status: "review", records: 1, amount: 77, description: "Posted expense rows on a category that is not an Expense category.", drill: { classes: ["unclassified"] } },
        { id: "future-dated", label: "Dated after today", status: "ok", records: 0, amount: 0, description: "Posted expenses dated after today.", drill: null },
      ] });
    }
    if (path === `${base}/budget`) {
      return respond({ available: true, unavailableReason: null, unbudgeted: { categories: [{ categoryId: "3", name: "Utilities", amount: 2000, records: 1 }], amount: 2000, records: 1 }, lines: [
        { budgetLineId: "1", budgetId: "1", budgetName: "November", categoryId: "2", categoryName: "Fuel and Gasoline", seasonName: null, coverageStart: "2026-11-01", coverageEnd: "2026-11-30", limitAmount: 2000, warningPercentage: 80, hardLimit: true, spentAmount: 1550.3, records: 3, utilization: 77.52, remaining: 449.7, state: "within" },
      ] });
    }
    if (path === `${base}/insights`) {
      return respond([{ id: "change", text: "Posted expenses were PHP 5,620.30 (170.31%) higher than the comparison period.", basis: "PHP 8,920.30 for 2026-11-01 to 2026-11-12 against PHP 3,300.00 for 2026-10-01 to 2026-10-12.", drill: { panel: "drivers" } }]);
    }
    if (path === `${base}/options`) return respond(options);
    if (path === `${base}/records`) {
      const view = url.searchParams.get("view") ?? "posted";
      const rows = view === "unposted" ? [record("8", "Unposted", 250)] : [record("1"), record("2", "Posted", 2000), record("3", "Posted", 1000.1)];
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      return respond({ records: rows, total: view === "unposted" ? 1 : 6, totalAmount: view === "unposted" ? 250 : 8920.3, page: Number(url.searchParams.get("page") ?? 1), pageSize, view });
    }
    const detail = path.match(new RegExp(`^${base}/records/(\\d+)$`));
    if (detail) return respond(recordDetail(detail[1]));
    if (path === `${base}/export`) {
      return route.fulfill({
        status: 200, headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="trackcoop-expenses-summary-2026-11-12.pdf"', "Access-Control-Expose-Headers": "Content-Disposition" },
        body: Buffer.from("%PDF-1.4 test"),
      });
    }
    if (path.startsWith("/api/realtime")) return route.abort();
    return respond([]);
  });
}

const last = (seen: Seen, path: string) => [...seen].reverse().find((entry) => entry.url.pathname === `${base}/${path}`)?.url;
const calls = (seen: Seen, path: string) => seen.filter((entry) => entry.url.pathname === `${base}/${path}`).length;

async function open(page: Page, seen: Seen, search = "", overrides: Overrides = {}, status: Record<string, number> = {}) {
  await mockApi(page, seen, overrides, status);
  await page.goto(`/portal/chairman/finance${search}`, { waitUntil: "load" });
  await expect(page.getByRole("main").getByRole("heading", { name: "Financial Overview", level: 1 })).toBeVisible();
}

test("shows the four expense figures from the server and nothing the Chairman could change", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  await expect(page.getByRole("button", { name: /^Total posted operating expenses: ₱8,920\.30/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Expense change: \+₱5,620\.30/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Expense records: 6/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Largest expense category: Salaries and Wages/ })).toBeVisible();
  await expect(page.getByText("170.31%", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Average ₱1,486.72 per record")).toBeVisible();
  // Read-only: no recording form, no dashboard of income, no write calls.
  await expect(page.getByRole("button", { name: /record expense/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /net surplus|income/i })).toHaveCount(0);
  await expect(page.getByText("do not yet store when or how an expense was paid", { exact: false }).or(page.getByText("does not yet store when or how an expense was paid", { exact: false }))).toBeVisible();
  expect(seen.filter((entry) => entry.method !== "GET" && entry.method !== "OPTIONS")).toEqual([]);
});

test("a zero previous period shows N/A for the percentage but still the peso change", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen, "", { [`${base}/summary`]: () => summary({ previousTotals: { amount: 0, records: 0 }, change: { amount: 8920.3, percent: null, basis: "no_previous_base" } }) });
  await expect(page.getByRole("button", { name: /^Expense change: \+₱8,920\.30/ })).toBeVisible();
  await expect(page.getByText("Percentage N/A: no spending in the comparison period")).toBeVisible();
});

test("with no comparison the change card says so instead of inventing a number", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen, "?compare=none", { [`${base}/summary`]: () => summary({ previousTotals: null, change: { amount: null, percent: null, basis: "no_comparison" }, period: { ...period, compare: "none", previous: null } }) });
  await expect(page.getByRole("button", { name: /^Expense change: —/ })).toBeVisible();
  expect(last(seen, "summary")?.searchParams.get("compare")).toBe("none");
});

test("each KPI opens a right-hand drawer that closes on Escape and returns focus", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  const total = page.getByRole("button", { name: /^Total posted operating expenses/ });
  await total.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Total posted expenses" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("How this total is made up")).toBeVisible();
  await expect(drawer.getByText("The two agree.")).toBeVisible();
  const box = await drawer.boundingBox();
  expect(box!.x + box!.width).toBeGreaterThan(page.viewportSize()!.width - 2);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(total).toBeFocused();

  await page.getByRole("button", { name: /^Expense change/ }).click();
  await expect(page.getByRole("dialog", { name: "What changed in expenses" }).getByRole("table", { name: "Category comparison table" })).toBeVisible();
});

test("the Expense records card lists the posted records and the secondary counts filter the table", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  await page.getByRole("button", { name: /^Expense records: 6/ }).click();
  await expect(page.getByRole("heading", { name: "Expense records", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: /^Unposted 1/ }).click();
  await expect.poll(() => last(seen, "records")?.searchParams.get("view")).toBe("unposted");
  await expect(page.getByText("Records: Unposted")).toBeVisible();
  await expect(page).toHaveURL(/view=unposted/);
  await expect(page.getByText("T-00008").first()).toBeVisible();
});

test("period and category filters apply together, show as chips, persist in the URL and survive a reload", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  await page.getByRole("combobox", { name: "Period" }).click();
  await page.getByRole("option", { name: "Last month" }).click();
  await page.getByRole("button", { name: /^Category:/ }).click();
  await page.getByRole("checkbox", { name: "Fuel and Gasoline" }).check({ force: true });
  await page.getByRole("button", { name: "Done" }).click();
  // Nothing is applied until Apply is chosen.
  expect(last(seen, "summary")?.searchParams.get("period")).toBe("this_month");
  await expect(page.getByText("Changes are not applied yet.")).toBeVisible();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect.poll(() => last(seen, "summary")?.searchParams.get("period")).toBe("last_month");
  for (const path of ["summary", "trends", "categories", "sources", "drivers", "records"]) {
    expect(last(seen, path)?.searchParams.get("categoryIds"), path).toBe("2");
  }
  await expect(page.getByRole("list", { name: "Active filters" }).getByText("Period: Last month")).toBeVisible();
  await expect(page.getByRole("list", { name: "Active filters" }).getByText("Category: Fuel and Gasoline")).toBeVisible();
  await expect(page).toHaveURL(/period=last_month/);
  await expect(page).toHaveURL(/categoryIds=2/);

  await page.reload({ waitUntil: "load" });
  await expect.poll(() => last(seen, "summary")?.searchParams.get("period")).toBe("last_month");
  await expect(page.getByRole("list", { name: "Active filters" }).getByText("Category: Fuel and Gasoline")).toBeVisible();

  await page.getByRole("button", { name: "Remove filter: Category: Fuel and Gasoline" }).click();
  await expect.poll(() => last(seen, "summary")?.searchParams.get("categoryIds")).toBeNull();
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page.getByRole("list", { name: "Active filters" })).toHaveCount(0);
  await expect(page).not.toHaveURL(/period=/);
});

test("a custom range that ends before it starts cannot be applied", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  await page.getByRole("combobox", { name: "Period" }).click();
  await page.getByRole("option", { name: "Custom range" }).click();
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeDisabled();
  await expect(page.getByText("Choose a start and an end date")).toBeVisible();
});

test("search waits for a pause, then reaches the table and every panel", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  const before = calls(seen, "summary");
  const search = page.getByRole("searchbox", { name: "Search expense records" });
  await search.pressSequentially("fuel", { delay: 40 });
  expect(calls(seen, "summary")).toBe(before);
  await expect.poll(() => last(seen, "records")?.searchParams.get("search")).toBe("fuel");
  expect(last(seen, "summary")?.searchParams.get("search")).toBe("fuel");
  expect(calls(seen, "summary")).toBe(before + 1);
});

test("the trend chart opens a period drawer by keyboard", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  const chart = page.getByRole("group", { name: /Posted expenses over time/ });
  await chart.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Nov 2, 2026: ₱300.00 from 1 record.")).toBeVisible();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Nov 2, 2026" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("By category")).toBeVisible();
  await expect(drawer.getByRole("link", { name: /Financial Ledger/ })).toBeVisible();
  expect(last(seen, "records")?.searchParams.get("startDate")).toBe("2026-11-02");
  expect(last(seen, "records")?.searchParams.get("endDate")).toBe("2026-11-02");
});

test("the category chart opens details and its filter button lists that category's records", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  await page.getByRole("button", { name: /^Fuel and Gasoline: ₱1,500\.30/ }).click();
  const drawer = page.getByRole("dialog", { name: "Fuel and Gasoline" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Latest records")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Show records for Fuel and Gasoline" }).click();
  await expect.poll(() => last(seen, "records")?.searchParams.get("categoryIds")).toBe("2");
  await expect(page.getByRole("list", { name: "Active filters" }).getByText("Category: Fuel and Gasoline")).toBeVisible();
});

test("what changed lists every category and reconciles to the overall change", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  const card = page.getByRole("region", { name: "What changed in expenses?" }).or(page.locator("section", { has: page.getByRole("heading", { name: "What changed in expenses?" }) }));
  await expect(card.getByText("+₱5,620.30")).toBeVisible();
  await expect(card.getByText("Salaries and Wages +₱5,000.00")).toBeVisible();
  await expect(card.getByText("Repair and Maintenance −₱400.00")).toBeVisible();
  await card.getByRole("button", { name: /See every category/ }).click();
  const table = page.getByRole("dialog", { name: "What changed in expenses" }).getByRole("table", { name: "Category comparison table" });
  await expect(table.getByRole("row")).toHaveCount(5);
  await expect(table.getByText("No activity now")).toBeVisible();
  await expect(table.getByText("New this period").first()).toBeVisible();
});

test("the comparison matrix opens from the left, and a cell narrows the table to that category and source", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  await page.getByRole("button", { name: "Compare expenses" }).click();
  const drawer = page.getByRole("dialog", { name: "Compare expenses" });
  await expect(drawer).toBeVisible();
  expect((await drawer.boundingBox())!.x).toBeLessThanOrEqual(1);
  const table = drawer.getByRole("table");
  await expect(table.getByRole("row", { name: /All categories/ })).toBeVisible();
  await table.getByRole("button", { name: /^Fuel and Gasoline, Rental: ₱500\.20/ }).click();
  await expect.poll(() => last(seen, "records")?.searchParams.get("sourceModules")).toBe("Rental");
  expect(last(seen, "records")?.searchParams.get("categoryIds")).toBe("2");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a record opens read-only with posting, relationships and the limits of what is known", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  await page.getByRole("button", { name: "View expense record T-00001" }).click();
  const drawer = page.getByRole("dialog", { name: "Expense record" });
  await expect(drawer.getByText("T-00001")).toBeVisible();
  await expect(drawer.getByText("Posted by")).toBeVisible();
  await expect(drawer.getByText("Chair Person")).toBeVisible();
  await expect(drawer.getByText("not when or how it was paid", { exact: false })).toBeVisible();
  await expect(drawer.getByRole("link", { name: /Financial Ledger/ })).toBeVisible();
  await expect(drawer.getByRole("button", { name: /post|void|edit|reverse|delete/i })).toHaveCount(0);
});

test("integrity and budget context open as drawers with neutral wording", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen);
  await page.getByRole("button", { name: /^Data integrity/ }).click();
  const integrity = page.getByRole("dialog", { name: "Data integrity" });
  await expect(integrity.getByText("Requires review").first()).toBeVisible();
  await expect(integrity.getByText("does not by itself mean money is missing", { exact: false })).toBeVisible();
  await integrity.getByRole("button", { name: "Show records" }).first().click();
  await expect.poll(() => last(seen, "records")?.searchParams.get("view")).toBe("unposted");
  await page.getByRole("button", { name: "Budget details" }).click();
  const budget = page.getByRole("dialog", { name: "Budget context" });
  await expect(budget.getByText("77.52%")).toBeVisible();
  await expect(budget.getByRole("link", { name: /Budget Controls/ })).toBeVisible();
});

test("exports use the page's filters and download a file", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen, "?period=last_month&sourceModules=Rental");
  await page.getByRole("button", { name: /^Export/ }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Operating expense summary (PDF)" }).click()]);
  expect(download.suggestedFilename()).toBe("trackcoop-expenses-summary-2026-11-12.pdf");
  const request = last(seen, "export")!;
  expect(request.searchParams.get("kind")).toBe("summary");
  expect(request.searchParams.get("format")).toBe("pdf");
  expect(request.searchParams.get("period")).toBe("last_month");
  expect(request.searchParams.get("sourceModules")).toBe("Rental");
  expect(request.searchParams.has("page")).toBe(false);
});

test("a failed summary shows an error with Retry instead of zeros, and Retry recovers", async ({ page }) => {
  const seen: Seen = [];
  await mockApi(page, seen, {}, { [`${base}/summary`]: 500 });
  await page.goto("/portal/chairman/finance", { waitUntil: "load" });
  await expect(page.getByRole("alert").filter({ hasText: "The summary could not be loaded." }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Total posted operating expenses: ₱0/ })).toHaveCount(0);
  await page.unroute(`${apiUrl}/api/**`);
  await mockApi(page, seen);
  await page.getByRole("button", { name: "Retry" }).first().click();
  await expect(page.getByRole("button", { name: /^Total posted operating expenses: ₱8,920\.30/ })).toBeVisible();
});

test("an empty period says there is nothing, not zero pesos dressed as a result", async ({ page }) => {
  const seen: Seen = [];
  await open(page, seen, "", {
    [`${base}/summary`]: () => summary({ totals: { amount: 0, records: 0, averageAmount: null }, change: { amount: -3300, percent: -100, basis: "ok" }, largestCategory: null }),
    [`${base}/trends`]: () => ({ granularity: "day", buckets, total: 0, records: 0, previousTotal: 0 }),
    [`${base}/categories`]: () => ({ items: [], total: 0, records: 0 }),
    [`${base}/records`]: () => ({ records: [], total: 0, totalAmount: 0, page: 1, pageSize: 20, view: "posted" }),
  });
  await expect(page.getByRole("button", { name: /^Largest expense category: No data/ })).toBeVisible();
  await expect(page.getByText("Average per record: N/A")).toBeVisible();
  await expect(page.getByText("No posted expenses in this period.").first()).toBeVisible();
  await expect(page.getByText("No posted expense records match the selected period and filters.")).toBeVisible();
});

for (const width of [1440, 768, 390]) {
  test(`fits without horizontal scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const seen: Seen = [];
    await open(page, seen);
    await expect(page.getByRole("button", { name: /^Total posted operating expenses/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^View expense record T-00001/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    // Set EXPENSE_SHOTS=<folder> to keep screenshots for a visual review.
    const shots = process.env.EXPENSE_SHOTS;
    if (shots) {
      await page.screenshot({ path: `${shots}/overview-${width}.png`, fullPage: true });
      await page.getByRole("button", { name: "Compare expenses" }).click();
      await page.getByRole("dialog", { name: "Compare expenses" }).waitFor();
      await page.screenshot({ path: `${shots}/matrix-${width}.png` });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /^View expense record T-00001/ }).click();
      await page.getByRole("dialog", { name: "Expense record" }).getByText("Posted by").waitFor();
      await page.screenshot({ path: `${shots}/record-${width}.png` });
      await page.keyboard.press("Escape");
    }
    if (width < 1024) {
      await expect(page.getByRole("list", { name: "Expense records" })).toBeVisible();
    } else {
      await expect(page.getByRole("region", { name: "Expense records table" })).toBeVisible();
    }
    if (width < 768) {
      await page.getByRole("button", { name: /^Total posted operating expenses/ }).click();
      const sheet = page.getByRole("dialog", { name: "Total posted expenses" });
      const box = (await sheet.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(width - 2);
      expect(box.y).toBeGreaterThan(0); // a bottom sheet, not a full-height panel
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    }
  });
}
