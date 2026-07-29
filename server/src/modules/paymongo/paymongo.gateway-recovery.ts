import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { env } from "../../config/env";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { GatewayRetryResult } from "../payment-references/payment-reference.types";
import {
  createPaymentSettlementRepository,
  type GatewaySettlementDetails,
  type PaymentSettlementRepository,
} from "./paymongo.settlement";

type RecoveryRow = RowDataPacket & {
  eventId: string;
  paymentReferenceId: string | null;
  eventType: string;
  processingStatus: "Received" | "Processing" | "Processed" | "Ignored" | "Failed";
  retryCount: string | number;
  signatureVerifiedAt: Date | null;
  checkoutId: string | null;
  paymentId: string | null;
  paymentIntentId: string | null;
  livemode: string | number;
  amount: string | number | null;
  currency: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  feeAmount: string | number | null;
  netAmount: string | number | null;
  paidAt: Date | null;
  referenceAmount: string | number;
  referenceStatus: string;
  referencePurpose: string;
  referenceChannel: string;
  referenceEnvironment: string;
  referenceCheckoutId: string | null;
  referencePaymentId: string | null;
  referencePaymentIntentId: string | null;
};
type AttemptRow = RowDataPacket & {
  environment: "Test" | "Live";
  amount: string | number;
};
type EventStateRow = RowDataPacket & {
  processingStatus: "Processed" | "Failed" | "Processing" | "Received" | "Ignored";
  retryCount: string | number;
};

const supportedPurposes = new Set(["Associate Membership Fee", "Share Capital"]);
const retryablePaymentStates = new Set(["Pending", "Needs Clarification", "Validated"]);

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
function environmentFromLivemode(livemode: boolean) {
  return livemode ? "Live" as const : "Test" as const;
}
function safeFailure(error: unknown) {
  if (error instanceof AppError) return error;
  return new AppError(
    "Gateway settlement retry failed because of an internal server error",
    500,
    "PAYMONGO_GATEWAY_RETRY_FAILED",
  );
}

async function lockRecoveryContext(connection: PoolConnection, eventId: string) {
  const [rows] = await connection.execute<RecoveryRow[]>(
    `SELECT CAST(e.payment_gateway_event_id AS CHAR) AS eventId,
            CAST(e.payment_reference_id AS CHAR) AS paymentReferenceId,
            e.event_type AS eventType,
            e.processing_status AS processingStatus,
            e.retry_count AS retryCount,
            e.signature_verified_at AS signatureVerifiedAt,
            e.gateway_checkout_id AS checkoutId,
            e.gateway_payment_id AS paymentId,
            e.gateway_payment_intent_id AS paymentIntentId,
            e.livemode,
            e.gateway_amount AS amount,
            e.gateway_currency AS currency,
            e.gateway_payment_status AS paymentStatus,
            e.gateway_payment_method AS paymentMethod,
            e.gateway_fee_amount AS feeAmount,
            e.gateway_net_amount AS netAmount,
            e.gateway_paid_at AS paidAt,
            p.amount AS referenceAmount,
            p.validation_status AS referenceStatus,
            p.payment_purpose AS referencePurpose,
            p.payment_channel AS referenceChannel,
            p.gateway_environment AS referenceEnvironment,
            p.gateway_checkout_id AS referenceCheckoutId,
            p.gateway_payment_id AS referencePaymentId,
            p.gateway_payment_intent_id AS referencePaymentIntentId
       FROM payment_gateway_events e
       LEFT JOIN payment_references p
         ON p.payment_reference_id = e.payment_reference_id
      WHERE e.payment_gateway_event_id = ?
      LIMIT 1
      FOR UPDATE`,
    [eventId],
  );
  return rows[0] ?? null;
}

function validateStoredRecovery(row: RecoveryRow) {
  if (!row.paymentReferenceId) {
    throw new AppError("Gateway event is not linked to a payment reference", 409, "GATEWAY_EVENT_PAYMENT_NOT_LINKED");
  }
  if (!row.signatureVerifiedAt) {
    throw new AppError("Gateway event does not have prior signature verification", 409, "GATEWAY_EVENT_SIGNATURE_NOT_VERIFIED");
  }
  if (row.eventType !== "checkout_session.payment.paid") {
    throw new AppError("Only verified paid checkout events can be retried", 409, "GATEWAY_EVENT_TYPE_NOT_RETRYABLE");
  }
  if (!row.checkoutId || !row.paymentId) {
    throw new AppError("Stored gateway identifiers are incomplete", 422, "GATEWAY_EVENT_IDS_INCOMPLETE");
  }
  if (String(row.paymentStatus ?? "").toLowerCase() !== "paid") {
    throw new AppError("Stored PayMongo payment is not marked paid", 422, "PAYMONGO_PAYMENT_NOT_PAID");
  }
  if (String(row.currency ?? "").toUpperCase() !== "PHP") {
    throw new AppError("Stored PayMongo currency is invalid", 422, "PAYMENT_CURRENCY_MISMATCH");
  }
  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Stored PayMongo amount is invalid", 422, "PAYMENT_AMOUNT_INVALID");
  }
  if (roundMoney(amount) !== roundMoney(Number(row.referenceAmount))) {
    throw new AppError("Stored PayMongo amount does not match the payment reference", 422, "PAYMENT_AMOUNT_MISMATCH");
  }
  if (row.referenceChannel !== "PayMongo") {
    throw new AppError("Gateway retry requires a PayMongo payment reference", 409, "PAYMENT_PAYMONGO_CHANNEL_REQUIRED");
  }
  if (!supportedPurposes.has(row.referencePurpose)) {
    throw new AppError("Payment purpose is not supported by PayMongo settlement", 409, "PAYMENT_SETTLEMENT_PURPOSE_UNSUPPORTED");
  }
  if (!retryablePaymentStates.has(row.referenceStatus)) {
    throw new AppError("Payment reference is not eligible for gateway recovery", 409, "PAYMENT_NOT_ELIGIBLE");
  }
  const environment = environmentFromLivemode(Boolean(row.livemode));
  const configuredEnvironment = env.PAYMONGO_MODE === "live" ? "Live" : "Test";
  if (environment !== configuredEnvironment) {
    throw new AppError("Stored gateway event belongs to a different PayMongo environment", 409, "PAYMENT_GATEWAY_ENVIRONMENT_MISMATCH");
  }
  if (row.referenceEnvironment !== "Manual" && row.referenceEnvironment !== environment) {
    throw new AppError("Payment reference belongs to a different gateway environment", 409, "PAYMENT_GATEWAY_ENVIRONMENT_MISMATCH");
  }
  if (row.referenceCheckoutId && row.referenceCheckoutId !== row.checkoutId) {
    throw new AppError("Stored checkout ID conflicts with the payment reference", 409, "PAYMENT_CHECKOUT_CONFLICT");
  }
  if (row.referencePaymentId && row.referencePaymentId !== row.paymentId) {
    throw new AppError("Stored payment ID conflicts with the payment reference", 409, "PAYMENT_GATEWAY_PAYMENT_CONFLICT");
  }
  if (row.referencePaymentIntentId && row.paymentIntentId && row.referencePaymentIntentId !== row.paymentIntentId) {
    throw new AppError("Stored payment-intent ID conflicts with the payment reference", 409, "PAYMENT_GATEWAY_PAYMENT_INTENT_CONFLICT");
  }
  return { amount, environment };
}

async function validateCheckoutAttempt(
  connection: PoolConnection,
  row: RecoveryRow,
  environment: "Test" | "Live",
  amount: number,
) {
  const [rows] = await connection.execute<AttemptRow[]>(
    `SELECT gateway_environment AS environment, amount
       FROM payment_gateway_checkout_attempts
      WHERE payment_reference_id = ? AND gateway_name = 'PayMongo'
        AND gateway_checkout_id = ?
      LIMIT 1 FOR UPDATE`,
    [row.paymentReferenceId, row.checkoutId],
  );
  const attempt = rows[0];
  if (!attempt) {
    if (row.referenceCheckoutId !== row.checkoutId) {
      throw new AppError("Stored checkout attempt was not found", 409, "PAYMONGO_CHECKOUT_ATTEMPT_NOT_FOUND");
    }
    return;
  }
  if (attempt.environment !== environment) {
    throw new AppError("Checkout attempt environment does not match the event", 409, "PAYMENT_GATEWAY_ENVIRONMENT_MISMATCH");
  }
  if (roundMoney(Number(attempt.amount)) !== roundMoney(amount)) {
    throw new AppError("Checkout attempt amount does not match the event", 422, "PAYMENT_AMOUNT_MISMATCH");
  }
}

export interface PaymongoGatewayRecoveryService {
  retryFailedEvent(input: {
    gatewayEventId: string;
    note: string;
    auth: AuthContext;
  }): Promise<GatewayRetryResult>;
}

export function createPaymongoGatewayRecoveryService(
  pool?: Pool,
  settlementRepository: PaymentSettlementRepository = createPaymentSettlementRepository(pool),
): PaymongoGatewayRecoveryService {
  const databasePool = () => pool ?? getPool();
  return {
    async retryFailedEvent(input) {
      if (input.auth.user.role !== "bookkeeper") {
        throw new AppError("Only the Bookkeeper can retry gateway settlement", 403, "FORBIDDEN");
      }
      const note = input.note.trim();
      if (note.length < 8) {
        throw new AppError("A recovery note with at least 8 characters is required", 400, "GATEWAY_RECOVERY_NOTE_REQUIRED");
      }

      const claimed = await withTransaction(async (connection) => {
        const row = await lockRecoveryContext(connection, input.gatewayEventId);
        if (!row) throw new AppError("Gateway event was not found", 404, "GATEWAY_EVENT_NOT_FOUND");
        if (row.processingStatus === "Processed") {
          if (!row.paymentReferenceId) {
            throw new AppError("Gateway event is not linked to a payment reference", 409, "GATEWAY_EVENT_PAYMENT_NOT_LINKED");
          }
          if (!row.signatureVerifiedAt) {
            throw new AppError("Gateway event does not have prior signature verification", 409, "GATEWAY_EVENT_SIGNATURE_NOT_VERIFIED");
          }
          if (row.eventType !== "checkout_session.payment.paid") {
            throw new AppError("Only verified paid checkout events can be retried", 409, "GATEWAY_EVENT_TYPE_NOT_RETRYABLE");
          }
          return { alreadyProcessed: true as const, row, amount: Number(row.amount), environment: environmentFromLivemode(Boolean(row.livemode)) };
        }
        if (row.processingStatus !== "Failed") {
          throw new AppError("Only failed gateway events can be retried", 409, "GATEWAY_EVENT_NOT_FAILED");
        }
        const validated = validateStoredRecovery(row);
        await validateCheckoutAttempt(connection, row, validated.environment, validated.amount);
        await connection.execute(
          `UPDATE payment_gateway_events
              SET processing_status = 'Processing',
                  processing_started_at = UTC_TIMESTAMP(),
                  last_attempt_at = UTC_TIMESTAMP(),
                  retry_count = retry_count + 1,
                  recovery_note = ?,
                  last_retried_by = ?,
                  error_code = NULL,
                  error_message = NULL,
                  safe_error_message = NULL
            WHERE payment_gateway_event_id = ? AND processing_status = 'Failed'`,
          [note, input.auth.user.id, input.gatewayEventId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'payment_gateway_event.retry_requested', 'payment_gateway_events', ?, ?,
                   JSON_OBJECT('processingStatus','Failed'),
                   JSON_OBJECT('processingStatus','Processing','recoveryNote',?))`,
          [input.auth.user.id, input.gatewayEventId,
            "The Bookkeeper requested recovery using the stored verified PayMongo event fields.", note],
        );
        return { alreadyProcessed: false as const, row, ...validated };
      }, databasePool());

      if (claimed.alreadyProcessed) {
        const [stateRows] = await databasePool().execute<EventStateRow[]>(
          `SELECT processing_status AS processingStatus, retry_count AS retryCount
             FROM payment_gateway_events WHERE payment_gateway_event_id = ? LIMIT 1`,
          [input.gatewayEventId],
        );
        return {
          gatewayEventId: input.gatewayEventId,
          paymentReferenceId: claimed.row.paymentReferenceId!,
          processingStatus: "Processed",
          retryCount: Number(stateRows[0]?.retryCount ?? claimed.row.retryCount),
          alreadyProcessed: true,
          receiptStatus: null,
          receiptErrorCode: null,
        };
      }

      const details: GatewaySettlementDetails = {
        checkoutId: claimed.row.checkoutId!,
        paymentId: claimed.row.paymentId!,
        paymentIntentId: claimed.row.paymentIntentId,
        gatewayStatus: claimed.row.paymentStatus ?? "paid",
        paymentMethod: claimed.row.paymentMethod,
        amount: claimed.amount,
        currency: "PHP",
        feeAmount: claimed.row.feeAmount === null ? null : Number(claimed.row.feeAmount),
        netAmount: claimed.row.netAmount === null ? null : Number(claimed.row.netAmount),
        paidAt: claimed.row.paidAt,
        environment: claimed.environment,
      };

      try {
        const result = await settlementRepository.settlePaymentReference({
          paymentReferenceId: claimed.row.paymentReferenceId!,
          validationSource: "PayMongo Webhook",
          actorUserId: null,
          gatewayEventId: input.gatewayEventId,
          gatewayDetails: details,
        });
        const [stateRows] = await databasePool().execute<EventStateRow[]>(
          `SELECT processing_status AS processingStatus, retry_count AS retryCount
             FROM payment_gateway_events WHERE payment_gateway_event_id = ? LIMIT 1`,
          [input.gatewayEventId],
        );
        return {
          gatewayEventId: input.gatewayEventId,
          paymentReferenceId: claimed.row.paymentReferenceId!,
          processingStatus: "Processed",
          retryCount: Number(stateRows[0]?.retryCount ?? Number(claimed.row.retryCount) + 1),
          alreadyProcessed: result.alreadySettled,
          receiptStatus: result.receiptStatus,
          receiptErrorCode: result.receiptErrorCode,
        };
      } catch (error) {
        const safe = safeFailure(error);
        await settlementRepository.markGatewayEventFailed({
          gatewayEventId: input.gatewayEventId,
          errorCode: safe.code,
          errorMessage: safe.message,
        });
        await databasePool().execute(
          `UPDATE payment_gateway_events SET safe_error_message = ?
            WHERE payment_gateway_event_id = ?`,
          [safe.message.slice(0, 1000), input.gatewayEventId],
        );
        await databasePool().execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'payment_gateway_event.retry_failed', 'payment_gateway_events', ?, ?,
                   JSON_OBJECT('errorCode',?))`,
          [input.auth.user.id, input.gatewayEventId,
            "Gateway recovery failed with a safe TrackCOOP error.", safe.code],
        );
        throw safe;
      }
    },
  };
}
