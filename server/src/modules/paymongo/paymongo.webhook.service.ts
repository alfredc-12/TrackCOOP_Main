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
  type GatewaySettlementDetails,
  type PaymentSettlementRepository,
} from "./paymongo.settlement";
import type {
  PaymongoConfig,
  PaymongoGatewayEnvironment,
  PaymongoOnlineGatewayEnvironment,
} from "./paymongo.types";
import {
  parsePaymongoPaidCheckoutWebhookPayload,
  paymongoEventFingerprint,
  verifyAndParsePaymongoWebhook,
} from "./paymongo.webhook";

type GatewayProcessingStatus = "Received" | "Processing" | "Processed" | "Ignored" | "Failed";

type PaymentReferenceLookup = {
  id: string;
  amount: string | number;
  referenceNumber: string;
  paymentPurpose: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  gatewayEnvironment: PaymongoGatewayEnvironment;
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
};

type CheckoutAttemptLookup = {
  id: string;
  gatewayEnvironment: PaymongoOnlineGatewayEnvironment;
  amount: string | number;
};

type PaymentReferenceLookupRow = RowDataPacket & PaymentReferenceLookup;
type CheckoutAttemptLookupRow = RowDataPacket & CheckoutAttemptLookup;
type GatewayEventRow = RowDataPacket & {
  id: string;
  processingStatus: GatewayProcessingStatus;
  retryCount: number | string;
};

type SafeGatewayEventSummary = {
  paymentReferenceId: string | null;
  eventType: string;
  eventObjectId: string | null;
  fingerprint: string;
  referenceNumber: string | null;
  checkoutId: string | null;
  paymentId: string | null;
  paymentIntentId: string | null;
  livemode: boolean;
  payloadHash: string;
  amount: number | null;
  currency: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  feeAmount: number | null;
  netAmount: number | null;
  paidAt: Date | null;
};

type GatewayEventInsertResult = {
  id: string;
  duplicate: boolean;
  processingStatus: GatewayProcessingStatus;
  retryCount: number;
};

export type PaymongoWebhookHandleResult = {
  status: "processed" | "duplicate" | "ignored";
  paymentReferenceId?: string;
};

const supportedPaymongoPurposes = new Set([
  "Associate Membership Fee",
  "Share Capital",
  "POS/Product",
]);

function centsToAmount(centavos: number) {
  return Math.round(centavos) / 100;
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function paidAtDate(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return new Date(value * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateTime(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 19).replace("T", " ") : null;
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
  return "Payment settlement failed because of an internal server error.";
}

function assertModeMatches(config: PaymongoConfig, livemode: boolean | null | undefined) {
  if (livemode === undefined || livemode === null) return;
  if (config.mode === "test" && livemode) {
    throw new AppError("Live PayMongo events are not accepted in test mode", 422, "PAYMONGO_LIVE_EVENT_REJECTED");
  }
  if (config.mode === "live" && !livemode) {
    throw new AppError("Test PayMongo events are not accepted in live mode", 422, "PAYMONGO_TEST_EVENT_REJECTED");
  }
}

function unsupportedPurposeError() {
  return new AppError(
    "PayMongo checkout is not implemented for this payment purpose",
    409,
    "PAYMENT_PURPOSE_GATEWAY_NOT_IMPLEMENTED",
  );
}

function eventDataObject(envelopeData: unknown) {
  if (!envelopeData || typeof envelopeData !== "object") return { id: null, type: null };
  const data = envelopeData as { id?: unknown; type?: unknown };
  return {
    id: typeof data.id === "string" && data.id.trim() ? data.id : null,
    type: typeof data.type === "string" && data.type.trim() ? data.type : null,
  };
}

function selectPaidPayment(
  payments: Array<{ id: string; attributes: Record<string, unknown> }>,
) {
  const paidPayments = payments.filter((payment) => {
    const status = payment.attributes.status;
    return typeof status === "string" && status.trim().toLowerCase() === "paid";
  });
  if (paidPayments.length === 0) {
    throw new AppError("PayMongo checkout does not include a paid payment", 422, "PAYMONGO_PAYMENT_NOT_PAID");
  }
  if (paidPayments.length > 1) {
    throw new AppError(
      "PayMongo checkout includes multiple paid payments and requires reconciliation",
      409,
      "PAYMONGO_PAYMENT_AMBIGUOUS",
    );
  }
  return paidPayments[0];
}

function assertMetadataMatches(metadata: Record<string, string>, reference: PaymentReferenceLookup) {
  if (metadata.trackcoop_reference_number && metadata.trackcoop_reference_number !== reference.referenceNumber) {
    throw new AppError("PayMongo reference number does not match TrackCOOP metadata", 422, "PAYMENT_REFERENCE_MISMATCH");
  }
  if (metadata.payment_purpose && metadata.payment_purpose !== reference.paymentPurpose) {
    throw new AppError("PayMongo payment purpose conflicts with TrackCOOP metadata", 422, "PAYMENT_METADATA_CONFLICT");
  }
  if (metadata.related_entity_type && reference.relatedEntityType && metadata.related_entity_type !== reference.relatedEntityType) {
    throw new AppError("PayMongo related entity type conflicts with TrackCOOP metadata", 422, "PAYMENT_METADATA_CONFLICT");
  }
  if (metadata.related_entity_id && reference.relatedEntityId && metadata.related_entity_id !== reference.relatedEntityId) {
    throw new AppError("PayMongo related entity ID conflicts with TrackCOOP metadata", 422, "PAYMENT_METADATA_CONFLICT");
  }
}

function assertGatewayIdsMatch(input: {
  reference: PaymentReferenceLookup;
  attempt: CheckoutAttemptLookup | null;
  details: GatewaySettlementDetails;
}) {
  if (
    input.reference.gatewayEnvironment !== "Manual"
    && input.reference.gatewayEnvironment !== input.details.environment
  ) {
    throw new AppError(
      "This payment was created for a different gateway environment",
      409,
      "PAYMENT_GATEWAY_ENVIRONMENT_MISMATCH",
    );
  }

  if (input.attempt) {
    if (input.attempt.gatewayEnvironment !== input.details.environment) {
      throw new AppError(
        "The checkout attempt belongs to a different gateway environment",
        409,
        "PAYMENT_GATEWAY_ENVIRONMENT_MISMATCH",
      );
    }
    if (toMoney(Number(input.attempt.amount)) !== toMoney(input.details.amount)) {
      throw new AppError(
        "PayMongo checkout attempt amount does not match the payment",
        422,
        "PAYMENT_AMOUNT_MISMATCH",
      );
    }
  } else if (
    input.reference.gatewayCheckoutId
    && input.reference.gatewayCheckoutId !== input.details.checkoutId
  ) {
    throw new AppError(
      "PayMongo checkout ID conflicts with the payment reference",
      409,
      "PAYMENT_CHECKOUT_CONFLICT",
    );
  }

  if (
    input.reference.gatewayPaymentId
    && input.reference.gatewayPaymentId !== input.details.paymentId
  ) {
    throw new AppError(
      "PayMongo payment ID conflicts with the payment reference",
      409,
      "PAYMENT_GATEWAY_PAYMENT_CONFLICT",
    );
  }
}

async function markEventFailed(input: {
  settlementRepository: PaymentSettlementRepository;
  gatewayEventId: string;
  error: unknown;
}) {
  await input.settlementRepository.markGatewayEventFailed({
    gatewayEventId: input.gatewayEventId,
    errorCode: safeErrorCode(input.error),
    errorMessage: safeErrorMessage(input.error),
  });
}

async function settleEvent(input: {
  eventRow: GatewayEventInsertResult;
  reference: PaymentReferenceLookup;
  gatewayDetails: GatewaySettlementDetails;
  repository: PaymongoWebhookRepository;
  settlementRepository: PaymentSettlementRepository;
}) {
  const claimed = await input.repository.markGatewayEventProcessing({
    gatewayEventId: input.eventRow.id,
    retryFailed: input.eventRow.processingStatus === "Failed",
  });
  if (!claimed) {
    return { status: "duplicate" as const, paymentReferenceId: input.reference.id };
  }

  try {
    await input.settlementRepository.settlePaymentReference({
      paymentReferenceId: input.reference.id,
      validationSource: "PayMongo Webhook",
      actorUserId: null,
      gatewayEventId: input.eventRow.id,
      gatewayDetails: input.gatewayDetails,
    });
  } catch (error) {
    await markEventFailed({
      settlementRepository: input.settlementRepository,
      gatewayEventId: input.eventRow.id,
      error,
    });
    throw error;
  }

  return { status: "processed" as const, paymentReferenceId: input.reference.id };
}

export interface PaymongoWebhookRepository {
  findPaymentReference(input: {
    paymentReferenceId?: string;
    referenceNumber: string;
  }): Promise<PaymentReferenceLookup | null>;
  findCheckoutAttempt?(input: {
    paymentReferenceId: string;
    checkoutId: string;
  }): Promise<CheckoutAttemptLookup | null>;
  insertGatewayEvent(input: SafeGatewayEventSummary): Promise<GatewayEventInsertResult>;
  markGatewayEventProcessing(input: {
    gatewayEventId: string;
    retryFailed: boolean;
  }): Promise<boolean>;
  markGatewayEventIgnored(gatewayEventId: string): Promise<void>;
  markCheckoutAttemptPaid?(input: {
    paymentReferenceId: string;
    checkoutId: string;
    paymentId: string;
    paymentIntentId: string | null;
    gatewayStatus: string;
    environment: PaymongoOnlineGatewayEnvironment;
  }): Promise<void>;
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
                reference_number AS referenceNumber,
                payment_purpose AS paymentPurpose,
                related_entity_type AS relatedEntityType,
                CAST(related_entity_id AS CHAR) AS relatedEntityId,
                gateway_environment AS gatewayEnvironment,
                gateway_checkout_id AS gatewayCheckoutId,
                gateway_payment_id AS gatewayPaymentId
           FROM payment_references
          WHERE ${where.join(" OR ")}
          ORDER BY payment_reference_id DESC
          LIMIT 1`,
        values,
      );
      return rows[0] ?? null;
    },

    async findCheckoutAttempt(input) {
      const [rows] = await databasePool().execute<CheckoutAttemptLookupRow[]>(
        `SELECT CAST(payment_gateway_checkout_attempt_id AS CHAR) AS id,
                gateway_environment AS gatewayEnvironment,
                amount
           FROM payment_gateway_checkout_attempts
          WHERE payment_reference_id = ?
            AND gateway_name = 'PayMongo'
            AND gateway_checkout_id = ?
          LIMIT 1`,
        [input.paymentReferenceId, input.checkoutId],
      );
      return rows[0] ?? null;
    },

    async insertGatewayEvent(input) {
      const [result] = await databasePool().execute<ResultSetHeader>(
        `INSERT IGNORE INTO payment_gateway_events
           (payment_reference_id, gateway_name, event_type, event_fingerprint,
            gateway_event_object_id, gateway_reference_number, gateway_checkout_id,
            gateway_payment_id, gateway_payment_intent_id, livemode, payload_sha256,
            gateway_amount, gateway_currency, gateway_payment_status, gateway_payment_method,
            gateway_fee_amount, gateway_net_amount, gateway_paid_at, processing_status,
            last_attempt_at)
         VALUES (?, 'PayMongo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Received',
                 UTC_TIMESTAMP())`,
        [
          input.paymentReferenceId,
          input.eventType,
          input.fingerprint,
          input.eventObjectId,
          input.referenceNumber,
          input.checkoutId,
          input.paymentId,
          input.paymentIntentId,
          input.livemode ? 1 : 0,
          input.payloadHash,
          input.amount,
          input.currency,
          input.paymentStatus,
          input.paymentMethod,
          input.feeAmount,
          input.netAmount,
          dateTime(input.paidAt),
        ],
      );
      if (result.affectedRows > 0) {
        return { id: String(result.insertId), duplicate: false, processingStatus: "Received", retryCount: 0 };
      }

      const [rows] = await databasePool().execute<GatewayEventRow[]>(
        `SELECT CAST(payment_gateway_event_id AS CHAR) AS id,
                processing_status AS processingStatus,
                retry_count AS retryCount
           FROM payment_gateway_events
          WHERE event_fingerprint = ?
             OR (? IS NOT NULL AND gateway_event_object_id = ?)
          LIMIT 1`,
        [input.fingerprint, input.eventObjectId, input.eventObjectId],
      );
      const row = rows[0];
      return {
        id: row?.id ?? "0",
        duplicate: true,
        processingStatus: row?.processingStatus ?? "Processed",
        retryCount: Number(row?.retryCount ?? 0),
      };
    },

    async markGatewayEventProcessing(input) {
      const [result] = await databasePool().execute<ResultSetHeader>(
        `UPDATE payment_gateway_events
            SET processing_status = 'Processing',
                processing_started_at = UTC_TIMESTAMP(),
                last_attempt_at = UTC_TIMESTAMP(),
                retry_count = CASE WHEN ? = 1 THEN retry_count + 1 ELSE retry_count END,
                safe_error_message = NULL
          WHERE payment_gateway_event_id = ?
            AND processing_status IN ('Received', 'Failed')`,
        [input.retryFailed ? 1 : 0, input.gatewayEventId],
      );
      return result.affectedRows > 0;
    },

    async markGatewayEventIgnored(gatewayEventId) {
      await databasePool().execute(
        `UPDATE payment_gateway_events
            SET processing_status = 'Ignored',
                processed_at = UTC_TIMESTAMP(),
                safe_error_message = NULL
          WHERE payment_gateway_event_id = ?`,
        [gatewayEventId],
      );
    },

    async markCheckoutAttemptPaid(input) {
      await databasePool().execute(
        `UPDATE payment_gateway_checkout_attempts
            SET gateway_status = ?,
                completed_at = COALESCE(completed_at, UTC_TIMESTAMP()),
                last_checked_at = UTC_TIMESTAMP(),
                updated_at = UTC_TIMESTAMP()
          WHERE payment_reference_id = ?
            AND gateway_name = 'PayMongo'
            AND gateway_checkout_id = ?`,
        [input.gatewayStatus, input.paymentReferenceId, input.checkoutId],
      );
      await databasePool().execute(
        `UPDATE payment_gateway_checkout_attempts
            SET superseded_at = COALESCE(superseded_at, UTC_TIMESTAMP()),
                updated_at = UTC_TIMESTAMP()
          WHERE payment_reference_id = ?
            AND gateway_name = 'PayMongo'
            AND gateway_checkout_id <> ?
            AND completed_at IS NULL
            AND superseded_at IS NULL`,
        [input.paymentReferenceId, input.checkoutId],
      );
      await databasePool().execute(
        `UPDATE payment_references
            SET gateway_environment = ?,
                gateway_checkout_id = ?,
                gateway_payment_id = COALESCE(?, gateway_payment_id),
                gateway_payment_intent_id = COALESCE(?, gateway_payment_intent_id),
                gateway_status = ?,
                updated_at = UTC_TIMESTAMP()
          WHERE payment_reference_id = ?
            AND validation_status IN ('Pending', 'Needs Clarification')`,
        [
          input.environment,
          input.checkoutId,
          input.paymentId,
          input.paymentIntentId,
          input.gatewayStatus,
          input.paymentReferenceId,
        ],
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
      const envelope = verified.envelope.data;
      const event = envelope.attributes;
      const eventType = event.type;
      const dataObject = eventDataObject(event.data);
      const eventObjectId = envelope.id ?? null;

      assertModeMatches(config, event.livemode);

      if (eventType !== "checkout_session.payment.paid") {
        const eventRow = await repository.insertGatewayEvent({
          paymentReferenceId: null,
          eventType,
          eventObjectId,
          fingerprint: paymongoEventFingerprint({
            eventObjectId,
            eventType,
            dataObjectId: dataObject.id,
            payloadHash: verified.payloadHash,
          }),
          referenceNumber: null,
          checkoutId: dataObject.type === "checkout_session" ? dataObject.id : null,
          paymentId: null,
          paymentIntentId: null,
          livemode: Boolean(event.livemode),
          payloadHash: verified.payloadHash,
          amount: null,
          currency: null,
          paymentStatus: null,
          paymentMethod: null,
          feeAmount: null,
          netAmount: null,
          paidAt: null,
        });
        if (!eventRow.duplicate) {
          await repository.markGatewayEventIgnored(eventRow.id);
        }
        return { status: "ignored" };
      }

      const paidPayload = parsePaymongoPaidCheckoutWebhookPayload(verified.json);
      const checkoutEvent = paidPayload.data.attributes;
      const checkout = checkoutEvent.data;
      const checkoutAttributes = checkout.attributes;

      if (checkoutEvent.livemode !== undefined && checkoutEvent.livemode !== checkoutAttributes.livemode) {
        throw new AppError("PayMongo event mode does not match checkout mode", 422, "PAYMONGO_LIVEMODE_MISMATCH");
      }
      assertModeMatches(config, checkoutAttributes.livemode);

      const payment = selectPaidPayment(checkoutAttributes.payments);
      const paymentAttributes = payment.attributes;
      if (!payment.id) {
        throw new AppError("PayMongo payment ID is missing", 422, "PAYMONGO_PAYMENT_ID_MISSING");
      }
      if (typeof paymentAttributes.amount !== "number") {
        throw new AppError("PayMongo payment amount is missing", 422, "PAYMONGO_PAYMENT_AMOUNT_MISSING");
      }
      if (typeof paymentAttributes.currency !== "string" || paymentAttributes.currency.toUpperCase() !== "PHP") {
        throw new AppError("PayMongo payment currency is invalid", 422, "PAYMENT_CURRENCY_MISMATCH");
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
      assertMetadataMatches(checkoutAttributes.metadata, reference);

      const feeAmount = typeof paymentAttributes.fee === "number"
        ? centsToAmount(paymentAttributes.fee)
        : null;
      const netAmount = typeof paymentAttributes.net_amount === "number"
        ? centsToAmount(paymentAttributes.net_amount)
        : null;
      const paidAtValue = typeof paymentAttributes.paid_at === "string"
        || typeof paymentAttributes.paid_at === "number"
        ? paymentAttributes.paid_at
        : null;
      const gatewayDetails: GatewaySettlementDetails = {
        checkoutId: checkout.id,
        paymentId: payment.id,
        paymentIntentId: checkoutAttributes.payment_intent?.id ?? null,
        gatewayStatus: checkoutAttributes.status ?? "paid",
        paymentMethod: paymentMethod(paymentAttributes),
        amount: centsToAmount(paymentAttributes.amount),
        currency: "PHP",
        feeAmount,
        netAmount,
        paidAt: paidAtDate(paidAtValue),
        environment: config.mode === "live" ? "Live" : "Test",
      };
      const checkoutAttempt = repository.findCheckoutAttempt
        ? await repository.findCheckoutAttempt({
          paymentReferenceId: reference.id,
          checkoutId: checkout.id,
        })
        : null;
      assertGatewayIdsMatch({ reference, attempt: checkoutAttempt, details: gatewayDetails });

      const eventRow = await repository.insertGatewayEvent({
        paymentReferenceId: reference.id,
        eventType,
        eventObjectId,
        fingerprint: paymongoEventFingerprint({
          eventObjectId,
          eventType,
          dataObjectId: checkout.id,
          checkoutId: checkout.id,
          paymentId: payment.id,
          payloadHash: verified.payloadHash,
        }),
        referenceNumber: checkoutAttributes.reference_number,
        checkoutId: checkout.id,
        paymentId: payment.id,
        paymentIntentId: checkoutAttributes.payment_intent?.id ?? null,
        livemode: checkoutAttributes.livemode,
        payloadHash: verified.payloadHash,
        amount: gatewayDetails.amount,
        currency: gatewayDetails.currency,
        paymentStatus: String(paymentAttributes.status),
        paymentMethod: gatewayDetails.paymentMethod ?? null,
        feeAmount: gatewayDetails.feeAmount ?? null,
        netAmount: gatewayDetails.netAmount ?? null,
        paidAt: gatewayDetails.paidAt ?? null,
      });

      if (repository.markCheckoutAttemptPaid && checkoutAttempt) {
        await repository.markCheckoutAttemptPaid({
          paymentReferenceId: reference.id,
          checkoutId: checkout.id,
          paymentId: payment.id,
          paymentIntentId: checkoutAttributes.payment_intent?.id ?? null,
          gatewayStatus: checkoutAttributes.status ?? "paid",
          environment: gatewayDetails.environment ?? (config.mode === "live" ? "Live" : "Test"),
        });
      }

      if (eventRow.duplicate) {
        if (eventRow.processingStatus === "Processed") {
          return { status: "duplicate", paymentReferenceId: reference.id };
        }
        if (eventRow.processingStatus === "Ignored") {
          return { status: "ignored", paymentReferenceId: reference.id };
        }
        if (eventRow.processingStatus === "Received" || eventRow.processingStatus === "Processing") {
          return { status: "duplicate", paymentReferenceId: reference.id };
        }
      }

      if (!supportedPaymongoPurposes.has(reference.paymentPurpose)) {
        const error = unsupportedPurposeError();
        await markEventFailed({ settlementRepository, gatewayEventId: eventRow.id, error });
        throw error;
      }

      if (toMoney(gatewayDetails.amount) !== toMoney(Number(reference.amount))) {
        const error = new AppError(
          "PayMongo payment amount does not match the TrackCOOP reference",
          422,
          "PAYMENT_AMOUNT_MISMATCH",
        );
        await markEventFailed({ settlementRepository, gatewayEventId: eventRow.id, error });
        throw error;
      }

      return settleEvent({
        eventRow,
        reference,
        gatewayDetails,
        repository,
        settlementRepository,
      });
    },
  };
}
