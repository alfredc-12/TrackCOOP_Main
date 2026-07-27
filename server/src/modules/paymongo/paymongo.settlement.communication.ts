import type { PoolConnection } from "mysql2/promise";
import type {
  MembershipApplicationSettlementRow,
} from "./paymongo.settlement.types";

export async function insertSettlementApplicantMessage(
  connection: PoolConnection,
  input: {
    application: MembershipApplicationSettlementRow;
    message: string;
    actorUserId: string | null;
  },
) {
  await connection.execute(
    `INSERT INTO membership_application_status_history
       (membership_application_id, old_status, new_status,
        internal_note, applicant_message, changed_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.application.id,
      input.application.applicationStatus,
      input.application.applicationStatus,
      "Payment was settled without changing application status.",
      input.message,
      input.actorUserId,
    ],
  );
}

export async function notifySettlementStaff(
  connection: PoolConnection,
  input: { applicationId: string; title: string; message: string },
) {
  await connection.execute(
    `INSERT INTO notifications
       (user_id, notification_type, title, message,
        related_entity_type, related_entity_id)
     SELECT u.user_id, 'Payment', ?, ?, 'membership_application', ?
       FROM users u JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug IN ('chairman', 'bookkeeper')
        AND u.account_status = 'Active'`,
    [input.title, input.message, input.applicationId],
  );
}

export async function notifySettlementMember(
  connection: PoolConnection,
  input: {
    userId: string | null;
    applicationId: string;
    title: string;
    message: string;
    notificationType: "Payment" | "Share Capital";
  },
) {
  if (!input.userId) return;
  await connection.execute(
    `INSERT INTO notifications
       (user_id, notification_type, title, message,
        related_entity_type, related_entity_id)
     VALUES (?, ?, ?, ?, 'membership_application', ?)`,
    [
      input.userId,
      input.notificationType,
      input.title,
      input.message,
      input.applicationId,
    ],
  );
}
