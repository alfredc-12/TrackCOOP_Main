import assert from "node:assert/strict";
import test from "node:test";
import { createFinancialAnalyticsEngine, percentChange } from "./financial-analytics.engine";
import { fixtureFilters, fixtureSources } from "./financial-analytics.test-fixture";
import type { FinancialFact } from "./financial-analytics.types";

const report = (filters = fixtureFilters(), sources = fixtureSources()) => createFinancialAnalyticsEngine(sources, filters, new Date("2026-11-02T01:00:00Z"));

test("KPIs, comparison and margin come from eligible facts", () => {
  const { overview } = report().result;
  assert.deepEqual([overview.income, overview.expenses, overview.net, overview.margin], [15000, 4500, 10500, 70]);
  assert.deepEqual(overview.previous, { income: 15000, expenses: 5000, net: 10000, margin: 66.67 });
  assert.deepEqual([overview.incomeChange, overview.incomeChangePct, overview.expenseChange, overview.expenseChangePct, overview.netChange, overview.netChangePct], [0, 0, -500, -10, 500, 5]);
  assert.equal(overview.marginChangePoints, 3.33);
  assert.equal(overview.largestExpenseCategory?.name, "Fuel");
  assert.equal(overview.state, "ok");
});

test("decimal-safe aggregation avoids float drift", () => {
  const facts: FinancialFact[] = [10, 20].map(cents => ({ date: "2026-10-02", type: "Income", categoryId: "1", source: "POS", cents, count: 1 }));
  assert.equal(report(fixtureFilters(), fixtureSources({ facts })).result.overview.income, 0.3);
});

test("percent change is N/A for a zero base and for net values that cross zero", () => {
  assert.equal(percentChange(10, 0), null);
  assert.equal(percentChange(50, 100), -50);
  assert.equal(percentChange(-50, -100, true), 50);
  assert.equal(percentChange(500, -100, true), null);
  assert.equal(percentChange(0, -100, true), 100);
});

test("net surplus bridge reconciles exactly and includes new and discontinued categories", () => {
  const { netSurplusBridge: bridge } = report().result;
  assert.equal(bridge.available, true);
  assert.deepEqual([bridge.previousNet, bridge.currentNet, bridge.totalChange], [10000, 10500, 500]);
  assert.equal(bridge.drivers.reduce((total, d) => total + Math.round(d.effect * 100), 0), Math.round((bridge.currentNet - bridge.previousNet) * 100));
  assert.equal(Math.round((bridge.previousNet + bridge.drivers.reduce((t, d) => t + d.effect, 0)) * 100), 1_050_000);
  const byName = Object.fromEntries(bridge.drivers.map(d => [d.name, d]));
  assert.equal(byName["Equipment Rental"].effect, -5000);
  assert.equal(byName["Equipment Rental"].status, "discontinued");
  assert.equal(byName["Donations and Grants"].status, "new");
  assert.equal(byName["Fuel"].effect, -1500, "an expense increase lowers the surplus");
  assert.equal(byName["Salaries"].effect, 3000, "an expense decrease raises the surplus");
  assert.equal(bridge.drivers[0].name, "Equipment Rental", "largest absolute driver first");
});

test("source and category totals reconcile and shares are consistent", () => {
  const r = report().result;
  assert.equal(r.incomeSources.rows.reduce((t, row) => t + row.amount, 0), 15000);
  assert.equal(r.incomeCategories.rows.reduce((t, row) => t + row.amount, 0), 15000);
  assert.equal(r.expenseCategories.rows.reduce((t, row) => t + row.amount, 0), 4500);
  assert.equal(r.incomeSources.rows[0].name, "POS");
  assert.equal(r.incomeSources.rows[0].share, 80);
  assert.equal(r.incomeSources.rows.filter(row => row.amount > 0).reduce((t, row) => t + (row.share ?? 0), 0), 100);
  assert.deepEqual([r.incomeSources.concentration.topName, r.incomeSources.concentration.topShare, r.incomeSources.concentration.topTwoShare, r.incomeSources.concentration.topThreeShare], ["POS", 80, null, null]);
});

test("expense drivers rank by amount, flag new categories and report concentration", () => {
  const { expenseCategories } = report().result;
  assert.deepEqual(expenseCategories.rows.map(row => [row.name, row.amount]), [["Fuel", 3500], ["Repairs", 1000], ["Salaries", 0]]);
  assert.equal(expenseCategories.rows.find(row => row.name === "Repairs")?.isNew, true);
  assert.equal(expenseCategories.rows.find(row => row.name === "Fuel")?.changePct, 75);
  assert.equal(expenseCategories.count, 3);
  assert.equal(expenseCategories.averageAmount, 1500);
  assert.equal(expenseCategories.concentration.top1, 77.78);
  assert.equal(expenseCategories.concentration.top3, null, "fewer than four categories: top three is not a meaningful subset");
});

test("trend zero-fills empty calendar buckets and sums to the headline", () => {
  const { performanceTrend } = report(fixtureFilters({ granularity: "weekly" })).result;
  assert.deepEqual(performanceTrend.points.map(p => p.key), ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.equal(performanceTrend.points[0].from, "2026-10-01", "edge bucket is clipped to the reporting range");
  assert.deepEqual(performanceTrend.points.map(p => p.income), [12000, 3000, 0, 0, 0]);
  assert.equal(performanceTrend.points.reduce((t, p) => t + p.net, 0), 10500);
  assert.equal(performanceTrend.points.reduce((t, p) => t + p.recordCount, 0), 9);
});

test("trend never invents buckets before ledger coverage", () => {
  const { performanceTrend } = report(fixtureFilters({ period: "custom", start: "2026-06-01", end: "2026-10-31", compare: "none", compareStart: null, compareEnd: null })).result;
  assert.deepEqual(performanceTrend.points.map(p => p.key), ["2026-09", "2026-10"]);
});

test("tooltip change compares with the aligned comparison bucket, else the preceding bucket", () => {
  const monthly = report().result.performanceTrend.points[0];
  assert.equal(monthly.changeBasis, "comparison");
  assert.deepEqual([monthly.previous?.net, monthly.change?.net, monthly.change?.netPct], [10000, 500, 5]);
  const none = report(fixtureFilters({ compare: "none", compareStart: null, compareEnd: null, granularity: "weekly" })).result.performanceTrend.points;
  assert.equal(none[0].changeBasis, null);
  assert.equal(none[1].changeBasis, "preceding");
});

test("without a usable comparison the bridge explains why instead of showing zeros", () => {
  const none = report(fixtureFilters({ compare: "none", compareStart: null, compareEnd: null })).result;
  assert.equal(none.netSurplusBridge.available, false);
  assert.equal(none.overview.previous, null);
  assert.equal(none.overview.incomeChange, null);
  const early = report(fixtureFilters({ compareStart: "2026-01-01", compareEnd: "2026-01-31" })).result;
  assert.match(early.overview.comparisonUnavailableReason ?? "", /No ledger records exist before 2026-09-05/);
  assert.equal(early.overview.previous, null);
});

test("a single record-type scope reports net surplus, margin and the bridge as N/A", () => {
  const r = report(fixtureFilters({ recordType: "Income" })).result;
  assert.deepEqual([r.overview.net, r.overview.margin, r.overview.netChange], [null, null, null]);
  assert.equal(r.netSurplusBridge.available, false);
});

test("deficit and empty states are explicit", () => {
  const deficit = report(fixtureFilters(), fixtureSources({ facts: [{ date: "2026-10-04", type: "Expense", categoryId: "4", source: "Manual", cents: 500_000, count: 1 }, { date: "2026-10-05", type: "Income", categoryId: "1", source: "POS", cents: 100_000, count: 1 }] })).result;
  assert.equal(deficit.overview.state, "deficit");
  assert.equal(deficit.overview.net, -4000);
  assert.equal(deficit.overview.margin, -400);
  assert.equal(deficit.insights[0].id, "deficit");
  const empty = report(fixtureFilters(), fixtureSources({ facts: [], firstRecordDate: null })).result;
  assert.equal(empty.overview.state, "no-records");
  assert.equal(empty.overview.margin, null, "no income: margin is N/A, not 0%");
  assert.equal(empty.performanceTrend.points.length, 0);
});

test("matrix totals reconcile with the eligible totals and change values are signed", () => {
  const engine = report();
  const income = engine.matrix("Income");
  assert.equal(income.total, 15000);
  assert.equal(income.rows.reduce((t, row) => t + row.total, 0), 15000);
  assert.deepEqual(income.sources, ["Rental", "POS", "Other"]);
  const pos = income.rows.find(row => row.name === "POS Sales")!;
  assert.deepEqual([pos.cells.POS.amount, pos.cells.POS.previousAmount, pos.cells.POS.change, pos.cells.POS.count], [12000, 10000, 2000, 5]);
  assert.equal(pos.cells.POS.shareOfTotal, 80);
  assert.equal(pos.cells.POS.shareOfSource, 100);
  const expense = engine.matrix("Expense");
  assert.equal(expense.total, 4500);
  assert.equal(Object.values(expense.sourceTotals).reduce((t, v) => t + v.amount, 0), 4500);
});

test("period detail summarizes by day, category and source", () => {
  const detail = report().periodDetail({ from: "2026-10-01", to: "2026-10-15" });
  assert.deepEqual([detail.income, detail.expenses, detail.net, detail.recordCount], [15000, 0, 15000, 6]);
  assert.deepEqual(detail.daily.map(d => d.date), ["2026-10-03", "2026-10-10"]);
  assert.equal(detail.previous?.income, 0, "the 15 days before Oct 1 contain only September 17–30 expenses");
  assert.equal(detail.previous?.expenses, 3000);
});

function history(): FinancialFact[] {
  const out: FinancialFact[] = [];
  for (let year = 2023; year <= 2026; year++) for (let month = 1; month <= 12; month++) {
    if (year === 2026 && month > 10) break;
    const date = `${year}-${String(month).padStart(2, "0")}-10`;
    out.push({ date, type: "Income", categoryId: "1", source: "POS", cents: (1000 + month * 100) * 100, count: 1 });
    out.push({ date, type: "Expense", categoryId: "4", source: "Manual", cents: (month === 12 ? 1500 : 500) * 100, count: 1 });
  }
  return out;
}

test("one year of history is a monthly trend, not established seasonality", () => {
  const facts: FinancialFact[] = [...history().filter(f => f.date >= "2026-01-01"), { date: "2026-11-01", type: "Income", categoryId: "1", source: "POS", cents: 100, count: 1 }];
  const seasonal = report(fixtureFilters(), fixtureSources({ facts, firstRecordDate: "2026-01-10" })).result.seasonalPatterns;
  assert.equal(seasonal.established, false);
  assert.match(seasonal.statement, /not an established seasonal pattern/);
  assert.equal(seasonal.strongest.income, null);
  assert.equal(seasonal.months[1].observations, 1);
  assert.equal(seasonal.grid.at(-1)?.complete, false, "the current month is incomplete");
});

test("three comparable years establish seasonality using averages and medians of complete months", () => {
  const seasonal = report(fixtureFilters(), fixtureSources({ facts: history(), firstRecordDate: "2023-01-10" })).result.seasonalPatterns;
  assert.equal(seasonal.established, true);
  const december = seasonal.months[11];
  assert.deepEqual([december.observations, december.years, december.incomeAverage, december.expenseAverage], [3, [2023, 2024, 2025], 2200, 1500]);
  assert.equal(seasonal.strongest.income?.name, "December");
  assert.equal(seasonal.strongest.expense?.name, "December");
  assert.equal(seasonal.months[0].observations, 3, "January 2023 is excluded because the ledger began mid-January");
});

test("insights are rule based, traceable and ranked", () => {
  const { insights } = report(fixtureFilters(), fixtureSources({ facts: history(), firstRecordDate: "2023-01-10" })).result;
  assert.ok(insights.length <= 6);
  assert.deepEqual([...insights].sort((a, b) => b.priority - a.priority).map(i => i.id), insights.map(i => i.id));
  for (const insight of insights) {
    assert.ok(insight.title && insight.value && insight.explanation && insight.period);
    assert.ok(insight.drill.kind);
  }
  assert.ok(insights.some(i => i.id === "income-concentration"), "a single POS source holds 100% of income");
  assert.ok(insights.every(i => i.id !== "deficit"));
});

test("integrity issues surface as a review insight with neutral wording", () => {
  const sources = fixtureSources({ integrity: { postedCount: 8, reconciliation: [], issues: [{ code: "unposted", title: "Unposted records", label: "Unposted", available: true, count: 2, amount: 120, dateRange: { from: "2026-10-01", to: "2026-10-31" }, rule: "Active without approver", limitation: null, references: [], truncated: false, modules: ["Manual"], ledgerQuery: null, link: null }] } });
  const insight = report(fixtureFilters(), sources).result.insights.find(i => i.id === "integrity");
  assert.ok(insight);
  assert.match(insight!.caveat ?? "", /does not mean money is missing/);
});
