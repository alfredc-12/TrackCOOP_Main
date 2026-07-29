import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { paymongoCheckoutSessionResponseSchema } from "./paymongo.schema";
import type {
  PaymongoCheckoutRequest,
  PaymongoCheckoutSession,
  PaymongoConfig,
} from "./paymongo.types";

export class PaymongoClientError extends AppError {
  constructor(message: string, statusCode = 502, code = "PAYMONGO_CLIENT_ERROR") {
    super(message, statusCode, code);
    this.name = "PaymongoClientError";
  }
}

export function createPaymongoConfigFromEnv(): PaymongoConfig {
  return {
    enabled: env.PAYMONGO_ENABLED,
    mode: env.PAYMONGO_MODE,
    apiBaseUrl: env.PAYMONGO_API_BASE_URL.replace(/\/+$/, ""),
    secretKey: env.PAYMONGO_SECRET_KEY,
    webhookSecret: env.PAYMONGO_WEBHOOK_SECRET,
    webhookToleranceSeconds: env.PAYMONGO_WEBHOOK_TOLERANCE_SECONDS,
    checkoutReuseMinutes: env.PAYMONGO_CHECKOUT_REUSE_MINUTES,
    paymentMethodTypes: env.PAYMONGO_PAYMENT_METHOD_TYPES,
    passOnFees: env.PAYMONGO_PASS_ON_FEES,
    successUrl: env.PAYMENT_SUCCESS_URL,
    cancelUrl: env.PAYMENT_CANCEL_URL,
    timeoutMs: 10_000,
  };
}

export function validatePaymongoConfig(config: PaymongoConfig, nodeEnv = env.NODE_ENV) {
  if (!config.enabled) {
    throw new AppError("PayMongo checkout is disabled", 503, "PAYMONGO_DISABLED");
  }
  if (!config.secretKey) {
    throw new AppError("PayMongo secret key is not configured", 503, "PAYMONGO_NOT_CONFIGURED");
  }
  if (nodeEnv !== "production" && config.mode === "live") {
    throw new AppError("PayMongo live mode is not allowed outside production", 503, "PAYMONGO_LIVE_MODE_BLOCKED");
  }
  if (nodeEnv !== "production" && config.secretKey.startsWith("sk_live_")) {
    throw new AppError("PayMongo live secret keys are not allowed outside production", 503, "PAYMONGO_LIVE_KEY_BLOCKED");
  }
  if (config.mode === "test" && !config.secretKey.startsWith("sk_test_")) {
    throw new AppError("PayMongo test mode requires a test secret key", 503, "PAYMONGO_TEST_KEY_REQUIRED");
  }
}

export function amountToCentavos(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Payment amount must be greater than zero", 400, "PAYMENT_AMOUNT_INVALID");
  }

  return Math.round(amount * 100);
}

function withStringMetadata(metadata: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, String(value)]),
  );
}

function compactBilling(billing: PaymongoCheckoutRequest["billing"]) {
  if (!billing) return undefined;

  const compacted = {
    name: billing.name?.trim() || undefined,
    email: billing.email?.trim() || undefined,
    phone: billing.phone?.trim() || undefined,
  };

  return compacted.name || compacted.email || compacted.phone ? compacted : undefined;
}

function selectedPaymentId(
  payments: Array<{ id: string; attributes?: { status?: string | null } }> | null | undefined,
) {
  const paid = payments?.find(
    (payment) => payment.attributes?.status?.trim().toLowerCase() === "paid",
  );
  return paid?.id ?? payments?.[0]?.id ?? null;
}

function mapCheckoutSession(payload: unknown): PaymongoCheckoutSession {
  const parsed = paymongoCheckoutSessionResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PaymongoClientError(
      "PayMongo returned an unexpected checkout response",
      502,
      "PAYMONGO_RESPONSE_INVALID",
    );
  }

  const session = parsed.data.data;
  const attributes = session.attributes;
  return {
    id: session.id,
    checkoutUrl: attributes.checkout_url,
    status: attributes.status ?? null,
    livemode: attributes.livemode ?? null,
    paymentIntentId: attributes.payment_intent?.id ?? null,
    paymentId: selectedPaymentId(attributes.payments),
  };
}

function authHeader(config: PaymongoConfig) {
  return `Basic ${Buffer.from(`${config.secretKey}:`).toString("base64")}`;
}

async function readJsonResponse(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

export interface PaymongoClient {
  createCheckoutSession(
    input: PaymongoCheckoutRequest,
    idempotencyKey: string,
  ): Promise<PaymongoCheckoutSession>;
  retrieveCheckoutSession(checkoutSessionId: string): Promise<PaymongoCheckoutSession>;
}

export function createPaymongoClient(
  config: PaymongoConfig = createPaymongoConfigFromEnv(),
  fetchImpl: typeof fetch = fetch,
): PaymongoClient {
  async function runRequest(input: {
    url: string;
    init: RequestInit;
    apiErrorMessage: string;
    timeoutMessage: string;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetchImpl(input.url, {
        ...input.init,
        signal: controller.signal,
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        const notFound = response.status === 404;
        throw new PaymongoClientError(
          notFound ? "PayMongo checkout session was not found" : input.apiErrorMessage,
          response.status >= 500 ? 502 : response.status,
          notFound ? "PAYMONGO_CHECKOUT_NOT_FOUND" : "PAYMONGO_API_ERROR",
        );
      }

      return mapCheckoutSession(payload);
    } catch (error) {
      if (error instanceof PaymongoClientError || error instanceof AppError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new PaymongoClientError(input.timeoutMessage, 504, "PAYMONGO_TIMEOUT");
      }
      throw new PaymongoClientError("PayMongo checkout request failed", 502, "PAYMONGO_REQUEST_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async createCheckoutSession(input, idempotencyKey) {
      validatePaymongoConfig(config);
      const billing = compactBilling(input.billing);
      const attributes = {
        line_items: input.lineItems.map((item) => ({
          name: item.name,
          amount: item.amount,
          currency: item.currency,
          quantity: item.quantity,
          ...(item.description ? { description: item.description } : {}),
        })),
        payment_method_types: input.paymentMethodTypes,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        reference_number: input.referenceNumber,
        description: input.description,
        send_email_receipt: input.sendEmailReceipt,
        show_description: input.showDescription,
        show_line_items: input.showLineItems,
        pass_on_fees: input.passOnFees,
        metadata: withStringMetadata(input.metadata),
        ...(billing ? { billing } : {}),
      };

      return runRequest({
        url: `${config.apiBaseUrl}/v2/checkout_sessions`,
        init: {
          method: "POST",
          headers: {
            Authorization: authHeader(config),
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ data: { attributes } }),
        },
        apiErrorMessage: "PayMongo checkout could not be created",
        timeoutMessage: "PayMongo checkout request timed out",
      });
    },

    async retrieveCheckoutSession(checkoutSessionId) {
      validatePaymongoConfig(config);
      if (!checkoutSessionId.trim()) {
        throw new AppError(
          "PayMongo checkout session ID is required",
          400,
          "PAYMONGO_CHECKOUT_ID_REQUIRED",
        );
      }

      const session = await runRequest({
        url: `${config.apiBaseUrl}/v1/checkout_sessions/${encodeURIComponent(checkoutSessionId)}`,
        init: {
          method: "GET",
          headers: {
            Authorization: authHeader(config),
            Accept: "application/json",
          },
        },
        apiErrorMessage: "PayMongo checkout status could not be retrieved",
        timeoutMessage: "PayMongo checkout status request timed out",
      });

      if (session.id !== checkoutSessionId) {
        throw new PaymongoClientError(
          "PayMongo returned a different checkout session",
          502,
          "PAYMONGO_CHECKOUT_ID_MISMATCH",
        );
      }
      return session;
    },
  };
}
