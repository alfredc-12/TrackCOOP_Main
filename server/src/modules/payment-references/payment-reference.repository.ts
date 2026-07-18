import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  PaymentReference,
  PaymentReferenceInput,
  PaymentReferenceListQuery,
  PaymentReferenceListResult,
  ReviewPaymentReferenceInput,
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
  validatedBy: string | null;
  validatedAt: Date | null;
  rejectionReason: string | null;
  notes: string | null;
  submittedAt: Date;
  updatedAt: Date;
};

type CountRow = RowDataPacket & { total: number };

const sortColumns: Record<PaymentReferenceListQuery["sortBy"], string> = {
  submittedAt: "p.submitted_at",
  amount: "p.amount",
  referenceNumber: "p.reference_number",
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
  };
}

function nullableId(value: string | null | undefined) {
  return value ?? null;
}

export interface PaymentReferenceRepository {
  list(query: PaymentReferenceListQuery): Promise<PaymentReferenceListResult>;
  findById(paymentReferenceId: string): Promise<PaymentReference | null>;
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
          "(p.reference_number LIKE ? OR p.payer_name LIKE ? OR p.payer_email LIKE ?)",
        );
        const search = `%${query.search}%`;
        values.push(search, search, search);
      }
      if (query.validationStatus) {
        where.push("p.validation_status = ?");
        values.push(query.validationStatus);
      }
      if (query.paymentPurpose) {
        where.push("p.payment_purpose = ?");
        values.push(query.paymentPurpose);
      }

      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;

      const [rows] = await databasePool().execute<PaymentRow[]>(
        `${paymentSelect()}
         ${whereSql}
         ORDER BY ${sortColumns[query.sortBy]} ${orderDirection}, p.payment_reference_id DESC
         LIMIT ? OFFSET ?`,
        [...values, query.pageSize, offset],
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

    async findById(paymentReferenceId) {
      const [rows] = await databasePool().execute<PaymentRow[]>(
        `${paymentSelect()} WHERE p.payment_reference_id = ? LIMIT 1`,
        [paymentReferenceId],
      );

      return rows[0] ? mapPayment(rows[0]) : null;
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
           VALUES (?, 'payment_reference.created', 'payment_references', ?, 'A payment reference was created.', CAST(? AS JSON))`,
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
           VALUES (?, 'payment_reference.updated', 'payment_references', ?, 'A payment reference was updated.', CAST(? AS JSON))`,
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

        const updated = await this.findById(paymentReferenceId);
        if (!updated) {
          throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        }
        return updated;
      }, databasePool());
    },
  };
}
