import assert from "node:assert/strict";
import test from "node:test";
import * as webWorkflow from "../../../../src/app/rental/_lib/rentalWorkflow";
import { getChairmanRentalActions } from "./rental-workflow";
import { confirmRentalPaymentState } from "./rental-payment-state";
import { assertRentalOperationPayment, rentalCanStartPayment, canTransitionRentalStatus } from "./rental-workflow";

for (const method of ["Cash", "Online"]) {
  test(`${method}: confirmation preserves the schedule, dates, work and operator`, () => {
    const original = { preferredPaymentMethod: method, statusOverride: "Scheduled", scheduleStatus: "Confirmed", assignedOperator: "Operator", dailyWork: [{ date: "2099-11-12", hectares: 3 }], paymentDeadline: "2099-11-10" };
    const meta = structuredClone(original);
    assert.equal(confirmRentalPaymentState("Scheduled", meta), "Scheduled");
    assert.deepEqual(meta, { ...original, paymentStatusOverride: "Paid" });
  });
}

test("late payment does not reopen cancelled or completed bookings", () => {
  for (const state of ["Cancelled", "Completed"]) {
    const meta = { statusOverride: state, scheduleStatus: state };
    assert.equal(confirmRentalPaymentState(state, meta), state);
    assert.equal(meta.scheduleStatus, state);
  }
});

test("legacy payment-first bookings remain approved for scheduling", () => {
  const meta: Record<string, unknown> = { statusOverride: "Payment Pending" };
  assert.equal(confirmRentalPaymentState("Pending", meta), "Approved");
  assert.equal(meta.statusOverride, "Approved for Scheduling");
  assert.equal(meta.scheduleStatus, "Proposed");
});

test("unpaid reservations can pay after scheduling, but cannot start or complete work", () => {
  for (const state of ["Pending", "Under Review", "Partially Paid", "Rejected", "Refunded", "Needs Clarification"] as const) {
    assert.equal(rentalCanStartPayment("Scheduled", state), true);
    assert.throws(() => assertRentalOperationPayment("In Progress", state), /verified/);
    assert.throws(() => assertRentalOperationPayment("Completed", state), /verified/);
    assert.doesNotThrow(() => assertRentalOperationPayment("Confirmed", state));
  }
  assert.equal(rentalCanStartPayment("Cancelled", "Pending"), false);
  assert.equal(rentalCanStartPayment("Scheduled", "Paid"), false);
  assert.doesNotThrow(() => assertRentalOperationPayment("In Progress", "Paid"));
  assert.equal(canTransitionRentalStatus("Payment Pending", "Scheduled"), true);
  assert.equal(canTransitionRentalStatus("Payment Under Review", "Scheduled"), true);
});

test("web and API keep start actions disabled until payment is verified", () => {
  for (const actions of [getChairmanRentalActions, webWorkflow.getChairmanRentalActions]) {
    assert.equal(actions("Scheduled", "Confirmed", "Pending").some(action => action.id === "mark-in-progress"), false);
    assert.equal(actions("Scheduled", "Confirmed", "Paid").some(action => action.id === "mark-in-progress"), true);
    assert.equal(actions("Payment Pending", "Proposed", "Pending").some(action => action.id === "confirm-schedule"), true);
  }
  assert.equal(webWorkflow.rentalCanStartPayment("Scheduled", "Pending"), true);
});
