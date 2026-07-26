import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  amountToCentavos,
  createPaymongoClient,
  createPaymongoConfigFromEnv,
  validatePaymongoConfig,
  type PaymongoClient,
} from "./paymongo.client";
import {
  createPaymongoRepository,
  type PaymongoRepository,
} from "./paymongo.repository";
import type {
  PaymongoCheckoutRequest,
  PaymongoCheckoutResult,
  PaymongoConfig,
  PaymongoGatewayEnvironment,
  PaymongoPaymentReferenceRecord,
  PaymongoPaymentStatus,
} from "./paymongo.types";

const pendingStatuses = new Set(["Pending", "Needs Clarification"]);
const manualChannels = new Set(["Manual GCash", "Cash", "Bank Transfer"]);

function gatewayEnvironment(mode: PaymongoConfig["mode"]): PaymongoGatewayEnvironment {
  return mode === "live" ? "Live" : "Test";
}

function stableIdempotencyKey(paymentReferenceId: string) {
  return `trackcoop-paymongo-payment-reference-${paymentReferenceId}`;
}

function requirePaymentReference(record: PaymongoPaymentReferenceRecord | null) {
  if (!record) {
    throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
  }
  return record;
}

function assertCanAccessPayment(record: PaymongoPaymentReferenceRecord, auth: AuthContext) {
  if (auth.user.role === "chairman" || auth.user.role === "bookkeeper") {
    return;
  }

  if (record.memberUserId === auth.user.id || record.submittedBy === auth.user.id) {
    return;
  }

  throw new AppError("You cannot access this payment reference", 403, "PAYMENT_REFERENCE_FORBIDDEN");
}

function assertEligibleForCheckout(record: PaymongoPaymentReferenceRecord, environment: PaymongoGatewayEnvironment) {
  if (record.validationStatus === "Validated") {
    throw new AppError("This payment has already been validated", 409, "PAYMENT_ALREADY_VALIDATED");
  }
  if (!pendingStatuses.has(record.validationStatus)) {
    throw new AppError("This payment is not eligible for PayMongo checkout", 409, "PAYMENT_NOT_ELIGIBLE");
  }
  if (record.amount <= 0) {
    throw new AppError("This payment has an invalid amount", 409, "PAYMENT_AMOUNT_INVALID");
  }
  if (manualChannels.has(record.paymentChannel)) {
    throw new AppError("Manual payment references cannot create PayMongo checkouts", 409, "PAYMENT_CHANNEL_MANUAL");
  }
  if (record.gatewayEnvironment !== "Manual" && record.gatewayEnvironment !== environment) {
    throw new AppError("This payment was created for a different gateway environment", 409, "PAYMENT_GATEWAY_ENVIRONMENT_MISMATCH");
  }
}

function checkoutDescription(record: PaymongoPaymentReferenceRecord) {
  return `TrackCOOP ${record.paymentPurpose} (${record.referenceNumber})`;
}

function checkoutLineName(record: PaymongoPaymentReferenceRecord) {
  return record.paymentPurpose || "TrackCOOP payment";
}

function checkoutMetadata(record: PaymongoPaymentReferenceRecord, environment: PaymongoGatewayEnvironment) {
  return {
    trackcoop_payment_reference_id: record.id,
    trackcoop_reference_number: record.referenceNumber,
    payment_purpose: record.paymentPurpose,
    related_entity_type: record.relatedEntityType ?? "",
    related_entity_id: record.relatedEntityId ?? "",
    environment,
  };
}

function buildCheckoutRequest(
  record: PaymongoPaymentReferenceRecord,
  config: PaymongoConfig,
): PaymongoCheckoutRequest {
  const centavos = amountToCentavos(record.amount);
  const description = checkoutDescription(record);

  return {
    referenceNumber: record.referenceNumber,
    description,
    lineItems: [
      {
        name: checkoutLineName(record),
        amount: centavos,
        currency: "PHP",
        quantity: 1,
        description,
      },
    ],
    paymentMethodTypes: config.paymentMethodTypes,
    successUrl: config.successUrl,
    cancelUrl: config.cancelUrl,
    billing: {
      name: record.payerName ?? undefined,
      email: record.payerEmail ?? undefined,
      phone: record.payerContact ?? undefined,
    },
    sendEmailReceipt: true,
    showDescription: true,
    showLineItems: true,
    passOnFees: config.passOnFees,
    metadata: checkoutMetadata(record, gatewayEnvironment(config.mode)),
  };
}

export interface PaymongoService {
  createPaymentReferenceCheckout(
    paymentReferenceId: string,
    auth: AuthContext,
  ): Promise<PaymongoCheckoutResult>;
  getPaymentReferenceStatus(
    paymentReferenceId: string,
    auth: AuthContext,
  ): Promise<PaymongoPaymentStatus>;
}

export function createPaymongoService(options: {
  config?: PaymongoConfig;
  client?: PaymongoClient;
  repository?: PaymongoRepository;
} = {}): PaymongoService {
  const config = options.config ?? createPaymongoConfigFromEnv();
  const client = options.client ?? createPaymongoClient(config);
  const repository = options.repository ?? createPaymongoRepository();

  return {
    async createPaymentReferenceCheckout(paymentReferenceId, auth) {
      validatePaymongoConfig(config);
      const record = requirePaymentReference(await repository.findPaymentReference(paymentReferenceId));
      assertCanAccessPayment(record, auth);

      const environment = gatewayEnvironment(config.mode);
      assertEligibleForCheckout(record, environment);

      const idempotencyKey = record.idempotencyKey ?? stableIdempotencyKey(record.id);
      const session = await client.createCheckoutSession(
        buildCheckoutRequest(record, config),
        idempotencyKey,
      );

      await repository.recordCheckoutSession({
        paymentReferenceId: record.id,
        session,
        environment,
        idempotencyKey,
      });

      return {
        paymentReferenceId: record.id,
        referenceNumber: record.referenceNumber,
        checkoutId: session.id,
        checkoutUrl: session.checkoutUrl,
        gatewayStatus: session.status,
        validationStatus: record.validationStatus,
        amount: record.amount,
        currency: "PHP",
        mode: config.mode,
      };
    },

    async getPaymentReferenceStatus(paymentReferenceId, auth) {
      const record = requirePaymentReference(await repository.findPaymentReference(paymentReferenceId));
      assertCanAccessPayment(record, auth);

      return {
        paymentReferenceId: record.id,
        referenceNumber: record.referenceNumber,
        validationStatus: record.validationStatus,
        paymentChannel: record.paymentChannel,
        gatewayEnvironment: record.gatewayEnvironment,
        gatewayCheckoutId: record.gatewayCheckoutId,
        gatewayPaymentId: record.gatewayPaymentId,
        gatewayPaymentIntentId: record.gatewayPaymentIntentId,
        gatewayStatus: record.gatewayStatus,
        paidAt: record.paidAt,
        amount: record.amount,
        currency: "PHP",
      };
    },
  };
}

