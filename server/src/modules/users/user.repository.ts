import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { limitOffsetSql } from "../../db/pagination";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext, RoleSlug } from "../auth/auth.types";
import type {
  CreateUserInput,
  RoleSummary,
  UpdateUserInput,
  UserListQuery,
  UserListResult,
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

const sortColumns: Record<UserListQuery["sortBy"], string> = {
  displayName: "u.display_name",
  email: "u.email",
  role: "r.role_slug",
  accountStatus: "u.account_status",
  createdAt: "u.created_at",
};

export interface UserRepository {
  list(query: UserListQuery): Promise<UserListResult>;
  findById(userId: string): Promise<UserSummary | null>;
  listRoles(): Promise<RoleSummary[]>;
  create(input: CreateUserInput & { passwordHash: string; createdBy: string }): Promise<UserSummary>;
  update(userId: string, input: UpdateUserInput, auth: AuthContext): Promise<UserSummary>;
  updateStatus(userId: string, accountStatus: UserSummary["accountStatus"], auth: AuthContext): Promise<UserSummary>;
  updateRole(userId: string, role: RoleSlug, auth: AuthContext): Promise<UserSummary>;
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
                 u.created_at AS createdAt
            FROM users u
            JOIN roles r ON r.role_id = u.role_id`;
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

export function createUserRepository(pool?: Pool): UserRepository {
  const databasePool = () => pool ?? getPool();

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

    async findById(userId) {
      const [rows] = await databasePool().execute<UserRow[]>(
        `${userSelect()} WHERE u.user_id = ? LIMIT 1`,
        [userId],
      );

      return rows[0] ? mapUser(rows[0]) : null;
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

        return mapUser(rows[0]);
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
           VALUES (?, 'account.updated', 'users', ?, 'A user profile was updated.', CAST(? AS JSON))`,
          [auth.user.id, userId, JSON.stringify(input)],
        );

        const updated = await this.findById(userId);
        if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async updateStatus(userId, accountStatus, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");

        await connection.execute(
          `UPDATE users SET account_status = ? WHERE user_id = ?`,
          [accountStatus, userId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'account.status_changed', 'users', ?, 'A user account status was changed.', JSON_OBJECT('accountStatus', ?), JSON_OBJECT('accountStatus', ?))`,
          [auth.user.id, userId, existing.accountStatus, accountStatus],
        );

        const updated = await this.findById(userId);
        if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async updateRole(userId, role, auth) {
      const poolInstance = databasePool();
      const roleId = await getRoleId(role, poolInstance);

      return withTransaction(async (connection) => {
        const existing = await this.findById(userId);
        if (!existing) throw new AppError("User was not found", 404, "USER_NOT_FOUND");

        await connection.execute(`UPDATE users SET role_id = ? WHERE user_id = ?`, [
          roleId,
          userId,
        ]);
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'account.role_changed', 'users', ?, 'A user account role was changed.', JSON_OBJECT('role', ?), JSON_OBJECT('role', ?))`,
          [auth.user.id, userId, existing.role, role],
        );

        const updated = await this.findById(userId);
        if (!updated) throw new AppError("User was not found", 404, "USER_NOT_FOUND");
        return updated;
      }, poolInstance);
    },
  };
}
