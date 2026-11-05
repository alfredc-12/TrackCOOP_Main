import type { Pool, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { createMemberRepository } from "./member.repository";

export function createMembershipUpgradeService(pool?: Pool) {
  const database = () => pool ?? getPool();
  const repository = createMemberRepository(pool);
  return {
    async status(auth: AuthContext) {
      const [members] = await database().execute<RowDataPacket[]>(
        "SELECT member_id, membership_type FROM member_profiles WHERE user_id = ?", [auth.user.id],
      );
      const member = members[0];
      if (!member) throw new AppError("Member profile not found", 404, "MEMBER_PROFILE_NOT_FOUND");
      const [requests] = await database().execute<RowDataPacket[]>(
        "SELECT upgrade_request_id AS id, request_status AS status, decision_reason AS decisionReason, created_at AS createdAt FROM membership_upgrade_requests WHERE member_id = ? ORDER BY upgrade_request_id DESC LIMIT 1", [member.member_id],
      );
      return { membershipType: member.membership_type, application: requests[0] ?? null,
        requirements: await repository.shareCapitalProgress(String(member.member_id)) };
    },
    async apply(auth: AuthContext, message: unknown) {
      if (typeof message !== "string" || !message.trim() || message.trim().length > 2000) {
        throw new AppError("Enter an application message of up to 2,000 characters", 400, "UPGRADE_MESSAGE_INVALID");
      }
      return withTransaction(async (connection) => {
        const [members] = await connection.execute<RowDataPacket[]>(
          "SELECT member_id, membership_type, approval_status, official_member_status FROM member_profiles WHERE user_id = ? FOR UPDATE", [auth.user.id],
        );
        const member = members[0];
        if (!member || member.membership_type !== "Associate" || member.approval_status !== "Approved" || member.official_member_status !== "Active") {
          throw new AppError("Only approved, active Associate Members can apply", 403, "UPGRADE_NOT_ELIGIBLE");
        }
        const [pending] = await connection.execute<RowDataPacket[]>(
          "SELECT upgrade_request_id FROM membership_upgrade_requests WHERE member_id = ? AND request_status = 'Pending'", [member.member_id],
        );
        if (pending.length) throw new AppError("Your application is already pending", 409, "UPGRADE_ALREADY_PENDING");
        await connection.execute("INSERT INTO membership_upgrade_requests (member_id, application_message) VALUES (?, ?)", [member.member_id, message.trim()]);
        await connection.execute("INSERT INTO audit_logs (user_id, action, entity_table, record_id, description) VALUES (?, 'membership_upgrade.submitted', 'member_profiles', ?, 'Associate applied for True Membership.')", [auth.user.id, member.member_id]);
        return { success: true };
      }, database());
    },
    async list() {
      const [rows] = await database().execute<(RowDataPacket & { id: string; memberId: string })[]>(
        `SELECT CAST(r.upgrade_request_id AS CHAR) AS id, CAST(m.member_id AS CHAR) AS memberId,
                m.full_name AS fullName, m.member_code AS memberCode, m.membership_type AS membershipType,
                r.application_message AS message, r.created_at AS createdAt
           FROM membership_upgrade_requests r JOIN member_profiles m ON m.member_id = r.member_id
          WHERE r.request_status = 'Pending' ORDER BY r.created_at, r.upgrade_request_id`,
      );
      return Promise.all(rows.map(async (row) => ({ ...row, requirements: await repository.shareCapitalProgress(String(row.memberId)) })));
    },
    async decide(auth: AuthContext, id: string, decision: unknown, reason: unknown) {
      if (decision !== "Approved" && decision !== "Rejected") throw new AppError("Choose an approval decision", 400, "UPGRADE_DECISION_INVALID");
      if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 2000) throw new AppError("Enter a decision reason of up to 2,000 characters", 400, "UPGRADE_REASON_INVALID");
      return withTransaction(async (connection) => {
        const [requests] = await connection.execute<RowDataPacket[]>("SELECT member_id FROM membership_upgrade_requests WHERE upgrade_request_id = ?", [id]);
        if (!requests[0]) throw new AppError("Application not found", 404, "UPGRADE_NOT_FOUND");
        // Always lock the member first, matching application submission and serializing decisions.
        const memberId = String(requests[0].member_id);
        const [members] = await connection.execute<RowDataPacket[]>("SELECT membership_type, approval_status, official_member_status FROM member_profiles WHERE member_id = ? FOR UPDATE", [memberId]);
        const [locked] = await connection.execute<RowDataPacket[]>("SELECT request_status FROM membership_upgrade_requests WHERE upgrade_request_id = ? FOR UPDATE", [id]);
        if (locked[0]?.request_status !== "Pending") throw new AppError("This application has already been reviewed", 409, "UPGRADE_ALREADY_REVIEWED");
        const member = members[0];
        if (decision === "Approved") {
          if (member.approval_status !== "Approved" || member.official_member_status !== "Active") throw new AppError("The member must be approved and active", 409, "UPGRADE_NOT_ELIGIBLE");
          if (member.membership_type !== "True Member") {
            // Reuse the chairman promotion requirements; unvalidated payments do not count.
            const capital = await repository.shareCapitalProgress(memberId, connection);
            if (!capital.fullRequirementMet || capital.validatedTotal > capital.maximumAllowed) {
              throw new AppError(`Validated Share Capital must be between PHP ${capital.fullRequirement} and PHP ${capital.maximumAllowed} before approval`, 409, "TRUE_MEMBER_CAPITAL_REQUIREMENT_NOT_MET");
            }
            await connection.execute("UPDATE member_profiles SET membership_type = 'True Member', true_member_since = COALESCE(true_member_since, CURRENT_DATE()) WHERE member_id = ?", [memberId]);
            await connection.execute("INSERT INTO member_status_history (member_id, old_membership_type, new_membership_type, old_official_status, new_official_status, reason, changed_by) VALUES (?, ?, 'True Member', ?, ?, ?, ?)", [memberId, member.membership_type, member.official_member_status, member.official_member_status, reason.trim(), auth.user.id]);
          }
        }
        await connection.execute("UPDATE membership_upgrade_requests SET request_status = ?, decision_reason = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE upgrade_request_id = ?", [decision, reason.trim(), auth.user.id, id]);
        await connection.execute("INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values) VALUES (?, 'membership_upgrade.reviewed', 'membership_upgrade_requests', ?, ?, ?)", [auth.user.id, id, reason.trim(), JSON.stringify({ decision, memberId })]);
        return { success: true };
      }, database());
    },
  };
}

