import type { Pool } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import { postMembershipSettlement } from "./paymongo.settlement.membership";
import {
  selectPaymentForSettlement,
  selectSettlementActor,
  settlementDateTime,
  settlementMoney,
} from "./paymongo.settlement.queries";
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

function validateSettlementChannel(input: {
  validationSource: SettlePaymentReferenceInput["validationSource"];
  paymentChannel: string;
}) {
  if (input.validationSource === "Manual Bookkeeper") {
    if (!manualChannels.has(input.paymentChannel)) {
      throw new AppError(
        "Only manual payment channels can be validated manually",
        409,
        "PAYMENT_MANUAL_CHANNEL_REQUIRED",
      );
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
}

function validateGatewayDetails(input: {
  payment: Awaited<ReturnType<typeof selectPaymentForSettlement>>;
  details: NonNullable<SettlePaymentReferenceInput["gatewayDetails"]>;
}) {
  const payment = input.payment;
  if (!payment) return;
  if (settlementMoney(input.details.amount) !== settlementMoney(Number(payment.amount))) {
    throw new AppError(
      "PayMongo payment amount does not match the TrackCOOP reference",
      422,
      "PAYMENT_AMOUNT_MISMATCH",
    );
  }
  if (input.details.currency !== "PHP") {
    throw new AppError(
      "PayMongo payment currency is invalid",
      422,
      "PAYMENT_CURRENCY_MISMATCH",
    );
  }
  if (payment.gatewayCheckoutId && payment.gatewayCheckoutId !== input.details.checkoutId) {
    throw new AppError(
      "PayMongo checkout ID conflicts with the payment reference",
      409,
      "PAYMENT_CHECKOUT_CONFLICT",
    );
  }
  if (payment.gatewayPaymentId && payment.gatewayPaymentId !== input.details.paymentId) {
    throw new AppError(
      "PayMongo payment ID conflicts with the payment reference",
      409,
      "PAYMENT_GATEWAY_PAYMENT_CONFLICT",
    );
  }
}

export interface PaymentSettlementRepository {
  settlePaymentReference(input: SettlePaymentReferenceInput): Promise<SettlementResult>;
  markGatewayEventProcessed(gatewayEventId: string): Promise<void>;
  markGatewayEventFailed(input: {
    gatewayEventId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<void>;
}

export function createPaymentSettlementRepository(pool?: Pool): PaymentSettlementRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async settlePaymentReference(input) {
      return withTransaction(async (connection) => {
        const payment = await selectPaymentForSettlement(
          connection,
          input.paymentReferenceId,
        );
        if (!payment) {
          throw new AppError(
            "Payment reference was not found",
            404,
            "PAYMENT_REFERENCE_NOT_FOUND",
          );
        }
        const actorUserId = await selectSettlementActor(connection, input.actorUserId);
        validateSettlementChannel({
          validationSource: input.validationSource,
          paymentChannel: payment.paymentChannel,
        });
        if (input.gatewayDetails) {
          validateGatewayDetails({ payment, details: input.gatewayDetails });
        }

        if (payment.validationStatus === "Validated") {
          if (
            !input.gatewayDetails?.paymentId
            || !payment.gatewayPaymentId
            || payment.gatewayPaymentId === input.gatewayDetails.paymentId
          ) {
            return {
              paymentReferenceId: payment.id,
              alreadySettled: true,
              validationStatus: "Validated" as const,
            };
          }
          throw new AppError(
            "Payment reference was already settled by a different gateway payment",
            409,
            "PAYMENT_GATEWAY_PAYMENT_CONFLICT",
          );
        }

        await connection.execute(
          `UPDATE payment_references
              SET validation_status = 'Validated',
                  validated_by = ?,
                  validated_at = UTC_TIMESTAMP(),
                  rejection_reason = NULL,
                  payment_channel = CASE
                    WHEN ? = 'PayMongo Webhook' THEN 'PayMongo'
                    ELSE payment_channel
                  END,
                  gateway_environment = COALESCE(?, gateway_environment),
                  gateway_checkout_id = COALESCE(?, gateway_checkout_id),
                  gateway_payment_id = COALESCE(?, gateway_payment_id),
                  gateway_payment_intent_id = COALESCE(?, gateway_payment_intent_id),
                  gateway_status = COALESCE(?, gateway_status),
                  gateway_payment_method = COALESCE(?, gateway_payment_method),
                  gateway_fee_amount = COALESCE(?, gateway_fee_amount),
                  gateway_net_amount = COALESCE(?, gateway_net_amount),
                  paid_at = COALESCE(?, paid_at, UTC_TIMESTAMP()),
                  webhook_received_at = CASE
                    WHEN ? = 'PayMongo Webhook' THEN UTC_TIMESTAMP()
                    ELSE webhook_received_at
                  END,
                  validation_source = ?,
                  updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?`,
          [
            actorUserId,
            input.validationSource,
            input.gatewayDetails?.environment ?? null,
            input.gatewayDetails?.checkoutId ?? null,
            input.gatewayDetails?.paymentId ?? null,
            input.gatewayDetails?.paymentIntentId ?? null,
            input.gatewayDetails?.gatewayStatus ?? null,
            input.gatewayDetails?.paymentMethod ?? null,
            input.gatewayDetails?.feeAmount ?? null,
            input.gatewayDetails?.netAmount ?? null,
            settlementDateTime(input.gatewayDetails?.paidAt),
            input.validationSource,
            input.validationSource,
            payment.id,
          ],
        );

        await connection.execute(
          `INSERT INTO payment_validation_history
             (payment_reference_id, old_status, new_status, validation_source,
              reason, changed_by, gateway_event_id)
           VALUES (?, ?, 'Validated', ?, ?, ?, ?)`,
          [
            payment.id,
            payment.validationStatus,
            input.validationSource,
            input.validationSource === "PayMongo Webhook"
              ? "PayMongo webhook confirmed payment."
              : "Bookkeeper manually validated payment.",
            actorUserId,
            input.gatewayEventId ?? null,
          ],
        );

        if (["Associate Membership Fee", "Share Capital"].includes(payment.paymentPurpose)) {
          await postMembershipSettlement({
            connection,
            payment: { ...payment, validationStatus: "Validated" },
            actorUserId,
            gatewayDetails: input.gatewayDetails,
          });
        }

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description,
              old_values, new_values)
           VALUES (?, 'payment_reference.settled', 'payment_references', ?, ?,
                   JSON_OBJECT('validationStatus', ?),
                   JSON_OBJECT('validationStatus', 'Validated', 'validationSource', ?))`,
          [
            actorUserId,
            payment.id,
            "A payment reference was settled.",
            payment.validationStatus,
            input.validationSource,
          ],
        );

        if (input.gatewayEventId) {
          await connection.execute(
            `UPDATE payment_gateway_events
                SET processing_status = 'Processed',
                    processed_at = UTC_TIMESTAMP(),
                    payment_reference_id = ?
              WHERE payment_gateway_event_id = ?`,
            [payment.id, input.gatewayEventId],
          );
        }

        return {
          paymentReferenceId: payment.id,
          alreadySettled: false,
          validationStatus: "Validated" as const,
        };
      }, databasePool());
    },

    async markGatewayEventProcessed(gatewayEventId) {
      await databasePool().execute(
        `UPDATE payment_gateway_events
            SET processing_status = 'Processed', processed_at = UTC_TIMESTAMP()
          WHERE payment_gateway_event_id = ?`,
        [gatewayEventId],
      );
    },

    async markGatewayEventFailed(input) {
      await databasePool().execute(
        `UPDATE payment_gateway_events
            SET processing_status = 'Failed',
                error_code = ?, error_message = ?, processed_at = UTC_TIMESTAMP()
          WHERE payment_gateway_event_id = ?`,
        [
          input.errorCode.slice(0, 120),
          input.errorMessage.slice(0, 1000),
          input.gatewayEventId,
        ],
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
  return {
    settlePaymentReference(input) {
      return repository.settlePaymentReference(input);
    },
  };
}
