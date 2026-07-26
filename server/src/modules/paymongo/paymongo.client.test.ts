import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import {
  amountToCentavos,
  createPaymongoClient,
  validatePaymongoConfig,
} from "./paymongo.client";
import type { PaymongoCheckoutRequest, PaymongoConfig } from "./paymongo.types";

const config: PaymongoConfig = {
  enabled: true,
  mode: "test",
  apiBaseUrl: "https://api.paymongo.test",
  secretKey: "sk_test_example",
  webhookSecret: "whsec_test_example",
  webhookToleranceSeconds: 300,
  paymentMethodTypes: ["card"],
  passOnFees: true,
  successUrl: "http://localhost:3000/payment/success",
  cancelUrl: "http://localhost:3000/payment/cancelled",
  timeoutMs: 1_000,
};

const checkoutRequest: PaymongoCheckoutRequest = {
  referenceNumber: "TC-REF-0001",
  description: "TrackCOOP Associate Membership Fee (TC-REF-0001)",
  lineItems: [
    {
      name: "Associate Membership Fee",
      amount: 20_000,
      currency: "PHP",
      quantity: 1,
      description: "TrackCOOP Associate Membership Fee (TC-REF-0001)",
    },
  ],
  paymentMethodTypes: ["card"],
  successUrl: "http://localhost:3000/payment/success",
  cancelUrl: "http://localhost:3000/payment/cancelled",
  billing: {
    name: "Juan Dela Cruz",
    email: "juan@example.test",
    phone: "09170000000",
  },
  sendEmailReceipt: true,
  showDescription: true,
  showLineItems: true,
  passOnFees: true,
  metadata: {
    trackcoop_payment_reference_id: "1",
    payment_purpose: "Associate Membership Fee",
    related_entity_type: "membership_application",
    related_entity_id: "7",
    environment: "Test",
  },
};

function successResponse() {
  return new Response(
    JSON.stringify({
      data: {
        id: "cs_test_123",
        type: "checkout_session",
        attributes: {
          checkout_url: "https://checkout.paymongo.com/cs_test_123",
          status: "active",
          livemode: false,
          payment_intent: { id: "pi_test_123" },
          payments: [{ id: "pay_test_123" }],
        },
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

test("amountToCentavos converts PHP amounts to integer centavos", () => {
  assert.equal(amountToCentavos(200), 20_000);
  assert.equal(amountToCentavos(1500.5), 150_050);
});

test("createCheckoutSession uses Basic auth, V2 URL, idempotency, and safe metadata", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchImpl = (async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return successResponse();
  }) as typeof fetch;

  const client = createPaymongoClient(config, fetchImpl);
  const result = await client.createCheckoutSession(checkoutRequest, "idem-123");

  assert.equal(capturedUrl, "https://api.paymongo.test/v2/checkout_sessions");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(
    (capturedInit?.headers as Record<string, string>).Authorization,
    `Basic ${Buffer.from("sk_test_example:").toString("base64")}`,
  );
  assert.equal((capturedInit?.headers as Record<string, string>)["Idempotency-Key"], "idem-123");

  const body = JSON.parse(String(capturedInit?.body));
  const attributes = body.data.attributes;
  assert.equal(attributes.line_items[0].amount, 20_000);
  assert.equal(attributes.line_items[0].currency, "PHP");
  assert.deepEqual(attributes.payment_method_types, ["card"]);
  assert.equal(attributes.pass_on_fees, true);
  assert.equal(attributes.reference_number, "TC-REF-0001");
  assert.equal(attributes.metadata.trackcoop_payment_reference_id, "1");
  assert.equal(attributes.metadata.payment_purpose, "Associate Membership Fee");
  assert.ok(!String(capturedInit?.body).includes("sk_test_example"));
  assert.equal(result.checkoutUrl, "https://checkout.paymongo.com/cs_test_123");
});

test("createCheckoutSession maps PayMongo API errors to safe structured errors", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ errors: [{ detail: "secret raw detail" }] }), { status: 400 })) as typeof fetch;

  const client = createPaymongoClient(config, fetchImpl);

  await assert.rejects(
    () => client.createCheckoutSession(checkoutRequest, "idem-123"),
    (error) => error instanceof AppError
      && error.code === "PAYMONGO_API_ERROR"
      && error.statusCode === 400
      && !error.message.includes("secret raw detail"),
  );
});

test("createCheckoutSession times out with AbortController", async () => {
  const fetchImpl = (async (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    })) as typeof fetch;

  const client = createPaymongoClient({ ...config, timeoutMs: 1 }, fetchImpl);

  await assert.rejects(
    () => client.createCheckoutSession(checkoutRequest, "idem-123"),
    (error) => error instanceof AppError && error.code === "PAYMONGO_TIMEOUT",
  );
});

test("createCheckoutSession rejects malformed PayMongo responses", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ data: { id: "cs_test_123", attributes: {} } }), { status: 200 })) as typeof fetch;

  const client = createPaymongoClient(config, fetchImpl);

  await assert.rejects(
    () => client.createCheckoutSession(checkoutRequest, "idem-123"),
    (error) => error instanceof AppError && error.code === "PAYMONGO_RESPONSE_INVALID",
  );
});

test("validatePaymongoConfig rejects disabled gateway and live keys in development", () => {
  assert.throws(
    () => validatePaymongoConfig({ ...config, enabled: false }),
    (error) => error instanceof AppError && error.code === "PAYMONGO_DISABLED",
  );
  assert.throws(
    () => validatePaymongoConfig({ ...config, secretKey: "sk_live_example" }, "development"),
    (error) => error instanceof AppError && error.code === "PAYMONGO_LIVE_KEY_BLOCKED",
  );
});
