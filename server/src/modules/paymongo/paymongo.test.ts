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

type GatewayProcessingStatus = "Received" | "Processing" | "Processed" | "Ignored" | "Failed";

type ReferenceFixture = {
  id: string;
  amount: number;
  referenceNumber: string;
  paymentPurpose: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  gatewayEnvironment: "Test" | "Live" | "Manual";
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
};

function payment(overrides: {
  id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  paidAt?: number | string | null;
} = {}) {
  return {
    id: overrides.id ?? "pay_test_123",
    attributes: {
      amount: overrides.amount ?? 20_000,
      currency: overrides.currency ?? "PHP",
      status: overrides.status ?? "paid",
      paid_at: overrides.paidAt ?? nowSeconds,
      fee: 500,
      net_amount: 19_500,
      source: { type: "card" },
    },
  };
}

function payload(overrides: {
  eventId?: string;
  eventType?: string;
  eventLivemode?: boolean;
  checkoutId?: string;
  checkoutLivemode?: boolean;
  checkoutStatus?: string;
  payments?: ReturnType<typeof payment>[];
  amount?: number;
  currency?: string;
  paymentStatus?: string;
  paymentId?: string;
  referenceNumber?: string;
  metadataReferenceId?: string;
  metadataPurpose?: string;
  metadataRelatedType?: string;
  metadataRelatedId?: string;
} = {}) {
  return {
    data: {
      id: overrides.eventId ?? "evt_test_123",
      type: "event",
      attributes: {
        type: overrides.eventType ?? "checkout_session.payment.paid",
        livemode: overrides.eventLivemode ?? false,
        data: {
          id: overrides.checkoutId ?? "cs_test_123",
          type: "checkout_session",
          attributes: {
            livemode: overrides.checkoutLivemode ?? false,
            reference_number: overrides.referenceNumber ?? "MEM-APP-2026-000300-FEE",
            status: overrides.checkoutStatus ?? "paid",
            payment_intent: { id: "pi_test_123" },
            metadata: {
              trackcoop_payment_reference_id: overrides.metadataReferenceId ?? "900",
              trackcoop_reference_number: overrides.referenceNumber ?? "MEM-APP-2026-000300-FEE",
              payment_purpose: overrides.metadataPurpose ?? "Associate Membership Fee",
              related_entity_type: overrides.metadataRelatedType ?? "membership_application",
              related_entity_id: overrides.metadataRelatedId ?? "300",
            },
            payments: overrides.payments ?? [
              payment({
                id: overrides.paymentId,
                amount: overrides.amount,
                currency: overrides.currency,
                status: overrides.paymentStatus,
              }),
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

function defaultReference(overrides: Partial<ReferenceFixture> = {}): ReferenceFixture {
  return {
    id: "900",
    amount: 200,
    referenceNumber: "MEM-APP-2026-000300-FEE",
    paymentPurpose: "Associate Membership Fee",
    relatedEntityType: "membership_application",
    relatedEntityId: "300",
    gatewayEnvironment: "Test",
    gatewayCheckoutId: "cs_test_123",
    gatewayPaymentId: null,
    ...overrides,
  };
}

function makeService(options: {
  duplicateStatus?: GatewayProcessingStatus;
  reference?: ReferenceFixture | null;
  settleError?: unknown;
  markProcessingResult?: boolean;
} = {}) {
  const settlementCalls: unknown[] = [];
  const failedEvents: unknown[] = [];
  const insertedEvents: unknown[] = [];
  const ignoredEvents: unknown[] = [];
  const processingClaims: unknown[] = [];
  const repository: PaymongoWebhookRepository = {
    async findPaymentReference() {
      const reference = options.reference === undefined
        ? defaultReference()
        : options.reference;
      return reference
        ? { ...reference, amount: reference.amount }
        : null;
    },
    async insertGatewayEvent(input) {
      insertedEvents.push(input);
      return {
        id: "70",
        duplicate: Boolean(options.duplicateStatus),
        processingStatus: options.duplicateStatus ?? "Received",
        retryCount: options.duplicateStatus === "Failed" ? 1 : 0,
      };
    },
    async markGatewayEventProcessing(input) {
      processingClaims.push(input);
      return options.markProcessingResult ?? true;
    },
    async markGatewayEventIgnored(gatewayEventId) {
      ignoredEvents.push(gatewayEventId);
    },
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
          receiptStatus: null,
          receiptErrorCode: null,
        };
      },
      async markGatewayEventProcessed() {},
      async markGatewayEventFailed(input) {
        failedEvents.push(input);
      },
    },
  });

  return { service, settlementCalls, failedEvents, insertedEvents, ignoredEvents, processingClaims };
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
  const { service, settlementCalls, insertedEvents, processingClaims } = makeService();

  const result = await service.handleWebhook({
    rawBody: signedPayload.raw,
    signatureHeader: signedPayload.header,
  });

  assert.equal(result.status, "processed");
  assert.equal(settlementCalls.length, 1);
  assert.equal(insertedEvents.length, 1);
  assert.equal(processingClaims.length, 1);
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

test("handleWebhook stores a generic signed unsupported event as ignored", async () => {
  const ignoredPayload = signed(payload({ eventType: "payment.paid" }));
  const { service, insertedEvents, ignoredEvents, settlementCalls } = makeService();

  const result = await service.handleWebhook({
    rawBody: ignoredPayload.raw,
    signatureHeader: ignoredPayload.header,
  });

  assert.equal(result.status, "ignored");
  assert.equal(insertedEvents.length, 1);
  assert.equal(ignoredEvents.length, 1);
  assert.equal(settlementCalls.length, 0);
});

test("handleWebhook selects the paid payment when it is not at index zero", async () => {
  const signedPayload = signed(payload({
    payments: [
      payment({ id: "pay_failed_123", status: "failed" }),
      payment({ id: "pay_test_456", status: "paid" }),
    ],
  }));
  const { service, settlementCalls } = makeService();

  await service.handleWebhook({
    rawBody: signedPayload.raw,
    signatureHeader: signedPayload.header,
  });

  assert.equal(
    (settlementCalls[0] as { gatewayDetails: { paymentId: string } }).gatewayDetails.paymentId,
    "pay_test_456",
  );
});

test("handleWebhook rejects a paid checkout with no paid payment", async () => {
  const signedPayload = signed(payload({
    payments: [payment({ id: "pay_failed_123", status: "failed" })],
  }));
  const { service, settlementCalls } = makeService();

  await assert.rejects(
    () => service.handleWebhook({ rawBody: signedPayload.raw, signatureHeader: signedPayload.header }),
    (error) => error instanceof AppError && error.code === "PAYMONGO_PAYMENT_NOT_PAID",
  );
  assert.equal(settlementCalls.length, 0);
});

test("handleWebhook handles duplicate processed, ignored, and processing events idempotently", async () => {
  const processedPayload = signed(payload());
  const processed = await makeService({ duplicateStatus: "Processed" }).service.handleWebhook({
    rawBody: processedPayload.raw,
    signatureHeader: processedPayload.header,
  });
  assert.equal(processed.status, "duplicate");

  const ignoredPayload = signed(payload());
  const ignored = await makeService({ duplicateStatus: "Ignored" }).service.handleWebhook({
    rawBody: ignoredPayload.raw,
    signatureHeader: ignoredPayload.header,
  });
  assert.equal(ignored.status, "ignored");

  const processingPayload = signed(payload());
  const processing = await makeService({ duplicateStatus: "Processing" }).service.handleWebhook({
    rawBody: processingPayload.raw,
    signatureHeader: processingPayload.header,
  });
  assert.equal(processing.status, "duplicate");
});

test("handleWebhook retries a failed event and settles when the retry succeeds", async () => {
  const signedPayload = signed(payload());
  const { service, settlementCalls, processingClaims } = makeService({ duplicateStatus: "Failed" });

  const result = await service.handleWebhook({
    rawBody: signedPayload.raw,
    signatureHeader: signedPayload.header,
  });

  assert.equal(result.status, "processed");
  assert.equal(settlementCalls.length, 1);
  assert.deepEqual(processingClaims[0], { gatewayEventId: "70", retryFailed: true });
});

test("handleWebhook keeps a failed event failed with a safe message when retry fails", async () => {
  const signedPayload = signed(payload());
  const { service, failedEvents } = makeService({
    duplicateStatus: "Failed",
    settleError: new Error("SQL duplicate raw internal detail"),
  });

  await assert.rejects(
    () => service.handleWebhook({ rawBody: signedPayload.raw, signatureHeader: signedPayload.header }),
    (error) => error instanceof Error,
  );
  assert.equal(failedEvents.length, 1);
  assert.equal(
    (failedEvents[0] as { errorMessage: string }).errorMessage,
    "Payment settlement failed because of an internal server error.",
  );
});

test("handleWebhook rejects live, malformed, unknown, and mismatched events safely", async () => {
  const live = signed(payload({ checkoutLivemode: true, eventLivemode: true }));
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

test("handleWebhook marks gateway events failed for settlement domain failures", async () => {
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

test("handleWebhook rejects amount, currency, checkout, payment, and metadata conflicts", async () => {
  const amountMismatch = signed(payload({ amount: 30_000 }));
  const amountCase = makeService();
  await assert.rejects(
    () => amountCase.service.handleWebhook({ rawBody: amountMismatch.raw, signatureHeader: amountMismatch.header }),
    (error) => error instanceof AppError && error.code === "PAYMENT_AMOUNT_MISMATCH",
  );
  assert.equal((amountCase.failedEvents[0] as { errorCode: string }).errorCode, "PAYMENT_AMOUNT_MISMATCH");

  const currencyMismatch = signed(payload({ currency: "USD" }));
  await assert.rejects(
    () => makeService().service.handleWebhook({ rawBody: currencyMismatch.raw, signatureHeader: currencyMismatch.header }),
    (error) => error instanceof AppError && error.code === "PAYMENT_CURRENCY_MISMATCH",
  );

  const checkoutConflict = signed(payload({ checkoutId: "cs_other" }));
  await assert.rejects(
    () => makeService().service.handleWebhook({ rawBody: checkoutConflict.raw, signatureHeader: checkoutConflict.header }),
    (error) => error instanceof AppError && error.code === "PAYMENT_CHECKOUT_CONFLICT",
  );

  const paymentConflict = signed(payload({ paymentId: "pay_other" }));
  await assert.rejects(
    () => makeService({ reference: defaultReference({ gatewayPaymentId: "pay_original" }) }).service.handleWebhook({
      rawBody: paymentConflict.raw,
      signatureHeader: paymentConflict.header,
    }),
    (error) => error instanceof AppError && error.code === "PAYMENT_GATEWAY_PAYMENT_CONFLICT",
  );

  const metadataConflict = signed(payload({ metadataPurpose: "Share Capital" }));
  await assert.rejects(
    () => makeService().service.handleWebhook({ rawBody: metadataConflict.raw, signatureHeader: metadataConflict.header }),
    (error) => error instanceof AppError && error.code === "PAYMENT_METADATA_CONFLICT",
  );
});

test("handleWebhook sanitizes unknown settlement errors and never stores raw payload", async () => {
  const signedPayload = signed(payload());
  const { service, failedEvents, insertedEvents } = makeService({
    settleError: new Error("SQL raw stack trace should not be stored"),
  });

  await assert.rejects(
    () => service.handleWebhook({ rawBody: signedPayload.raw, signatureHeader: signedPayload.header }),
    (error) => error instanceof Error,
  );

  assert.equal(
    (failedEvents[0] as { errorMessage: string }).errorMessage,
    "Payment settlement failed because of an internal server error.",
  );
  assert.ok(!("rawBody" in (insertedEvents[0] as Record<string, unknown>)));
  assert.ok(!("rawPayload" in (insertedEvents[0] as Record<string, unknown>)));
});

test("handleWebhook blocks unsupported payment purposes before settlement", async () => {
  const signedPayload = signed(payload({ metadataPurpose: "Rental" }));
  const { service, settlementCalls, failedEvents } = makeService({
    reference: defaultReference({ paymentPurpose: "Rental" }),
  });

  await assert.rejects(
    () => service.handleWebhook({ rawBody: signedPayload.raw, signatureHeader: signedPayload.header }),
    (error) => error instanceof AppError && error.code === "PAYMENT_PURPOSE_GATEWAY_NOT_IMPLEMENTED",
  );

  assert.equal(settlementCalls.length, 0);
  assert.equal((failedEvents[0] as { errorCode: string }).errorCode, "PAYMENT_PURPOSE_GATEWAY_NOT_IMPLEMENTED");
});

test("manual Bookkeeper validation uses the shared settlement service", async () => {
  const paymentReference: PaymentReference = {
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
        return paymentReference;
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
          receiptStatus: null,
          receiptErrorCode: null,
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
