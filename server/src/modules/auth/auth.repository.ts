import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import type {
  AccountStatus,
  AuthContext,
  LoginAccount,
  RequestContext,
  RoleSlug,
  SessionSummary,
} from "./auth.types";

type LoginAccountRow = RowDataPacket & {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  passwordHash: string;
  accountStatus: AccountStatus;
  failedLoginCount: number;
  lockedUntil: Date | null;
  role: RoleSlug;
  roleIsActive: number;
};

type SessionRow = RowDataPacket & {
  sessionId: string;
  userId: string;
  displayName: string;
  email: string;
  username: string | null;
  role: RoleSlug;
};

type SessionSummaryRow = RowDataPacket & {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  tokenHash: string;
};

export type CreateSessionInput = RequestContext & {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type FailedLoginInput = RequestContext & {
  userId: string;
  failedLoginCount: number;
  lockedUntil: Date | null;
};

export interface AuthRepository {
  findLoginAccount(identifier: string): Promise<LoginAccount | null>;
  recordFailedLogin(input: FailedLoginInput): Promise<void>;
  createSession(input: CreateSessionInput): Promise<void>;
  findSession(tokenHash: string): Promise<AuthContext | null>;
  revokeCurrentSession(auth: AuthContext): Promise<void>;
  listSessions(userId: string, currentTokenHash: string): Promise<SessionSummary[]>;
  revokeSessionById(userId: string, sessionId: string): Promise<boolean>;
}

function auditValues(action: string, description: string) {
  return [action, description] as const;
}

export function createAuthRepository(pool?: Pool): AuthRepository {
  const databasePool = () => pool ?? getPool();

  return {
    async findLoginAccount(identifier) {
      const [rows] = await databasePool().execute<LoginAccountRow[]>(
        `SELECT CAST(u.user_id AS CHAR) AS id,
                u.display_name AS displayName,
                u.email,
                u.username,
                u.password_hash AS passwordHash,
                u.account_status AS accountStatus,
                u.failed_login_count AS failedLoginCount,
                u.locked_until AS lockedUntil,
                r.role_slug AS role,
                r.is_active AS roleIsActive
           FROM users u
           JOIN roles r ON r.role_id = u.role_id
          WHERE u.email = ? OR u.username = ?
          LIMIT 1`,
        [identifier, identifier],
      );
      const row = rows[0];

      return row
        ? {
            ...row,
            roleIsActive: row.roleIsActive === 1,
          }
        : null;
    },

    async recordFailedLogin(input) {
      await withTransaction(async (connection) => {
        await connection.execute(
          `UPDATE users
              SET failed_login_count = ?, locked_until = ?
            WHERE user_id = ?`,
          [input.failedLoginCount, input.lockedUntil, input.userId],
        );
        const [action, description] = auditValues(
          "auth.login_failed",
          "A login attempt failed.",
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, ip_address, user_agent)
           VALUES (?, ?, 'users', ?, ?, ?, ?)`,
          [
            input.userId,
            action,
            input.userId,
            description,
            input.ipAddress,
            input.userAgent,
          ],
        );
      }, databasePool());
    },

    async createSession(input) {
      await withTransaction(async (connection) => {
        await connection.execute(
          `INSERT INTO user_sessions
             (user_id, session_token_hash, ip_address, user_agent, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.userId,
            input.tokenHash,
            input.ipAddress,
            input.userAgent,
            input.expiresAt,
          ],
        );
        await connection.execute(
          `UPDATE users
              SET failed_login_count = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP()
            WHERE user_id = ?`,
          [input.userId],
        );
        const [action, description] = auditValues(
          "auth.login",
          "The user signed in successfully.",
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, ip_address, user_agent)
           VALUES (?, ?, 'users', ?, ?, ?, ?)`,
          [
            input.userId,
            action,
            input.userId,
            description,
            input.ipAddress,
            input.userAgent,
          ],
        );
      }, databasePool());
    },

    async findSession(tokenHash) {
      const [rows] = await databasePool().execute<SessionRow[]>(
        `SELECT CAST(s.session_id AS CHAR) AS sessionId,
                CAST(u.user_id AS CHAR) AS userId,
                u.display_name AS displayName,
                u.email,
                u.username,
                r.role_slug AS role
           FROM user_sessions s
           JOIN users u ON u.user_id = s.user_id
           JOIN roles r ON r.role_id = u.role_id
          WHERE s.session_token_hash = ?
            AND s.revoked_at IS NULL
            AND s.expires_at > UTC_TIMESTAMP()
            AND u.account_status = 'Active'
            AND r.is_active = 1
          LIMIT 1`,
        [tokenHash],
      );
      const row = rows[0];

      return row
        ? {
            sessionId: row.sessionId,
            tokenHash,
            user: {
              id: row.userId,
              displayName: row.displayName,
              email: row.email,
              username: row.username,
              role: row.role,
            },
          }
        : null;
    },

    async revokeCurrentSession(auth) {
      await withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `UPDATE user_sessions
              SET revoked_at = UTC_TIMESTAMP()
            WHERE session_id = ? AND user_id = ? AND session_token_hash = ? AND revoked_at IS NULL`,
          [auth.sessionId, auth.user.id, auth.tokenHash],
        );

        if (result.affectedRows > 0) {
          await connection.execute(
            `INSERT INTO audit_logs
               (user_id, action, entity_table, record_id, description)
             VALUES (?, 'auth.logout', 'user_sessions', ?, 'The current session was revoked during logout.')`,
            [auth.user.id, auth.sessionId],
          );
        }
      }, databasePool());
    },

    async listSessions(userId, currentTokenHash) {
      const [rows] = await databasePool().execute<SessionSummaryRow[]>(
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

      return rows.map((row) => ({
        id: row.id,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        isCurrent: String(row.tokenHash) === currentTokenHash,
      }));
    },

    async revokeSessionById(userId, sessionId) {
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `UPDATE user_sessions
              SET revoked_at = UTC_TIMESTAMP()
            WHERE session_id = ? AND user_id = ? AND revoked_at IS NULL`,
          [sessionId, userId],
        );

        if (result.affectedRows > 0) {
          await connection.execute(
            `INSERT INTO audit_logs
               (user_id, action, entity_table, record_id, description)
             VALUES (?, 'auth.session_revoked', 'user_sessions', ?, 'An active user session was revoked.')`,
            [userId, sessionId],
          );
        }

        return result.affectedRows > 0;
      }, databasePool());
    },
  };
}
