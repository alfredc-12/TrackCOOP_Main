import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";

export type ProvisionAccountInput = {
  email: string;
  displayName: string;
  role: "chairman" | "bookkeeper";
  passwordHash: string;
};

type RoleRow = RowDataPacket & {
  roleId: number;
};

type ExistingUserRow = RowDataPacket & {
  id: string;
};

export async function provisionAccount(
  input: ProvisionAccountInput,
  pool: Pool = getPool(),
) {
  return withTransaction(async (connection) => {
    const [roles] = await connection.execute<RoleRow[]>(
      `SELECT role_id AS roleId
         FROM roles
        WHERE role_slug = ? AND is_active = 1
        LIMIT 1`,
      [input.role],
    );
    const role = roles[0];

    if (!role) {
      throw new AppError(
        `The ${input.role} role is missing or inactive. Run the reference seed first.`,
        400,
        "ROLE_NOT_AVAILABLE",
      );
    }

    const [existingUsers] = await connection.execute<ExistingUserRow[]>(
      `SELECT CAST(user_id AS CHAR) AS id
         FROM users
        WHERE email = ?
        LIMIT 1`,
      [input.email],
    );

    if (existingUsers.length > 0) {
      throw new AppError(
        "An account with this email already exists",
        409,
        "ACCOUNT_ALREADY_EXISTS",
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users
         (role_id, email, password_hash, display_name, account_status, email_verified_at)
       VALUES (?, ?, ?, ?, 'Active', UTC_TIMESTAMP())`,
      [role.roleId, input.email, input.passwordHash, input.displayName],
    );
    const userId = String(result.insertId);

    await connection.execute(
      `INSERT INTO audit_logs
         (user_id, action, entity_table, record_id, description)
       VALUES (?, 'account.bootstrap_created', 'users', ?, 'A portal account was created using the secure account provisioning command.')`,
      [userId, userId],
    );

    return {
      id: userId,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
    };
  }, pool);
}
