import { createHash } from "node:crypto";
import { AppError } from "../../utils/app-error";

export const taxonomy = {
  MISSING_POSTING: "High", DUPLICATE_POSTING: "Critical", POSSIBLE_DUPLICATE: "High", AMOUNT_MISMATCH: "High",
  PAYMENT_INCONSISTENCY: "High", RECEIPT_FAILURE: "Medium", RECEIPT_DELIVERY_FAILURE: "Medium", EVIDENCE_MISSING: "Medium",
  BUDGET_BLOCKED: "High", POLICY_CONFIGURATION: "High", STALE_APPROVAL: "High", UNBUDGETED_REVIEW: "High",
  CORRECTION_REQUIRED: "High", HISTORICAL_ATTRIBUTION: "High", SOURCE_PROCESSING_FAILURE: "High", LATE_EVENT: "Informational",
  PRIVACY_VIOLATION: "Critical", PAYMONGO_BYPASS: "Critical", CAPITAL_CAP_VIOLATION: "Critical", CLARIFICATION_PENDING: "Medium", DOCUMENT_STALE: "Medium",
} as const;
export type ExceptionCode = keyof typeof taxonomy;
export type SourceType = "payment_reference" | "financial_record" | "controlled_operation";
export type CaseState = "Open" | "Under Review" | "Awaiting Evidence" | "Escalated" | "Resolved" | "Closed" | "Reopened";
export type Role = "bookkeeper" | "chairman";
export type Action = "review" | "await_evidence" | "escalate" | "resolve" | "close" | "reopen";
export const reasonCodes = ["INVESTIGATION", "ASSIGNMENT", "EVIDENCE_REQUESTED", "ESCALATION_REQUIRED", "SOURCE_CONDITION_CLEARED", "REVIEW_COMPLETE", "CONDITION_RECURRED"] as const;
export type ReasonCode = typeof reasonCodes[number];
export function fingerprint(type: SourceType, id: string, code: ExceptionCode): string {
  if (!["payment_reference","financial_record","controlled_operation"].includes(type) || !/^[1-9]\d{0,19}$/.test(id) || !Object.hasOwn(taxonomy,code)) throw new AppError("Invalid exception identity",422,"INVALID_EXCEPTION");
  return createHash("sha256").update(`v1:${type}:${id}:${code}`).digest("hex");
}
export function transition(state: CaseState, action: Action, role: Role, reason: ReasonCode, condition: "present" | "cleared" | "unknown"): CaseState {
  const expected: Record<Action, ReasonCode> = { review:"INVESTIGATION", await_evidence:"EVIDENCE_REQUESTED", escalate:"ESCALATION_REQUIRED", resolve:"SOURCE_CONDITION_CLEARED", close:"REVIEW_COMPLETE", reopen:"CONDITION_RECURRED" };
  if (expected[action] !== reason) throw new AppError("Reason does not match the action",422,"INVALID_EXCEPTION_REASON");
  const next: Partial<Record<CaseState,Partial<Record<Action,CaseState>>>> = {
    Open:{review:"Under Review",await_evidence:"Awaiting Evidence",escalate:"Escalated"},
    "Under Review":{await_evidence:"Awaiting Evidence",escalate:"Escalated",resolve:"Resolved"},
    "Awaiting Evidence":{review:"Under Review",escalate:"Escalated",resolve:"Resolved"},
    Escalated:{review:"Under Review",resolve:"Resolved"},
    Resolved:{close:"Closed",reopen:"Reopened"}, Closed:{reopen:"Reopened"}, Reopened:{review:"Under Review",await_evidence:"Awaiting Evidence",escalate:"Escalated"},
  };
  if (state === "Escalated" && (action === "review" || action === "resolve") && role !== "chairman") throw new AppError("Chairman review required",403,"FORBIDDEN");
  const result = next[state]?.[action];
  if (!result) throw new AppError("Invalid exception transition",409,"EXCEPTION_STATE_CONFLICT");
  if ((action === "resolve" || action === "close") && condition !== "cleared") throw new AppError("Source condition is not verified as cleared",409,"EXCEPTION_CONDITION_UNRESOLVED");
  if (action === "reopen" && condition === "cleared") throw new AppError("Condition remains cleared",409,"EXCEPTION_CONDITION_CLEARED");
  return result;
}
