import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { createPaymongoService } from "./paymongo.service";
import type {
  PaymongoCheckoutRequest,
  PaymongoCheckoutSession,
  PaymongoConfig,
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

const memberAuth: AuthContext = {
  user: {
    id: "10",
    displayName: "Member User",
    email: "member@example.test",
    username: "member",
    role: "member",
  },
  sessionId: "session-1",
  tokenHash: "token-1",
};

const bookkeeperAuth: AuthContext = {
  ...memberAuth,
  user: {
    ...memberAuth.user,
    id: "2",
    role: "bookkeeper",
  },
};

const paymentReference: PaymongoPaymentReferenceRecord = {
  id: "100",
  memberId: "20",
  memberUserId: "10",
  submittedBy: null,
  payerName: "Member User",
  payerEmail: "member@example.test",
  payerContact: "09170000000",
  provider: "Reference-Based Payment",
  referenceNumber: "TC-REF-0100",
  paymentPurpose: "Associate Membership Fee",
  relatedEntityType: "membership_application",
  relatedEntityId: "30",
  amount: 200,
  validationStatus: "Pending",
  paymentChannel: "Other",
  gatewayEnvironment: "Manual",
  gatewayCheckoutId: null,
  gatewayPaymentId: null,
  gatewayPaymentIntentId: null,
  gatewayStatus: null,
  idempotencyKey: null,
  paidAt: null,
};

function createSession(): PaymongoCheckoutSession {
  return {
    id: "cs_test_100",
    checkoutUrl: "https://checkout.paymongo.com/cs_test_100",
    status: "active",
    livemode: false,
    paymentIntentId: null,
    paymentId: null,
  };
}

function makeService(record: PaymongoPaymentReferenceRecord | null, options: {
  configOverride?: Partial<PaymongoConfig>;
  onCheckout?: (input: PaymongoCheckoutRequest, idempotencyKey: string) => Promise<PaymongoCheckoutSession>;
} = {}) {
  const checkoutCalls: Array<{ input: PaymongoCheckoutRequest; idempotencyKey: string }> = [];
  const updates: unknown[] = [];
  return {
    service: createPaymongoService({
      config: { ...config, ...options.configOverride },
      client: {
        async createCheckoutSession(input, idempotencyKey) {
          checkoutCalls.push({ input, idempotencyKey });
          return options.onCheckout?.(input, idempotencyKey) ?? createSession();
        },
      },
      repository: {
        async findPaymentReference() {
          return record;
        },
        async findMembershipApplicationByCode() {
          return null;
        },
        async getMembershipPaymentSettings() {
          return {
            associateFee: 200,
            initialShareCapital: 1500,
            trueMemberRequiredCapital: 3000,
            maximumShareCapital: 15000,
          };
        },
        async getValidatedMembershipPaymentTotal() {
          return 0;
        },
        async prepareMembershipPaymentReference() {
          return paymentReference;
        },
        async recordCheckoutSession(input) {
          updates.push(input);
        },
      },
    }),
    checkoutCalls,
    updates,
  };
}

test("createPaymentReferenceCheckout uses trusted database fields for metadata and amount", async () => {
  const { service, checkoutCalls, updates } = makeService(paymentReference);
  const result = await service.createPaymentReferenceCheckout("100", memberAuth);

  assert.equal(result.checkoutUrl, "https://checkout.paymongo.com/cs_test_100");
  assert.equal(checkoutCalls.length, 1);
  assert.equal(checkoutCalls[0].input.lineItems[0].amount, 20_000);
  assert.equal(checkoutCalls[0].input.lineItems[0].currency, "PHP");
  assert.equal(checkoutCalls[0].input.referenceNumber, "TC-REF-0100");
  assert.equal(checkoutCalls[0].input.metadata.trackcoop_payment_reference_id, "100");
  assert.equal(checkoutCalls[0].input.metadata.payment_purpose, "Associate Membership Fee");
  assert.equal(checkoutCalls[0].input.metadata.related_entity_type, "membership_application");
  assert.equal(checkoutCalls[0].input.metadata.related_entity_id, "30");
  assert.equal(checkoutCalls[0].input.metadata.environment, "Test");
  assert.equal(updates.length, 1);
});

test("createPaymentReferenceCheckout allows bookkeeper assistance", async () => {
  const { service } = makeService(paymentReference);
  const result = await service.createPaymentReferenceCheckout("100", bookkeeperAuth);
  assert.equal(result.checkoutId, "cs_test_100");
});

test("createPaymentReferenceCheckout rejects non-owner members", async () => {
  const { service } = makeService({ ...paymentReference, memberUserId: "11", submittedBy: null });

  await assert.rejects(
    () => service.createPaymentReferenceCheckout("100", memberAuth),
    (error) => error instanceof AppError && error.code === "PAYMENT_REFERENCE_FORBIDDEN",
  );
});

test("createPaymentReferenceCheckout reuses stable idempotency key for duplicate clicks", async () => {
  const { service, checkoutCalls } = makeService({
    ...paymentReference,
    gatewayCheckoutId: "cs_test_existing",
    gatewayStatus: "active",
    idempotencyKey: "existing-idempotency-key",
    paymentChannel: "PayMongo",
    gatewayEnvironment: "Test",
  });

  await service.createPaymentReferenceCheckout("100", memberAuth);
  await service.createPaymentReferenceCheckout("100", memberAuth);

  assert.equal(checkoutCalls.length, 2);
  assert.equal(checkoutCalls[0].idempotencyKey, "existing-idempotency-key");
  assert.equal(checkoutCalls[1].idempotencyKey, "existing-idempotency-key");
});

test("createPaymentReferenceCheckout rejects already-paid and manual obligations", async () => {
  await assert.rejects(
    () => makeService({ ...paymentReference, validationStatus: "Validated" }).service.createPaymentReferenceCheckout("100", memberAuth),
    (error) => error instanceof AppError && error.code === "PAYMENT_ALREADY_VALIDATED",
  );
  await assert.rejects(
    () => makeService({ ...paymentReference, paymentChannel: "Cash" }).service.createPaymentReferenceCheckout("100", memberAuth),
    (error) => error instanceof AppError && error.code === "PAYMENT_CHANNEL_MANUAL",
  );
});

test("createPaymentReferenceCheckout rejects disabled gateway before creating a checkout", async () => {
  const { service, checkoutCalls } = makeService(paymentReference, {
    configOverride: { enabled: false },
  });

  await assert.rejects(
    () => service.createPaymentReferenceCheckout("100", memberAuth),
    (error) => error instanceof AppError && error.code === "PAYMONGO_DISABLED",
  );
  assert.equal(checkoutCalls.length, 0);
});

test("getPaymentReferenceStatus enforces ownership and returns safe status", async () => {
  const { service } = makeService({
    ...paymentReference,
    paymentChannel: "PayMongo",
    gatewayEnvironment: "Test",
    gatewayCheckoutId: "cs_test_100",
    gatewayStatus: "active",
  });

  const status = await service.getPaymentReferenceStatus("100", memberAuth);

  assert.equal(status.paymentReferenceId, "100");
  assert.equal(status.gatewayCheckoutId, "cs_test_100");
  assert.equal(status.gatewayStatus, "active");
  assert.equal(status.currency, "PHP");
});
