import crypto from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { ApprovalInput, RequestedMembershipType } from "./membership-application.types";
import {
  generatedMemberCode,
  mysqlDateTime,
  normalizeApprovalEmail,
  type ApplicationRow,
  type PreparedActivation,
} from "./membership-application.approval-support";

type IdRow = RowDataPacket & { id: string };
type RoleRow = RowDataPacket & { roleId: number };

export async function createApprovedMemberUser(input: {
  connection: PoolConnection;
  application: ApplicationRow;
  approval: ApprovalInput;
  auth: AuthContext;
  activation: PreparedActivation;
}) {
  if (!input.approval.createMemberPortalAccount) return null;
  const email = normalizeApprovalEmail(
    input.approval.accountEmail ?? input.application.email,
  );
  if (!email) {
    throw new AppError(
      "An email address is required to create a member portal account",
      400,
      "MEMBERSHIP_ACCOUNT_EMAIL_REQUIRED",
    );
  }
  if (!input.activation) {
    throw new AppError("Activation token generation failed", 500, "ACTIVATION_TOKEN_FAILED");
  }

  const [roles] = await input.connection.execute<RoleRow[]>(
    `SELECT role_id AS roleId FROM roles
      WHERE role_slug = 'member' AND is_active = 1 LIMIT 1`,
  );
  if (!roles[0]) {
    throw new AppError("The member role is not available", 400, "ROLE_NOT_AVAILABLE");
  }

  const username = input.approval.username?.trim() || null;
  const [existing] = await input.connection.execute<IdRow[]>(
    `SELECT CAST(user_id AS CHAR) AS id FROM users
      WHERE email = ? OR (? IS NOT NULL AND username = ?) LIMIT 1`,
    [email, username, username],
  );
  if (existing[0]) {
    throw new AppError(
      "A conflicting user account already exists",
      409,
      "MEMBERSHIP_ACCOUNT_CONFLICT",
    );
  }

  const [result] = await input.connection.execute<ResultSetHeader>(
    `INSERT INTO users
       (role_id, username, email, password_hash, display_name,
        account_status, email_verified_at, created_by)
     VALUES (?, ?, ?, ?, ?, 'Pending', NULL, ?)`,
    [
      roles[0].roleId,
      username,
      email,
      input.activation.unusablePasswordHash,
      input.application.fullName,
      input.auth.user.id,
    ],
  );
  const userId = String(result.insertId);
  await input.connection.execute(
    `INSERT INTO user_activation_tokens
       (user_id, token_hash, expires_at, created_by)
     VALUES (?, ?, ?, ?)`,
    [
      userId,
      input.activation.tokenHash,
      mysqlDateTime(input.activation.expiresAt),
      input.auth.user.id,
    ],
  );
  await input.connection.execute(
    `INSERT INTO audit_logs
       (user_id, action, entity_table, record_id, description, new_values)
     VALUES (?, 'activation_token.issued', 'user_activation_tokens', ?,
             'A member activation token was issued.', ?)`,
    [
      input.auth.user.id,
      userId,
      JSON.stringify({ userId, expiresAt: input.activation.expiresAt.toISOString() }),
    ],
  );
  return userId;
}

export async function insertApprovedMemberProfile(input: {
  connection: PoolConnection;
  application: ApplicationRow;
  auth: AuthContext;
  userId: string | null;
  membershipType: RequestedMembershipType;
  trueMemberSince: string | null;
  shareCapitalDeadline: string | null;
}) {
  const [result] = await input.connection.execute<ResultSetHeader>(
    `INSERT INTO member_profiles
       (user_id, member_code, full_name, contact_number, email, barangay,
        municipality, province, membership_type, approval_status,
        official_member_status, application_date, approved_by, approved_at,
        true_member_since, share_capital_deadline, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved', 'Active', DATE(?), ?,
             UTC_TIMESTAMP(), ?, ?, ?)`,
    [
      input.userId,
      `NFFAC-PENDING-${crypto.randomUUID()}`,
      input.application.fullName,
      input.application.contactNumber,
      input.application.email,
      input.application.barangay,
      input.application.municipality,
      input.application.province,
      input.membershipType,
      input.application.submittedAt,
      input.auth.user.id,
      input.trueMemberSince,
      input.shareCapitalDeadline,
      `Converted from membership application ${input.application.applicationCode}.`
        + (input.shareCapitalDeadline ? " Pursuing True Member status." : ""),
    ],
  );
  const memberId = String(result.insertId);
  const memberCode = generatedMemberCode(result.insertId);
  await input.connection.execute(
    `UPDATE member_profiles SET member_code = ? WHERE member_id = ?`,
    [memberCode, memberId],
  );
  return { memberId, memberCode };
}
