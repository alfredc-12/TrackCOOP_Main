import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { env } from "../config/env";
import { closePool } from "../db/pool";
import { withTransaction } from "../db/transaction";

async function main() {
  try {
    if (env.NODE_ENV !== "development") throw new Error("This test account command is only available in development.");
    const email = "associate.test@trackcoop.test";
    const password = `Assoc!${randomBytes(12).toString("base64url")}7a`;
    const passwordHash = await hash(password, 12);
    const account = await withTransaction(async (connection) => {
      const [existing] = await connection.execute<RowDataPacket[]>("SELECT user_id FROM users WHERE email = ?", [email]);
      if (existing.length) throw new Error("The associate test account already exists; it was preserved.");
      const [roles] = await connection.execute<RowDataPacket[]>("SELECT role_id FROM roles WHERE role_slug = 'member' AND is_active = 1");
      if (!roles[0]) throw new Error("Member role is unavailable");
      const [user] = await connection.execute<ResultSetHeader>("INSERT INTO users (role_id, email, password_hash, display_name, account_status, email_verified_at) VALUES (?, ?, ?, 'Associate Test', 'Active', UTC_TIMESTAMP())", [roles[0].role_id, email, passwordHash]);
      const code = `ASSOC-TEST-${user.insertId}`;
      await connection.execute("INSERT INTO member_profiles (user_id, member_code, full_name, email, membership_type, approval_status, official_member_status, application_date, approved_at, notes) VALUES (?, ?, 'Associate Test', ?, 'Associate', 'Approved', 'Active', CURRENT_DATE(), UTC_TIMESTAMP(), 'Development account for testing Associate access and True Membership applications.')", [user.insertId, code, email]);
      await connection.execute("INSERT INTO audit_logs (user_id, action, entity_table, record_id, description) VALUES (?, 'account.test_created', 'users', ?, 'Created the authorized associate development test account.')", [user.insertId, user.insertId]);
      return { email, password, membershipType: "Associate", memberCode: code };
    });
    console.info(JSON.stringify(account, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally { await closePool(); }
}
void main();
