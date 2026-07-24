import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRentalStatusTransition,
  canTransitionRentalStatus,
  getChairmanRentalActions,
} from "./rentalWorkflow";

test("permits the normal inquiry review workflow", () => {
  assert.equal(canTransitionRentalStatus("New Inquiry", "Under Review"), true);
  assert.equal(
    canTransitionRentalStatus("Under Review", "Approved for Scheduling"),
    true,
  );
  assert.equal(
    canTransitionRentalStatus("Approved for Scheduling", "Scheduled"),
    true,
  );
});

test("rejects invalid terminal status transitions", () => {
  assert.equal(canTransitionRentalStatus("Completed", "Under Review"), false);
  assert.throws(
    () => assertRentalStatusTransition("Rejected", "Scheduled"),
    /cannot change/,
  );
});

test("offers the Chairman direct inquiry decisions for a new request", () => {
  const actions = getChairmanRentalActions("New Inquiry").map(
    (action) => action.id,
  );
  assert.ok(actions.includes("start-review"));
  assert.ok(actions.includes("approve-scheduling"));
  assert.ok(actions.includes("request-information"));
  assert.ok(actions.includes("place-hold"));
  assert.ok(actions.includes("reject-inquiry"));
  assert.equal(actions.includes("mark-completed"), false);
});

test("offers schedule and operations actions only at the correct stage", () => {
  assert.deepEqual(
    getChairmanRentalActions("Approved for Scheduling").map(
      (action) => action.id,
    ),
    ["place-hold", "propose-schedule", "cancel-booking"],
  );
  assert.ok(
    getChairmanRentalActions(
      "Awaiting Confirmation",
      "Awaiting Confirmation",
    ).some((action) => action.id === "confirm-schedule"),
  );
  assert.ok(
    getChairmanRentalActions("Rescheduled", "Proposed").some(
      (action) => action.id === "approve-rescheduling",
    ),
  );
  assert.deepEqual(
    getChairmanRentalActions("In Progress").map((action) => action.id),
    ["cancel-booking", "mark-completed"],
  );
});
