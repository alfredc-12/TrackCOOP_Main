export type BudgetCandidate = {
  lineId: string; budgetId: string; categoryId: string; seasonId: string | null;
  startDate: string; endDate: string; status: string; limit: string;
  warningPercentage: string; hardLimit: boolean;
};
export type ExpenseKey = { date: string; categoryId: string; seasonId: string | null };
export type Assignment = { state: "ASSIGNED"; line: BudgetCandidate } | { state: "UNBUDGETED" | "AMBIGUOUS" };

// Integer cents fit safely in BigInt even when SUM(DECIMAL) exceeds JS safe integers.
export function cents(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw new Error("Invalid nonnegative decimal amount");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}
export function money(value: bigint): string {
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}
export function selectBudgetLine(expense: ExpenseKey, candidates: BudgetCandidate[]): Assignment {
  const eligible = candidates.filter((c) => c.status === "Approved" && c.categoryId === expense.categoryId && c.startDate <= expense.date && c.endDate >= expense.date);
  const exact = expense.seasonId === null ? [] : eligible.filter((c) => c.seasonId === expense.seasonId);
  const matches = exact.length ? exact : eligible.filter((c) => c.seasonId === null);
  if (matches.length > 1) return { state: "AMBIGUOUS" };
  return matches.length ? { state: "ASSIGNED", line: matches[0] } : { state: "UNBUDGETED" };
}
export type SpendRow = { recordStatus: string; approvedBy: string | null; recordType: string; amount: string; assignedLineId: string | null; explicitPending: boolean; eligible: boolean; assignmentValid?: boolean };
export type Totals = { posted: string; drafts: string; pending: string; unresolved: number };
export function calculateAssignedTotals(lineId: string, rows: SpendRow[]): Totals {
  let posted = BigInt(0), drafts = BigInt(0), pending = BigInt(0), unresolved = 0;
  for (const row of rows) {
    if (row.recordStatus !== "Active" || row.recordType !== "Expense") continue;
    if (row.approvedBy && (!row.eligible || !row.assignedLineId || row.assignmentValid === false)) { unresolved++; continue; }
    if (row.assignedLineId !== lineId) continue;
    if (row.approvedBy && row.eligible) posted += cents(row.amount);
    else if (!row.approvedBy && row.explicitPending) pending += cents(row.amount);
    else if (!row.approvedBy) drafts += cents(row.amount);
  }
  return { posted: money(posted), drafts: money(drafts), pending: money(pending), unresolved };
}
export type GuardState = "WITHIN_BUDGET" | "WARNING" | "HARD_LIMIT_EXCEEDED" | "UNBUDGETED" | "AMBIGUOUS" | "BUDGET_UNAVAILABLE" | "HISTORICAL_ATTRIBUTION_REQUIRED" | "COMMITMENT_POLICY_REQUIRED" | "STALE_BUDGET";
export type BudgetEvaluation = { state: GuardState; blocked: boolean; lineId: string | null; unresolvedCount: number; posted: string; drafts: string; pending: string; limit: string | null; remaining: string | null; projected: string | null };
export function evaluateAssignedBudget(line: BudgetCandidate, totals: Totals, amount: string): BudgetEvaluation {
  const limit = cents(line.limit), spent = cents(totals.posted), proposal = cents(amount);
  if (proposal <= BigInt(0)) throw new Error("Expense amount must be positive");
  const projected = spent + proposal, remaining = limit - spent;
  const percentHundredths = cents(line.warningPercentage);
  if (percentHundredths <= BigInt(0) || percentHundredths > BigInt(10000)) throw new Error("Invalid warning threshold");
  const state: GuardState = totals.unresolved > 0 ? "HISTORICAL_ATTRIBUTION_REQUIRED"
    : cents(totals.pending) > BigInt(0) ? "COMMITMENT_POLICY_REQUIRED"
    : line.hardLimit && projected > limit ? "HARD_LIMIT_EXCEEDED"
    : limit === BigInt(0) || projected * BigInt(10000) >= limit * percentHundredths ? "WARNING" : "WITHIN_BUDGET";
  return { state, blocked: !["WITHIN_BUDGET", "WARNING"].includes(state), lineId: line.lineId, unresolvedCount: totals.unresolved, posted: totals.posted, drafts: totals.drafts, pending: totals.pending, limit: line.limit, remaining: money(remaining), projected: money(projected) };
}
