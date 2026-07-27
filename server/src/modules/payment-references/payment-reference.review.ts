import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { ValidationStatus } from "./payment-reference.types";

type StatusRow = RowDataPacket & { validationStatus: ValidationStatus };
const allowed: Record<string, ValidationStatus[]> = {
  Pending: ["Needs Clarification", "Rejected"],
  "Needs Clarification": ["Pending", "Rejected"],
  Rejected: ["Pending"],
};

async function selectStatus(connection: PoolConnection, id: string) {
  const [rows] = await connection.execute<StatusRow[]>(
    `SELECT validation_status AS validationStatus FROM payment_references
      WHERE payment_reference_id = ? LIMIT 1 FOR UPDATE`, [id],
  );
  return rows[0] ?? null;
}

export interface PaymentReferenceReviewService {
  ensureInitialPendingHistory(paymentReferenceId: string, auth: AuthContext): Promise<void>;
  transition(input: {
    paymentReferenceId: string;
    newStatus: "Pending" | "Needs Clarification" | "Rejected";
    reason: string;
    auth: AuthContext;
  }): Promise<void>;
}

export function createPaymentReferenceReviewService(pool?: Pool): PaymentReferenceReviewService {
  const databasePool = () => pool ?? getPool();
  return {
    async ensureInitialPendingHistory(paymentReferenceId, auth) {
      await databasePool().execute(
        `INSERT INTO payment_validation_history
           (payment_reference_id, old_status, new_status, validation_source, reason, changed_by)
         SELECT ?, NULL, 'Pending', 'Manual Bookkeeper', ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM payment_validation_history WHERE payment_reference_id = ?
          )`,
        [paymentReferenceId, "Payment reference created in Pending status.", auth.user.id, paymentReferenceId],
      );
    },
    async transition(input) {
      const reason = input.reason.trim();
      if (!reason) throw new AppError("A review reason is required", 400, "PAYMENT_REVIEW_REASON_REQUIRED");
      await withTransaction(async (connection) => {
        const current = await selectStatus(connection, input.paymentReferenceId);
        if (!current) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        if (current.validationStatus === input.newStatus) {
          throw new AppError("Payment reference is already in that status", 400, "PAYMENT_REFERENCE_STATUS_UNCHANGED");
        }
        if (!(allowed[current.validationStatus] ?? []).includes(input.newStatus)) {
          throw new AppError("This payment status transition is not allowed", 409, "PAYMENT_REFERENCE_TRANSITION_INVALID");
        }
        await connection.execute(
          `UPDATE payment_references SET validation_status = ?,
                  rejection_reason = CASE WHEN ? IN ('Rejected','Needs Clarification') THEN ? ELSE NULL END,
                  validation_source = 'Manual Bookkeeper', updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?`,
          [input.newStatus, input.newStatus, reason, input.paymentReferenceId],
        );
        await connection.execute(
          `INSERT INTO payment_validation_history
             (payment_reference_id, old_status, new_status, validation_source, reason, changed_by)
           VALUES (?, ?, ?, 'Manual Bookkeeper', ?, ?)`,
          [input.paymentReferenceId, current.validationStatus, input.newStatus, reason, input.auth.user.id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'payment_reference.validation_changed', 'payment_references', ?, ?,
                   JSON_OBJECT('validationStatus', ?), JSON_OBJECT('validationStatus', ?))`,
          [input.auth.user.id, input.paymentReferenceId, reason, current.validationStatus, input.newStatus],
        );
      }, databasePool());
    },
  };
}
