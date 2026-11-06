import assert from "node:assert/strict";
import test from "node:test";
import { budgetBasis } from "./controlled-budget.guard";
import { calculateAssignedTotals, cents, evaluateAssignedBudget, money, selectBudgetLine, type BudgetCandidate, type SpendRow } from "./controlled-budget.model";

const base: BudgetCandidate = { lineId: "10", budgetId: "1", categoryId: "4", seasonId: null, startDate: "2026-01-01", endDate: "2026-12-31", status: "Approved", limit: "100.00", warningPercentage: "80.00", hardLimit: true };
const seasonal = { ...base, lineId: "11", seasonId: "7" };
const expense = { date: "2026-06-01", categoryId: "4", seasonId: "7" };
const row = (overrides: Partial<SpendRow>): SpendRow => ({ recordStatus: "Active", approvedBy: "1", recordType: "Expense", amount: "0.10", assignedLineId: "10", explicitPending: false, eligible: true, ...overrides });

test("assignment prefers exact season, falls back to general, and rejects overlaps", () => {
  assert.deepEqual(selectBudgetLine(expense, [base, seasonal]), { state: "ASSIGNED", line: seasonal });
  assert.deepEqual(selectBudgetLine(expense, [base]), { state: "ASSIGNED", line: base });
  assert.equal(selectBudgetLine(expense, [seasonal, { ...seasonal, lineId: "12" }, base]).state, "AMBIGUOUS");
  assert.equal(selectBudgetLine(expense, [base, { ...base, lineId: "12" }]).state, "AMBIGUOUS");
  assert.equal(selectBudgetLine(expense, [{ ...base, status: "Closed" }]).state, "UNBUDGETED");
});

test("spending includes all assigned rows and separates pending, drafts, voided and unknown history", () => {
  const rows = [row({ amount: "0.10" }), row({ amount: "0.20" }), row({ approvedBy: null, amount: "2.00", explicitPending: true }), row({ approvedBy: null, amount: "3.00" }), row({ recordStatus: "Voided", amount: "7.00" }), row({ recordStatus: "Reversed", amount: "8.00" }), row({ assignedLineId: "11", amount: "9.00" }), row({ assignedLineId: null })];
  assert.deepEqual(calculateAssignedTotals("10", rows), { posted: "0.30", pending: "2.00", drafts: "3.00", unresolved: 1 });
  assert.equal(calculateAssignedTotals("10", [row({ eligible: false })]).unresolved, 1);
  assert.equal(calculateAssignedTotals("10", [row({ assignmentValid: false })]).unresolved, 1);
});

test("hard limit and warning boundaries use exact cents and never treat commitments as approved capacity policy", () => {
  const totals = { posted: "99.70", pending: "0.00", drafts: "2.00", unresolved: 0 };
  assert.equal(evaluateAssignedBudget(base, totals, "0.30").state, "WARNING");
  assert.equal(evaluateAssignedBudget(base, totals, "0.31").state, "HARD_LIMIT_EXCEEDED");
  assert.equal(evaluateAssignedBudget(base, { ...totals, pending: "0.01" }, "0.01").state, "COMMITMENT_POLICY_REQUIRED");
  assert.equal(evaluateAssignedBudget(base, { ...totals, unresolved: 1 }, "0.01").state, "HISTORICAL_ATTRIBUTION_REQUIRED");
  assert.equal(evaluateAssignedBudget({ ...base, limit: "0.00" }, { ...totals, posted: "0.00" }, "0.01").state, "HARD_LIMIT_EXCEEDED");
  assert.equal(money(cents("0.10") + cents("0.20")), "0.30");
  assert.notEqual(budgetBasis(base), budgetBasis({ ...base, limit: "101.00" }));
  assert.throws(() => cents("1.001"));
});

test("unavailable budget infrastructure blocks without calling a write", async () => {
  let called = false;
  const connection = { async beginTransaction() {}, async commit() {}, async rollback() {}, release() {}, async execute() { throw new Error("missing budget table"); } };
  const pool = { async getConnection() { return connection; } } as unknown as import("mysql2/promise").Pool;
  const { withControlledBudget } = await import("./controlled-budget.guard");
  const result = await withControlledBudget(pool, { ...expense, amount: "1.00", actorId: "1", operationKey: "a".repeat(64), expectedBasis: "b".repeat(64) }, async () => { called = true; return "1"; });
  assert.equal(result.state, "BUDGET_UNAVAILABLE");
  assert.equal(called, false);
  const offline = { async getConnection() { throw new Error("unavailable"); } } as unknown as import("mysql2/promise").Pool;
  const missing = await withControlledBudget(offline, { ...expense, amount: "1.00", actorId: "1", operationKey: "a".repeat(64), expectedBasis: "b".repeat(64) }, async () => { called = true; return "1"; });
  assert.equal(missing.state, "BUDGET_UNAVAILABLE");
  assert.equal(called, false);
});
