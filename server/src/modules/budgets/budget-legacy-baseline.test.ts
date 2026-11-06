import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import { evaluateExpenseBudget } from "./budget-control";

type Line = { budgetLineId: string; budgetId: string; budgetName: string; coverageStart: string; coverageEnd: string; seasonId: string | null; limitAmount: string; warningPercentage: string; hardLimit: number };
type Expense = { amount: number; seasonId: string | null; approved: boolean; status: string };
const general: Line = { budgetLineId: "1", budgetId: "1", budgetName: "Synthetic general", coverageStart: "2026-01-01", coverageEnd: "2026-12-31", seasonId: null, limitAmount: "1000.00", warningPercentage: "80", hardLimit: 1 };
const expenses: Expense[] = [
  { amount: 400, seasonId: null, approved: true, status: "Active" },
  { amount: 75, seasonId: null, approved: false, status: "Active" },
  { amount: 300, seasonId: "2", approved: true, status: "Active" },
  { amount: 25, seasonId: "2", approved: false, status: "Active" },
  { amount: 200, seasonId: null, approved: true, status: "Voided" },
];
const input = { financialCategoryId: "5", amount: 100, expenseDate: "2026-06-01", seasonId: "2" };
function fixture(lines: Line[], failure?: Error) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const connection = { async execute(sql: string, params: unknown[]) {
    calls.push({ sql, params });
    if (failure) throw failure;
    if (sql.includes("FROM budget_lines")) return [lines.slice(0, 1), []];
    if (sql.includes("SUM(amount)")) {
      const season = sql.includes("season_id IS NULL") ? null : params[3];
      return [[{ spentAmount: expenses.filter((e) => e.status === "Active" && e.seasonId === season).reduce((n, e) => n + e.amount, 0) }], []];
    }
    throw new Error("Unexpected budget query");
  } } as unknown as PoolConnection;
  return { connection, calls };
}

test("legacy general fallback counts unposted unseasoned expense and misses seasonal posted expense", async () => {
  const db = fixture([general]);
  const actual = await evaluateExpenseBudget(db.connection, input);
  assert.equal(actual.budgetLineId, "1");
  assert.equal(actual.spentAmount, 475); // 400 posted + 75 unposted; 300 seasonal posted is omitted.
  assert.equal(actual.projectedAmount, 575);
  assert.match(db.calls[1].sql, /season_id IS NULL/);
  assert.doesNotMatch(db.calls[1].sql, /approved_by/);
  const intendedReviewedPosted = expenses.filter((e) => e.approved && e.status === "Active").reduce((n, e) => n + e.amount, 0);
  assert.equal(intendedReviewedPosted, 700); // Only valid if review confirms both expenses map to this general line.
  assert.notEqual(actual.spentAmount, intendedReviewedPosted);
});

test("exact seasonal match counts active unposted expenses; posted fixture is lower", async () => {
  const seasonal = { ...general, budgetLineId: "2", seasonId: "2" };
  const db = fixture([seasonal, general]);
  const actual = await evaluateExpenseBudget(db.connection, input);
  assert.equal(actual.spentAmount, 325);
  assert.equal(expenses.filter((e) => e.approved && e.status === "Active" && e.seasonId === "2").reduce((n, e) => n + e.amount, 0), 300);
  assert.match(db.calls[0].sql, /CASE WHEN bl\.season_id IS NULL THEN 1 ELSE 0 END/);
  assert.equal(db.calls[0].params[2], "2");
});

test("overlap chooses one candidate rather than reporting ambiguous attribution", async () => {
  const db = fixture([{ ...general, budgetLineId: "2" }, general]);
  const actual = await evaluateExpenseBudget(db.connection, input);
  assert.equal(actual.budgetLineId, "2");
  assert.match(db.calls[0].sql, /ORDER BY[\s\S]*coverage_start DESC[\s\S]*LIMIT 1/);
  // Two approved candidates are synthetic; ordering and result are modeled by the mock, not MySQL.
});

test("no matching line and a budget schema error both currently allow posting", async () => {
  const noLine = await evaluateExpenseBudget(fixture([]).connection, input);
  const unavailable = await evaluateExpenseBudget(fixture([], new Error("budget table unavailable")).connection, input);
  assert.equal(noLine.budgetLineId, null); assert.equal(noLine.blocked, false);
  assert.equal(unavailable.budgetLineId, null); assert.equal(unavailable.blocked, false);
  assert.match(noLine.message, /unbudgeted/);
  assert.match(unavailable.message, /without a budget check/);
  await assert.rejects(() => evaluateExpenseBudget(fixture([], new Error("connection reset")).connection, input), /connection reset/);
});
