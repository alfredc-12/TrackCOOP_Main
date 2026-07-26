import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { limitOffsetSql } from "../../db/pagination";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext, RoleSlug } from "../auth/auth.types";
import type {
  ActivationLinkResult,
  CreateUserInput,
  LinkableMember,
  RoleSummary,
  UpdateUserInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
  UserDetail,
  UserListQuery,
  UserListResult,
  UserMutationResult,
  UserSummaryCounts,
  UserSummary,
} from "./user.types";

type UserRow = RowDataPacket & {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  role: RoleSlug;
  accountStatus: UserSummary["accountStatus"];
  lastLoginAt: Date | null;
  createdAt: Date;
  linkedMemberId: string | null;
  linkedMemberCode: string | null;
  linkedMemberName: string | null;
  activeSessionCount: number;
  activationTokenExpiresAt: Date | null;
};

type RoleRow = RowDataPacket & {
  id: string;
  name: string;
  slug: RoleSlug;
  description: string | null;
};

type CountRow = RowDataPacket & {
  total: number;
};

type SummaryRow = RowDataPacket & UserSummaryCounts;

type SessionRow = RowDataPacket & {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  tokenHash: string;
};

type LinkableMemberRow = RowDataPacket & LinkableMember;

type SettingRow = RowDataPacket & {
  value: string | null;
};

const sortColumns: Record<UserListQuery["sortBy"], string> = {
  displayName: "u.display_name",
  email: "u.email",
  role: "r.role_slug",
  accountStatus: "u.account_status",
  createdAt: "u.created_at",
};

export interface UserRepository {
  list(query: UserListQuery): Promise<UserListResult>;
  summary(): Promise<UserSummaryCounts>;
  findById(userId: string): Promise<UserDetail | null>;
  listRoles(): Promise<RoleSummary[]>;
  listLinkableMembers(query: { search?: string; pageSize: number }): Promise<LinkableMember[]>;
  create(input: CreateUserInput & {
    passwordHash: string;
    createdBy: string;
    activationTokenHash?: string;
    activationTokenExpiresAt?: Date;
    activationUrl?: string;
  }): Promise<UserMutationResult>;
  update(userId: string, input: UpdateUserInput, auth: AuthContext): Promise<UserSummary>;
  updateStatus(userId: string, input: UpdateUserStatusInput, auth: AuthContext): Promise<UserSummary>;
  updateRole(userId: string, input: UpdateUserRoleInput, auth: AuthContext): Promise<UserSummary>;
  issueActivationLink(userId: string, input: {
    tokenHash: string;
    expiresAt: Date;
    activationUrl: string;
    reason: string;
  }, auth: AuthContext): Promise<ActivationLinkResult>;
  revokeSession(userId: string, sessionId: string, reason: string, auth: AuthContext): Promise<UserDetail>;
  revokeAllSessions(userId: string, reason: string, auth: AuthContext): Promise<UserDetail>;
  linkMember(userId: string, memberId: string, reason: string, auth: AuthContext): Promise<UserDetail>;
  unlinkMember(userId: string, reason: string, auth: AuthContext): Promise<UserDetail>;
  activationTokenHours(): Promise<number>;
}

function mapUser(row: UserRow): UserSummary {
  return {
    id: row.id,
    displayName: row.displayName,
    email: row.email,
    username: row.username,
    role: row.role,
    accountStatus: row.accountStatus,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    linkedMemberId: row.linkedMemberId,
    linkedMemberCode: row.linkedMemberCode,
    linkedMemberName: row.linkedMemberName,
    activeSessionCount: Number(row.activeSessionCount),
    activationTokenExpiresAt: row.activationTokenExpiresAt,
  };
}

function userSelect() {
  return `SELECT CAST(u.user_id AS CHAR) AS id,
                 u.display_name AS displayName,
                 u.email,
                 u.username,
                 r.role_slug AS role,
                 u.account_status AS accountStatus,
                 u.last_login_at AS lastLoginAt,
                 u.created_at AS createdAt,
                 CAST(m.member_id AS CHAR) AS linkedMemberId,
                 m.member_code AS linkedMemberCode,
                 m.full_name AS linkedMemberName,
                 (SELECT COUNT(*)
                    FROM user_sessions s
                   WHERE s.user_id = u.user_id
                     AND s.revoked_at IS NULL
                     AND s.expires_at > UTC_TIMESTAMP()) AS activeSessionCount,
                 (SELECT MAX(t.expires_at)
                    FROM user_activation_tokens t
                   WHERE t.user_id = u.user_id
                     AND t.used_at IS NULL
                     AND t.expires_at > UTC_TIMESTAMP()) AS activationTokenExpiresAt
            FROM users u
            JOIN roles r ON r.role_id = u.role_id
            LEFT JOIN member_profiles m ON m.user_id = u.user_id`;
}

async function getRoleId(role: RoleSlug, pool: Pool) {
  const [rows] = await pool.execute<(RowDataPacket & { roleId: number })[]>(
    `SELECT role_id AS roleId
       FROM roles
      WHERE role_slug = ? AND is_active = 1
      LIMIT 1`,
    [role],
  );

  const row = rows[0];
  if (!row) {
    throw new AppError("The requested role is not available", 400, "ROLE_NOT_AVAILABLE");
  }

  return row.roleId;
}

function mysqlDateTime(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function mapSession(row: SessionRow, currentSessionId: string) {
  return {
    id: row.id,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    isCurrent: row.id === currentSessionId,
  };
}

export function createUserRepository(pool?: Pool): UserRepository {
  const databasePool = () => pool ?? getPool();

  async function findDetail(userId: string, currentSessionId = ""): Promise<UserDetail | null> {
    const [rows] = await databasePool().execute<UserRow[]>(
      `${userSelect()} WHERE u.user_id = ? LIMIT 1`,
      [userId],
    );
    const row = rows[0];
    if (!row) return null;

    const [sessions] = await databasePool().execute<SessionRow[]>(
      `SELECT CAST(session_id AS CHAR) AS id,
              ip_address AS ipAddress,
              user_agent AS userAgent,
              created_at AS createdAt,
              expires_at AS expiresAt,
              session_token_hash AS tokenHash
         FROM user_sessions
        WHERE user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()
        ORDER BY created_at DESC`,
      [userId],
    );

    return {
      ...mapUser(row),
      sessions: sessions.map((session) => mapSession(session, currentSessionId)),
    };
  }

  async function activeChairmanCountForUpdate(connection: PoolConnection) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT u.user_id
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
        WHERE r.role_slug = 'chairman'
          AND u.account_status = 'Active'
        FOR UPDATE`,
    );

    return rows.length;
  }

  async function revokeSessions(
    connection: PoolConnection,
    userId: string,
    auth: AuthContext,
    action: string,
    description: string,
    reason: string,
    exceptSessionId?: string,
  ) {
    const params: string[] = [userId];
    let sessionFilter = "";
    if (exceptSessionId) {
      sessionFilter = " AND session_id <> ?";
      params.push(exceptSessionId);
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE user_sessions
          SET revoked_at = UTC_TIMESTAMP()
        WHERE user_id = ?
          AND revoked_at IS NULL
          AND expires_at > UTC_TIMESTAMP()
          ${sessionFilter}`,
      params,
    );

    if (result.affectedRows > 0) {
      await connection.execute(
        `INSERT INTO audit_logs
           (user_id, action, entity_table, record_id, description, new_values)
         VALUES (?, ?, 'user_sessions', ?, ?, ?)`,
        [
          auth.user.id,
          action,
          userId,
          description,
          JSON.stringify({ userId, revokedSessions: result.affectedRows, reason }),
        ],
      );
    }
  }

  return {
    async list(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];

      if (query.search) {
        where.push("(u.display_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search, search);
      }

      if (query.role) {
        where.push("r.role_slug = ?");
        values.push(query.role);
      }

      if (query.status) {
        where.push("u.account_status = ?");
        values.push(query.status);
      }

      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const orderBy = sortColumns[query.sortBy];
      const offset = (query.page - 1) * query.pageSize;

      const [rows] = await databasePool().execute<UserRow[]>(
        `${userSelect()}
         ${whereSql}
         ORDER BY ${orderBy} ${orderDirection}, u.user_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total
           FROM users u
           JOIN roles r ON r.role_id = u.role_id
         ${whereSql}`,
        values,
      );

      return {
        users: rows.map(mapUser),
        total: countRows[0]?.total ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async summary() {
      const [rows] = await databasePool().execute<SummaryRow[]>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN account_status = 'Active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN account_status = 'Pending' THEN 1 ELSE 0 END) AS pendingActivation,
                SUM(CASE WHEN account_status IN ('Suspended', 'Inactive') THEN 1 ELSE 0 END) AS suspendedInactive
           FROM users`,
      );
      const row = rows[0];

      return {
        total: Number(row?.total ?? 0),
        active: Number(row?.active ?? 0),
        pendingActivation: Number(row?.pendingActivation ?? 0),
        suspendedInactive: Number(row?.suspendedInactive ?? 0),
      };
    },

    async findById(userId) {
      return findDetail(userId);
    },

    async listRoles() {
      const [rows] = await databasePool().execute<RoleRow[]>(
        `SELECT CAST(role_id AS CHAR) AS id,
                role_name AS name,
                role_slug AS slug,
                description
           FROM roles
          WHERE is_active = 1
          ORDER BY role_id ASC`,
      );

      return rows;
    },

    async listLinkableMembers(query) {
      const values: Array<string | number> = [];
      let searchSql = "";

      if (query.search) {
        searchSql = " AND (member_code LIKE ? OR full_name LIKE ? OR email LIKE ?)";
        const search = `%${query.search}%`;
        values.push(search, search, search);
      }

      values.push(query.pageSize);

      const [rows] = await databasePool().execute<LinkableMemberRow[]>(
        `SELECT CAST(member_id AS CHAR) AS id,
                member_code AS memberCode,
                full_name AS fullName,
                email
           FROM member_profiles
          WHERE user_id IS NULL
            AND approval_status = 'Approved'
            ${searchSql}
          ORDER BY full_name ASC, member_id DESC
          LIMIT ?`,
        values,
      );

      return rows;
    },

    async create(input) {
      const poolInstance = databasePool();
      const roleId = await getRoleId(input.role, poolInstance);

      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO users
             (role_id, username, email, password_hash, display_name, account_status, email_verified_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 'Active' THEN UTC_TIMESTAMP() ELSE NULL END, ?)`,
          [
            roleId,
            input.username ?? null,
            input.email,
            input.passwordHash,
            input.displayName,
            input.accountStatus,
            input.accountStatus,
            input.createdBy,
          ],
        );
        const userId = String(result.insertId);

        if (input.activationTokenHash && input.activationTokenExpiresAt) {
          await connection.execute(
            `INSERT INTO user_activation_tokens
               (user_id, token_hash, expires_at, created_by)
             VALUES (?, ?, ?, ?)`,
            [
              userId,
              input.activationTokenHash,
              mysqlDateTime(input.activationTokenExpiresAt),
              input.createdBy,
            ],
          );
          await connection.execute(
            `INSERT INTO audit_logs
               (user_id, action, entity_table, record_id, description, new_values)
             VALUES (?, 'activation_token.issued', 'user_activation_tokens', ?,
                     'A user activation token was issued.', ?)`,
            [
              input.createdBy,
              userId,
              JSON.stringify({
                userId,
                expiresAt: input.activationTokenExpiresAt.toISOString(),
              }),
            ],
          );
        }

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'account.created', 'users', ?, 'A user account was created.', JSON_OBJECT('role', ?, 'accountStatus', ?))`,
          [input.createdBy, userId, input.role, input.accountStatus],
        );

        const [rows] = await connection.execute<UserRow[]>(
          `${userSelect()} WHERE u.user_id = ? LIMIT 1`,
          [userId],
        );

        const user = mapUser(rows[0]);
        return {
          user,
          activationUrl: input.activationUrl,
          activationTokenExpiresAt: input.activationTokenExpiresAt,
        };
      }, poolInstance);
    },

    async update(userId, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");

        await connection.execute(
          `UPDATE users
              SET display_name = COALESCE(?, display_name),
                  email = COALESCE(?, email),
                  username = ?
            WHERE user_id = ?`,
          [
            input.displayName ?? null,
            input.email ?? null,
            Object.prototype.hasOwnProperty.call(input, "username")
              ? input.username ?? null
              : existing.username,
            userId,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'account.updated', 'users', ?, 'A user profile was updated.', ?)`,
          [auth.user.id, userId, JSON.stringify(input)],
        );

        const updated = await this.findById(userId);
        if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async updateStatus(userId, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");

        if (
          existing.role === "chairman" &&
          existing.accountStatus === "Active" &&
          input.accountStatus !== "Active" &&
          (await activeChairmanCountForUpdate(connection)) <= 1
        ) {
          throw new AppError(
            "The last active Chairman account cannot be suspended or deactivated",
            409,
            "LAST_ACTIVE_CHAIRMAN",
          );
        }

        await connection.execute(
          `UPDATE users
              SET account_status = ?,
                  email_verified_at = CASE WHEN ? = 'Active' THEN COALESCE(email_verified_at, UTC_TIMESTAMP()) ELSE email_verified_at END
            WHERE user_id = ?`,
          [input.accountStatus, input.accountStatus, userId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'account.status_changed', 'users', ?, 'A user account status was changed.', JSON_OBJECT('accountStatus', ?), ?)`,
          [
            auth.user.id,
            userId,
            existing.accountStatus,
            JSON.stringify({
              accountStatus: input.accountStatus,
              reason: input.reason,
            }),
          ],
        );

        await revokeSessions(
          connection,
          userId,
          auth,
          "account.sessions_revoked",
          "User sessions were revoked after an account status change.",
          input.reason,
          input.accountStatus === "Active" ? auth.sessionId : undefined,
        );

        const updated = await this.findById(userId);
        if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async updateRole(userId, input, auth) {
      const poolInstance = databasePool();
      const roleId = await getRoleId(input.role, poolInstance);

      return withTransaction(async (connection) => {
        const existing = await this.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");

        if (
          existing.role === "chairman" &&
          existing.accountStatus === "Active" &&
          input.role !== "chairman" &&
          (await activeChairmanCountForUpdate(connection)) <= 1
        ) {
          throw new AppError(
            "The last active Chairman account cannot lose the Chairman role",
            409,
            "LAST_ACTIVE_CHAIRMAN",
          );
        }

        if (existing.linkedMemberId && input.role !== "member") {
          await connection.execute(
            `UPDATE member_profiles SET user_id = NULL WHERE user_id = ?`,
            [userId],
          );
          await connection.execute(
            `INSERT INTO audit_logs
               (user_id, action, entity_table, record_id, description, new_values)
             VALUES (?, 'member.account_unlinked', 'member_profiles', ?, 'A member profile was unlinked after account role change.', ?)`,
            [
              auth.user.id,
              existing.linkedMemberId,
              JSON.stringify({ userId, reason: input.reason }),
            ],
          );
        }

        await connection.execute(`UPDATE users SET role_id = ? WHERE user_id = ?`, [
          roleId,
          userId,
        ]);
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'account.role_changed', 'users', ?, 'A user account role was changed.', JSON_OBJECT('role', ?), ?)`,
          [
            auth.user.id,
            userId,
            existing.role,
            JSON.stringify({ role: input.role, reason: input.reason }),
          ],
        );

        await revokeSessions(
          connection,
          userId,
          auth,
          "account.sessions_revoked",
          "User sessions were revoked after an account role change.",
          input.reason,
          auth.sessionId,
        );

        const updated = await this.findById(userId);
        if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
        return updated;
      }, poolInstance);
    },

    async issueActivationLink(userId, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");

        if (existing.accountStatus === "Active") {
          throw new AppError(
            "Activation links can only be issued for accounts that are not active",
            409,
            "ACCOUNT_ALREADY_ACTIVE",
          );
        }

        await connection.execute(
          `UPDATE user_activation_tokens
              SET used_at = COALESCE(used_at, UTC_TIMESTAMP())
            WHERE user_id = ? AND used_at IS NULL`,
          [userId],
        );
        await connection.execute(
          `INSERT INTO user_activation_tokens
             (user_id, token_hash, expires_at, created_by)
           VALUES (?, ?, ?, ?)`,
          [userId, input.tokenHash, mysqlDateTime(input.expiresAt), auth.user.id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'activation_token.issued', 'user_activation_tokens', ?,
                   'A user activation token was issued.', ?)`,
          [
            auth.user.id,
            userId,
            JSON.stringify({
              userId,
              expiresAt: input.expiresAt.toISOString(),
              reason: input.reason,
            }),
          ],
        );

        const updated = await this.findById(userId);
        if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
        return {
          user: updated,
          activationUrl: input.activationUrl,
          activationTokenExpiresAt: input.expiresAt,
        };
      }, databasePool());
    },

    async revokeSession(userId, sessionId, reason, auth) {
      await withTransaction(async (connection) => {
        const existing = await this.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");

        const [result] = await connection.execute<ResultSetHeader>(
          `UPDATE user_sessions
              SET revoked_at = UTC_TIMESTAMP()
            WHERE user_id = ?
              AND session_id = ?
              AND revoked_at IS NULL`,
          [userId, sessionId],
        );

        if (result.affectedRows === 0) {
          throw new AppError("Session was not found or already revoked", 404, "SESSION_NOT_FOUND");
        }

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'account.session_revoked', 'user_sessions', ?, 'A Chairman revoked one user session.', ?)`,
          [auth.user.id, sessionId, JSON.stringify({ userId, reason })],
        );
      }, databasePool());

      const updated = await findDetail(userId, auth.sessionId);
      if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
      return updated;
    },

    async revokeAllSessions(userId, reason, auth) {
      await withTransaction(async (connection) => {
        const existing = await this.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
        await revokeSessions(
          connection,
          userId,
          auth,
          "account.sessions_revoked",
          "A Chairman revoked all active user sessions.",
          reason,
          userId === auth.user.id ? auth.sessionId : undefined,
        );
      }, databasePool());

      const updated = await findDetail(userId, auth.sessionId);
      if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
      return updated;
    },

    async linkMember(userId, memberId, reason, auth) {
      await withTransaction(async (connection) => {
        const existing = await this.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
        if (existing.role !== "member") {
          throw new AppError(
            "Only Member-role accounts can be linked to member profiles",
            400,
            "MEMBER_ROLE_REQUIRED",
          );
        }
        if (existing.linkedMemberId) {
          throw new AppError("This user is already linked to a member profile", 409, "USER_ALREADY_LINKED");
        }

        const [members] = await connection.execute<(RowDataPacket & { linkedUserId: string | null })[]>(
          `SELECT CAST(user_id AS CHAR) AS linkedUserId
             FROM member_profiles
            WHERE member_id = ?
            FOR UPDATE`,
          [memberId],
        );
        const member = members[0];
        if (!member) throw new AppError("Member profile was not found", 404, "MEMBER_NOT_FOUND");
        if (member.linkedUserId) {
          throw new AppError("This member profile is already linked", 409, "MEMBER_ALREADY_LINKED");
        }

        await connection.execute(
          `UPDATE member_profiles SET user_id = ? WHERE member_id = ?`,
          [userId, memberId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'member.account_linked', 'member_profiles', ?, 'A member profile was linked to a user account.', ?)`,
          [auth.user.id, memberId, JSON.stringify({ userId, reason })],
        );
      }, databasePool());

      const updated = await findDetail(userId, auth.sessionId);
      if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
      return updated;
    },

    async unlinkMember(userId, reason, auth) {
      await withTransaction(async (connection) => {
        const existing = await this.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
        if (!existing.linkedMemberId) {
          throw new AppError("This account is not linked to a member profile", 409, "USER_NOT_LINKED");
        }

        await connection.execute(
          `UPDATE member_profiles SET user_id = NULL WHERE user_id = ?`,
          [userId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'member.account_unlinked', 'member_profiles', ?, 'A member profile was unlinked from a user account.', ?)`,
          [auth.user.id, existing.linkedMemberId, JSON.stringify({ userId, reason })],
        );
      }, databasePool());

      const updated = await findDetail(userId, auth.sessionId);
      if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
      return updated;
    },

    async activationTokenHours() {
      const [rows] = await databasePool().execute<SettingRow[]>(
        `SELECT setting_value AS value
           FROM system_settings
          WHERE setting_key = 'membership.activation_token_hours'
          LIMIT 1`,
      );
      const hours = Number(rows[0]?.value ?? 72);
      return Number.isFinite(hours) && hours > 0 ? hours : 72;
    },
  };
}
