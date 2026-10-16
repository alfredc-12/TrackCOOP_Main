import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import { assertShareCapitalPaymentUpdateAllowed } from "./share-capital.rules";

test("allows notes-only updates for a validated Share Capital payment", () => {
  assert.doesNotThrow(() =>
    assertShareCapitalPaymentUpdateAllowed("Validated", { remarks: "Receipt checked" }),
  );
});

test("allows a validated payment to be reversed without changing its source fields", () => {
  assert.doesNotThrow(() =>
    assertShareCapitalPaymentUpdateAllowed("Validated", {
      paymentStatus: "Reversed",
      remarks: "Duplicate receipt",
    }),
  );
});

test("blocks changing the amount or member after validation", () => {
  assert.throws(
    () =>
      assertShareCapitalPaymentUpdateAllowed("Validated", {
        amount: 2_000,
      }),
    (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_VALIDATED_IMMUTABLE",
  );
});

test("allows normal edits while a payment is still pending", () => {
  assert.doesNotThrow(() =>
    assertShareCapitalPaymentUpdateAllowed("Pending", {
      memberId: "member-2",
      amount: 2_000,
      paymentDate: "2026-10-01",
      paymentStatus: "Validated",
    }),
  );
});
