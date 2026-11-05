import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../../db/pool";
import type { AuthContext } from "../auth/auth.types";
import { createMembershipUpgradeService } from "./membership-upgrade.service";

test("MySQL upgrade lifecycle preserves membership until a valid approval", { skip: process.env.RUN_MEMBERSHIP_UPGRADE_MYSQL_TESTS !== "true" }, async () => {
  const connection = await getPool().getConnection();
  try {
    // Session-local copies shadow application tables. No real member or financial records are edited.
    await connection.query("CREATE TEMPORARY TABLE member_profiles (member_id BIGINT UNSIGNED PRIMARY KEY, user_id BIGINT UNSIGNED, member_code VARCHAR(60), full_name VARCHAR(190), membership_type VARCHAR(30), approval_status VARCHAR(30), official_member_status VARCHAR(30), true_member_since DATE NULL)");
    const migration = readFileSync(path.resolve("server/database/migrations/20261105_membership_upgrade_requests.sql"), "utf8")
      .replace("CREATE TABLE IF NOT EXISTS", "CREATE TEMPORARY TABLE")
      .split("\n").filter((line) => !line.trim().startsWith("CONSTRAINT ")).join("\n").replace(/,\s*\)/, "\n)");
    await connection.query(migration);
    await connection.query("CREATE TEMPORARY TABLE share_capital_payments (share_payment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, member_id BIGINT UNSIGNED, amount DECIMAL(12,2), payment_date DATE, payment_status VARCHAR(30))");
    await connection.query("CREATE TEMPORARY TABLE member_status_history (member_id BIGINT UNSIGNED, old_membership_type VARCHAR(30), new_membership_type VARCHAR(30), old_official_status VARCHAR(30), new_official_status VARCHAR(30), reason TEXT, changed_by BIGINT UNSIGNED)");
    await connection.query("CREATE TEMPORARY TABLE audit_logs (user_id BIGINT UNSIGNED, action VARCHAR(100), entity_table VARCHAR(100), record_id BIGINT UNSIGNED, description TEXT, new_values TEXT)");
    await connection.execute("INSERT INTO member_profiles (member_id, user_id, member_code, full_name, membership_type, approval_status, official_member_status) VALUES (1, 7, 'UPGRADE-TEMP', 'Temporary Associate', 'Associate', 'Approved', 'Active')");
    const transactionalConnection = {
      execute: connection.execute.bind(connection), query: connection.query.bind(connection),
      beginTransaction: connection.beginTransaction.bind(connection), commit: connection.commit.bind(connection),
      rollback: connection.rollback.bind(connection), release() {},
    };
    const pool = { ...transactionalConnection, async getConnection() { return transactionalConnection; } } as unknown as Pool;
    const service = createMembershipUpgradeService(pool);
    const auth: AuthContext = { user: { id: "7", displayName: "Temporary Associate", email: "temp@example.test", username: null, role: "member" }, sessionId: "1", tokenHash: "hash" };
    const chairman: AuthContext = { ...auth, user: { ...auth.user, id: "9", role: "chairman" } };
    await service.apply(auth, "Please review my True Membership application.");
    const pending = (await service.list())[0];
    await assert.rejects(service.apply(auth, "Duplicate"), /already pending/);
    await assert.rejects(service.decide(chairman, String(pending.id), "Approved", "Reviewed"), /PHP 3000/);
    assert.equal((await service.status(auth)).membershipType, "Associate");
    await connection.execute("INSERT INTO share_capital_payments (member_id, amount, payment_date, payment_status) VALUES (1, 3000, CURRENT_DATE(), 'Pending')");
    await assert.rejects(service.decide(chairman, String(pending.id), "Approved", "Reviewed"), /PHP 3000/);
    await connection.execute("UPDATE share_capital_payments SET payment_status = 'Validated' WHERE member_id = 1");
    await service.decide(chairman, String(pending.id), "Approved", "Validated contribution and requirements verified.");
    const status = await service.status(auth);
    assert.equal(status.membershipType, "True Member");
    assert.equal(status.application?.status, "Approved");
    await assert.rejects(service.decide(chairman, String(pending.id), "Rejected", "Duplicate review"), /already been reviewed/);
    const [history] = await connection.execute<RowDataPacket[]>("SELECT * FROM member_status_history WHERE member_id = 1");
    assert.equal(history.length, 1);
    assert.equal(history[0].new_membership_type, "True Member");
  } finally {
    // Temporary tables disappear with the connection.
    connection.destroy();
    await closePool();
  }
});
