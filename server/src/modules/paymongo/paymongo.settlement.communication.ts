import type { PoolConnection } from "mysql2/promise";
import type { PaymentValidationSource } from "./paymongo.settlement.types";

export type SettlementCommunicationContext = {
  memberId: string | null;
  memberUserId: string | null;
  applicationId: string | null;
  applicationStatus: string | null;
  subjectReference: string;
  subjectName: string;
};

export async function recordSettlementCommunication(connection: PoolConnection, input: {
  context: SettlementCommunicationContext;
  paymentReferenceId: string;
  paymentReferenceNumber: string;
  paymentPurpose: string;
  amount: number;
  actorUserId: string;
  validationSource: PaymentValidationSource;
}) {
  const confirmed = `${input.paymentPurpose} ${input.paymentReferenceNumber} for PHP ${input.amount.toFixed(2)} was confirmed.`;
  if (input.context.applicationId && input.context.applicationStatus) {
    await connection.execute(
      `INSERT INTO membership_application_status_history
         (membership_application_id, old_status, new_status,
          internal_note, applicant_message, changed_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.context.applicationId, input.context.applicationStatus,
        input.context.applicationStatus,
        `Payment ${input.paymentReferenceNumber} settled by ${input.validationSource} without changing application status.`,
        confirmed, input.actorUserId],
    );
  }
  if (input.context.memberUserId) {
    await connection.execute(
      `INSERT INTO notifications
         (user_id, notification_type, title, message,
          related_entity_type, related_entity_id)
       VALUES (?, ?, ?, ?, 'payment_reference', ?)`,
      [input.context.memberUserId,
        input.paymentPurpose === "Share Capital" ? "Share Capital" : "Payment",
        `${input.paymentPurpose} payment confirmed`, confirmed,
        input.paymentReferenceId],
    );
  }
  await connection.execute(
    `INSERT INTO notifications
       (user_id, notification_type, title, message,
        related_entity_type, related_entity_id)
     SELECT u.user_id, 'Payment', 'Payment confirmed', ?,
            'payment_reference', ?
       FROM users u JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug IN ('chairman', 'bookkeeper')
        AND u.account_status = 'Active'`,
    [`${input.context.subjectReference}: ${confirmed}`, input.paymentReferenceId],
  );
}
