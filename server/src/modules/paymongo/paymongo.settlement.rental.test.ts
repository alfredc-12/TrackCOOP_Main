import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import { postRentalSettlement } from "./paymongo.settlement.rental";
import type { PaymentReferenceForSettlement } from "./paymongo.settlement.types";

function payment(amount = 1500): PaymentReferenceForSettlement {
  return {
    constructor: { name: "RowDataPacket" },
    id: "91",
    memberId: "8",
    payerName: "Juan Dela Cruz",
    payerEmail: null,
    payerContact: "09170000000",
    provider: "PayMongo",
    referenceNumber: "RNT-2026-0001-PAY",
    paymentPurpose: "Rental",
    relatedEntityType: "rental_bookings",
    relatedEntityId: "41",
    amount,
    validationStatus: "Pending",
    paymentChannel: "PayMongo",
    gatewayEnvironment: "Test",
    gatewayCheckoutId: "cs_test_rental",
    gatewayPaymentId: null,
    gatewayPaymentIntentId: null,
  } as PaymentReferenceForSettlement;
}

function connection(estimatedTotal = 1500) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const fake = {
    async execute(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (sql.includes("FROM rental_bookings")) {
        return [[{
          id: "41",
          bookingNumber: "RNT-2026-0001",
          memberId: "8",
          memberUserId: "18",
          requesterName: "Juan Dela Cruz",
          assetName: "Four-wheel Tractor",
          paymentStatus: "Unpaid",
          purpose: JSON.stringify({
            estimatedFee: { total: estimatedTotal },
            estimatedUsage: "2",
            unitOfMeasurement: "days",
          }),
        }], []];
      }
      if (sql.includes("FROM financial_categories")) return [[{ id: "6" }], []];
      return [{ affectedRows: 1 }, []];
    },
  } as unknown as PoolConnection;
  return { fake, calls };
}

test("rental settlement marks booking paid and creates rental income", async () => {
  const { fake, calls } = connection();
  const result = await postRentalSettlement({
    connection: fake,
    payment: payment(),
    actorUserId: "900",
    gatewayDetails: {
      amount: 1500,
      currency: "PHP",
      paidAt: new Date("2026-09-27T00:00:00.000Z"),
    },
  });

  assert.equal(result.subjectReference, "RNT-2026-0001");
  assert.equal(result.memberUserId, "18");
  assert.ok(calls.some(({ sql }) => sql.includes("SET payment_status = 'Paid'")));
  assert.ok(calls.some(({ sql }) => sql.includes("INSERT IGNORE INTO financial_records")));
});

test("rental settlement rejects an amount that differs from approved fee", async () => {
  const { fake, calls } = connection(1800);
  await assert.rejects(
    () => postRentalSettlement({ connection: fake, payment: payment(1500), actorUserId: "900" }),
    (error) => error instanceof AppError && error.code === "RENTAL_PAYMENT_AMOUNT_MISMATCH",
  );
  assert.equal(calls.some(({ sql }) => sql.includes("SET payment_status = 'Paid'")), false);
});
