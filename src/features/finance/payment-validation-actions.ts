import type { PaymentGatewayEvent, PaymentReferenceDetail } from "./finance-api";

export type PaymentMutationAction = "validate" | "reject" | "clarification" | "reverse" | "retry";
export type PaymentActionDialogState = {
  open: boolean;
  action: PaymentMutationAction | null;
  gatewayEventId: string | null;
  reason: string;
  confirmation: string;
  recoveryNote: string;
  submitting: boolean;
};

export const initialPaymentActionDialogState: PaymentActionDialogState = {
  open: false,
  action: null,
  gatewayEventId: null,
  reason: "",
  confirmation: "",
  recoveryNote: "",
  submitting: false,
};

export function openPaymentAction(
  action: PaymentMutationAction,
  gatewayEventId: string | null = null,
): PaymentActionDialogState {
  return { ...initialPaymentActionDialogState, open: true, action, gatewayEventId };
}
export function closePaymentAction(): PaymentActionDialogState {
  return initialPaymentActionDialogState;
}
export function beginPaymentAction(state: PaymentActionDialogState) {
  if (!state.open || !state.action || state.submitting) return state;
  return { ...state, submitting: true };
}
export function updatePaymentAction(
  state: PaymentActionDialogState,
  patch: Partial<Pick<PaymentActionDialogState, "reason" | "confirmation" | "recoveryNote">>,
) {
  return { ...state, ...patch };
}

export function paymentActionEffect(action: PaymentMutationAction) {
  const effects: Record<PaymentMutationAction, string> = {
    validate: "Marks this manual payment as Validated and posts its supported finance, requirement, receipt, and Share Capital effects.",
    reject: "Marks the payment as Rejected, records your reason, and prevents settlement until it is returned to Pending.",
    clarification: "Marks the payment as Needs Clarification and records the reason for staff and applicant follow-up.",
    reverse: "Creates reversing accounting entries and marks linked payment postings Reversed without automatically revoking membership.",
    retry: "Replays settlement from the stored, previously verified PayMongo event fields. No browser webhook payload is accepted.",
  };
  return effects[action];
}

export function canConfirmPaymentAction(
  state: PaymentActionDialogState,
  payment: Pick<PaymentReferenceDetail, "referenceNumber">,
) {
  if (!state.open || !state.action || state.submitting) return false;
  if (["reject", "clarification", "reverse"].includes(state.action) && state.reason.trim().length < 8) return false;
  if (state.action === "reverse" && state.confirmation.trim() !== payment.referenceNumber) return false;
  if (state.action === "retry" && state.recoveryNote.trim().length < 8) return false;
  return true;
}

export function canRetryGatewayEvent(event: Pick<PaymentGatewayEvent, "processingStatus" | "signatureVerified" | "eligibleForRetry">) {
  return event.processingStatus === "Failed" && event.signatureVerified && event.eligibleForRetry;
}


export function canUsePaymentMutationControls(role: string) {
  return role === "bookkeeper";
}

export function totalPaymentPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}
export function clampPaymentPage(page: number, total: number, pageSize: number) {
  return Math.min(Math.max(1, page), totalPaymentPages(total, pageSize));
}
