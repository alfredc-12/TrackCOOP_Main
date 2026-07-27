import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { limitOffsetSql } from "../../db/pagination";
import { withTransaction } from "../../db/transaction";
import { createGeneratedPdfDocument } from "../../records/generated-pdf-document";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  PaymentGatewayEventSummary,
  PaymentPostingSummary,
  PaymentReference,
  PaymentReferenceDetail,
  PaymentReferenceInput,
  PaymentReferenceListQuery,
  PaymentReferenceListResult,
  PaymentReferenceSummary,
  PaymentValidationHistoryEntry,
  ReviewPaymentReferenceInput,
  ReversePaymentReferenceInput,
  UpdatePaymentReferenceInput,
  ValidationStatus,
} from "./payment-reference.types";

type PaymentRow = RowDataPacket & {
  id: string;
  memberId: string | null;
  submittedBy: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerContact: string | null;
  provider: string;
  referenceNumber: string;
  paymentPurpose: PaymentReference["paymentPurpose"];
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  amount: string | number;
  proofFilePath: string | null;
  validationStatus: ValidationStatus;
  paymentChannel: PaymentReference["paymentChannel"];
  gatewayEnvironment: PaymentReference["gatewayEnvironment"];
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
  gatewayStatus: string | null;
  gatewayPaymentMethod: string | null;
  gatewayFeeAmount: string | number | null;
  gatewayNetAmount: string | number | null;
  paidAt: Date | null;
  webhookReceivedAt: Date | null;
  validationSource: PaymentReference["validationSource"];
  validatedBy: string | null;
  validatedAt: Date | null;
  rejectionReason: string | null;
  notes: string | null;
  submittedAt: Date;
  updatedAt: Date;
};

type CountRow = RowDataPacket & { total: number };
type SummaryRow = RowDataPacket & {
  total: number;
  pendingManual: number;
  needsClarification: number;
  validatedToday: number;
  paymongoTestPayments: number;
  rejected: number;
  validatedAmount: string | number | null;
};
type DetailRow = PaymentRow & {
  memberCode: string | null;
  memberName: string | null;
  submittedByName: string | null;
  validatedByName: string | null;
};
type HistoryRow = RowDataPacket & PaymentValidationHistoryEntry;
type GatewayEventRow = RowDataPacket & {
  id: string;
  eventType: string;
  checkoutId: string | null;
  paymentId: string | null;
  paymentIntentId: string | null;
  livemode: number;
  payloadHash: string;
  processingStatus: PaymentGatewayEventSummary["processingStatus"];
  errorCode: string | null;
  errorMessage: string | null;
  receivedAt: Date;
  processedAt: Date | null;
};
type PostingRow = RowDataPacket & {
  financialRecordId: string | null;
  financialRecordNumber: string | null;
  financialRecordStatus: PaymentPostingSummary["financialRecordStatus"];
  shareCapitalPaymentId: string | null;
  shareCapitalStatus: PaymentPostingSummary["shareCapitalStatus"];
  membershipRequirementId: string | null;
  membershipRequirementStatus: PaymentPostingSummary["membershipRequirementStatus"];
  membershipApplicationStatus: string | null;
  approvedMembershipCount: number | string | null;
};

const sortColumns: Record<PaymentReferenceListQuery["sortBy"], string> = {
  submittedAt: "p.submitted_at",
  amount: "p.amount",
  referenceNumber: "p.reference_number",
  paidAt: "p.paid_at",
};

function paymentSelect() {
  return `SELECT CAST(p.payment_reference_id AS CHAR) AS id,
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
                 p.updated_at AS updatedAt
            FROM payment_references p`;
}

function mapPayment(row: PaymentRow): PaymentReference {
  return {
    ...row,
    amount: Number(row.amount),
    gatewayFeeAmount: row.gatewayFeeAmount === null ? null : Number(row.gatewayFeeAmount),
    gatewayNetAmount: row.gatewayNetAmount === null ? null : Number(row.gatewayNetAmount),
  };
}

function nullableId(value: string | null | undefined) {
  return value ?? null;
}

export interface PaymentReferenceRepository {
  list(query: PaymentReferenceListQuery): Promise<PaymentReferenceListResult>;
  summary(): Promise<PaymentReferenceSummary>;
  findById(paymentReferenceId: string): Promise<PaymentReference | null>;
  detail(paymentReferenceId: string): Promise<PaymentReferenceDetail | null>;
  create(input: PaymentReferenceInput, auth: AuthContext): Promise<PaymentReference>;
  update(
    paymentReferenceId: string,
    input: UpdatePaymentReferenceInput,
    auth: AuthContext,
  ): Promise<PaymentReference>;
  setValidationStatus(
    paymentReferenceId: string,
    validationStatus: ValidationStatus,
    input: ReviewPaymentReferenceInput,
    auth: AuthContext,
  ): Promise<PaymentReference>;
  reverse(
    paymentReferenceId: string,
    input: ReversePaymentReferenceInput,
    auth: AuthContext,
  ): Promise<PaymentReferenceDetail>;
}

export function createPaymentReferenceRepository(
  pool?: Pool,
): PaymentReferenceRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async list(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];

      if (query.search) {
        where.push(
          "(p.reference_number LIKE ? OR p.payer_name LIKE ? OR p.payer_email LIKE ? OR p.payer_contact LIKE ?)",
        );
        const search = `%${query.search}%`;
        values.push(search, search, search, search);
      }
      if (query.validationStatus) {
        where.push("p.validation_status = ?");
        values.push(query.validationStatus);
      }
      if (query.paymentPurpose) {
        where.push("p.payment_purpose = ?");
        values.push(query.paymentPurpose);
      }
      if (query.paymentChannel) {
        where.push("p.payment_channel = ?");
        values.push(query.paymentChannel);
      }
      if (query.validationSource) {
        where.push("p.validation_source = ?");
        values.push(query.validationSource);
      }
      if (query.gatewayOnly) {
        where.push("p.payment_channel = 'PayMongo'");
      }
      if (query.manualOnly) {
        where.push("p.payment_channel IN ('Manual GCash', 'Cash', 'Bank Transfer', 'Other')");
      }
      if (query.dateFrom) {
        where.push("DATE(p.submitted_at) >= ?");
        values.push(query.dateFrom);
      }
      if (query.dateTo) {
        where.push("DATE(p.submitted_at) <= ?");
        values.push(query.dateTo);
      }
      if (typeof query.amountMin === "number") {
        where.push("p.amount >= ?");
        values.push(query.amountMin);
      }
      if (typeof query.amountMax === "number") {
        where.push("p.amount <= ?");
        values.push(query.amountMax);
      }

      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;

      const [rows] = await databasePool().execute<PaymentRow[]>(
        `${paymentSelect()}
         ${whereSql}
         ORDER BY ${sortColumns[query.sortBy]} ${orderDirection}, p.payment_reference_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM payment_references p${whereSql}`,
        values,
      );

      return {
        paymentReferences: rows.map(mapPayment),
        total: Number(countRows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async summary() {
      const [rows] = await databasePool().execute<SummaryRow[]>(
        `SELECT COUNT(*) AS total,
                SUM(validation_status = 'Pending' AND payment_channel <> 'PayMongo') AS pendingManual,
                SUM(validation_status = 'Needs Clarification') AS needsClarification,
                SUM(validation_status = 'Validated' AND DATE(validated_at) = UTC_DATE()) AS validatedToday,
                SUM(payment_channel = 'PayMongo' AND gateway_environment = 'Test') AS paymongoTestPayments,
                SUM(validation_status = 'Rejected') AS rejected,
                COALESCE(SUM(CASE WHEN validation_status = 'Validated' THEN amount ELSE 0 END), 0) AS validatedAmount
           FROM payment_references`,
      );
      const row = rows[0];
      return {
        total: Number(row?.total ?? 0),
        pendingManual: Number(row?.pendingManual ?? 0),
        needsClarification: Number(row?.needsClarification ?? 0),
        validatedToday: Number(row?.validatedToday ?? 0),
        paymongoTestPayments: Number(row?.paymongoTestPayments ?? 0),
        rejected: Number(row?.rejected ?? 0),
        validatedAmount: Number(row?.validatedAmount ?? 0),
      };
    },

    async findById(paymentReferenceId) {
      const [rows] = await databasePool().execute<PaymentRow[]>(
        `${paymentSelect()} WHERE p.payment_reference_id = ? LIMIT 1`,
        [paymentReferenceId],
      );

      return rows[0] ? mapPayment(rows[0]) : null;
    },

    async detail(paymentReferenceId) {
      const [rows] = await databasePool().execute<DetailRow[]>(
        `${paymentSelect().replace(
          "p.updated_at AS updatedAt",
          `p.updated_at AS updatedAt,
                 m.member_code AS memberCode,
                 m.full_name AS memberName,
                 submitted_user.display_name AS submittedByName,
                 validated_user.display_name AS validatedByName`,
        )}
          LEFT JOIN member_profiles m ON m.member_id = p.member_id
          LEFT JOIN users submitted_user ON submitted_user.user_id = p.submitted_by
          LEFT JOIN users validated_user ON validated_user.user_id = p.validated_by
         WHERE p.payment_reference_id = ?
         LIMIT 1`,
        [paymentReferenceId],
      );
      const row = rows[0];
      if (!row) return null;

      const [historyRows] = await databasePool().execute<HistoryRow[]>(
        `SELECT CAST(h.payment_validation_history_id AS CHAR) AS id,
                h.old_status AS oldStatus,
                h.new_status AS newStatus,
                h.validation_source AS validationSource,
                h.reason,
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
      const [eventRows] = await databasePool().execute<GatewayEventRow[]>(
        `SELECT CAST(payment_gateway_event_id AS CHAR) AS id,
                event_type AS eventType,
                gateway_checkout_id AS checkoutId,
                gateway_payment_id AS paymentId,
                gateway_payment_intent_id AS paymentIntentId,
                livemode,
                payload_sha256 AS payloadHash,
                processing_status AS processingStatus,
                error_code AS errorCode,
                error_message AS errorMessage,
                received_at AS receivedAt,
                processed_at AS processedAt
           FROM payment_gateway_events
          WHERE payment_reference_id = ?
          ORDER BY received_at DESC, payment_gateway_event_id DESC`,
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
      const postingRow = postingRows[0];
      const warnings: string[] = [];
      if (Number(postingRow?.approvedMembershipCount ?? 0) > 0 && row.validationStatus === "Validated") {
        warnings.push("This payment is attached to an approved membership application. Reversal will not automatically revoke the member.");
      }
      if (eventRows.some((event) => event.processingStatus === "Failed")) {
        warnings.push("A PayMongo gateway event failed during processing. Review the safe error before retrying externally.");
      }

      return {
        ...mapPayment(row),
        memberCode: row.memberCode,
        memberName: row.memberName,
        submittedByName: row.submittedByName,
        validatedByName: row.validatedByName,
        validationHistory: historyRows,
        gatewayEvents: eventRows.map((event) => ({
          ...event,
          livemode: Boolean(event.livemode),
        })),
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

    async create(input, auth) {
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO payment_references
             (member_id, submitted_by, payer_name, payer_email, payer_contact, provider, reference_number,
              payment_purpose, related_entity_type, related_entity_id, amount, proof_file_path, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nullableId(input.memberId),
            nullableId(input.submittedBy) ?? auth.user.id,
            input.payerName ?? null,
            input.payerEmail ?? null,
            input.payerContact ?? null,
            input.provider ?? "Reference-Based Payment",
            input.referenceNumber,
            input.paymentPurpose,
            input.relatedEntityType ?? null,
            nullableId(input.relatedEntityId),
            input.amount,
            input.proofFilePath ?? null,
            input.notes ?? null,
          ],
        );
        const paymentReferenceId = String(result.insertId);

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'payment_reference.created', 'payment_references', ?, 'A payment reference was created.', ?)`,
          [auth.user.id, paymentReferenceId, JSON.stringify(input)],
        );

        const [rows] = await connection.execute<PaymentRow[]>(
          `${paymentSelect()} WHERE p.payment_reference_id = ? LIMIT 1`,
          [paymentReferenceId],
        );
        return mapPayment(rows[0]);
      }, databasePool());
    },

    async update(paymentReferenceId, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findById(paymentReferenceId);
        if (!existing) {
          throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        }
        if (existing.validationStatus === "Validated") {
          throw new AppError(
            "Validated payment references cannot be edited",
            409,
            "PAYMENT_REFERENCE_LOCKED",
          );
        }

        await connection.execute(
          `UPDATE payment_references
              SET member_id = ?,
                  payer_name = ?,
                  payer_email = ?,
                  payer_contact = ?,
                  provider = COALESCE(?, provider),
                  reference_number = COALESCE(?, reference_number),
                  payment_purpose = COALESCE(?, payment_purpose),
                  related_entity_type = ?,
                  related_entity_id = ?,
                  amount = COALESCE(?, amount),
                  proof_file_path = ?,
                  notes = ?
            WHERE payment_reference_id = ?`,
          [
            Object.prototype.hasOwnProperty.call(input, "memberId")
              ? nullableId(input.memberId)
              : existing.memberId,
            Object.prototype.hasOwnProperty.call(input, "payerName")
              ? input.payerName ?? null
              : existing.payerName,
            Object.prototype.hasOwnProperty.call(input, "payerEmail")
              ? input.payerEmail ?? null
              : existing.payerEmail,
            Object.prototype.hasOwnProperty.call(input, "payerContact")
              ? input.payerContact ?? null
              : existing.payerContact,
            input.provider ?? null,
            input.referenceNumber ?? null,
            input.paymentPurpose ?? null,
            Object.prototype.hasOwnProperty.call(input, "relatedEntityType")
              ? input.relatedEntityType ?? null
              : existing.relatedEntityType,
            Object.prototype.hasOwnProperty.call(input, "relatedEntityId")
              ? nullableId(input.relatedEntityId)
              : existing.relatedEntityId,
            input.amount ?? null,
            Object.prototype.hasOwnProperty.call(input, "proofFilePath")
              ? input.proofFilePath ?? null
              : existing.proofFilePath,
            Object.prototype.hasOwnProperty.call(input, "notes")
              ? input.notes ?? null
              : existing.notes,
            paymentReferenceId,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'payment_reference.updated', 'payment_references', ?, 'A payment reference was updated.', ?)`,
          [auth.user.id, paymentReferenceId, JSON.stringify(input)],
        );

        const updated = await this.findById(paymentReferenceId);
        if (!updated) {
          throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        }
        return updated;
      }, databasePool());
    },

    async setValidationStatus(paymentReferenceId, validationStatus, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findById(paymentReferenceId);
        if (!existing) {
          throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        }

        await connection.execute(
          `UPDATE payment_references
              SET validation_status = ?,
                  validated_by = CASE WHEN ? = 'Validated' THEN ? ELSE validated_by END,
                  validated_at = CASE WHEN ? = 'Validated' THEN UTC_TIMESTAMP() ELSE validated_at END,
                  rejection_reason = CASE WHEN ? IN ('Rejected', 'Needs Clarification') THEN ? ELSE NULL END
            WHERE payment_reference_id = ?`,
          [
            validationStatus,
            validationStatus,
            auth.user.id,
            validationStatus,
            validationStatus,
            input.reason ?? null,
            paymentReferenceId,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'payment_reference.validation_changed', 'payment_references', ?, ?, JSON_OBJECT('validationStatus', ?), JSON_OBJECT('validationStatus', ?))`,
          [
            auth.user.id,
            paymentReferenceId,
            input.reason ?? "Payment reference validation status changed.",
            existing.validationStatus,
            validationStatus,
          ],
        );
        if (validationStatus === "Validated") {
          const [receiptDocuments] = await connection.execute<CountRow[]>(
            `SELECT COUNT(*) AS total
               FROM documents
              WHERE related_module = 'PAYMENT'
                AND related_record_id = ?
                AND relationship_type = 'SYSTEM_RECEIPT'`,
            [paymentReferenceId],
          );
          if (Number(receiptDocuments[0]?.total ?? 0) === 0) {
            const receiptReference = `RCP-${new Date().getUTCFullYear()}-${paymentReferenceId.padStart(6, "0")}`;
            const generatedReceipt = await createGeneratedPdfDocument(connection, {
              uploadedBy: auth.user.id,
              uploaderRole: auth.user.role,
              memberId: existing.memberId,
              title: `Payment Receipt ${receiptReference}`,
              description:
                "System-generated receipt for a validated payment reference.",
              category: "RECEIPT",
              documentType: "Receipt",
              accessLevel: existing.memberId
                ? "Member-only"
                : "Bookkeeper-only",
              relatedModule: "PAYMENT",
              relatedRecordId: paymentReferenceId,
              relatedRecordReference: `PAY-${paymentReferenceId.padStart(6, "0")}`,
              relationshipType: "SYSTEM_RECEIPT",
              fileBaseName: receiptReference,
              heading: "Validated Payment Receipt",
              lines: [
                { label: "Receipt number", value: receiptReference },
                { label: "Payer", value: existing.payerName },
                {
                  label: "Payment purpose",
                  value: existing.paymentPurpose,
                },
                { label: "Amount paid", value: `PHP ${existing.amount}` },
                { label: "Payment provider", value: existing.provider },
                {
                  label: "Payment reference",
                  value: existing.referenceNumber,
                },
                { label: "Validation status", value: "Validated" },
              ],
            });
            if (existing.memberId) {
              await connection.execute(
                `INSERT INTO notifications
                   (user_id, notification_type, title, message, related_entity_type, related_entity_id)
                 SELECT mp.user_id, 'Document', 'Payment receipt available',
                        'Your validated payment receipt is available in Documents.',
                        'Document', ?
                   FROM member_profiles mp
                  WHERE mp.member_id = ? AND mp.user_id IS NOT NULL`,
                [generatedReceipt.documentId, existing.memberId],
              );
            }
          }
        }

        const updated = await this.findById(paymentReferenceId);
        if (!updated) {
          throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        }
        return updated;
      }, databasePool());
    },

    async reverse(paymentReferenceId, input, auth) {
      await withTransaction(async (connection) => {
        const [rows] = await connection.execute<PaymentRow[]>(
          `${paymentSelect()} WHERE p.payment_reference_id = ? LIMIT 1 FOR UPDATE`,
          [paymentReferenceId],
        );
        const existing = rows[0] ? mapPayment(rows[0]) : null;
        if (!existing) {
          throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        }
        if (existing.validationStatus !== "Validated") {
          throw new AppError("Only validated payment references can be reversed", 409, "PAYMENT_REFERENCE_NOT_VALIDATED");
        }
        if (input.confirmation !== existing.referenceNumber) {
          throw new AppError("Type the payment reference number to confirm reversal", 400, "PAYMENT_REVERSAL_CONFIRMATION_REQUIRED");
        }

        await connection.execute(
          `INSERT IGNORE INTO financial_records
             (record_number, payment_reference_id, member_id, financial_category_id, recorded_by,
              approved_by, record_type, source_module, source_record_id, amount, record_date,
              record_status, reversal_of_record_id, remarks)
           SELECT CONCAT('REV-', financial_record_id),
                  payment_reference_id,
                  member_id,
                  financial_category_id,
                  ?,
                  ?,
                  'Adjustment',
                  source_module,
                  source_record_id,
                  -amount,
                  UTC_DATE(),
                  'Active',
                  financial_record_id,
                  ?
             FROM financial_records
            WHERE payment_reference_id = ?
              AND record_status = 'Active'`,
          [
            auth.user.id,
            auth.user.id,
            `Payment reversal: ${input.reason}`,
            paymentReferenceId,
          ],
        );

        await connection.execute(
          `UPDATE financial_records
              SET record_status = 'Reversed',
                  remarks = CONCAT(COALESCE(remarks, ''), ?),
                  updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?
              AND record_status = 'Active'
              AND reversal_of_record_id IS NULL`,
          [`\nReversed payment reference: ${input.reason}`, paymentReferenceId],
        );

        await connection.execute(
          `UPDATE share_capital_payments
              SET payment_status = 'Reversed',
                  remarks = CONCAT(COALESCE(remarks, ''), ?),
                  updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?
              AND payment_status = 'Validated'`,
          [`\nReversed payment reference: ${input.reason}`, paymentReferenceId],
        );

        await connection.execute(
          `UPDATE membership_application_requirements
              SET requirement_status = CASE
                    WHEN requirement_status = 'Verified' THEN 'Pending'
                    ELSE requirement_status
                  END,
                  verified_by = CASE WHEN requirement_status = 'Verified' THEN NULL ELSE verified_by END,
                  verified_at = CASE WHEN requirement_status = 'Verified' THEN NULL ELSE verified_at END,
                  remarks = CONCAT(COALESCE(remarks, ''), ?),
                  updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?`,
          [`\nPayment reversed: ${input.reason}`, paymentReferenceId],
        );

        await connection.execute(
          `UPDATE payment_references
              SET validation_status = 'Reversed',
                  rejection_reason = ?,
                  validation_source = 'Manual Bookkeeper',
                  updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?`,
          [input.reason, paymentReferenceId],
        );

        await connection.execute(
          `INSERT INTO payment_validation_history
             (payment_reference_id, old_status, new_status, validation_source, reason, changed_by)
           VALUES (?, 'Validated', 'Reversed', 'Manual Bookkeeper', ?, ?)`,
          [paymentReferenceId, input.reason, auth.user.id],
        );

        await connection.execute(
          `INSERT INTO membership_application_status_history
             (membership_application_id, old_status, new_status, internal_note, applicant_message, changed_by)
           SELECT a.membership_application_id,
                  a.application_status,
                  a.application_status,
                  ?,
                  ?,
                  ?
             FROM membership_application_requirements r
             JOIN membership_applications a ON a.membership_application_id = r.membership_application_id
            WHERE r.payment_reference_id = ?`,
          [
            `Payment reference ${existing.referenceNumber} was reversed. ${input.reason}`,
            "A previously confirmed payment was reversed. Please contact the cooperative office for next steps.",
            auth.user.id,
            paymentReferenceId,
          ],
        );

        await connection.execute(
          `INSERT INTO notifications
             (user_id, notification_type, title, message, related_entity_type, related_entity_id)
           SELECT u.user_id,
                  'Payment',
                  'Payment reference reversed',
                  ?,
                  'payment_reference',
                  ?
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
            WHERE r.role_slug IN ('chairman', 'bookkeeper')
              AND u.account_status = 'Active'`,
          [
            `${existing.referenceNumber} was reversed by ${auth.user.displayName}.`,
            paymentReferenceId,
          ],
        );

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'payment_reference.reversed', 'payment_references', ?, ?, JSON_OBJECT('validationStatus', 'Validated'), JSON_OBJECT('validationStatus', 'Reversed'))`,
          [auth.user.id, paymentReferenceId, input.reason],
        );
      }, databasePool());

      const reversed = await this.detail(paymentReferenceId);
      if (!reversed) {
        throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
      }
      return reversed;
    },
  };
}
