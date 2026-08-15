import type { Pool } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { postMembershipSettlement } from "./paymongo.settlement.membership";
import { postMemberShareCapitalSettlement } from "./paymongo.settlement.member-share-capital";
import { postPointOfSaleSettlement } from "./paymongo.settlement.pos";
import { recordSettlementCommunication } from "./paymongo.settlement.communication";
import { resolveSettlementContext } from "./paymongo.settlement.context";
import {
  createPaymentReceiptService,
  queuePaymentReceipt,
  type PaymentReceiptService,
} from "./paymongo.settlement.receipt";
import {
  selectPaymentForSettlement,
  settlementDateTime,
  settlementMoney,
} from "./paymongo.settlement.queries";
import { resolvePaymongoSettlementActor } from "./paymongo.system-actor";
import type {
  SettlePaymentReferenceInput,
  SettlementResult,
} from "./paymongo.settlement.types";

export type {
  GatewaySettlementDetails,
  PaymentValidationSource,
  SettlePaymentReferenceInput,
  SettlementResult,
} from "./paymongo.settlement.types";

const manualChannels = new Set(["Manual GCash", "Cash", "Bank Transfer", "Other"]);
const eligibleStatuses = new Set(["Pending", "Needs Clarification"]);

function validateSettlementChannel(input: {
  validationSource: SettlePaymentReferenceInput["validationSource"];
  paymentChannel: string;
  gatewayDetails: SettlePaymentReferenceInput["gatewayDetails"];
}) {
  if (input.validationSource === "Manual Bookkeeper") {
    if (!manualChannels.has(input.paymentChannel)) {
      throw new AppError(
        "A PayMongo payment waiting for webhook confirmation cannot be validated manually",
        409,
        "PAYMENT_MANUAL_CHANNEL_REQUIRED",
      );
    }
    if (input.gatewayDetails) {
      throw new AppError("Manual settlement cannot include PayMongo gateway details", 400, "PAYMENT_GATEWAY_DETAILS_NOT_ALLOWED");
    }
    return;
  }
  if (input.paymentChannel !== "PayMongo") {
    throw new AppError(
      "PayMongo webhook settlement requires a PayMongo payment reference",
      409,
      "PAYMENT_PAYMONGO_CHANNEL_REQUIRED",
    );
  }
  if (!input.gatewayDetails) {
    throw new AppError("PayMongo webhook details are required", 422, "PAYMENT_GATEWAY_DETAILS_REQUIRED");
  }
}

function validateGatewayDetails(input: {
  payment: NonNullable<Awaited<ReturnType<typeof selectPaymentForSettlement>>>;
  details: NonNullable<SettlePaymentReferenceInput["gatewayDetails"]>;
}) {
  if (settlementMoney(input.details.amount) !== settlementMoney(Number(input.payment.amount))) {
    throw new AppError("PayMongo payment amount does not match the TrackCOOP reference", 422, "PAYMENT_AMOUNT_MISMATCH");
  }
  if (input.details.currency !== "PHP") {
    throw new AppError("PayMongo payment currency is invalid", 422, "PAYMENT_CURRENCY_MISMATCH");
  }
  if (input.payment.gatewayCheckoutId && input.payment.gatewayCheckoutId !== input.details.checkoutId) {
    throw new AppError("PayMongo checkout ID conflicts with the payment reference", 409, "PAYMENT_CHECKOUT_CONFLICT");
  }
  if (input.payment.gatewayPaymentId && input.payment.gatewayPaymentId !== input.details.paymentId) {
    throw new AppError("PayMongo payment ID conflicts with the payment reference", 409, "PAYMENT_GATEWAY_PAYMENT_CONFLICT");
  }
}

function sameSettlement(payment: NonNullable<Awaited<ReturnType<typeof selectPaymentForSettlement>>>, input: SettlePaymentReferenceInput) {
  if (payment.validationStatus !== "Validated") return false;
  if (input.validationSource === "Manual Bookkeeper") return true;
  return !payment.gatewayPaymentId || !input.gatewayDetails?.paymentId
    || payment.gatewayPaymentId === input.gatewayDetails.paymentId;
}

export interface PaymentSettlementRepository {
  settlePaymentReference(input: SettlePaymentReferenceInput): Promise<SettlementResult>;
  markGatewayEventProcessed(gatewayEventId: string): Promise<void>;
  markGatewayEventFailed(input: { gatewayEventId: string; errorCode: string; errorMessage: string }): Promise<void>;
}

type Dependencies = {
  postMembershipSettlement?: typeof postMembershipSettlement;
  postMemberShareCapitalSettlement?: typeof postMemberShareCapitalSettlement;
  postPointOfSaleSettlement?: typeof postPointOfSaleSettlement;
  recordSettlementCommunication?: typeof recordSettlementCommunication;
  queuePaymentReceipt?: typeof queuePaymentReceipt;
  receiptService?: PaymentReceiptService;
  systemActorUserId?: string;
};

export function createPaymentSettlementRepository(pool?: Pool, dependencies: Dependencies = {}): PaymentSettlementRepository {
  const databasePool = () => pool ?? getPool();
  const receiptService = dependencies.receiptService ?? createPaymentReceiptService(pool);

  return {
    async settlePaymentReference(input) {
      const durable = await withTransaction(async (connection) => {
        const payment = await selectPaymentForSettlement(connection, input.paymentReferenceId);
        if (!payment) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        if (!Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0) {
          throw new AppError("Payment amount must be positive", 422, "PAYMENT_AMOUNT_INVALID");
        }
        const actor = await resolvePaymongoSettlementActor(connection, {
          validationSource: input.validationSource,
          actorUserId: input.actorUserId,
          configuredSystemActorUserId:
            dependencies.systemActorUserId ?? env.PAYMONGO_SYSTEM_ACTOR_USER_ID,
        });
        const actorUserId = actor.id;
        validateSettlementChannel({
          validationSource: input.validationSource,
          paymentChannel: payment.paymentChannel,
          gatewayDetails: input.gatewayDetails,
        });
        if (input.gatewayDetails) validateGatewayDetails({ payment, details: input.gatewayDetails });

        if (payment.validationStatus === "Validated") {
          if (!sameSettlement(payment, input)) {
            throw new AppError(
              "Payment reference was already settled by a different gateway payment",
              409,
              "PAYMENT_GATEWAY_PAYMENT_CONFLICT",
            );
          }
          const context = await resolveSettlementContext(connection, payment);
          await (dependencies.queuePaymentReceipt ?? queuePaymentReceipt)(connection, {
            paymentReferenceId: payment.id,
            memberId: context.memberId,
            actorUserId,
            amount: Number(payment.amount),
            paymentChannel: payment.paymentChannel,
            provider: payment.provider,
            validationSource: input.validationSource,
            subjectReference: context.subjectReference,
            paymentDate: payment.paidAt ?? input.gatewayDetails?.paidAt ?? null,
            validatedAt: payment.validatedAt ?? null,
          });
          if (input.gatewayEventId) {
            await connection.execute(
              `UPDATE payment_gateway_events SET processing_status = 'Processed',
                      processed_at = UTC_TIMESTAMP(), payment_reference_id = ?
                WHERE payment_gateway_event_id = ?`,
              [payment.id, input.gatewayEventId],
            );
          }
          return { paymentReferenceId: payment.id, alreadySettled: true };
        }
        if (!eligibleStatuses.has(payment.validationStatus)) {
          throw new AppError("Payment reference is not eligible for settlement", 409, "PAYMENT_NOT_ELIGIBLE");
        }
        if (!["Associate Membership Fee", "Share Capital", "POS/Product"].includes(payment.paymentPurpose)) {
          throw new AppError(
            "The payment purpose is not supported by the settlement workflow",
            409,
            "PAYMENT_SETTLEMENT_PURPOSE_UNSUPPORTED",
          );
        }

        await connection.execute(
          `UPDATE payment_references
              SET validation_status = 'Validated', validated_by = ?,
                  validated_at = UTC_TIMESTAMP(), rejection_reason = NULL,
                  payment_channel = CASE WHEN ? = 'PayMongo Webhook' THEN 'PayMongo' ELSE payment_channel END,
                  gateway_environment = COALESCE(?, gateway_environment),
                  gateway_checkout_id = COALESCE(?, gateway_checkout_id),
                  gateway_payment_id = COALESCE(?, gateway_payment_id),
                  gateway_payment_intent_id = COALESCE(?, gateway_payment_intent_id),
                  gateway_status = COALESCE(?, gateway_status),
                  gateway_payment_method = COALESCE(?, gateway_payment_method),
                  gateway_fee_amount = COALESCE(?, gateway_fee_amount),
                  gateway_net_amount = COALESCE(?, gateway_net_amount),
                  paid_at = COALESCE(?, paid_at, UTC_TIMESTAMP()),
                  webhook_received_at = CASE WHEN ? = 'PayMongo Webhook' THEN UTC_TIMESTAMP() ELSE webhook_received_at END,
                  validation_source = ?, updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?`,
          [actorUserId, input.validationSource, input.gatewayDetails?.environment ?? null,
            input.gatewayDetails?.checkoutId ?? null, input.gatewayDetails?.paymentId ?? null,
            input.gatewayDetails?.paymentIntentId ?? null, input.gatewayDetails?.gatewayStatus ?? null,
            input.gatewayDetails?.paymentMethod ?? null, input.gatewayDetails?.feeAmount ?? null,
            input.gatewayDetails?.netAmount ?? null, settlementDateTime(input.gatewayDetails?.paidAt),
            input.validationSource, input.validationSource, payment.id],
        );
        await connection.execute(
          `INSERT INTO payment_validation_history
             (payment_reference_id, old_status, new_status, validation_source,
              reason, changed_by, gateway_event_id)
           VALUES (?, ?, 'Validated', ?, ?, ?, ?)`,
          [payment.id, payment.validationStatus, input.validationSource,
            input.validationSource === "PayMongo Webhook"
              ? "PayMongo webhook confirmed payment."
              : "Bookkeeper manually validated payment.",
            actorUserId, input.gatewayEventId ?? null],
        );

        const posted = payment.paymentPurpose === "POS/Product"
          ? await (dependencies.postPointOfSaleSettlement ?? postPointOfSaleSettlement)({
              connection, payment: { ...payment, validationStatus: "Validated" }, actorUserId,
              gatewayDetails: input.gatewayDetails,
            })
          : payment.paymentPurpose === "Share Capital" && payment.relatedEntityType === "member_profile"
          ? await (dependencies.postMemberShareCapitalSettlement ?? postMemberShareCapitalSettlement)({
              connection, payment: { ...payment, validationStatus: "Validated" }, actorUserId,
              gatewayDetails: input.gatewayDetails,
            })
          : await (dependencies.postMembershipSettlement ?? postMembershipSettlement)({
              connection, payment: { ...payment, validationStatus: "Validated" }, actorUserId,
              gatewayDetails: input.gatewayDetails,
            });
        const context = {
          memberId: posted.memberId,
          memberUserId: posted.memberUserId,
          applicationId: "applicationId" in posted ? posted.applicationId : null,
          applicationStatus: "applicationStatus" in posted ? posted.applicationStatus : null,
          subjectReference: posted.subjectReference,
          subjectName: posted.subjectName,
        };
        await (dependencies.recordSettlementCommunication ?? recordSettlementCommunication)(connection, {
          context, paymentReferenceId: payment.id, paymentReferenceNumber: payment.referenceNumber,
          paymentPurpose: payment.paymentPurpose, amount: Number(payment.amount), actorUserId,
          validationSource: input.validationSource,
        });
        await (dependencies.queuePaymentReceipt ?? queuePaymentReceipt)(connection, {
          paymentReferenceId: payment.id, memberId: context.memberId, actorUserId,
          amount: Number(payment.amount), paymentChannel: payment.paymentChannel,
          provider: payment.provider, validationSource: input.validationSource,
          subjectReference: context.subjectReference,
          paymentDate: input.gatewayDetails?.paidAt ?? payment.paidAt ?? null,
          validatedAt: new Date(),
        });
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'payment_reference.settled', 'payment_references', ?, ?,
                   JSON_OBJECT('validationStatus', ?),
                   JSON_OBJECT('validationStatus', 'Validated', 'validationSource', ?,
                                'actorType', ?, 'gatewayEventId', ?))`,
          [actorUserId, payment.id,
            input.validationSource === "PayMongo Webhook"
              ? "An automated PayMongo webhook settled the payment reference."
              : "The authenticated Bookkeeper manually settled the payment reference.",
            payment.validationStatus, input.validationSource, actor.actorType, input.gatewayEventId ?? null],
        );
        if (input.gatewayEventId) {
          await connection.execute(
            `UPDATE payment_gateway_events SET processing_status = 'Processed',
                    processed_at = UTC_TIMESTAMP(), payment_reference_id = ?
              WHERE payment_gateway_event_id = ?`,
            [payment.id, input.gatewayEventId],
          );
        }
        return { paymentReferenceId: payment.id, alreadySettled: false };
      }, databasePool());

      const receipt = await receiptService.process(durable.paymentReferenceId);
      return {
        ...durable,
        validationStatus: "Validated",
        receiptStatus: receipt?.processingStatus ?? null,
        receiptErrorCode: receipt?.lastErrorCode ?? null,
      };
    },

    async markGatewayEventProcessed(gatewayEventId) {
      await databasePool().execute(
        `UPDATE payment_gateway_events SET processing_status = 'Processed', processed_at = UTC_TIMESTAMP()
          WHERE payment_gateway_event_id = ?`, [gatewayEventId],
      );
    },
    async markGatewayEventFailed(input) {
      await databasePool().execute(
        `UPDATE payment_gateway_events SET processing_status = 'Failed',
                error_code = ?, error_message = ?, processed_at = UTC_TIMESTAMP()
          WHERE payment_gateway_event_id = ?`,
        [input.errorCode.slice(0, 120), input.errorMessage.slice(0, 1000), input.gatewayEventId],
      );
    },
  };
}

export interface PaymentSettlementService {
  settlePaymentReference(input: SettlePaymentReferenceInput): Promise<SettlementResult>;
}
export function createPaymentSettlementService(
  repository: PaymentSettlementRepository = createPaymentSettlementRepository(),
): PaymentSettlementService {
  return { settlePaymentReference: (input) => repository.settlePaymentReference(input) };
}
