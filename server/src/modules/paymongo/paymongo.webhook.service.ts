import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ZodError } from "zod";
import { getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import {
  createPaymongoConfigFromEnv,
  validatePaymongoConfig,
} from "./paymongo.client";
import {
  createPaymentSettlementRepository,
  type PaymentSettlementRepository,
} from "./paymongo.settlement";
import type { PaymongoConfig } from "./paymongo.types";
import {
  paymongoEventFingerprint,
  verifyAndParsePaymongoWebhook,
} from "./paymongo.webhook";

type PaymentReferenceLookup = {
  id: string;
  amount: string | number;
  referenceNumber: string;
};

type PaymentReferenceLookupRow = RowDataPacket & PaymentReferenceLookup;

type GatewayEventRow = RowDataPacket & {
  id: string;
  processingStatus: "Received" | "Processed" | "Ignored" | "Failed";
};

export type PaymongoWebhookHandleResult = {
  status: "processed" | "duplicate" | "ignored";
  paymentReferenceId?: string;
};

function centsToAmount(centavos: number) {
  return Math.round(centavos) / 100;
}

function paidAtDate(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return new Date(value * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function paymentMethod(attributes: Record<string, unknown>) {
  const paymentMethodValue = attributes.payment_method;
  if (paymentMethodValue && typeof paymentMethodValue === "object" && "type" in paymentMethodValue) {
    const type = (paymentMethodValue as { type?: unknown }).type;
    if (typeof type === "string" && type.trim()) return type;
  }
  const source = attributes.source;
  if (source && typeof source === "object" && "type" in source) {
    const type = (source as { type?: unknown }).type;
    if (typeof type === "string" && type.trim()) return type;
  }
  return null;
}

function safeErrorCode(error: unknown) {
  if (error instanceof AppError) return error.code;
  if (error instanceof ZodError) return "PAYMONGO_WEBHOOK_PAYLOAD_INVALID";
  return "PAYMONGO_WEBHOOK_SETTLEMENT_FAILED";
}

function safeErrorMessage(error: unknown) {
  if (error instanceof AppError) return error.message;
  if (error instanceof ZodError) return "PayMongo webhook payload is invalid";
  if (error instanceof Error) return error.message;
  return "PayMongo webhook settlement failed";
}

export interface PaymongoWebhookRepository {
  findPaymentReference(input: {
    paymentReferenceId?: string;
    referenceNumber: string;
  }): Promise<PaymentReferenceLookup | null>;
  insertGatewayEvent(input: {
    paymentReferenceId: string | null;
    eventType: string;
    fingerprint: string;
    checkoutId: string;
    paymentId: string;
    paymentIntentId: string | null;
    livemode: boolean;
    payloadHash: string;
  }): Promise<{ id: string; duplicate: boolean }>;
  markGatewayEventIgnored(gatewayEventId: string): Promise<void>;
}

export function createPaymongoWebhookRepository(pool?: Pool): PaymongoWebhookRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async findPaymentReference(input) {
      const values: string[] = [];
      const where: string[] = [];
      if (input.paymentReferenceId) {
        where.push("payment_reference_id = ?");
        values.push(input.paymentReferenceId);
      }
      where.push("reference_number = ?");
      values.push(input.referenceNumber);

      const [rows] = await databasePool().execute<PaymentReferenceLookupRow[]>(
        `SELECT CAST(payment_reference_id AS CHAR) AS id,
                amount,
                reference_number AS referenceNumber
           FROM payment_references
          WHERE ${where.join(" OR ")}
          ORDER BY payment_reference_id DESC
          LIMIT 1`,
        values,
      );
      return rows[0] ?? null;
    },

    async insertGatewayEvent(input) {
      const [result] = await databasePool().execute<ResultSetHeader>(
        `INSERT IGNORE INTO payment_gateway_events
           (payment_reference_id, gateway_name, event_type, event_fingerprint,
            gateway_checkout_id, gateway_payment_id, gateway_payment_intent_id,
            livemode, payload_sha256, processing_status)
         VALUES (?, 'PayMongo', ?, ?, ?, ?, ?, ?, ?, 'Received')`,
        [
          input.paymentReferenceId,
          input.eventType,
          input.fingerprint,
          input.checkoutId,
          input.paymentId,
          input.paymentIntentId,
          input.livemode ? 1 : 0,
          input.payloadHash,
        ],
      );
      if (result.affectedRows > 0) {
        return { id: String(result.insertId), duplicate: false };
      }

      const [rows] = await databasePool().execute<GatewayEventRow[]>(
        `SELECT CAST(payment_gateway_event_id AS CHAR) AS id,
                processing_status AS processingStatus
           FROM payment_gateway_events
          WHERE event_fingerprint = ?
          LIMIT 1`,
        [input.fingerprint],
      );
      return { id: rows[0]?.id ?? "0", duplicate: true };
    },

    async markGatewayEventIgnored(gatewayEventId) {
      await databasePool().execute(
        `UPDATE payment_gateway_events
            SET processing_status = 'Ignored',
                processed_at = UTC_TIMESTAMP()
          WHERE payment_gateway_event_id = ?`,
        [gatewayEventId],
      );
    },
  };
}

export interface PaymongoWebhookService {
  handleWebhook(input: {
    rawBody: Buffer;
    signatureHeader: string | undefined;
  }): Promise<PaymongoWebhookHandleResult>;
}

export function createPaymongoWebhookService(options: {
  config?: PaymongoConfig;
  repository?: PaymongoWebhookRepository;
  settlementRepository?: PaymentSettlementRepository;
} = {}): PaymongoWebhookService {
  const config = options.config ?? createPaymongoConfigFromEnv();
  const repository = options.repository ?? createPaymongoWebhookRepository();
  const settlementRepository = options.settlementRepository ?? createPaymentSettlementRepository();

  return {
    async handleWebhook(input) {
      validatePaymongoConfig(config);
      const verified = verifyAndParsePaymongoWebhook({
        rawBody: input.rawBody,
        signatureHeader: input.signatureHeader,
        config,
      });
      const event = verified.payload.data.attributes;
      const checkout = event.data;
      const checkoutAttributes = checkout.attributes;
      const payment = checkoutAttributes.payments[0];
      const paymentAttributes = payment.attributes;
      const eventType = event.type;

      if (eventType !== "checkout_session.payment.paid") {
        return { status: "ignored" };
      }
      if (config.mode === "test" && checkoutAttributes.livemode) {
        throw new AppError("Live PayMongo events are not accepted in test mode", 422, "PAYMONGO_LIVE_EVENT_REJECTED");
      }
      if (config.mode === "live" && !checkoutAttributes.livemode) {
        throw new AppError("Test PayMongo events are not accepted in live mode", 422, "PAYMONGO_TEST_EVENT_REJECTED");
      }
      if (paymentAttributes.currency.toUpperCase() !== "PHP") {
        throw new AppError("PayMongo payment currency is invalid", 422, "PAYMENT_CURRENCY_MISMATCH");
      }
      if (paymentAttributes.status.toLowerCase() !== "paid") {
        throw new AppError("PayMongo payment is not paid", 422, "PAYMONGO_PAYMENT_NOT_PAID");
      }

      const metadataReferenceId = checkoutAttributes.metadata.trackcoop_payment_reference_id;
      const reference = await repository.findPaymentReference({
        paymentReferenceId: metadataReferenceId,
        referenceNumber: checkoutAttributes.reference_number,
      });
      if (!reference) {
        throw new AppError("TrackCOOP payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
      }
      if (reference.referenceNumber !== checkoutAttributes.reference_number) {
        throw new AppError("PayMongo reference number does not match TrackCOOP metadata", 422, "PAYMENT_REFERENCE_MISMATCH");
      }

      const fingerprint = paymongoEventFingerprint({
        eventType,
        checkoutId: checkout.id,
        paymentId: payment.id,
        payloadHash: verified.payloadHash,
      });
      const eventRow = await repository.insertGatewayEvent({
        paymentReferenceId: reference.id,
        eventType,
        fingerprint,
        checkoutId: checkout.id,
        paymentId: payment.id,
        paymentIntentId: checkoutAttributes.payment_intent?.id ?? null,
        livemode: checkoutAttributes.livemode,
        payloadHash: verified.payloadHash,
      });
      if (eventRow.duplicate) {
        return { status: "duplicate", paymentReferenceId: reference.id };
      }

      try {
        await settlementRepository.settlePaymentReference({
          paymentReferenceId: reference.id,
          validationSource: "PayMongo Webhook",
          actorUserId: null,
          gatewayEventId: eventRow.id,
          gatewayDetails: {
            checkoutId: checkout.id,
            paymentId: payment.id,
            paymentIntentId: checkoutAttributes.payment_intent?.id ?? null,
            gatewayStatus: checkoutAttributes.status ?? "paid",
            paymentMethod: paymentMethod(paymentAttributes),
            amount: centsToAmount(paymentAttributes.amount),
            currency: "PHP",
            feeAmount: paymentAttributes.fee === null || paymentAttributes.fee === undefined
              ? null
              : centsToAmount(paymentAttributes.fee),
            netAmount: paymentAttributes.net_amount === null || paymentAttributes.net_amount === undefined
              ? null
              : centsToAmount(paymentAttributes.net_amount),
            paidAt: paidAtDate(paymentAttributes.paid_at),
            environment: config.mode === "live" ? "Live" : "Test",
          },
        });
      } catch (error) {
        await settlementRepository.markGatewayEventFailed({
          gatewayEventId: eventRow.id,
          errorCode: safeErrorCode(error),
          errorMessage: safeErrorMessage(error),
        });
        throw error;
      }

      return { status: "processed", paymentReferenceId: reference.id };
    },
  };
}
