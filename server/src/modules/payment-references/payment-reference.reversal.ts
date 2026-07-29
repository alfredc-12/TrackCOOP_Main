import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";

type PaymentRow = RowDataPacket & {
  id: string;
  referenceNumber: string;
  validationStatus: string;
  memberId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  paymentPurpose: string;
};
type MemberRow = RowDataPacket & {
  membershipType: string;
  officialStatus: string;
};

async function lockPayment(connection: PoolConnection, id: string) {
  const [rows] = await connection.execute<PaymentRow[]>(
    `SELECT CAST(payment_reference_id AS CHAR) AS id,
            reference_number AS referenceNumber, validation_status AS validationStatus,
            CAST(member_id AS CHAR) AS memberId, related_entity_type AS relatedEntityType,
            CAST(related_entity_id AS CHAR) AS relatedEntityId, payment_purpose AS paymentPurpose
       FROM payment_references WHERE payment_reference_id = ? LIMIT 1 FOR UPDATE`, [id],
  );
  return rows[0] ?? null;
}

export interface PaymentReferenceReversalService {
  reverse(input: {
    paymentReferenceId: string;
    confirmation: string;
    reason: string;
    auth: AuthContext;
  }): Promise<void>;
}

export function createPaymentReferenceReversalService(pool?: Pool): PaymentReferenceReversalService {
  const databasePool = () => pool ?? getPool();
  return {
    async reverse(input) {
      const reason = input.reason.trim();
      if (!reason) throw new AppError("A reversal reason is required", 400, "PAYMENT_REVERSAL_REASON_REQUIRED");
      await withTransaction(async (connection) => {
        const payment = await lockPayment(connection, input.paymentReferenceId);
        if (!payment) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        if (payment.validationStatus !== "Validated") {
          throw new AppError("Only validated payment references can be reversed", 409, "PAYMENT_REFERENCE_NOT_VALIDATED");
        }
        if (input.confirmation !== payment.referenceNumber) {
          throw new AppError("Type the payment reference number to confirm reversal", 400, "PAYMENT_REVERSAL_CONFIRMATION_REQUIRED");
        }
        await connection.execute(
          `INSERT INTO financial_records
             (record_number, payment_reference_id, member_id, financial_category_id,
              recorded_by, approved_by, record_type, source_module, source_record_id,
              amount, record_date, record_status, reversal_of_record_id, remarks)
           SELECT CONCAT('REV-', fr.financial_record_id), fr.payment_reference_id, fr.member_id,
                  fr.financial_category_id, ?, ?, 'Adjustment', fr.source_module,
                  fr.source_record_id, -fr.amount, UTC_DATE(), 'Active',
                  fr.financial_record_id, ?
             FROM financial_records fr
            WHERE fr.payment_reference_id = ? AND fr.record_status = 'Active'
              AND fr.reversal_of_record_id IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM financial_records reverse_record
                 WHERE reverse_record.reversal_of_record_id = fr.financial_record_id
              )`,
          [input.auth.user.id, input.auth.user.id, `Payment reversal: ${reason}`, input.paymentReferenceId],
        );
        await connection.execute(
          `UPDATE financial_records SET record_status = 'Reversed',
                  remarks = CONCAT(COALESCE(remarks, ''), ?), updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ? AND record_status = 'Active'
              AND reversal_of_record_id IS NULL`,
          [`\nReversed payment reference: ${reason}`, input.paymentReferenceId],
        );
        await connection.execute(
          `UPDATE share_capital_payments SET payment_status = 'Reversed',
                  remarks = CONCAT(COALESCE(remarks, ''), ?), updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ? AND payment_status = 'Validated'`,
          [`\nReversed payment reference: ${reason}`, input.paymentReferenceId],
        );
        if (payment.relatedEntityType === "membership_application" && payment.relatedEntityId) {
          const settingKey = payment.paymentPurpose === "Share Capital"
            ? "membership.initial_share_capital"
            : "membership.associate_fee";
          const fallback = payment.paymentPurpose === "Share Capital" ? 1500 : 200;
          const [settingRows] = await connection.execute<(RowDataPacket & { value: string | null })[]>(
            `SELECT setting_value AS value FROM system_settings WHERE setting_key = ? LIMIT 1`,
            [settingKey],
          );
          const requiredAmount = Number(settingRows[0]?.value ?? fallback);
          const [remainingRows] = await connection.execute<(RowDataPacket & { total: string | number })[]>(
            `SELECT COALESCE(SUM(amount), 0) AS total FROM payment_references
              WHERE related_entity_type = 'membership_application'
                AND related_entity_id = ? AND payment_purpose = ?
                AND validation_status = 'Validated' AND payment_reference_id <> ?`,
            [payment.relatedEntityId, payment.paymentPurpose, input.paymentReferenceId],
          );
          const stillSatisfied = Number(remainingRows[0]?.total ?? 0) >= requiredAmount;
          await connection.execute(
            `UPDATE membership_application_requirements SET
                    requirement_status = CASE WHEN requirement_status = 'Waived' THEN 'Waived' ELSE ? END,
                    verified_by = CASE WHEN ? = 'Verified' THEN verified_by ELSE NULL END,
                    verified_at = CASE WHEN ? = 'Verified' THEN verified_at ELSE NULL END,
                    remarks = CONCAT(COALESCE(remarks, ''), ?), updated_at = UTC_TIMESTAMP()
              WHERE membership_application_id = ?
                AND requirement_type = ?`,
            [stillSatisfied ? "Verified" : "Pending", stillSatisfied ? "Verified" : "Pending",
              stillSatisfied ? "Verified" : "Pending", `\nPayment reversed: ${reason}`,
              payment.relatedEntityId,
              payment.paymentPurpose === "Share Capital" ? "Initial Share Capital" : "Associate Membership Fee"],
          );
        }
        await connection.execute(
          `UPDATE payment_references SET validation_status = 'Reversed', rejection_reason = ?,
                  validation_source = 'Manual Bookkeeper', updated_at = UTC_TIMESTAMP()
            WHERE payment_reference_id = ?`, [reason, input.paymentReferenceId],
        );
        await connection.execute(
          `INSERT INTO payment_validation_history
             (payment_reference_id, old_status, new_status, validation_source, reason, changed_by)
           VALUES (?, 'Validated', 'Reversed', 'Manual Bookkeeper', ?, ?)`,
          [input.paymentReferenceId, reason, input.auth.user.id],
        );
        await connection.execute(
          `INSERT INTO membership_application_status_history
             (membership_application_id, old_status, new_status, internal_note, applicant_message, changed_by)
           SELECT a.membership_application_id, a.application_status, a.application_status,
                  ?, ?, ? FROM membership_application_requirements r
             JOIN membership_applications a ON a.membership_application_id = r.membership_application_id
            WHERE r.payment_reference_id = ?`,
          [`Payment ${payment.referenceNumber} was reversed. Membership was not automatically revoked. ${reason}`,
            "A previously confirmed payment was reversed. Contact the cooperative office for next steps.",
            input.auth.user.id, input.paymentReferenceId],
        );
        if (payment.memberId) {
          const [memberRows] = await connection.execute<MemberRow[]>(
            `SELECT membership_type AS membershipType, official_member_status AS officialStatus
               FROM member_profiles WHERE member_id = ? LIMIT 1 FOR UPDATE`, [payment.memberId],
          );
          if (memberRows[0]) {
            await connection.execute(
              `INSERT INTO member_status_history
                 (member_id, old_membership_type, new_membership_type,
                  old_official_status, new_official_status, reason, changed_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [payment.memberId, memberRows[0].membershipType, memberRows[0].membershipType,
                memberRows[0].officialStatus, memberRows[0].officialStatus,
                `Payment ${payment.referenceNumber} reversed; membership remains unchanged. ${reason}`,
                input.auth.user.id],
            );
          }
        }
        await connection.execute(
          `UPDATE payment_receipts SET reversed_at = UTC_TIMESTAMP(), reversal_note = ?
            WHERE payment_reference_id = ?`, [reason, input.paymentReferenceId],
        );
        await connection.execute(
          `UPDATE documents SET description = CONCAT(COALESCE(description, ''), ?)
            WHERE related_module = 'Payment' AND related_record_id = ?
              AND relationship_type = 'Payment Receipt'`,
          [`\nAssociated payment reversed: ${reason}`, input.paymentReferenceId],
        );
        await connection.execute(
          `INSERT INTO notifications
             (user_id, notification_type, title, message, related_entity_type, related_entity_id)
           SELECT u.user_id, 'Payment', 'Payment reference reversed', ?,
                  'payment_reference', ? FROM users u JOIN roles r ON r.role_id = u.role_id
            WHERE r.role_slug IN ('chairman','bookkeeper') AND u.account_status = 'Active'`,
          [`${payment.referenceNumber} was reversed by ${input.auth.user.displayName}. Membership was not automatically revoked.`, input.paymentReferenceId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'payment_reference.reversed', 'payment_references', ?, ?,
                   JSON_OBJECT('validationStatus','Validated'), JSON_OBJECT('validationStatus','Reversed'))`,
          [input.auth.user.id, input.paymentReferenceId, reason],
        );
      }, databasePool());
    },
  };
}
