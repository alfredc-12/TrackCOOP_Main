import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import { createPaymentReferenceService } from "../payment-references/payment-reference.service";
import type { PaymentReference } from "../payment-references/payment-reference.types";
import type { PaymongoConfig } from "./paymongo.types";
import {
  createPaymongoWebhookService,
  type PaymongoWebhookRepository,
} from "./paymongo.webhook.service";
import { verifyAndParsePaymongoWebhook } from "./paymongo.webhook";

const nowSeconds = 1_800_000_000;
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

function payload(overrides: {
  eventType?: string;
  livemode?: boolean;
  amount?: number;
  currency?: string;
  paymentStatus?: string;
  paymentId?: string;
  referenceNumber?: string;
  metadataReferenceId?: string;
} = {}) {
  return {
    data: {
      type: "event",
      attributes: {
        type: overrides.eventType ?? "checkout_session.payment.paid",
        data: {
          id: "cs_test_123",
          type: "checkout_session",
          attributes: {
            livemode: overrides.livemode ?? false,
            reference_number: overrides.referenceNumber ?? "MEM-APP-2026-000300-FEE",
            status: "paid",
            payment_intent: { id: "pi_test_123" },
            metadata: {
              trackcoop_payment_reference_id: overrides.metadataReferenceId ?? "900",
            },
            payments: [
              {
                id: overrides.paymentId ?? "pay_test_123",
                attributes: {
                  amount: overrides.amount ?? 20_000,
                  currency: overrides.currency ?? "PHP",
                  status: overrides.paymentStatus ?? "paid",
                  paid_at: nowSeconds,
                  fee: 500,
                  net_amount: 19_500,
                  source: { type: "card" },
                },
              },
            ],
          },
        },
      },
    },
  };
}

function signed(body: unknown, timestamp = Math.floor(Date.now() / 1000)) {
  const raw = Buffer.from(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", config.webhookSecret ?? "")
    .update(`${timestamp}.${raw.toString("utf8")}`)
    .digest("hex");
  return {
    raw,
    header: `t=${timestamp},te=${signature},li=live-signature`,
  };
}

function makeService(options: {
  duplicate?: boolean;
  reference?: { id: string; amount: number; referenceNumber: string } | null;
  settleError?: AppError;
} = {}) {
  const settlementCalls: unknown[] = [];
  const failedEvents: unknown[] = [];
  const insertedEvents: unknown[] = [];
  const repository: PaymongoWebhookRepository = {
    async findPaymentReference() {
      const reference = options.reference === undefined
        ? { id: "900", amount: 200, referenceNumber: "MEM-APP-2026-000300-FEE" }
        : options.reference;
      return reference
        ? { ...reference, amount: reference.amount }
        : null;
    },
    async insertGatewayEvent(input) {
      insertedEvents.push(input);
      return { id: "70", duplicate: options.duplicate ?? false };
    },
    async markGatewayEventIgnored() {},
  };
  const service = createPaymongoWebhookService({
    config,
    repository,
    settlementRepository: {
      async settlePaymentReference(input) {
        settlementCalls.push(input);
        if (options.settleError) throw options.settleError;
        return {
          paymentReferenceId: input.paymentReferenceId,
          alreadySettled: false,
          validationStatus: "Validated",
        };
      },
      async markGatewayEventProcessed() {},
      async markGatewayEventFailed(input) {
        failedEvents.push(input);
      },
    },
  });

  return { service, settlementCalls, failedEvents, insertedEvents };
}

test("verifyAndParsePaymongoWebhook accepts a valid test signature", () => {
  const body = payload();
  const signedPayload = signed(body, nowSeconds);
  const result = verifyAndParsePaymongoWebhook({
    rawBody: signedPayload.raw,
    signatureHeader: signedPayload.header,
    config,
    nowSeconds,
  });

  assert.equal(result.payload.data.attributes.type, "checkout_session.payment.paid");
});

test("verifyAndParsePaymongoWebhook rejects missing, invalid, and stale signatures", () => {
  const body = signed(payload(), nowSeconds);

  assert.throws(
    () => verifyAndParsePaymongoWebhook({ rawBody: body.raw, signatureHeader: undefined, config, nowSeconds }),
    (error) => error instanceof AppError && error.code === "PAYMONGO_SIGNATURE_REQUIRED",
  );
  assert.throws(
    () => verifyAndParsePaymongoWebhook({ rawBody: body.raw, signatureHeader: "t=1800000000,te=bad", config, nowSeconds }),
    (error) => error instanceof AppError && error.code === "PAYMONGO_SIGNATURE_INVALID",
  );
  assert.throws(
    () => verifyAndParsePaymongoWebhook({ rawBody: body.raw, signatureHeader: body.header, config, nowSeconds: nowSeconds + 301 }),
    (error) => error instanceof AppError && error.code === "PAYMONGO_SIGNATURE_STALE",
  );
});

test("handleWebhook settles a valid paid checkout event", async () => {
  const signedPayload = signed(payload());
  const { service, settlementCalls, insertedEvents } = makeService();

  const result = await service.handleWebhook({
    rawBody: signedPayload.raw,
    signatureHeader: signedPayload.header,
  });

  assert.equal(result.status, "processed");
  assert.equal(settlementCalls.length, 1);
  assert.equal(insertedEvents.length, 1);
  assert.deepEqual(
    (settlementCalls[0] as { validationSource: string; gatewayDetails: { amount: number; currency: string } }).gatewayDetails,
    {
      checkoutId: "cs_test_123",
      paymentId: "pay_test_123",
      paymentIntentId: "pi_test_123",
      gatewayStatus: "paid",
      paymentMethod: "card",
      amount: 200,
      currency: "PHP",
      feeAmount: 5,
      netAmount: 195,
      paidAt: new Date(nowSeconds * 1000),
      environment: "Test",
    },
  );
});

test("handleWebhook returns 200-equivalent outcomes for ignored and duplicate events", async () => {
  const ignoredPayload = signed(payload({ eventType: "payment.paid" }));
  const ignored = await makeService().service.handleWebhook({
    rawBody: ignoredPayload.raw,
    signatureHeader: ignoredPayload.header,
  });
  assert.equal(ignored.status, "ignored");

  const duplicatePayload = signed(payload());
  const duplicate = await makeService({ duplicate: true }).service.handleWebhook({
    rawBody: duplicatePayload.raw,
    signatureHeader: duplicatePayload.header,
  });
  assert.equal(duplicate.status, "duplicate");
});

test("handleWebhook rejects live, malformed, unknown, and mismatched events safely", async () => {
  const live = signed(payload({ livemode: true }));
  await assert.rejects(
    () => makeService().service.handleWebhook({ rawBody: live.raw, signatureHeader: live.header }),
    (error) => error instanceof AppError && error.code === "PAYMONGO_LIVE_EVENT_REJECTED",
  );

  const malformed = signed({ data: { attributes: { type: "checkout_session.payment.paid" } } });
  await assert.rejects(
    () => makeService().service.handleWebhook({ rawBody: malformed.raw, signatureHeader: malformed.header }),
    (error) => error instanceof AppError && error.code === "PAYMONGO_WEBHOOK_PAYLOAD_INVALID",
  );

  const unknown = signed(payload());
  await assert.rejects(
    () => makeService({ reference: null }).service.handleWebhook({ rawBody: unknown.raw, signatureHeader: unknown.header }),
    (error) => error instanceof AppError && error.code === "PAYMENT_REFERENCE_NOT_FOUND",
  );

  const mismatch = signed(payload({ referenceNumber: "OTHER-REF" }));
  await assert.rejects(
    () => makeService().service.handleWebhook({ rawBody: mismatch.raw, signatureHeader: mismatch.header }),
    (error) => error instanceof AppError && error.code === "PAYMENT_REFERENCE_MISMATCH",
  );
});

test("handleWebhook marks gateway events failed when settlement rolls back", async () => {
  const signedPayload = signed(payload());
  const { service, failedEvents } = makeService({
    settleError: new AppError("Payment amount mismatch", 422, "PAYMENT_AMOUNT_MISMATCH"),
  });

  await assert.rejects(
    () => service.handleWebhook({ rawBody: signedPayload.raw, signatureHeader: signedPayload.header }),
    (error) => error instanceof AppError && error.code === "PAYMENT_AMOUNT_MISMATCH",
  );
  assert.equal(failedEvents.length, 1);
  assert.equal((failedEvents[0] as { errorCode: string }).errorCode, "PAYMENT_AMOUNT_MISMATCH");
});

test("manual Bookkeeper validation uses the shared settlement service", async () => {
  const payment: PaymentReference = {
    id: "900",
    memberId: null,
    submittedBy: null,
    payerName: "Applicant",
    payerEmail: null,
    payerContact: null,
    provider: "Manual GCash",
    referenceNumber: "MANUAL-900",
    paymentPurpose: "Associate Membership Fee",
    relatedEntityType: "membership_application",
    relatedEntityId: "300",
    amount: 200,
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
    submittedAt: new Date(),
    updatedAt: new Date(),
  };
  const settlementCalls: unknown[] = [];
  const service = createPaymentReferenceService(
    {
      async list() {
        throw new Error("not used");
      },
      async summary() {
        throw new Error("not used");
      },
      async findById() {
        return payment;
      },
      async detail() {
        throw new Error("not used");
      },
      async create() {
        throw new Error("not used");
      },
      async update() {
        throw new Error("not used");
      },
      async setValidationStatus() {
        throw new Error("manual validation must use settlement service");
      },
      async reverse() {
        throw new Error("not used");
      },
    },
    {
      async settlePaymentReference(input) {
        settlementCalls.push(input);
        return {
          paymentReferenceId: input.paymentReferenceId,
          alreadySettled: false,
          validationStatus: "Validated",
        };
      },
    },
  );

  await service.validatePaymentReference(
    "900",
    {},
    {
      user: {
        id: "2",
        displayName: "Bookkeeper",
        email: "bookkeeper@example.test",
        username: "bookkeeper",
        role: "bookkeeper",
      },
      sessionId: "session",
      tokenHash: "hash",
    },
  );

  assert.equal(settlementCalls.length, 1);
  assert.equal(
    (settlementCalls[0] as { validationSource: string }).validationSource,
    "Manual Bookkeeper",
  );
});
