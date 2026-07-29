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
  paymentChannel: "Manual GCash",
  gatewayEnvironment: "Manual",
  gatewayCheckoutId: null,
  gatewayPaymentId: null,
  gatewayPaymentIntentId: null,
  gatewayStatus: null,
  gatewayPaymentMethod: null,
  gatewayFeeAmount: null,
  gatewayNetAmount: null,
  paidAt: null,
  webhookReceivedAt: null,
  validationSource: null,
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
    async summary() {
      return {
        total: 0,
        pendingManual: 0,
        needsClarification: 0,
        validatedToday: 0,
        paymongoTestPayments: 0,
        rejected: 0,
        validatedAmount: 0,
      };
    },
    async findById() {
      return payment;
    },
    async detail() {
      return {
        ...payment,
        memberCode: null,
        memberName: null,
        submittedByName: null,
        validatedByName: null,
        validationHistory: [],
        gatewayEvents: [],
        posting: {
          financialRecordId: null,
          financialRecordNumber: null,
          financialRecordStatus: null,
          shareCapitalPaymentId: null,
          shareCapitalStatus: null,
          membershipRequirementId: null,
          membershipRequirementStatus: null,
          membershipApplicationStatus: null,
          warnings: [],
        },
      };
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
    async reverse() {
      return {
        ...payment,
        validationStatus: "Reversed",
        memberCode: null,
        memberName: null,
        submittedByName: null,
        validatedByName: null,
        validationHistory: [],
        gatewayEvents: [],
        posting: {
          financialRecordId: null,
          financialRecordNumber: null,
          financialRecordStatus: null,
          shareCapitalPaymentId: null,
          shareCapitalStatus: null,
          membershipRequirementId: null,
          membershipRequirementStatus: null,
          membershipApplicationStatus: null,
          warnings: [],
        },
      };
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

test("validatePaymentReference delegates to the shared settlement service", async () => {
  let settlementCalled = false;
  let findCount = 0;
  const service = createPaymentReferenceService(
    createRepository({
      async findById() {
        findCount += 1;
        return findCount === 1
          ? payment
          : { ...payment, validationStatus: "Validated" };
      },
      async setValidationStatus() {
        throw new Error("manual validation must use settlement service");
      },
    }),
    {
      async settlePaymentReference(input) {
        settlementCalled = true;
        assert.equal(input.paymentReferenceId, payment.id);
        assert.equal(input.validationSource, "Manual Bookkeeper");
        assert.equal(input.actorUserId, auth.user.id);
        return {
          paymentReferenceId: input.paymentReferenceId,
          alreadySettled: false,
          validationStatus: "Validated",
          receiptStatus: null,
          receiptErrorCode: null,
        };
      },
    },
  );

  const updated = await service.validatePaymentReference(payment.id, {}, auth);

  assert.equal(settlementCalled, true);
  assert.ok(updated);
  assert.equal(updated.validationStatus, "Validated");
});

test("reversePaymentReference delegates a confirmed reversal", async () => {
  let reversalCalled = false;
  const service = createPaymentReferenceService(
    createRepository({
      async detail() {
        return {
          ...payment,
          validationStatus: reversalCalled ? "Reversed" : "Pending",
          memberCode: null,
          memberName: null,
          submittedByName: null,
          validatedByName: null,
          validationHistory: [],
          gatewayEvents: [],
          posting: {
            financialRecordId: null,
            financialRecordNumber: null,
            financialRecordStatus: null,
            shareCapitalPaymentId: null,
            shareCapitalStatus: null,
            membershipRequirementId: null,
            membershipRequirementStatus: null,
            membershipApplicationStatus: null,
            warnings: [],
          },
        };
      },
      async reverse(id, input, actionAuth) {
        reversalCalled = true;
        assert.equal(id, payment.id);
        assert.equal(input.reason, "Duplicate payment posting");
        assert.equal(input.confirmation, payment.referenceNumber);
        assert.equal(actionAuth.user.role, "bookkeeper");
        return {
          ...payment,
          validationStatus: "Reversed",
          memberCode: null,
          memberName: null,
          submittedByName: null,
          validatedByName: null,
          validationHistory: [],
          gatewayEvents: [],
          posting: {
            financialRecordId: null,
            financialRecordNumber: null,
            financialRecordStatus: null,
            shareCapitalPaymentId: null,
            shareCapitalStatus: null,
            membershipRequirementId: null,
            membershipRequirementStatus: null,
            membershipApplicationStatus: null,
            warnings: [],
          },
        };
      },
    }),
    undefined,
    undefined,
    {
      async reverse(input) {
        reversalCalled = true;
        assert.equal(input.paymentReferenceId, payment.id);
        assert.equal(input.reason, "Duplicate payment posting");
        assert.equal(input.confirmation, payment.referenceNumber);
        assert.equal(input.auth.user.role, "bookkeeper");
      },
    },
  );

  const reversed = await service.reversePaymentReference(
    payment.id,
    {
      reason: "Duplicate payment posting",
      confirmation: payment.referenceNumber,
    },
    auth,
  );

  assert.equal(reversalCalled, true);
  assert.ok(reversed);
  assert.equal(reversed.validationStatus, "Reversed");
});
