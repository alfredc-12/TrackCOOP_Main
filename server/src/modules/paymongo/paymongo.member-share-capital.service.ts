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
  createPaymongoCheckoutAttemptRepository,
  type PaymongoCheckoutAttemptRepository,
} from "./paymongo.checkout-attempt.repository";
import {
  createPaymongoMemberShareCapitalRepository,
  type PaymongoMemberShareCapitalRepository,
} from "./paymongo.member-share-capital.repository";
import {
  createPaymongoRepository,
  type PaymongoRepository,
} from "./paymongo.repository";
import type {
  PaymongoCheckoutRequest,
  PaymongoCheckoutResult,
  PaymongoConfig,
  PaymongoMemberShareCapitalCheckoutInput,
  PaymongoMemberShareCapitalSummary,
  PaymongoOnlineGatewayEnvironment,
  PaymongoPaymentReferenceRecord,
} from "./paymongo.types";

const defaultCheckoutReuseMinutes = 30;
const pendingStatuses = new Set(["Pending", "Needs Clarification"]);

function environment(mode: PaymongoConfig["mode"]): PaymongoOnlineGatewayEnvironment {
  return mode === "live" ? "Live" : "Test";
}

function reuseMinutes(config: PaymongoConfig) {
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

function requireMember(auth: AuthContext) {
  if (auth.user.role !== "member") {
    throw new AppError(
      "Only Members can access Share Capital checkout",
      403,
      "MEMBER_SHARE_CAPITAL_ROLE_REQUIRED",
    );
  }
}

function assertOwnership(record: PaymongoPaymentReferenceRecord, auth: AuthContext) {
  requireMember(auth);
  if (record.memberUserId !== auth.user.id || !record.memberId) {
    throw new AppError(
      "The Share Capital payment does not belong to the authenticated Member",
      403,
      "MEMBER_SHARE_CAPITAL_FORBIDDEN",
    );
  }
  if (
    record.paymentPurpose !== "Share Capital"
    || record.relatedEntityType !== "member_profile"
    || record.relatedEntityId !== record.memberId
  ) {
    throw new AppError(
      "The payment reference is not a Member Share Capital contribution",
      409,
      "MEMBER_SHARE_CAPITAL_REFERENCE_INVALID",
    );
  }
}

function assertCheckoutEligible(
  record: PaymongoPaymentReferenceRecord,
  gatewayEnvironment: PaymongoOnlineGatewayEnvironment,
) {
  if (!pendingStatuses.has(record.validationStatus)) {
    throw new AppError(
      record.validationStatus === "Validated"
        ? "This Share Capital payment has already been validated"
        : "This Share Capital payment is not eligible for checkout",
      409,
      record.validationStatus === "Validated"
        ? "SHARE_CAPITAL_PAYMENT_ALREADY_VALIDATED"
        : "PAYMENT_NOT_ELIGIBLE",
    );
  }
  if (!Number.isFinite(record.amount) || record.amount <= 0) {
    throw new AppError(
      "This Share Capital payment has an invalid amount",
      409,
      "PAYMENT_AMOUNT_INVALID",
    );
  }
  if (record.paymentChannel !== "PayMongo") {
    throw new AppError(
      "This Share Capital payment is not a PayMongo reference",
      409,
      "PAYMENT_CHANNEL_INVALID",
    );
  }
  if (
    record.gatewayEnvironment !== "Manual"
    && record.gatewayEnvironment !== gatewayEnvironment
  ) {
    throw new AppError(
      "This Share Capital payment belongs to a different PayMongo environment",
      409,
      "PAYMENT_GATEWAY_ENVIRONMENT_MISMATCH",
    );
  }
}

function checkoutRequest(
  record: PaymongoPaymentReferenceRecord,
  config: PaymongoConfig,
): PaymongoCheckoutRequest {
  const description = `TrackCOOP Share Capital (${record.referenceNumber})`;
  return {
    referenceNumber: record.referenceNumber,
    description,
    lineItems: [{
      name: "Share Capital",
      amount: amountToCentavos(record.amount),
      currency: "PHP",
      quantity: 1,
      description,
    }],
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
    metadata: {
      trackcoop_payment_reference_id: record.id,
      trackcoop_reference_number: record.referenceNumber,
      payment_purpose: "Share Capital",
      related_entity_type: "member_profile",
      related_entity_id: record.memberId ?? "",
      environment: environment(config.mode),
    },
  };
}

export interface PaymongoMemberShareCapitalService {
  getSummary(auth: AuthContext): Promise<PaymongoMemberShareCapitalSummary>;
  createCheckout(
    input: PaymongoMemberShareCapitalCheckoutInput,
    auth: AuthContext,
  ): Promise<PaymongoCheckoutResult>;
}

export function createPaymongoMemberShareCapitalService(options: {
  config?: PaymongoConfig;
  client?: PaymongoClient;
  repository?: PaymongoRepository;
  attemptRepository?: PaymongoCheckoutAttemptRepository;
  memberRepository?: PaymongoMemberShareCapitalRepository;
} = {}): PaymongoMemberShareCapitalService {
  const config = options.config ?? createPaymongoConfigFromEnv();
  const client = options.client ?? createPaymongoClient(config);
  const repository = options.repository ?? createPaymongoRepository();
  const attemptRepository = options.attemptRepository
    ?? createPaymongoCheckoutAttemptRepository();
  const memberRepository = options.memberRepository
    ?? createPaymongoMemberShareCapitalRepository();

  return {
    async getSummary(auth) {
      validatePaymongoConfig(config);
      requireMember(auth);
      const settings = await repository.getMembershipPaymentSettings();
      return memberRepository.getSummary({
        userId: auth.user.id,
        settings,
        environment: environment(config.mode),
        reuseMinutes: reuseMinutes(config),
        mode: config.mode,
      });
    },

    async createCheckout(input, auth) {
      validatePaymongoConfig(config);
      requireMember(auth);
      const settings = await repository.getMembershipPaymentSettings();
      const gatewayEnvironment = environment(config.mode);
      const record = await memberRepository.prepareContribution({
        userId: auth.user.id,
        checkout: input,
        settings,
        environment: gatewayEnvironment,
        reuseMinutes: reuseMinutes(config),
      });
      assertOwnership(record, auth);

      const result = await attemptRepository.createOrReuseCheckoutAttempt({
        paymentReferenceId: record.id,
        environment: gatewayEnvironment,
        reuseMinutes: reuseMinutes(config),
        async validateRecord(lockedRecord, connection) {
          assertOwnership(lockedRecord, auth);
          assertCheckoutEligible(lockedRecord, gatewayEnvironment);
          await memberRepository.assertCheckoutCapacity({
            connection,
            userId: auth.user.id,
            paymentReferenceId: lockedRecord.id,
            amount: lockedRecord.amount,
            settings,
            environment: gatewayEnvironment,
            reuseMinutes: reuseMinutes(config),
          });
        },
        createSession(lockedRecord, idempotencyKey) {
          return client.createCheckoutSession(
            checkoutRequest(lockedRecord, config),
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
  };
}
