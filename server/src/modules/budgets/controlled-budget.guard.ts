import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { createHash } from "node:crypto";
import { withTransaction } from "../../db/transaction";
import { postedOperatingSql } from "../finance/financial-posting-rules";
import { calculateAssignedTotals, evaluateAssignedBudget, selectBudgetLine, cents, type BudgetCandidate, type BudgetEvaluation, type ExpenseKey, type SpendRow } from "./controlled-budget.model";

type CandidateRow = RowDataPacket & BudgetCandidate;
type FinancialRow = RowDataPacket & SpendRow;
export type GuardInput = ExpenseKey & { amount: string; expectedBasis: string; operationKey: string; actorId: string };
export type GuardResult = { state: "POSTED" | "REPLAY"; operationReference: string } | BudgetEvaluation;
const denied = (state: BudgetEvaluation["state"]): BudgetEvaluation => ({ state, blocked: true, lineId: null, unresolvedCount: 0, posted: "0.00", drafts: "0.00", pending: "0.00", limit: null, remaining: null, projected: null });
export function budgetBasis(line: BudgetCandidate): string {
  return createHash("sha256").update(JSON.stringify([line.lineId, line.budgetId, line.categoryId, line.seasonId, line.startDate, line.endDate, line.status, line.limit, line.warningPercentage, line.hardLimit])).digest("hex");
}
async function candidates(connection: PoolConnection, input: ExpenseKey): Promise<BudgetCandidate[]> {
  const [rows] = await connection.execute<CandidateRow[]>(`SELECT CAST(bl.budget_line_id AS CHAR) AS lineId, CAST(b.budget_id AS CHAR) AS budgetId,
    CAST(bl.financial_category_id AS CHAR) AS categoryId, CAST(bl.season_id AS CHAR) AS seasonId,
    DATE_FORMAT(b.coverage_start,'%Y-%m-%d') AS startDate, DATE_FORMAT(b.coverage_end,'%Y-%m-%d') AS endDate,
    b.budget_status AS status, CAST(bl.limit_amount AS CHAR) AS \`limit\`, CAST(bl.warning_percentage AS CHAR) AS warningPercentage, bl.hard_limit AS hardLimit
    FROM budget_lines bl JOIN budgets b ON b.budget_id=bl.budget_id
    WHERE bl.financial_category_id=? AND ? BETWEEN b.coverage_start AND b.coverage_end AND b.budget_status='Approved'
    AND (bl.season_id IS NULL OR bl.season_id=?) FOR UPDATE`, [input.categoryId, input.date, input.seasonId]);
  return rows.map((r) => ({ ...r, hardLimit: Boolean(r.hardLimit) }));
}
async function totals(connection: PoolConnection, line: BudgetCandidate) {
  const [rows] = await connection.execute<FinancialRow[]>(`SELECT fr.record_status AS recordStatus, CAST(fr.approved_by AS CHAR) AS approvedBy,
    fr.record_type AS recordType, CAST(fr.amount AS CHAR) AS amount, CAST(a.budget_line_id AS CHAR) AS assignedLineId,
    (a.commitment_state='Pending') AS explicitPending, (fr.financial_category_id=? AND (? IS NULL OR fr.season_id=?) AND fr.record_date BETWEEN ? AND ?) AS assignmentValid, (${postedOperatingSql("fr", "fc")}) AS eligible
    FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id=fr.financial_category_id
    LEFT JOIN budget_expense_assignments a ON a.financial_record_id=fr.financial_record_id
    WHERE (a.budget_line_id=? OR (a.financial_record_id IS NULL AND fr.financial_category_id=? AND fr.record_date BETWEEN ? AND ?))
    AND fr.record_type='Expense'`, [line.categoryId, line.seasonId, line.seasonId, line.startDate, line.endDate, line.lineId, line.categoryId, line.startDate, line.endDate]);
  return calculateAssignedTotals(line.lineId, rows.map((r) => ({ ...r, eligible: Boolean(r.eligible), explicitPending: Boolean(r.explicitPending), assignmentValid: Boolean(r.assignmentValid) })));
}

// Internal-only foundation. The callback and its source write must use this connection;
// all future controlled writers and budget transitions must acquire the same mutex.
// This function is not connected to any current route or posting service.
export async function withControlledBudget(pool: Pool, input: GuardInput, post: (connection: PoolConnection, line: BudgetCandidate) => Promise<string>): Promise<GuardResult> {
  if (!/^[a-f0-9]{64}$/.test(input.operationKey) || !/^[a-f0-9]{64}$/.test(input.expectedBasis) || !/^[1-9]\d*$/.test(input.actorId)) throw new Error("Invalid budget guard request");
  const requestHash = createHash("sha256").update(JSON.stringify([input.date, input.categoryId, input.seasonId, input.amount, input.expectedBasis, input.actorId])).digest("hex");
  let postAttempted = false;
  try { return await withTransaction(async (connection) => {
    let lines: BudgetCandidate[];
    try {
      const [mutex] = await connection.execute<RowDataPacket[]>("SELECT mutex_id FROM budget_control_mutex WHERE mutex_id=1 FOR UPDATE");
      if (!mutex.length) return denied("BUDGET_UNAVAILABLE");
      const [prior] = await connection.execute<RowDataPacket[]>("SELECT request_hash AS requestHash, operation_reference AS operationReference FROM budget_guard_operations WHERE operation_key=?", [input.operationKey]);
      if (prior.length) {
        if (prior[0].requestHash !== requestHash) throw new Error("Idempotency key reused with different request");
        return { state: "REPLAY", operationReference: String(prior[0].operationReference) };
      }
      lines = await candidates(connection, input);
    } catch (error) {
      if (error instanceof Error && error.message === "Idempotency key reused with different request") throw error;
      return denied("BUDGET_UNAVAILABLE");
    }
    const assignment = selectBudgetLine(input, lines);
    if (assignment.state !== "ASSIGNED") return denied(assignment.state);
    if (budgetBasis(assignment.line) !== input.expectedBasis) return denied("STALE_BUDGET");
    let result: BudgetEvaluation;
    try { result = evaluateAssignedBudget(assignment.line, await totals(connection, assignment.line), input.amount); }
    catch { return denied("BUDGET_UNAVAILABLE"); }
    if (result.blocked) return result;
    postAttempted = true;
    const operationReference = await post(connection, assignment.line);
    if (!/^[1-9]\d*$/.test(operationReference)) throw new Error("Invalid controlled financial record ID");
    const [records] = await connection.execute<RowDataPacket[]>(`SELECT CAST(fr.financial_category_id AS CHAR) AS categoryId, CAST(fr.season_id AS CHAR) AS seasonId, DATE_FORMAT(fr.record_date,'%Y-%m-%d') AS recordDate, CAST(fr.amount AS CHAR) AS amount, (${postedOperatingSql("fr", "fc")}) AS eligible FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id=fr.financial_category_id WHERE fr.financial_record_id=? FOR UPDATE`, [operationReference]);
    const record = records[0];
    if (!record || !record.eligible || record.categoryId !== input.categoryId || record.seasonId !== input.seasonId || record.recordDate !== input.date || cents(String(record.amount)) !== cents(input.amount)) throw new Error("Controlled post does not match guarded expense");
    await connection.execute("INSERT INTO budget_expense_assignments(financial_record_id,budget_line_id,assigned_by) VALUES(?,?,?)", [operationReference, assignment.line.lineId, input.actorId]);
    await connection.execute("INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,new_values,action_time) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP())", [input.actorId, "budget.assignment_created", "financial_records", operationReference, "A controlled expense was assigned to a budget line.", JSON.stringify({ budgetLineId: assignment.line.lineId, recordId: operationReference })]);
    await connection.execute("INSERT INTO budget_guard_operations(operation_key,request_hash,operation_reference) VALUES(?,?,?)", [input.operationKey, requestHash, operationReference]);
    return { state: "POSTED", operationReference };
  }, pool); } catch (error) {
    if (postAttempted || (error instanceof Error && error.message === "Idempotency key reused with different request")) throw error;
    return denied("BUDGET_UNAVAILABLE");
  }
}

// Read-only, conservative preview; records needing historical decisions are never assigned here.
export async function previewControlledBudget(pool: Pool, input: ExpenseKey & { amount: string }): Promise<{ evaluation: BudgetEvaluation; basis: string | null }> {
  try {
    return await withTransaction(async (connection) => {
      const assignment = selectBudgetLine(input, await candidates(connection, input));
      if (assignment.state !== "ASSIGNED") return { evaluation: denied(assignment.state), basis: null };
      const line = assignment.line;
      return { evaluation: evaluateAssignedBudget(line, await totals(connection, line), input.amount), basis: budgetBasis(line) };
    }, pool);
  } catch { return { evaluation: denied("BUDGET_UNAVAILABLE"), basis: null }; }
}
