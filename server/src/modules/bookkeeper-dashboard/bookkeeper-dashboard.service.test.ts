import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";
import type { AuthService } from "../auth/auth.service";
import { resolveDashboardPeriod } from "./bookkeeper-dashboard.period";
import { buildDashboard } from "./bookkeeper-dashboard.service";
import { createBookkeeperDashboardRouter } from "./bookkeeper-dashboard.routes";
import type { DashboardExecutor } from "./bookkeeper-dashboard.repository";
import type { BookkeeperDashboardService } from "./bookkeeper-dashboard.service";

type Call = { sql: string; params: unknown[] };

/** Fake read-only executor. Routes each statement to a fixture by a distinctive fragment of its SQL. */
function fixtureDb(responses: Array<[RegExp, unknown[] | Error | ((params: unknown[]) => unknown[])]>) {
  const calls: Call[] = [];
  const db = {
    async execute(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      for (const [pattern, response] of responses) {
        if (!pattern.test(sql)) continue;
        if (response instanceof Error) throw response;
        return [typeof response === "function" ? response(params) : response, []];
      }
      throw new Error(`Unexpected SQL in fixture: ${sql.slice(0, 80)}`);
    },
  } as unknown as DashboardExecutor;
  return { db, calls };
}

const now = new Date("2026-11-04T14:42:00Z");
const period = resolveDashboardPeriod({ period: "month" }, now);

const baseResponses: Array<[RegExp, unknown[] | Error | ((params: unknown[]) => unknown[])]> = [
  // Operating totals: current period (start 2026-11-01) vs previous (2026-10-01).
  [/AS incomeCount/, (params) => (params[0] === "2026-11-01"
    ? [{ income: "3500.75", expenses: "1000.10", incomeCount: "3", expenseCount: "2" }]
    : [{ income: "2000.00", expenses: "1500.00", incomeCount: "1", expenseCount: "1" }])],
  [/AS reversalTotal/, [{ total: "-250.00", count: "1", reversalTotal: "-250.00", reversalCount: "1" }]],
  [/GROUP BY DATE_FORMAT/, [{ month: "2026-10", income: "2000.00", expenses: "1500.00" }, { month: "2026-11", income: "3500.75", expenses: "1000.10" }]],
  [/END AS source, /, [
    { source: "pos", amount: "1000.50", count: "1" },
    { source: "rental", amount: "2000.25", count: "1" },
    { source: "donations", amount: "500.00", count: "1" },
  ]],
  [/AS gross/, [{ gross: "1500.00", reversals: "200.00", count: "2" }]],
  [/GROUP BY fc.financial_category_id/, (params) => (params[0] === "2026-11-01"
    ? [{ id: "5", name: "Fuel and Gasoline", amount: "600.10", count: "1" }, { id: "6", name: "Utilities", amount: "400.00", count: "1" }]
    : [{ id: "5", name: "Fuel and Gasoline", amount: "300.00", count: "1" }])],
  [/FROM share_capital_accounts/, [{ balance: "75000.00", holders: "30" }]],
  [/FROM patronage_allocations/, [{ outstanding: "1200.00", allocations: "4" }]],
  [/FROM member_dividends/, [{ withdrawalCount: "2", withdrawalAmount: "800.00", capitalizationCount: "1", capitalizationAmount: "300.00" }]],
  [/AS awaitingReview/, [{ awaitingReview: "2", awaitingGateway: "5", needsClarification: "1", approvedToday: "3", exceptions: "1" }]],
  [/COUNT\(\*\) AS total FROM payment_references/, [{ total: "7" }]],
  [/AS reason/, [{ id: "9", referenceNumber: "PAY-9", payer: null, purpose: "Rental", channel: "Cash", amount: "150.00", status: "Pending", submittedAt: "2026-11-03T01:00:00Z", reason: "manual-review" }]],
  [/LIMIT 10/, [
    { id: "1", recordNumber: "FIN-1", date: "2026-11-03", source: "POS", category: "POS Sales", recordType: "Income", amount: "1000.50", recordStatus: "Active", posted: 1, operating: 1, capital: 0, paymentReferenceId: "9" },
    { id: "2", recordNumber: "FIN-2", date: "2026-11-02", source: "Membership", category: "Share Capital", recordType: "Income", amount: "1500.00", recordStatus: "Active", posted: 1, operating: 0, capital: 1, paymentReferenceId: "4" },
    { id: "3", recordNumber: "FIN-3", date: "2026-11-01", source: "Manual", category: "Fuel", recordType: "Expense", amount: "99.00", recordStatus: "Active", posted: 0, operating: 0, capital: 0, paymentReferenceId: null },
  ]],
];

test("dashboard figures are centavo-exact and adjustments are shown, never netted into surplus", async () => {
  const { db } = fixtureDb(baseResponses);
  const result = await buildDashboard(db, period, now);
  assert.deepEqual(result.errors, {});
  assert.equal(result.overview?.income, "3500.75");
  assert.equal(result.overview?.expenses, "1000.10");
  assert.equal(result.overview?.net, "2500.65"); // 3500.75 − 1000.10, not reduced by the −250.00 reversal adjustment
  assert.equal(result.overview?.adjustments.total, "-250.00");
  assert.equal(result.overview?.adjustments.reversalCount, 1);
  assert.equal(result.overview?.previous.net, "500.00");
  assert.equal(result.overview?.change.percent, "400.13"); // (2500.65 − 500.00) / 500.00
  assert.equal(result.scope.timezone, "Asia/Manila");
});

test("income sources add up to operating income and member capital stays outside it", async () => {
  const { db } = fixtureDb(baseResponses);
  const result = await buildDashboard(db, period, now);
  const sourceTotal = result.incomeBySource!.items.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
  assert.equal(sourceTotal, 350075);
  assert.equal(result.incomeBySource?.total, "3500.75");
  assert.equal(result.incomeBySource?.items[0].key, "rental");
  assert.equal(result.incomeBySource?.items.find((item) => item.key === "membership")?.sharePercent, "0.00");
  assert.equal(result.memberCapitalReceived?.net, "1300.00");
  assert.notEqual(result.overview?.income, result.memberCapitalReceived?.net);
  assert.equal(result.incomeBySource?.items.some((item) => /capital/i.test(item.label)), false);
});

test("expense categories are ranked with share and previous-period comparison", async () => {
  const { db } = fixtureDb(baseResponses);
  const result = await buildDashboard(db, period, now);
  const [top, second] = result.expenseByCategory!.items;
  assert.equal(result.expenseByCategory?.total, "1000.10");
  assert.equal(top.name, "Fuel and Gasoline");
  assert.equal(top.sharePercent, "60.00");
  assert.equal(top.change.percent, "100.03");
  assert.equal(second.previousAmount, "0.00");
  assert.equal(second.change.available, false);
});

test("recent activity separates operating, capital and unposted rows", async () => {
  const { db } = fixtureDb(baseResponses);
  const rows = (await buildDashboard(db, period, now)).recent!;
  assert.deepEqual(rows.map((row) => [row.status, row.classification]), [
    ["Posted", "operating"], ["Posted", "capital"], ["Unposted", "excluded"],
  ]);
});

test("attention separates manual review from gateway-managed pending payments", async () => {
  const { db } = fixtureDb(baseResponses);
  const attention = (await buildDashboard(db, period, now)).attention!;
  assert.equal(attention.awaitingReview, 2);
  assert.equal(attention.awaitingGateway, 5);
  assert.equal(attention.recordsNeedingAttention, 1);
  assert.equal(attention.testPaymentsExcluded, 7);
  assert.equal(attention.items[0].reason, "manual-review");
});

test("a failed section is isolated and the rest of the dashboard remains valid", async () => {
  const broken = Object.assign(new Error("missing"), { code: "ER_NO_SUCH_TABLE" });
  const { db } = fixtureDb([[/FROM patronage_allocations/, broken], ...baseResponses]);
  const result = await buildDashboard(db, period, now);
  assert.equal(result.member, null);
  assert.match(result.errors.member ?? "", /unavailable/);
  assert.equal(result.overview?.net, "2500.65");
});

test("an empty period yields zero amounts, no NaN and an unavailable percentage", async () => {
  const empty: Array<[RegExp, unknown[]]> = [
    [/AS incomeCount/, [{ income: "0.00", expenses: "0.00", incomeCount: "0", expenseCount: "0" }]],
    [/AS reversalTotal/, [{ total: "0.00", count: "0", reversalTotal: "0.00", reversalCount: "0" }]],
    [/GROUP BY DATE_FORMAT/, []], [/END AS source, /, []],
    [/AS gross/, [{ gross: "0.00", reversals: "0.00", count: "0" }]],
    [/GROUP BY fc.financial_category_id/, []],
    [/FROM share_capital_accounts/, [{ balance: "0.00", holders: "0" }]],
    [/FROM patronage_allocations/, [{ outstanding: "0.00", allocations: "0" }]],
    [/FROM member_dividends/, [{ withdrawalCount: "0", withdrawalAmount: "0.00", capitalizationCount: "0", capitalizationAmount: "0.00" }]],
    [/AS awaitingReview/, [{ awaitingReview: "0", awaitingGateway: "0", needsClarification: "0", approvedToday: "0", exceptions: "0" }]],
    [/COUNT\(\*\) AS total FROM payment_references/, [{ total: "0" }]],
    [/AS reason/, []], [/LIMIT 10/, []],
  ];
  const { db } = fixtureDb(empty);
  const result = await buildDashboard(db, period, now);
  assert.equal(result.overview?.net, "0.00");
  assert.equal(result.overview?.change.available, false);
  assert.equal(result.trend?.length, 6);
  assert.ok(result.trend?.every((point) => point.net === "0.00"));
  assert.equal(result.incomeBySource?.items.every((item) => item.sharePercent === null), true);
  assert.equal(JSON.stringify(result).includes("NaN"), false);
});

test("a negative-surplus period keeps its sign", async () => {
  const deficit = baseResponses.map(([pattern, response]) => (String(pattern) === String(/AS incomeCount/)
    ? [pattern, (params: unknown[]) => (params[0] === "2026-11-01"
      ? [{ income: "100.00", expenses: "350.25", incomeCount: "1", expenseCount: "1" }]
      : [{ income: "100.00", expenses: "50.00", incomeCount: "1", expenseCount: "1" }])] as [RegExp, (p: unknown[]) => unknown[]]
    : [pattern, response] as [RegExp, unknown[] | Error | ((p: unknown[]) => unknown[])]));
  const result = await buildDashboard(fixtureDb(deficit).db, period, now);
  assert.equal(result.overview?.net, "-250.25");
  assert.equal(result.overview?.change.direction, "down");
});

test("every query applies the shared posted rule, excludes test payments, uses Manila dates and no session clock", async () => {
  const { db, calls } = fixtureDb(baseResponses);
  await buildDashboard(db, period, now);
  const sql = calls.map((call) => call.sql).join("\n");
  assert.doesNotMatch(sql, /UTC_DATE|CURRENT_DATE|CURDATE|NOW\(\)|UTC_TIMESTAMP/);
  const financial = calls.filter((call) => /FROM financial_records fr/.test(call.sql) && /record_type = 'Expense'|AS incomeCount|GROUP BY DATE_FORMAT|END AS source, /.test(call.sql));
  assert.ok(financial.length >= 5);
  for (const call of financial) {
    assert.match(call.sql, /fr\.approved_by IS NOT NULL/);
    assert.match(call.sql, /fr\.record_status = 'Active'/);
    assert.match(call.sql, /gateway_environment\s*=\s*'Test'/);
    assert.match(call.sql, /SHARE_CAPITAL/);
  }
  const attention = calls.find((call) => /AS awaitingReview/.test(call.sql))!;
  assert.deepEqual(attention.params, ["2026-11-03 16:00:00", "2026-11-04 16:00:00"]); // Manila 4 Nov as UTC bounds
  const current = calls.find((call) => /AS incomeCount/.test(call.sql))!;
  assert.deepEqual(current.params, ["2026-11-01", "2026-11-04"]);
  const capital = calls.find((call) => /AS gross/.test(call.sql))!;
  assert.match(capital.sql, /gateway_environment\s*=\s*'Test'/);
});

test("the dashboard issues only read statements", async () => {
  const { db, calls } = fixtureDb(baseResponses);
  await buildDashboard(db, period, now);
  assert.ok(calls.length > 10);
  for (const call of calls) assert.match(call.sql.trim(), /^SELECT/i);
});

test("the endpoint is Bookkeeper-only, validates filters and returns no-store", async () => {
  let role = "bookkeeper";
  let loggedIn = true;
  let reads = 0;
  const auth = { authenticate: async () => {
    if (!loggedIn) throw new AppError("Login required", 401, "UNAUTHENTICATED");
    return { sessionId: "1", tokenHash: "fixture", user: { id: "1", role, displayName: "Staff" } };
  } } as unknown as AuthService;
  const service = { dashboard: async () => { reads += 1; return { ok: true }; } } as unknown as BookkeeperDashboardService;
  const app = express();
  app.use("/api", createBookkeeperDashboardRouter(auth, service));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server failed");
  const url = `http://127.0.0.1:${address.port}/api/bookkeeper/financial-dashboard`;
  try {
    for (const denied of ["chairman", "member", "admin"]) {
      role = denied;
      assert.equal((await fetch(url)).status, 403, denied);
    }
    assert.equal(reads, 0);
    role = "bookkeeper";
    const ok = await fetch(url);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("cache-control"), "no-store");
    assert.equal((await fetch(`${url}?period=forever`)).status, 422);
    assert.equal((await fetch(`${url}?period=month&extra=1`)).status, 422);
    assert.equal((await fetch(`${url}?period=custom&start=2026-01-01&end=2026-01-31`)).status, 200);
    assert.equal((await fetch(url, { method: "POST" })).status >= 400, true);
    loggedIn = false;
    assert.equal((await fetch(url)).status, 401);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
