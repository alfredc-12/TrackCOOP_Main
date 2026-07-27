import { AppError } from "../../utils/app-error";
import {
  requireApplicationTrackingToken,
  verifyApplicationTrackingToken,
} from "../membership-applications/public-tracking-token";
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
  PaymongoMembershipApplicationRecord,
  PaymongoMembershipCheckoutInput,
  PaymongoPaymentReferenceRecord,
  PaymongoPaymentStatus,
  PaymongoPublicCheckoutResult,
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

function requireMembershipApplication(record: PaymongoMembershipApplicationRecord | null) {
  if (!record) {
    throw new AppError(
      "Membership application was not found",
      404,
      "MEMBERSHIP_APPLICATION_NOT_FOUND",
    );
  }
  return record;
}

function assertValidTrackingToken(
  application: PaymongoMembershipApplicationRecord,
  rawTrackingToken: string | undefined,
) {
  const trackingToken = requireApplicationTrackingToken(rawTrackingToken);
  if (!verifyApplicationTrackingToken(application.publicTrackingTokenHash, trackingToken)) {
    throw new AppError(
      "Application tracking token is invalid",
      403,
      "APPLICATION_TRACKING_TOKEN_INVALID",
    );
  }
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

function assertApplicationCanStartCheckout(application: PaymongoMembershipApplicationRecord) {
  if (["Rejected", "Withdrawn"].includes(application.applicationStatus)) {
    throw new AppError(
      "This membership application is not eligible for online payment",
      409,
      "MEMBERSHIP_APPLICATION_PAYMENT_NOT_ELIGIBLE",
    );
  }
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

function assertMembershipReferenceEligible(
  record: PaymongoPaymentReferenceRecord,
  environment: PaymongoGatewayEnvironment,
) {
  try {
    assertEligibleForCheckout(record, environment);
  } catch (error) {
    if (error instanceof AppError && error.code === "PAYMENT_ALREADY_VALIDATED") {
      if (record.paymentPurpose === "Associate Membership Fee") {
        throw new AppError(
          "The associate membership fee has already been paid",
          409,
          "MEMBERSHIP_FEE_ALREADY_VALIDATED",
        );
      }
      if (record.paymentPurpose === "Share Capital") {
        throw new AppError(
          "This share capital payment has already been validated",
          409,
          "SHARE_CAPITAL_PAYMENT_ALREADY_VALIDATED",
        );
      }
    }
    throw error;
  }
}

function checkoutPublicStatus(record: PaymongoPaymentReferenceRecord) {
  return record.validationStatus === "Validated" ? "Confirmed" : "Waiting";
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
  createMembershipApplicationCheckout(
    applicationCode: string,
    rawTrackingToken: string | undefined,
    input: PaymongoMembershipCheckoutInput,
  ): Promise<PaymongoPublicCheckoutResult>;
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

    async createMembershipApplicationCheckout(applicationCode, rawTrackingToken, input) {
      validatePaymongoConfig(config);
      const application = requireMembershipApplication(
        await repository.findMembershipApplicationByCode(applicationCode),
      );
      assertValidTrackingToken(application, rawTrackingToken);
      assertApplicationCanStartCheckout(application);

      const settings = await repository.getMembershipPaymentSettings();
      let amount: number;
      if (input.paymentPurpose === "Associate Membership Fee") {
        amount = settings.associateFee;
        const validatedFee = await repository.getValidatedMembershipPaymentTotal({
          applicationId: application.id,
          paymentPurpose: "Associate Membership Fee",
        });
        if (validatedFee >= settings.associateFee) {
          throw new AppError(
            "The associate membership fee has already been paid",
            409,
            "MEMBERSHIP_FEE_ALREADY_VALIDATED",
          );
        }
      } else {
        if (application.requestedMembershipType !== "True Member") {
          throw new AppError(
            "Share capital checkout is only available for True Member applicants",
            409,
            "SHARE_CAPITAL_TRUE_MEMBER_REQUIRED",
          );
        }
        amount = input.requestedAmount ?? 0;
        if (amount < settings.initialShareCapital) {
          throw new AppError(
            "Initial share capital payment must be at least PHP 1,500",
            400,
            "SHARE_CAPITAL_AMOUNT_BELOW_MINIMUM",
          );
        }
        const validatedCapital = await repository.getValidatedMembershipPaymentTotal({
          applicationId: application.id,
          paymentPurpose: "Share Capital",
        });
        if (validatedCapital + amount > settings.maximumShareCapital) {
          throw new AppError(
            "Share capital payment would exceed the maximum allowed amount",
            409,
            "SHARE_CAPITAL_MAXIMUM_EXCEEDED",
          );
        }
      }

      const record = await repository.prepareMembershipPaymentReference({
        application,
        paymentPurpose: input.paymentPurpose,
        amount,
      });
      const environment = gatewayEnvironment(config.mode);
      assertMembershipReferenceEligible(record, environment);

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
        referenceNumber: record.referenceNumber,
        checkoutUrl: session.checkoutUrl,
        gatewayStatus: session.status,
        paymentPurpose: input.paymentPurpose,
        amount: record.amount,
        currency: "PHP",
        mode: config.mode,
        status: checkoutPublicStatus(record),
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
