import { createServer, type Server } from "node:http";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { BookkeeperDashboard } from "../../src/features/finance/bookkeeper-dashboard/dashboard-api";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 5365);
const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3145";
const dashboardPath = "/portal/bookkeeper/financial-dashboard";
const artifactDir =
  process.env.DASHBOARD_SCREENSHOT_DIR ??
  "C:/Users/Alfred/.gemini/antigravity/brain/e3dcf77f-0f37-49c4-9a4a-0703bcc3f5de";

const bookkeeperUser = {
  id: "7",
  username: "bookkeeper",
  email: "bookkeeper@nffac.test",
  displayName: "Maria Santos (Bookkeeper)",
  role: "bookkeeper",
  accountStatus: "Active",
};

const dashboardFixture: BookkeeperDashboard = {
  scope: {
    period: "month",
    label: "This month",
    start: "2026-11-01",
    end: "2026-11-04",
    previousStart: "2026-10-01",
    previousEnd: "2026-10-04",
    previousLabel: "Previous month",
    today: "2026-11-04",
    timezone: "Asia/Manila",
  },
  generatedAt: "2026-11-04T14:42:00.000Z",
  attention: {
    basis: "current-backlog",
    awaitingReview: 3,
    awaitingGateway: 4,
    needsClarification: 2,
    approvedToday: 6,
    recordsNeedingAttention: 1,
    testPaymentsExcluded: 5,
    items: [
      {
        id: "101",
        referenceNumber: "PAY-2026-0101",
        payer: "Juan Dela Cruz",
        purpose: "Rental",
        channel: "Cash",
        amount: "2450.00",
        status: "Validated",
        submittedAt: "2026-11-03T01:15:00.000Z",
        reason: "exception",
      },
      {
        id: "102",
        referenceNumber: "PAY-2026-0102",
        payer: "Elena Reyes",
        purpose: "POS/Product",
        channel: "Manual GCash",
        amount: "1180.50",
        status: "Pending",
        submittedAt: "2026-11-03T06:40:00.000Z",
        reason: "manual-review",
      },
      {
        id: "103",
        referenceNumber: "PAY-2026-0103",
        payer: "Roberto Mendoza",
        purpose: "Share Capital",
        channel: "Bank Transfer",
        amount: "1500.00",
        status: "Needs Clarification",
        submittedAt: "2026-11-04T00:20:00.000Z",
        reason: "clarification",
      },
    ],
  },
  overview: {
    income: "48250.75",
    expenses: "19420.25",
    net: "28830.50",
    incomeCount: 18,
    expenseCount: 9,
    previous: {
      income: "39100.00",
      expenses: "18100.00",
      net: "21000.00",
      start: "2026-10-01",
      end: "2026-10-04",
      label: "Previous month",
    },
    change: {
      available: true,
      percent: "37.29",
      direction: "up",
      absolute: "7830.50",
      reason: null,
    },
    adjustments: {
      total: "-1250.00",
      count: 1,
      reversalTotal: "-1250.00",
      reversalCount: 1,
    },
  },
  trend: [
    { month: "2026-06", income: "62400.00", expenses: "41800.00", net: "20600.00" },
    { month: "2026-07", income: "54800.00", expenses: "59200.00", net: "-4400.00" },
    { month: "2026-08", income: "71900.00", expenses: "45100.00", net: "26800.00" },
    { month: "2026-09", income: "68300.00", expenses: "43750.00", net: "24550.00" },
    { month: "2026-10", income: "79400.00", expenses: "48900.00", net: "30500.00" },
    { month: "2026-11", income: "48250.75", expenses: "19420.25", net: "28830.50" },
  ],
  incomeBySource: {
    total: "48250.75",
    items: [
      { key: "rental", label: "Equipment rentals", amount: "22400.00", count: 7, sharePercent: "46.42" },
      { key: "pos", label: "Store (POS) sales", amount: "18650.75", count: 8, sharePercent: "38.65" },
      { key: "donations", label: "Donations & grants", amount: "5000.00", count: 1, sharePercent: "10.36" },
      { key: "membership", label: "Membership fees", amount: "1200.00", count: 1, sharePercent: "2.49" },
      { key: "other", label: "Other operating income", amount: "1000.00", count: 1, sharePercent: "2.07" },
    ],
  },
  memberCapitalReceived: {
    net: "13500.00",
    gross: "15000.00",
    reversals: "1500.00",
    count: 6,
  },
  expenseByCategory: {
    total: "19420.25",
    items: [
      {
        id: "1",
        name: "Fuel and Gasoline",
        amount: "7850.25",
        count: 3,
        sharePercent: "40.42",
        previousAmount: "6200.00",
        change: { available: true, percent: "26.62", direction: "up", absolute: "1650.25", reason: null },
      },
      {
        id: "2",
        name: "Salaries and Wages",
        amount: "6500.00",
        count: 2,
        sharePercent: "33.47",
        previousAmount: "6500.00",
        change: { available: true, percent: "0.00", direction: "flat", absolute: "0.00", reason: null },
      },
      {
        id: "3",
        name: "Repair and Maintenance",
        amount: "3200.00",
        count: 2,
        sharePercent: "16.48",
        previousAmount: "4100.00",
        change: { available: true, percent: "-21.95", direction: "down", absolute: "-900.00", reason: null },
      },
      {
        id: "4",
        name: "Utilities",
        amount: "1870.00",
        count: 2,
        sharePercent: "9.63",
        previousAmount: "1300.00",
        change: { available: true, percent: "43.85", direction: "up", absolute: "570.00", reason: null },
      },
    ],
  },
  member: {
    capitalBalance: "412500.00",
    capitalHolders: 84,
    patronageOutstanding: "18400.00",
    patronageAllocations: 12,
    interestAwaitingAction: {
      withdrawalCount: 3,
      withdrawalAmount: "4200.00",
      capitalizationCount: 2,
      capitalizationAmount: "2650.00",
    },
  },
  recent: [
    {
      id: "501",
      recordNumber: "FIN-2026-0501",
      date: "2026-11-04",
      source: "Rental",
      category: "Rental Income",
      recordType: "Income",
      amount: "4800.00",
      status: "Posted",
      classification: "operating",
      paymentReferenceId: "88",
    },
    {
      id: "502",
      recordNumber: "FIN-OPEX-20261104-A1B2C3D4",
      date: "2026-11-04",
      source: "Manual",
      category: "Fuel and Gasoline",
      recordType: "Expense",
      amount: "2350.25",
      status: "Posted",
      classification: "operating",
      paymentReferenceId: null,
    },
    {
      id: "503",
      recordNumber: "PAY-FIN-91",
      date: "2026-11-03",
      source: "Membership",
      category: "Share Capital",
      recordType: "Income",
      amount: "1500.00",
      status: "Posted",
      classification: "capital",
      paymentReferenceId: "91",
    },
    {
      id: "504",
      recordNumber: "REV-412",
      date: "2026-11-02",
      source: "POS",
      category: "POS Sales",
      recordType: "Adjustment",
      amount: "-1250.00",
      status: "Posted",
      classification: "adjustment",
      paymentReferenceId: "74",
    },
    {
      id: "505",
      recordNumber: "FIN-2026-0499",
      date: "2026-11-01",
      source: "Manual",
      category: "Office Supplies",
      recordType: "Expense",
      amount: "680.00",
      status: "Unposted",
      classification: "excluded",
      paymentReferenceId: null,
    },
  ],
  errors: {},
};

let server: Server;
const envelope = (data: unknown) => JSON.stringify({ success: true, message: "ok", data, meta: {} });

test.beforeAll(async () => {
  mkdirSync(artifactDir, { recursive: true });
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(envelope(req.url === "/api/auth/me" ? bookkeeperUser : []));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(apiPort, resolve);
  });
});

test.afterAll(async () => {
  server?.closeAllConnections();
  await new Promise<void>((resolve, reject) => server?.close((err) => (err ? reject(err) : resolve())));
});

async function setupDashboard(
  page: Page,
  options: { payload?: BookkeeperDashboard; failAll?: boolean } = {},
) {
  await page.context().addCookies([
    { name: "trackcoop_session", value: "fixture-bookkeeper", url: origin },
  ]);
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ contentType: "application/json", body: envelope(bookkeeperUser) });
    }
    if (url.pathname === "/api/bookkeeper/financial-dashboard") {
      if (options.failAll) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Database connection unavailable — financial figures withheld.",
            errors: [],
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope(options.payload ?? dashboardFixture),
      });
    }
    return route.fulfill({ contentType: "application/json", body: envelope([]) });
  });
}

for (const [label, width, height] of [
  ["desktop", 1440, 1080],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
] as const) {
  test(`Bookkeeper Financial Dashboard renders accurately without horizontal overflow at ${label} (${width}px)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await setupDashboard(page);
    await page.setViewportSize({ width, height });
    await page.goto(dashboardPath);

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Financial Dashboard", exact: true })).toBeVisible({
      timeout: 25000,
    });
    await expect(main.getByRole("heading", { name: "Requires Bookkeeper Attention" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Operating Financial Overview" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Where Our Money Comes From" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Where Our Money Goes" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Member Capital & Benefits" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Recent Financial Records" })).toBeVisible();

    // Verify exact reconciled figures on screen
    await expect(page.getByText("₱48,250.75").first()).toBeVisible();
    await expect(page.getByText("₱19,420.25").first()).toBeVisible();
    await expect(page.getByText("₱28,830.50").first()).toBeVisible();
    await expect(page.getByText("₱13,500.00").first()).toBeVisible();

    const overflow = await page.evaluate(() => {
      const w = window.innerWidth;
      const culprits = Array.from(document.querySelectorAll("*"))
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            cls: (el as HTMLElement).className,
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter((item) => item.right > w + 1)
        .slice(0, 8);
      return {
        innerWidth: w,
        scrollWidth: document.documentElement.scrollWidth,
        culprits,
      };
    });
    expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(width + 1);
    expect(pageErrors).toEqual([]);

    const screenshotPath = path.join(artifactDir, `bookkeeper-dashboard-${label}-${width}px.png`);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
}

test("failed sections or top-level API errors never render fake ₱0.00 financial figures", async ({ page }) => {
  const partialFailure: BookkeeperDashboard = {
    ...dashboardFixture,
    overview: null,
    errors: { overview: "Operating totals could not be verified." },
  };
  await setupDashboard(page, { payload: partialFailure });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(dashboardPath);

  await expect(page.getByText("Operating totals could not be verified.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operating Financial Overview" })).toHaveCount(0);
  await expect(page.getByText("Net Operating Surplus", { exact: true })).toHaveCount(0);
  // Other healthy sections still render accurately
  await expect(page.getByText("₱412,500.00")).toBeVisible();

  // Full API failure withholds all cards and shows the top-level error alert
  await setupDashboard(page, { failAll: true });
  await page.reload();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Database connection unavailable");
  await expect(page.getByRole("heading", { name: "Operating Financial Overview" })).toHaveCount(0);
});

