import type { Pool, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import type {
  PaymentCheckoutAttemptSummary,
  PaymentGatewayEventSummary,
  PaymentReceiptSummary,
  PaymentReference,
  PaymentReferenceDetail,
  PaymentReferenceListItem,
  PaymentReferenceListQuery,
  PaymentValidationHistoryEntry,
  PaymentValidationListResult,
} from "./payment-reference.types";

type ListRow = RowDataPacket & PaymentReferenceListItem & {
  amount: string | number;
  gatewayFeeAmount: string | number | null;
  gatewayNetAmount: string | number | null;
  failedGatewayEvents: string | number;
};
type CountRow = RowDataPacket & { total: string | number };
type DetailRow = RowDataPacket & PaymentReference & {
  amount: string | number;
  gatewayFeeAmount: string | number | null;
  gatewayNetAmount: string | number | null;
  memberCode: string | null;
  memberName: string | null;
  applicationCode: string | null;
  applicationName: string | null;
  submittedByName: string | null;
  validatedByName: string | null;
};
type AttemptRow = RowDataPacket & Omit<PaymentCheckoutAttemptSummary, "attemptNumber" | "amount" | "active"> & {
  attemptNumber: string | number;
  amount: string | number;
  active: string | number;
};
type EventRow = RowDataPacket & Omit<PaymentGatewayEventSummary, "livemode" | "retryCount" | "signatureVerified" | "eligibleForRetry" | "amount"> & {
  livemode: string | number;
  retryCount: string | number;
  signatureVerified: string | number;
  amount: string | number | null;
};
type ReceiptRow = RowDataPacket & NonNullable<PaymentReceiptSummary> & {
  attemptCount: string | number;
};
type HistoryRow = RowDataPacket & PaymentValidationHistoryEntry;
type PostingRow = RowDataPacket & {
  financialRecordId: string | null;
  financialRecordNumber: string | null;
  financialRecordStatus: PaymentReferenceDetail["posting"]["financialRecordStatus"];
  shareCapitalPaymentId: string | null;
  shareCapitalStatus: PaymentReferenceDetail["posting"]["shareCapitalStatus"];
  membershipRequirementId: string | null;
  membershipRequirementStatus: PaymentReferenceDetail["posting"]["membershipRequirementStatus"];
  membershipApplicationStatus: string | null;
  approvedMembershipCount: string | number | null;
};

const sortColumns: Record<PaymentReferenceListQuery["sortBy"], string> = {
  submittedAt: "p.submitted_at",
  amount: "p.amount",
  referenceNumber: "p.reference_number",
  paidAt: "p.paid_at",
};

function money(value: string | number | null) {
  return value === null ? null : Number(value);
}

function paymentColumns() {
  return `CAST(p.payment_reference_id AS CHAR) AS id,
          CAST(p.member_id AS CHAR) AS memberId,
          CAST(p.submitted_by AS CHAR) AS submittedBy,
          p.payer_name AS payerName,
          p.payer_email AS payerEmail,
          p.payer_contact AS payerContact,
          p.provider,
          p.reference_number AS referenceNumber,
          p.payment_purpose AS paymentPurpose,
          p.related_entity_type AS relatedEntityType,
          CAST(p.related_entity_id AS CHAR) AS relatedEntityId,
          p.amount,
          p.proof_file_path AS proofFilePath,
          p.validation_status AS validationStatus,
          p.payment_channel AS paymentChannel,
          p.gateway_environment AS gatewayEnvironment,
          p.gateway_checkout_id AS gatewayCheckoutId,
          p.gateway_payment_id AS gatewayPaymentId,
          p.gateway_payment_intent_id AS gatewayPaymentIntentId,
          p.gateway_status AS gatewayStatus,
          p.gateway_payment_method AS gatewayPaymentMethod,
          p.gateway_fee_amount AS gatewayFeeAmount,
          p.gateway_net_amount AS gatewayNetAmount,
          p.paid_at AS paidAt,
          p.webhook_received_at AS webhookReceivedAt,
          p.validation_source AS validationSource,
          CAST(p.validated_by AS CHAR) AS validatedBy,
          p.validated_at AS validatedAt,
          p.rejection_reason AS rejectionReason,
          p.notes,
          p.submitted_at AS submittedAt,
          p.updated_at AS updatedAt`;
}

function identityJoins() {
  return `LEFT JOIN member_profiles m ON m.member_id = p.member_id
          LEFT JOIN membership_applications a
            ON p.related_entity_type = 'membership_application'
           AND a.membership_application_id = p.related_entity_id`;
}

function mapPayment<T extends ListRow | DetailRow>(row: T) {
  return {
    ...row,
    amount: Number(row.amount),
    gatewayFeeAmount: money(row.gatewayFeeAmount),
    gatewayNetAmount: money(row.gatewayNetAmount),
  };
}

function listWhere(query: PaymentReferenceListQuery) {
  const where: string[] = [];
  const values: Array<string | number> = [];
  if (query.search) {
    where.push(`(p.reference_number LIKE ? OR p.payer_name LIKE ? OR p.payer_email LIKE ?
      OR p.payer_contact LIKE ? OR m.member_code LIKE ? OR m.full_name LIKE ?
      OR a.application_code LIKE ? OR TRIM(CONCAT_WS(' ', a.first_name,
          NULLIF(a.middle_name, ''), a.last_name, NULLIF(a.suffix, ''))) LIKE ?)`);
    const term = `%${query.search}%`;
    values.push(term, term, term, term, term, term, term, term);
  }
  if (query.validationStatus) { where.push("p.validation_status = ?"); values.push(query.validationStatus); }
  if (query.paymentPurpose) { where.push("p.payment_purpose = ?"); values.push(query.paymentPurpose); }
  if (query.paymentChannel) { where.push("p.payment_channel = ?"); values.push(query.paymentChannel); }
  if (query.validationSource) { where.push("p.validation_source = ?"); values.push(query.validationSource); }
  if (query.gatewayOnly) where.push("p.payment_channel = 'PayMongo'");
  if (query.manualOnly) where.push("p.payment_channel IN ('Manual GCash','Cash','Bank Transfer','Other')");
  if (query.failedEvents) {
    where.push(`EXISTS (SELECT 1 FROM payment_gateway_events failed_event
      WHERE failed_event.payment_reference_id = p.payment_reference_id
        AND failed_event.processing_status = 'Failed')`);
  }
  if (query.dateFrom) { where.push("DATE(p.submitted_at) >= ?"); values.push(query.dateFrom); }
  if (query.dateTo) { where.push("DATE(p.submitted_at) <= ?"); values.push(query.dateTo); }
  if (query.amountMin !== undefined) { where.push("p.amount >= ?"); values.push(query.amountMin); }
  if (query.amountMax !== undefined) { where.push("p.amount <= ?"); values.push(query.amountMax); }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", values };
}

export interface PaymentValidationRepository {
  list(query: PaymentReferenceListQuery): Promise<PaymentValidationListResult>;
  detail(paymentReferenceId: string): Promise<PaymentReferenceDetail | null>;
}

export function createPaymentValidationRepository(pool?: Pool): PaymentValidationRepository {
  const databasePool = () => pool ?? getPool();
  return {
    async list(query) {
      const { sql, values } = listWhere(query);
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(DISTINCT p.payment_reference_id) AS total
           FROM payment_references p
           ${identityJoins()}
           ${sql}`,
        values,
      );
      const total = Number(countRows[0]?.total ?? 0);
      const lastPage = Math.max(1, Math.ceil(total / query.pageSize));
      const page = Math.min(query.page, lastPage);
      const offset = (page - 1) * query.pageSize;
      const direction = query.sortDirection === "asc" ? "ASC" : "DESC";
      const [rows] = await databasePool().execute<ListRow[]>(
        `SELECT ${paymentColumns()},
                m.member_code AS memberCode,
                m.full_name AS memberName,
                a.application_code AS applicationCode,
                TRIM(CONCAT_WS(' ', a.first_name, NULLIF(a.middle_name, ''),
                               a.last_name, NULLIF(a.suffix, ''))) AS applicationName,
                (SELECT COUNT(*) FROM payment_gateway_events failed_event
                  WHERE failed_event.payment_reference_id = p.payment_reference_id
                    AND failed_event.processing_status = 'Failed') AS failedGatewayEvents
           FROM payment_references p
           ${identityJoins()}
           ${sql}
          ORDER BY ${sortColumns[query.sortBy]} ${direction}, p.payment_reference_id DESC
          LIMIT ${query.pageSize} OFFSET ${offset}`,
        values,
      );
      return {
        items: rows.map((row) => ({
          ...mapPayment(row),
          failedGatewayEvents: Number(row.failedGatewayEvents),
        })),
        total,
        page,
        pageSize: query.pageSize,
      };
    },

    async detail(paymentReferenceId) {
      const [rows] = await databasePool().execute<DetailRow[]>(
        `SELECT ${paymentColumns()},
                m.member_code AS memberCode,
                m.full_name AS memberName,
                a.application_code AS applicationCode,
                TRIM(CONCAT_WS(' ', a.first_name, NULLIF(a.middle_name, ''),
                               a.last_name, NULLIF(a.suffix, ''))) AS applicationName,
                submitted_user.display_name AS submittedByName,
                validated_user.display_name AS validatedByName
           FROM payment_references p
           ${identityJoins()}
           LEFT JOIN users submitted_user ON submitted_user.user_id = p.submitted_by
           LEFT JOIN users validated_user ON validated_user.user_id = p.validated_by
          WHERE p.payment_reference_id = ? LIMIT 1`,
        [paymentReferenceId],
      );
      const row = rows[0];
      if (!row) return null;

      const [attemptRows] = await databasePool().execute<AttemptRow[]>(
        `SELECT CAST(payment_gateway_checkout_attempt_id AS CHAR) AS id,
                attempt_number AS attemptNumber,
                gateway_checkout_id AS checkoutId,
                gateway_status AS gatewayStatus,
                gateway_environment AS gatewayEnvironment,
                amount, currency, last_checked_at AS lastCheckedAt,
                reusable_until AS reusableUntil, superseded_at AS supersededAt,
                completed_at AS completedAt,
                (superseded_at IS NULL AND completed_at IS NULL
                  AND reusable_until > UTC_TIMESTAMP()) AS active
           FROM payment_gateway_checkout_attempts
          WHERE payment_reference_id = ? AND gateway_name = 'PayMongo'
          ORDER BY attempt_number DESC`,
        [paymentReferenceId],
      );
      const checkoutAttempts = attemptRows.map((attempt) => ({
        ...attempt,
        attemptNumber: Number(attempt.attemptNumber),
        amount: Number(attempt.amount),
        active: Boolean(attempt.active),
      }));

      const [eventRows] = await databasePool().execute<EventRow[]>(
        `SELECT CAST(payment_gateway_event_id AS CHAR) AS id,
                event_type AS eventType,
                gateway_checkout_id AS checkoutId,
                gateway_payment_id AS paymentId,
                gateway_payment_intent_id AS paymentIntentId,
                livemode,
                processing_status AS processingStatus,
                retry_count AS retryCount,
                (signature_verified_at IS NOT NULL) AS signatureVerified,
                error_code AS errorCode,
                safe_error_message AS errorMessage,
                gateway_amount AS amount,
                gateway_currency AS currency,
                gateway_payment_status AS paymentStatus,
                gateway_payment_method AS paymentMethod,
                gateway_paid_at AS paidAt,
                received_at AS receivedAt,
                processed_at AS processedAt
           FROM payment_gateway_events
          WHERE payment_reference_id = ?
          ORDER BY received_at DESC, payment_gateway_event_id DESC`,
        [paymentReferenceId],
      );
      const gatewayEvents: PaymentGatewayEventSummary[] = eventRows.map((event) => ({
        ...event,
        livemode: Boolean(event.livemode),
        retryCount: Number(event.retryCount),
        signatureVerified: Boolean(event.signatureVerified),
        eligibleForRetry: event.processingStatus === "Failed"
          && Boolean(event.signatureVerified)
          && event.eventType === "checkout_session.payment.paid"
          && row.paymentChannel === "PayMongo",
        amount: money(event.amount),
      }));

      const [historyRows] = await databasePool().execute<HistoryRow[]>(
        `SELECT CAST(h.payment_validation_history_id AS CHAR) AS id,
                h.old_status AS oldStatus, h.new_status AS newStatus,
                h.validation_source AS validationSource, h.reason,
                CAST(h.changed_by AS CHAR) AS changedBy,
                u.display_name AS changedByName,
                CAST(h.gateway_event_id AS CHAR) AS gatewayEventId,
                h.changed_at AS changedAt
           FROM payment_validation_history h
           LEFT JOIN users u ON u.user_id = h.changed_by
          WHERE h.payment_reference_id = ?
          ORDER BY h.changed_at DESC, h.payment_validation_history_id DESC`,
        [paymentReferenceId],
      );

      const [postingRows] = await databasePool().execute<PostingRow[]>(
        `SELECT CAST(MAX(fr.financial_record_id) AS CHAR) AS financialRecordId,
                MAX(fr.record_number) AS financialRecordNumber,
                MAX(fr.record_status) AS financialRecordStatus,
                CAST(MAX(sp.share_payment_id) AS CHAR) AS shareCapitalPaymentId,
                MAX(sp.payment_status) AS shareCapitalStatus,
                CAST(MAX(req.membership_application_requirement_id) AS CHAR) AS membershipRequirementId,
                MAX(req.requirement_status) AS membershipRequirementStatus,
                MAX(app.application_status) AS membershipApplicationStatus,
                SUM(app.application_status = 'Approved') AS approvedMembershipCount
           FROM payment_references p
           LEFT JOIN financial_records fr ON fr.payment_reference_id = p.payment_reference_id
           LEFT JOIN share_capital_payments sp ON sp.payment_reference_id = p.payment_reference_id
           LEFT JOIN membership_application_requirements req ON req.payment_reference_id = p.payment_reference_id
           LEFT JOIN membership_applications app ON app.membership_application_id = req.membership_application_id
          WHERE p.payment_reference_id = ?`,
        [paymentReferenceId],
      );

      const [receiptRows] = await databasePool().execute<ReceiptRow[]>(
        `SELECT receipt_number AS receiptNumber,
                processing_status AS processingStatus,
                CAST(document_id AS CHAR) AS documentId,
                attempt_count AS attemptCount,
                last_error_code AS lastErrorCode,
                last_error_message AS lastErrorMessage,
                generated_at AS generatedAt,
                reversed_at AS reversedAt,
                reversal_note AS reversalNote
           FROM payment_receipts WHERE payment_reference_id = ? LIMIT 1`,
        [paymentReferenceId],
      );
      const receiptRow = receiptRows[0];
      const receipt: PaymentReceiptSummary = receiptRow ? {
        ...receiptRow,
        attemptCount: Number(receiptRow.attemptCount),
      } : null;

      const postingRow = postingRows[0];
      const warnings: string[] = [];
      if (Number(postingRow?.approvedMembershipCount ?? 0) > 0 && row.validationStatus === "Validated") {
        warnings.push("This payment belongs to an approved membership application. Reversal will not automatically revoke membership.");
      }
      if (gatewayEvents.some((event) => event.processingStatus === "Failed")) {
        warnings.push("A verified PayMongo event failed settlement and may be retried by the Bookkeeper.");
      }
      if (receipt?.processingStatus === "Failed") {
        warnings.push("Payment settlement is complete, but receipt generation failed and must be retried separately.");
      }

      return {
        ...mapPayment(row),
        checkoutAttempts,
        activeAttemptId: checkoutAttempts.find((attempt) => attempt.active)?.id ?? null,
        gatewayEvents,
        validationHistory: historyRows,
        receipt,
        posting: {
          financialRecordId: postingRow?.financialRecordId ?? null,
          financialRecordNumber: postingRow?.financialRecordNumber ?? null,
          financialRecordStatus: postingRow?.financialRecordStatus ?? null,
          shareCapitalPaymentId: postingRow?.shareCapitalPaymentId ?? null,
          shareCapitalStatus: postingRow?.shareCapitalStatus ?? null,
          membershipRequirementId: postingRow?.membershipRequirementId ?? null,
          membershipRequirementStatus: postingRow?.membershipRequirementStatus ?? null,
          membershipApplicationStatus: postingRow?.membershipApplicationStatus ?? null,
          warnings,
        },
      };
    },
  };
}

export async function requirePaymentValidationDetail(
  repository: PaymentValidationRepository,
  paymentReferenceId: string,
) {
  const detail = await repository.detail(paymentReferenceId);
  if (!detail) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
  return detail;
}
