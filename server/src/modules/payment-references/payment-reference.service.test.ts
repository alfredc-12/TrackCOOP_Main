import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { createPaymentReferenceService } from "./payment-reference.service";
import type { PaymentReferenceRepository } from "./payment-reference.repository";
import type { PaymentReference } from "./payment-reference.types";

const auth: AuthContext = {
  sessionId: "1",
  tokenHash: "hash",
  user: {
    id: "1",
    displayName: "Book Keeper",
    email: "bookkeeper@example.test",
    username: "bookkeeper",
    role: "bookkeeper",
  },
};

const payment: PaymentReference = {
  id: "10",
  memberId: null,
  submittedBy: null,
  payerName: "Sample Payer",
  payerEmail: null,
  payerContact: null,
  provider: "Reference-Based Payment",
  referenceNumber: "PAY-001",
  paymentPurpose: "Share Capital",
  relatedEntityType: null,
  relatedEntityId: null,
  amount: 1000,
  proofFilePath: null,
  validationStatus: "Pending",
  validatedBy: null,
  validatedAt: null,
  rejectionReason: null,
  notes: null,
  submittedAt: new Date("2026-07-18T00:00:00.000Z"),
  updatedAt: new Date("2026-07-18T00:00:00.000Z"),
};

function createRepository(overrides: Partial<PaymentReferenceRepository> = {}): PaymentReferenceRepository {
  return {
    async list() {
      return { paymentReferences: [], total: 0, page: 1, pageSize: 20 };
    },
    async findById() {
      return payment;
    },
    async create() {
      return payment;
    },
    async update() {
      return payment;
    },
    async setValidationStatus() {
      return { ...payment, validationStatus: "Rejected" };
    },
    ...overrides,
  };
}

test("rejectPaymentReference requires a reason", async () => {
  const service = createPaymentReferenceService(createRepository());

  await assert.rejects(
    () => service.rejectPaymentReference(payment.id, {}, auth),
    (error) =>
      error instanceof AppError && error.code === "PAYMENT_REVIEW_REASON_REQUIRED",
  );
});

test("validatePaymentReference delegates a real status transition", async () => {
  let delegated = false;
  const service = createPaymentReferenceService(
    createRepository({
      async setValidationStatus() {
        delegated = true;
        return { ...payment, validationStatus: "Validated" };
      },
    }),
  );

  const updated = await service.validatePaymentReference(payment.id, {}, auth);

  assert.equal(delegated, true);
  assert.equal(updated.validationStatus, "Validated");
});
