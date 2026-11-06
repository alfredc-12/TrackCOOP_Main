import { isCapitalMovement } from "./financial-posting-rules";
import { cents } from "../budgets/controlled-budget.model";
import { assessConfiguration, type PolicyRevision } from "../financial-policy/financial-policy.model";
import { AppError } from "../../utils/app-error";

export type ControlledState = "DRAFT" | "INCOMPLETE_EVIDENCE" | "CONFIGURATION_BLOCKED" | "BUDGET_BLOCKED" | "PENDING_APPROVAL" | "UNBUDGETED_REVIEWED" | "REJECTED" | "ROUTINE_POST_ELIGIBLE" | "APPROVED_FOR_POSTING" | "POSTED" | "CORRECTION_REQUESTED";
export type ControlledRecord = {
  id: string; makerId: string; recordType: "Income" | "Expense" | "Adjustment";
  sourceModule: string; sourceRecordId: string | null; paymentReferenceId: string | null; memberId: string | null;
  categoryId: string; categoryActive: boolean; categoryType: string | null; categoryCode: string | null; categoryName: string | null; amount: string; recordStatus: string; approvedBy: string | null;
};
export type BudgetDecision = { state: string; blocked: boolean; basis: string | null };
export type EvaluationInput = {
  record: ControlledRecord; evidenceVerified: boolean;
  threshold: PolicyRevision | null; restrictions: PolicyRevision | null;
  expectedPolicy: { threshold: number; restrictions: number } | undefined;
  budget: BudgetDecision | null; now: Date;
};
export type ControlledEvaluation = { state: ControlledState; code: string; configurationCode: "POLICY_CONFIGURATION_REQUIRED" | null; thresholdVersion: number | null; restrictionVersion: number | null; budgetBasis: string | null };

// evidenceVerified is supplied only by a trusted server-side evidence adapter.
// No user-submitted flag can establish a protected source/evidence relationship.
export function evaluateControlledRecord(input: EvaluationInput): ControlledEvaluation {
  const { record, threshold, restrictions, now } = input;
  const policy = assessConfiguration(threshold, restrictions, now, input.expectedPolicy);
  const result = (state: ControlledState, code: string): ControlledEvaluation => ({ state, code, configurationCode: policy.configurationComplete ? null : "POLICY_CONFIGURATION_REQUIRED", thresholdVersion: threshold?.version ?? null, restrictionVersion: restrictions?.version ?? null, budgetBasis: input.budget?.basis ?? null });
  if (record.recordStatus !== "Active" || record.approvedBy || !record.categoryActive || (record.recordType !== "Adjustment" && ![record.recordType,"Both"].includes(record.categoryType ?? "")) || record.sourceModule !== "Manual" || record.sourceRecordId || record.paymentReferenceId || record.memberId || isCapitalMovement(record) || !/^[1-9]\d*$/.test(record.categoryId)) return result("CONFIGURATION_BLOCKED", "SOURCE_OR_RECORD_INVALID");
  try { if (cents(record.amount) <= BigInt(0)) return result("CONFIGURATION_BLOCKED", "INVALID_AMOUNT"); }
  catch { return result("CONFIGURATION_BLOCKED", "INVALID_AMOUNT"); }
  if (!input.evidenceVerified) return result("INCOMPLETE_EVIDENCE", "EVIDENCE_REQUIRED");
  if (!policy.configurationComplete) return result("CONFIGURATION_BLOCKED", "POLICY_CONFIGURATION_REQUIRED");
  if (record.recordType === "Expense" && input.budget?.state === "UNBUDGETED") return result("PENDING_APPROVAL", "UNBUDGETED_REVIEW_REQUIRED");
  if (record.recordType === "Expense" && (!input.budget || input.budget.blocked || !input.budget.basis)) return result("BUDGET_BLOCKED", input.budget?.state ?? "BUDGET_UNAVAILABLE");
  const limit = threshold!.config as { amountPhp: string };
  const schedule = restrictions!.config as { categoryIds: string[]; sources: string[] };
  if (cents(record.amount) >= cents(limit.amountPhp) || schedule.categoryIds.includes(record.categoryId) || schedule.sources.includes(record.sourceModule) || record.recordType === "Adjustment") return result("PENDING_APPROVAL", "CHAIRMAN_APPROVAL_REQUIRED");
  return result("ROUTINE_POST_ELIGIBLE", "ROUTINE_ELIGIBLE");
}

export type OperationSnapshot = { version: number; state: ControlledState; makerId: string; thresholdVersion: number | null; restrictionVersion: number | null; budgetBasis: string | null };
export function decideApproval(operation: OperationSnapshot, expectedVersion: number, actor: { id: string; role: string }, decision: "approve" | "reject", reason: string, current: ControlledEvaluation): ControlledState {
  if (actor.role !== "chairman") throw new AppError("Chairman authorization required", 403, "FORBIDDEN");
  if (actor.id === operation.makerId) throw new AppError("A different reviewer is required", 403, "SELF_APPROVAL_FORBIDDEN");
  if (!reason.trim() || reason.trim().length > 2000) throw new AppError("A decision reason is required", 422, "DECISION_REASON_REQUIRED");
  if (operation.version !== expectedVersion || operation.state !== "PENDING_APPROVAL") throw new AppError("Operation is stale or not awaiting approval", 409, "CONTROLLED_OPERATION_CONFLICT");
  if (current.state !== "PENDING_APPROVAL" || current.thresholdVersion !== operation.thresholdVersion || current.restrictionVersion !== operation.restrictionVersion || current.budgetBasis !== operation.budgetBasis) throw new AppError("Policy, evidence or budget changed; reevaluate", 409, "CONTROLLED_REEVALUATION_REQUIRED");
  if (decision === "reject") return "REJECTED";
  return current.code === "UNBUDGETED_REVIEW_REQUIRED" ? "UNBUDGETED_REVIEWED" : "APPROVED_FOR_POSTING";
}

// PR 1C deliberately has no activation mechanism. No configuration can change this.
export function assertControlledPostingInactive(): never {
  throw new AppError("Controlled finance is inactive", 409, "CONTROLLED_FINANCE_INACTIVE");
}
