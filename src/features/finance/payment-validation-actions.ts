import type { PaymentGatewayEvent, PaymentReferenceDetail } from "./finance-api";

export type PaymentMutationAction = "validate" | "reject" | "clarification" | "reverse" | "retry";
export type PaymentActionDialogState = {
  open: boolean;
  action: PaymentMutationAction | null;
  gatewayEventId: string | null;
  reason: string;
  confirmation: string;
  recoveryNote: string;
  evidenceChecked: boolean;
  detailsChecked: boolean;
  submitting: boolean;
};

export const initialPaymentActionDialogState: PaymentActionDialogState = {
  open: false,
  action: null,
  gatewayEventId: null,
  reason: "",
  confirmation: "",
  recoveryNote: "",
  evidenceChecked: false,
  detailsChecked: false,
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
  patch: Partial<Pick<PaymentActionDialogState, "reason" | "confirmation" | "recoveryNote" | "evidenceChecked" | "detailsChecked">>,
) {
  return { ...state, ...patch };
}

export function paymentActionEffect(action: PaymentMutationAction) {
  const effects: Record<PaymentMutationAction, string> = {
    validate: "The payment will be marked Approved. TrackCOOP will safely create the related finance record, receipt, and membership or Share Capital update when applicable.",
    reject: "The payment will be marked Rejected. Your reason will be saved for the audit record, and no payment posting will be made.",
    clarification: "The payment will be marked Needs Correction. Your note will be saved so staff can tell the payer what to fix.",
    reverse: "TrackCOOP will create reversing accounting entries and mark linked payment records Reversed. Membership is not automatically cancelled.",
    retry: "TrackCOOP will safely retry the previously verified PayMongo event. It will not accept new payment details from this screen.",
  };
  return effects[action];
}

export function canConfirmPaymentAction(
  state: PaymentActionDialogState,
  payment: Pick<PaymentReferenceDetail, "referenceNumber">,
) {
  if (!state.open || !state.action || state.submitting) return false;
  if (state.action === "validate" && (!state.evidenceChecked || !state.detailsChecked)) return false;
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
