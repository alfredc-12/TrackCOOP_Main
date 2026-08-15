import { AppError } from "../../utils/app-error";
import {
  requireApplicationBirthDateCredential,
  verifyApplicationBirthDate,
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
  createPaymongoCheckoutAttemptRepository,
  type PaymongoCheckoutAttemptRepository,
} from "./paymongo.checkout-attempt.repository";
import {
  createPaymongoRepository,
  type PaymongoRepository,
} from "./paymongo.repository";
import {
  createPaymongoMembershipInstallmentRepository,
  type PaymongoMembershipInstallmentRepository,
} from "./paymongo.membership-installment.repository";
import type {
  PaymongoCheckoutRequest,
  PaymongoCheckoutResult,
  PaymongoConfig,
  PaymongoMembershipApplicationRecord,
  PaymongoMembershipCheckoutInput,
  PaymongoOnlineGatewayEnvironment,
  PaymongoPaymentReferenceRecord,
  PaymongoPaymentStatus,
  PaymongoPublicCheckoutResult,
} from "./paymongo.types";

const pendingStatuses = new Set(["Pending", "Needs Clarification"]);
const manualChannels = new Set(["Manual GCash", "Cash", "Bank Transfer"]);
const supportedPaymongoPurposes = new Set([
  "Associate Membership Fee",
  "Share Capital",
  "POS/Product",
]);
const defaultCheckoutReuseMinutes = 30;

function gatewayEnvironment(mode: PaymongoConfig["mode"]): PaymongoOnlineGatewayEnvironment {
  return mode === "live" ? "Live" : "Test";
}

function checkoutReuseMinutes(config: PaymongoConfig) {
  const value = config.checkoutReuseMinutes ?? defaultCheckoutReuseMinutes;
  if (!Number.isInteger(value) || value < 1 || value > 1440) {
    throw new AppError(
      "PayMongo checkout reuse interval is invalid",
      503,
      "PAYMONGO_CHECKOUT_REUSE_INVALID",
    );
  }
  return value;
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

function assertValidBirthDateCredential(
  application: PaymongoMembershipApplicationRecord,
  rawDateOfBirth: string | undefined,
) {
  const dateOfBirth = requireApplicationBirthDateCredential(rawDateOfBirth);
  if (!verifyApplicationBirthDate(application.dateOfBirth, dateOfBirth)) {
    throw new AppError(
      "Applicant date of birth does not match this application",
      403,
      "APPLICATION_BIRTH_DATE_INVALID",
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
  if (["Approved", "Rejected", "Withdrawn"].includes(application.applicationStatus)) {
    throw new AppError(
      "This membership application is not eligible for online payment",
      409,
      "MEMBERSHIP_APPLICATION_PAYMENT_NOT_ELIGIBLE",
    );
  }
}

function assertPaymongoPurposeSupported(paymentPurpose: string) {
  if (!supportedPaymongoPurposes.has(paymentPurpose)) {
    throw new AppError(
      "PayMongo checkout is not implemented for this payment purpose",
      409,
      "PAYMENT_PURPOSE_GATEWAY_NOT_IMPLEMENTED",
    );
  }
}

function assertEligibleForCheckout(
  record: PaymongoPaymentReferenceRecord,
  environment: PaymongoOnlineGatewayEnvironment,
) {
  if (record.validationStatus === "Validated") {
    throw new AppError("This payment has already been validated", 409, "PAYMENT_ALREADY_VALIDATED");
  }
  if (record.validationStatus === "Reversed") {
    throw new AppError("A reversed payment cannot create a checkout", 409, "PAYMENT_REVERSED");
  }
  if (!pendingStatuses.has(record.validationStatus)) {
    throw new AppError("This payment is not eligible for PayMongo checkout", 409, "PAYMENT_NOT_ELIGIBLE");
  }
  if (!Number.isFinite(record.amount) || record.amount <= 0) {
    throw new AppError("This payment has an invalid amount", 409, "PAYMENT_AMOUNT_INVALID");
  }
  assertPaymongoPurposeSupported(record.paymentPurpose);
  if (manualChannels.has(record.paymentChannel)) {
    throw new AppError("Manual payment references cannot create PayMongo checkouts", 409, "PAYMENT_CHANNEL_MANUAL");
  }
  if (record.gatewayEnvironment !== "Manual" && record.gatewayEnvironment !== environment) {
    throw new AppError(
      "This payment was created for a different gateway environment",
      409,
      "PAYMENT_GATEWAY_ENVIRONMENT_MISMATCH",
    );
  }
}

function assertMembershipReferenceEligible(
  record: PaymongoPaymentReferenceRecord,
  environment: PaymongoOnlineGatewayEnvironment,
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

function assertApplicationPaymentReferenceMatches(input: {
  record: PaymongoPaymentReferenceRecord;
  application: PaymongoMembershipApplicationRecord;
  paymentPurpose: PaymongoMembershipCheckoutInput["paymentPurpose"];
  amount: number;
}) {
  if (
    input.record.relatedEntityType !== "membership_application"
    || input.record.relatedEntityId !== input.application.id
  ) {
    throw new AppError(
      "The payment reference does not belong to this membership application",
      409,
      "MEMBERSHIP_PAYMENT_REFERENCE_MISMATCH",
    );
  }
  if (input.record.paymentPurpose !== input.paymentPurpose) {
    throw new AppError(
      "The payment reference purpose does not match the requested checkout",
      409,
      "MEMBERSHIP_PAYMENT_PURPOSE_MISMATCH",
    );
  }
  if (Math.round(input.record.amount * 100) !== Math.round(input.amount * 100)) {
    throw new AppError(
      "The payment reference amount does not match the requested checkout",
      409,
      "MEMBERSHIP_PAYMENT_AMOUNT_MISMATCH",
    );
  }
}

function checkoutPublicStatus(record: PaymongoPaymentReferenceRecord) {
  return record.validationStatus === "Validated" ? "Confirmed" : "Waiting";
}

function checkoutDescription(record: PaymongoPaymentReferenceRecord) {
  return `TrackCOOP ${record.paymentPurpose} (${record.referenceNumber})`;
}

function checkoutLineName(record: PaymongoPaymentReferenceRecord) {
  if (record.paymentPurpose === "POS/Product") {
    return "Cooperative Store Order";
  }
  return record.paymentPurpose || "TrackCOOP payment";
}

function checkoutMetadata(
  record: PaymongoPaymentReferenceRecord,
  environment: PaymongoOnlineGatewayEnvironment,
) {
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
    rawDateOfBirth: string | undefined,
    input: PaymongoMembershipCheckoutInput,
  ): Promise<PaymongoPublicCheckoutResult>;
  createPaymentReferenceCheckout(
    paymentReferenceId: string,
    auth: AuthContext,
  ): Promise<PaymongoCheckoutResult>;
  createPointOfSaleCheckout(
    paymentReferenceId: string,
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
  attemptRepository?: PaymongoCheckoutAttemptRepository;
  membershipInstallmentRepository?: PaymongoMembershipInstallmentRepository;
} = {}): PaymongoService {
  const config = options.config ?? createPaymongoConfigFromEnv();
  const client = options.client ?? createPaymongoClient(config);
  const repository = options.repository ?? createPaymongoRepository();
  const attemptRepository = options.attemptRepository
    ?? createPaymongoCheckoutAttemptRepository();
  const membershipInstallmentRepository = options.membershipInstallmentRepository
    ?? createPaymongoMembershipInstallmentRepository();

  return {
    async createPaymentReferenceCheckout(paymentReferenceId, auth) {
      validatePaymongoConfig(config);
      const initialRecord = requirePaymentReference(
        await repository.findPaymentReference(paymentReferenceId),
      );
      assertCanAccessPayment(initialRecord, auth);

      const environment = gatewayEnvironment(config.mode);
      const result = await attemptRepository.createOrReuseCheckoutAttempt({
        paymentReferenceId: initialRecord.id,
        environment,
        reuseMinutes: checkoutReuseMinutes(config),
        validateRecord(record) {
          assertCanAccessPayment(record, auth);
          assertEligibleForCheckout(record, environment);
        },
        createSession(record, idempotencyKey) {
          return client.createCheckoutSession(
            buildCheckoutRequest(record, config),
            idempotencyKey,
          );
        },
      });

      return {
        paymentReferenceId: result.record.id,
        referenceNumber: result.record.referenceNumber,
        checkoutId: result.attempt.checkoutId,
        checkoutUrl: result.attempt.checkoutUrl,
        gatewayStatus: result.attempt.gatewayStatus,
        validationStatus: result.record.validationStatus,
        amount: result.record.amount,
        currency: "PHP",
        mode: config.mode,
        attemptNumber: result.attempt.attemptNumber,
        reused: result.reused,
      };
    },

    async createPointOfSaleCheckout(paymentReferenceId) {
      validatePaymongoConfig(config);
      const initialRecord = requirePaymentReference(
        await repository.findPaymentReference(paymentReferenceId),
      );

      const environment = gatewayEnvironment(config.mode);
      const result = await attemptRepository.createOrReuseCheckoutAttempt({
        paymentReferenceId: initialRecord.id,
        environment,
        reuseMinutes: checkoutReuseMinutes(config),
        validateRecord(record) {
          if (
            record.paymentPurpose !== "POS/Product"
            || record.relatedEntityType !== "pos_sales"
            || !record.relatedEntityId
          ) {
            throw new AppError(
              "Point-of-sale PayMongo checkout requires a linked cooperative store sale",
              422,
              "POS_PAYMONGO_REFERENCE_INVALID",
            );
          }
          assertEligibleForCheckout(record, environment);
        },
        createSession(record, idempotencyKey) {
          return client.createCheckoutSession(
            buildCheckoutRequest(record, config),
            idempotencyKey,
          );
        },
      });

      return {
        paymentReferenceId: result.record.id,
        referenceNumber: result.record.referenceNumber,
        checkoutId: result.attempt.checkoutId,
        checkoutUrl: result.attempt.checkoutUrl,
        gatewayStatus: result.attempt.gatewayStatus,
        validationStatus: result.record.validationStatus,
        amount: result.record.amount,
        currency: "PHP",
        mode: config.mode,
        attemptNumber: result.attempt.attemptNumber,
        reused: result.reused,
      };
    },

    async createMembershipApplicationCheckout(applicationCode, rawDateOfBirth, input) {
      validatePaymongoConfig(config);
      const application = requireMembershipApplication(
        await repository.findMembershipApplicationByCode(applicationCode),
      );
      assertValidBirthDateCredential(application, rawDateOfBirth);
      assertApplicationCanStartCheckout(application);

      const settings = await repository.getMembershipPaymentSettings();
      const environment = gatewayEnvironment(config.mode);
      const requestedAmount = input.paymentPurpose === "Associate Membership Fee"
        ? settings.associateFee
        : input.requestedAmount ?? 0;

      if (input.paymentPurpose === "Share Capital" && application.requestedMembershipType !== "True Member") {
        throw new AppError(
          "Share capital checkout is only available for True Member applicants",
          409,
          "SHARE_CAPITAL_TRUE_MEMBER_REQUIRED",
        );
      }

      const record = await membershipInstallmentRepository.prepareMembershipPaymentReference({
        application,
        purpose: input.paymentPurpose,
        requestedAmount,
        settings,
        environment,
      });
      const result = await attemptRepository.createOrReuseCheckoutAttempt({
        paymentReferenceId: record.id,
        environment,
        reuseMinutes: checkoutReuseMinutes(config),
        async validateRecord(lockedRecord, connection) {
          assertApplicationPaymentReferenceMatches({
            record: lockedRecord,
            application,
            paymentPurpose: input.paymentPurpose,
            amount: record.amount,
          });
          assertMembershipReferenceEligible(lockedRecord, environment);
          await membershipInstallmentRepository.assertCheckoutCapacity({
            connection,
            applicationId: application.id,
            paymentReferenceId: lockedRecord.id,
            purpose: input.paymentPurpose,
            amount: lockedRecord.amount,
            settings,
            environment,
          });
        },
        createSession(lockedRecord, idempotencyKey) {
          return client.createCheckoutSession(
            buildCheckoutRequest(lockedRecord, config),
            idempotencyKey,
          );
        },
      });

      return {
        referenceNumber: result.record.referenceNumber,
        checkoutUrl: result.attempt.checkoutUrl,
        gatewayStatus: result.attempt.gatewayStatus,
        paymentPurpose: input.paymentPurpose,
        amount: result.record.amount,
        currency: "PHP",
        mode: config.mode,
        status: checkoutPublicStatus(result.record),
        attemptNumber: result.attempt.attemptNumber,
        reused: result.reused,
      };
    },

    async getPaymentReferenceStatus(paymentReferenceId, auth) {
      let record = requirePaymentReference(
        await repository.findPaymentReference(paymentReferenceId),
      );
      assertCanAccessPayment(record, auth);

      const attempt = await attemptRepository.findLatestCheckoutAttempt(record.id);
      if (attempt) {
        validatePaymongoConfig(config);
        const environment = gatewayEnvironment(config.mode);
        if (attempt.gatewayEnvironment !== environment) {
          throw new AppError(
            "This checkout attempt belongs to a different PayMongo environment",
            409,
            "PAYMENT_GATEWAY_ENVIRONMENT_MISMATCH",
          );
        }

        const session = await client.retrieveCheckoutSession(attempt.checkoutId);
        if (session.livemode !== null && session.livemode !== (config.mode === "live")) {
          throw new AppError(
            "PayMongo returned a checkout session from a different environment",
            409,
            "PAYMONGO_CHECKOUT_ENVIRONMENT_MISMATCH",
          );
        }
        await attemptRepository.refreshCheckoutAttempt({
          paymentReferenceId: record.id,
          checkoutId: attempt.checkoutId,
          session,
        });
        record = requirePaymentReference(
          await repository.findPaymentReference(paymentReferenceId),
        );
        assertCanAccessPayment(record, auth);
      }

      const refreshedAttempt = attempt
        ? await attemptRepository.findLatestCheckoutAttempt(record.id)
        : null;

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
        checkoutAttemptNumber: refreshedAttempt?.attemptNumber ?? null,
        gatewayLastCheckedAt: refreshedAttempt?.lastCheckedAt ?? null,
      };
    },
  };
}
