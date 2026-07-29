import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import { hashApplicationTrackingToken } from "../membership-applications/public-tracking-token";
import { createPaymongoService } from "./paymongo.service";
import type {
  PaymongoCheckoutAttemptRecord,
  PaymongoCheckoutRequest,
  PaymongoCheckoutSession,
  PaymongoConfig,
  PaymongoMembershipApplicationRecord,
  PaymongoPaymentReferenceRecord,
} from "./paymongo.types";

const config: PaymongoConfig = {
  enabled: true,
  mode: "test",
  apiBaseUrl: "https://api.paymongo.test",
  secretKey: "sk_test_example",
  webhookSecret: "whsec_test_example",
  webhookToleranceSeconds: 300,
  paymentMethodTypes: ["card"],
  passOnFees: false,
  successUrl: "http://localhost:3000/payment/success",
  cancelUrl: "http://localhost:3000/payment/cancelled",
  timeoutMs: 1_000,
};

const trackingToken = "public-tracking-secret";

const application: PaymongoMembershipApplicationRecord = {
  id: "300",
  applicationCode: "MEM-APP-2026-000300",
  publicTrackingTokenHash: hashApplicationTrackingToken(trackingToken),
  requestedMembershipType: "Associate",
  fullName: "Public Applicant",
  email: "applicant@example.test",
  contactNumber: "09170000300",
  applicationStatus: "Submitted",
};

const paymentReference: PaymongoPaymentReferenceRecord = {
  id: "900",
  memberId: null,
  memberUserId: null,
  submittedBy: null,
  payerName: application.fullName,
  payerEmail: application.email,
  payerContact: application.contactNumber,
  provider: "PayMongo Hosted Checkout",
  referenceNumber: `${application.applicationCode}-FEE`,
  paymentPurpose: "Associate Membership Fee",
  relatedEntityType: "membership_application",
  relatedEntityId: application.id,
  amount: 200,
  validationStatus: "Pending",
  paymentChannel: "PayMongo",
  gatewayEnvironment: "Manual",
  gatewayCheckoutId: null,
  gatewayPaymentId: null,
  gatewayPaymentIntentId: null,
  gatewayStatus: null,
  idempotencyKey: "trackcoop-paymongo-membership-application-300-fee",
  paidAt: null,
};

function createSession(): PaymongoCheckoutSession {
  return {
    id: "cs_test_membership",
    checkoutUrl: "https://checkout.paymongo.com/cs_test_membership",
    status: "active",
    livemode: false,
    paymentIntentId: null,
    paymentId: null,
  };
}

function makeMembershipService(options: {
  applicationRecord?: PaymongoMembershipApplicationRecord | null;
  preparedReference?: PaymongoPaymentReferenceRecord;
  validatedFee?: number;
  validatedCapital?: number;
} = {}) {
  const checkoutCalls: Array<{ input: PaymongoCheckoutRequest; idempotencyKey: string }> = [];
  const preparedInputs: unknown[] = [];
  const attempts: PaymongoCheckoutAttemptRecord[] = [];
  let preparedRecord: PaymongoPaymentReferenceRecord | null = null;

  const service = createPaymongoService({
    config,
    client: {
      async createCheckoutSession(input, idempotencyKey) {
        checkoutCalls.push({ input, idempotencyKey });
        return createSession();
      },
      async retrieveCheckoutSession() {
        return createSession();
      },
    },
    repository: {
      async findPaymentReference() {
        return null;
      },
      async findMembershipApplicationByCode() {
        return options.applicationRecord === undefined
          ? application
          : options.applicationRecord;
      },
      async getMembershipPaymentSettings() {
        return {
          associateFee: 200,
          initialShareCapital: 1500,
          trueMemberRequiredCapital: 3000,
          maximumShareCapital: 15000,
        };
      },
      async prepareMembershipPaymentReference(input) {
        preparedInputs.push(input);
        preparedRecord = {
          ...paymentReference,
          ...options.preparedReference,
          amount: input.amount,
          paymentPurpose: input.paymentPurpose,
          referenceNumber:
            input.paymentPurpose === "Share Capital"
              ? `${application.applicationCode}-CAP`
              : `${application.applicationCode}-FEE`,
        };
        return preparedRecord;
      },
      async getValidatedMembershipPaymentTotal() {
        return 0;
      },
      async recordCheckoutSession() {
        return undefined;
      },
    },
    membershipInstallmentRepository: {
      async prepareMembershipPaymentReference(input) {
        preparedInputs.push(input);
        preparedRecord = {
          ...paymentReference,
          ...options.preparedReference,
          amount: input.requestedAmount,
          paymentPurpose: input.purpose,
          referenceNumber:
            input.purpose === "Share Capital"
              ? `${application.applicationCode}-CAP`
              : `${application.applicationCode}-FEE`,
        };
        return preparedRecord;
      },
      async assertCheckoutCapacity(input) {
        if (input.purpose === "Associate Membership Fee") {
          if ((options.validatedFee ?? 0) >= 200) {
            throw new AppError(
              "The associate membership fee has already been paid",
              409,
              "MEMBERSHIP_FEE_ALREADY_VALIDATED",
            );
          }
          return;
        }
        if ((options.validatedCapital ?? 0) + input.amount > 15000) {
          throw new AppError(
            "Share capital payment exceeds the maximum allowed amount",
            409,
            "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
          );
        }
      },
      async publicPaymentSummary() {
        throw new Error("not used in this test");
      },
    },
    attemptRepository: {
      async createOrReuseCheckoutAttempt(input) {
        const record = preparedRecord ?? options.preparedReference ?? paymentReference;
        await input.validateRecord(record, null);
        const reusable = attempts.find(
          (attempt) =>
            attempt.paymentReferenceId === input.paymentReferenceId
            && attempt.gatewayEnvironment === input.environment
            && !attempt.completedAt
            && !attempt.supersededAt,
        );
        if (reusable?.checkoutUrl) {
          return { record, attempt: { ...reusable, checkoutUrl: reusable.checkoutUrl }, reused: true };
        }
        const attemptNumber = attempts.length + 1;
        const idempotencyKey =
          record.idempotencyKey ?? `trackcoop-paymongo-payment-reference-${record.id}-attempt-${attemptNumber}`;
        const session = await input.createSession(record, idempotencyKey);
        const attempt: PaymongoCheckoutAttemptRecord & { checkoutUrl: string } = {
          id: String(attemptNumber),
          paymentReferenceId: record.id,
          attemptNumber,
          idempotencyKey,
          checkoutId: session.id,
          checkoutUrl: session.checkoutUrl,
          gatewayStatus: session.status,
          gatewayEnvironment: input.environment,
          amount: record.amount,
          currency: "PHP",
          lastCheckedAt: null,
          reusableUntil: new Date(Date.now() + input.reuseMinutes * 60_000),
          supersededAt: null,
          completedAt: null,
        };
        attempts.push(attempt);
        return { record, attempt, reused: false };
      },
      async findLatestCheckoutAttempt() {
        return attempts.at(-1) ?? null;
      },
      async refreshCheckoutAttempt() {
        return undefined;
      },
    },
  });

  return { service, checkoutCalls, preparedInputs, attempts };
}

test("createMembershipApplicationCheckout creates a fee checkout with the correct tracking token", async () => {
  const { service, checkoutCalls, attempts } = makeMembershipService();

  const result = await service.createMembershipApplicationCheckout(
    application.applicationCode,
    trackingToken,
    { paymentPurpose: "Associate Membership Fee" },
  );

  assert.equal(result.checkoutUrl, "https://checkout.paymongo.com/cs_test_membership");
  assert.equal(result.paymentPurpose, "Associate Membership Fee");
  assert.equal(result.amount, 200);
  assert.equal(result.status, "Waiting");
  assert.equal(checkoutCalls[0].input.metadata.trackcoop_reference_number, `${application.applicationCode}-FEE`);
  assert.equal(checkoutCalls[0].input.metadata.payment_purpose, "Associate Membership Fee");
  assert.equal(checkoutCalls[0].input.metadata.trackcoop_payment_reference_id, "900");
  assert.equal(attempts.length, 1);
});

test("createMembershipApplicationCheckout rejects the wrong tracking token", async () => {
  const { service } = makeMembershipService();

  await assert.rejects(
    () =>
      service.createMembershipApplicationCheckout(application.applicationCode, "wrong-token", {
        paymentPurpose: "Associate Membership Fee",
      }),
    (error) => error instanceof AppError && error.code === "APPLICATION_TRACKING_TOKEN_INVALID",
  );
});

test("createMembershipApplicationCheckout rejects unknown applications", async () => {
  const { service } = makeMembershipService({ applicationRecord: null });

  await assert.rejects(
    () =>
      service.createMembershipApplicationCheckout("MEM-APP-MISSING", trackingToken, {
        paymentPurpose: "Associate Membership Fee",
      }),
    (error) => error instanceof AppError && error.code === "MEMBERSHIP_APPLICATION_NOT_FOUND",
  );
});

test("createMembershipApplicationCheckout rejects an already-paid membership fee", async () => {
  const { service } = makeMembershipService({ validatedFee: 200 });

  await assert.rejects(
    () =>
      service.createMembershipApplicationCheckout(application.applicationCode, trackingToken, {
        paymentPurpose: "Associate Membership Fee",
      }),
    (error) => error instanceof AppError && error.code === "MEMBERSHIP_FEE_ALREADY_VALIDATED",
  );
});

test("createMembershipApplicationCheckout supports True Member share capital", async () => {
  const { service, checkoutCalls } = makeMembershipService({
    applicationRecord: {
      ...application,
      requestedMembershipType: "True Member",
    },
  });

  const result = await service.createMembershipApplicationCheckout(
    application.applicationCode,
    trackingToken,
    { paymentPurpose: "Share Capital", requestedAmount: 1500 },
  );

  assert.equal(result.paymentPurpose, "Share Capital");
  assert.equal(result.amount, 1500);
  assert.equal(checkoutCalls[0].input.lineItems[0].amount, 150_000);
});

test("createMembershipApplicationCheckout prevents exceeding maximum share capital", async () => {
  const { service } = makeMembershipService({
    applicationRecord: {
      ...application,
      requestedMembershipType: "True Member",
    },
    validatedCapital: 14000,
  });

  await assert.rejects(
    () =>
      service.createMembershipApplicationCheckout(application.applicationCode, trackingToken, {
        paymentPurpose: "Share Capital",
        requestedAmount: 1500,
      }),
    (error) => error instanceof AppError && error.code === "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
  );
});

test("createMembershipApplicationCheckout reuses idempotency for duplicate clicks", async () => {
  const { service, checkoutCalls } = makeMembershipService({
    preparedReference: {
      ...paymentReference,
      gatewayCheckoutId: "cs_test_existing",
      gatewayEnvironment: "Test",
      gatewayStatus: "active",
      idempotencyKey: "existing-membership-checkout-key",
    },
  });

  await service.createMembershipApplicationCheckout(application.applicationCode, trackingToken, {
    paymentPurpose: "Associate Membership Fee",
  });
  const second = await service.createMembershipApplicationCheckout(application.applicationCode, trackingToken, {
    paymentPurpose: "Associate Membership Fee",
  });

  assert.equal(checkoutCalls.length, 1);
  assert.equal(checkoutCalls[0].idempotencyKey, "existing-membership-checkout-key");
  assert.equal(second.reused, true);
});

test("payment return pages are informational and do not mutate status", () => {
  const successPage = readFileSync(
    path.join(process.cwd(), "src/app/payment/success/page.tsx"),
    "utf8",
  );
  const cancelledPage = readFileSync(
    path.join(process.cwd(), "src/app/payment/cancelled/page.tsx"),
    "utf8",
  );

  assert.match(successPage, /webhook confirms/i);
  assert.match(successPage, /does not update your payment status/i);
  assert.doesNotMatch(successPage, /apiRequest|fetch\(/);
  assert.match(cancelledPage, /does not reject your membership application/i);
  assert.doesNotMatch(cancelledPage, /apiRequest|fetch\(/);
});
