import assert from "node:assert/strict";
import test from "node:test";
import {
  beginPaymentAction,
  canConfirmPaymentAction,
  canRetryGatewayEvent,
  canUsePaymentMutationControls,
  clampPaymentPage,
  initialPaymentActionDialogState,
  openPaymentAction,
  totalPaymentPages,
  updatePaymentAction,
} from "./payment-validation-actions";

const payment = { referenceNumber: "PAY-00042" };

test("mutation actions open a confirmation dialog before submission", () => {
  const state = openPaymentAction("validate");
  assert.equal(state.open, true);
  assert.equal(state.action, "validate");
  assert.equal(canConfirmPaymentAction(state, payment), true);
});

test("reject, clarification, reversal, and retry enforce their required inputs", () => {
  let reject = openPaymentAction("reject");
  assert.equal(canConfirmPaymentAction(reject, payment), false);
  reject = updatePaymentAction(reject, { reason: "Incorrect proof supplied" });
  assert.equal(canConfirmPaymentAction(reject, payment), true);

  let reverse = openPaymentAction("reverse");
  reverse = updatePaymentAction(reverse, { reason: "Duplicate payment posting", confirmation: "WRONG" });
  assert.equal(canConfirmPaymentAction(reverse, payment), false);
  reverse = updatePaymentAction(reverse, { confirmation: payment.referenceNumber });
  assert.equal(canConfirmPaymentAction(reverse, payment), true);

  let retry = openPaymentAction("retry", "77");
  assert.equal(canConfirmPaymentAction(retry, payment), false);
  retry = updatePaymentAction(retry, { recoveryNote: "Retry after member record reconciliation" });
  assert.equal(canConfirmPaymentAction(retry, payment), true);
});

test("submitting state prevents duplicate confirmation", () => {
  const state = beginPaymentAction(openPaymentAction("validate"));
  assert.equal(state.submitting, true);
  assert.equal(canConfirmPaymentAction(state, payment), false);
  assert.deepEqual(beginPaymentAction(state), state);
});

test("retry eligibility requires failed and signature-verified event", () => {
  assert.equal(canRetryGatewayEvent({ processingStatus: "Failed", signatureVerified: true, eligibleForRetry: true }), true);
  assert.equal(canRetryGatewayEvent({ processingStatus: "Failed", signatureVerified: false, eligibleForRetry: false }), false);
  assert.equal(canRetryGatewayEvent({ processingStatus: "Processed", signatureVerified: true, eligibleForRetry: false }), false);
});

test("pagination clamps invalid pages and honors total", () => {
  assert.equal(totalPaymentPages(51, 20), 3);
  assert.equal(clampPaymentPage(9, 51, 20), 3);
  assert.equal(clampPaymentPage(0, 0, 20), 1);
  assert.equal(initialPaymentActionDialogState.open, false);
});


test("Bookkeeper can mutate while Chairman and Member remain read-only", () => {
  assert.equal(canUsePaymentMutationControls("bookkeeper"), true);
  assert.equal(canUsePaymentMutationControls("chairman"), false);
  assert.equal(canUsePaymentMutationControls("member"), false);
});
