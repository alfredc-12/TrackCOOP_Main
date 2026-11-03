import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";

/**
 * Activation links against a throwaway MySQL (see email-outbox.integration.test.ts for the safety rules).
 * The application's own pool is pointed at that database before anything imports it.
 */
const dbName = process.env.EMAIL_TEST_DB_NAME ?? "";
const enabled = /_test$/.test(dbName);
const skip = enabled ? false : "set EMAIL_TEST_DB_NAME=<name>_test (and EMAIL_TEST_DB_PORT) to run against a throwaway MySQL";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

test("activation link integration", { skip }, async (t) => {
  Object.assign(process.env, {
    DB_HOST: "127.0.0.1", DB_SSL: "false", DB_PORT: process.env.EMAIL_TEST_DB_PORT ?? "3306", DB_NAME: dbName, DB_USER: process.env.EMAIL_TEST_DB_USER ?? "root", DB_PASSWORD: process.env.EMAIL_TEST_DB_PASSWORD ?? "",
    EMAIL_DELIVERY: "resend", EMAIL_RELEASE_STAGE: "general", RESEND_API_KEY: "re_integration_test_key_000000", EMAIL_FROM_ADDRESS: "notifications@notify.example.test",
    EMAIL_SECRET_KEY: randomBytes(32).toString("base64"), API_PUBLIC_URL: "https://api.example.test", FRONTEND_URL: "https://app.example.test", BCRYPT_ROUNDS: "10",
  });
  const { getPool, closePool } = await import("../../db/pool");
  const { createMembershipRepository } = await import("./membership.repository");
  const pool = getPool();
  const repository = createMembershipRepository(pool);
  // The integration files share one database and run as separate processes: take turns.
  const turn = await pool.getConnection();
  await turn.query("SELECT GET_LOCK('trackcoop_email_integration_tests', 300)");
  t.after(async () => {
    await turn.query("SELECT RELEASE_LOCK('trackcoop_email_integration_tests')").catch(() => undefined);
    turn.release();
    await closePool();
  });

  const rows = async (sql: string, values: unknown[] = []) => (await pool.execute<RowDataPacket[]>(sql, values as never))[0];

  async function fixture(status = "Pending") {
    for (const table of ["email_outbox_attempts", "email_outbox", "audit_logs", "user_activation_tokens", "membership_account_activations", "member_profiles", "users"]) await pool.query(`DELETE FROM ${table}`);
    const [role] = await rows("SELECT role_id FROM roles WHERE role_slug = 'member'");
    const [created] = await pool.execute("INSERT INTO users (role_id, email, password_hash, display_name, account_status) VALUES (?, 'member@example.test', 'x', 'Ana Reyes', ?)", [role.role_id, status]) as unknown as [{ insertId: number }];
    return String(created.insertId);
  }
  const token = async (userId: string, raw: string, expiresSql: string, usedSql = "NULL", createdSql = "UTC_TIMESTAMP() - INTERVAL 1 DAY") =>
    pool.query(`INSERT INTO user_activation_tokens (user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ${expiresSql}, ${usedSql}, ${createdSql})`, [userId, sha(raw)]);

  await t.test("a valid link activates the account exactly once", async () => {
    const userId = await fixture();
    await token(userId, "good-token", "UTC_TIMESTAMP() + INTERVAL 1 HOUR");
    await repository.activate("good-token", "A-strong-passphrase-1");
    assert.equal((await rows("SELECT account_status FROM users WHERE user_id = ?", [userId]))[0].account_status, "Active");
    await assert.rejects(repository.activate("good-token", "Another-passphrase-2"), (error: { statusCode?: number; code?: string }) => error.code === "ACTIVATION_INVALID");
  });

  await t.test("an expired link is refused and the account stays inactive", async () => {
    const userId = await fixture();
    await token(userId, "old-token", "UTC_TIMESTAMP() - INTERVAL 1 SECOND");
    await assert.rejects(repository.activate("old-token", "A-strong-passphrase-1"), (error: { code?: string }) => error.code === "ACTIVATION_INVALID");
    assert.equal((await rows("SELECT account_status FROM users WHERE user_id = ?", [userId]))[0].account_status, "Pending");
  });

  await t.test("an expired approval-time link (the original table) is refused too", async () => {
    const userId = await fixture();
    await pool.query("DELETE FROM membership_applications");
    await pool.execute("INSERT INTO membership_applications (membership_application_id, application_code, public_tracking_token_hash, first_name, last_name, contact_number, current_address, terms_version, applicant_signature_name, signed_at, signed_place, application_status) VALUES (701, 'MEM-APP-000701', REPEAT('c', 64), 'Ana', 'Reyes', '0', 'x', 'v1', 'Ana', NOW(), 'x', 'Approved')");
    await pool.execute("INSERT INTO membership_account_activations (membership_application_id, user_id, token_hash, expires_at, created_by) VALUES (701, ?, ?, UTC_TIMESTAMP() - INTERVAL 1 SECOND, ?)", [userId, sha("approval-token"), userId]);
    await assert.rejects(repository.activate("approval-token", "A-strong-passphrase-1"), (error: { code?: string }) => error.code === "ACTIVATION_INVALID");
    assert.equal((await rows("SELECT account_status FROM users WHERE user_id = ?", [userId]))[0].account_status, "Pending");
    await pool.query("DELETE FROM membership_account_activations");
    await pool.query("DELETE FROM membership_applications WHERE membership_application_id = 701");
  });

  await t.test("a replacement link goes only to an eligible pending member, is queued encrypted, and replaces the old link", async () => {
    const userId = await fixture();
    await token(userId, "first-link", "UTC_TIMESTAMP() + INTERVAL 1 HOUR");
    const issued = await repository.requestActivationReplacement("  Member@Example.test ");
    assert.ok(issued);
    assert.equal(issued.email, "member@example.test");
    assert.ok(issued.expiresAt.getTime() > Date.now() + 71 * 3600_000 && issued.expiresAt.getTime() < Date.now() + 73 * 3600_000, "72 hours");

    const queued = await rows("SELECT * FROM email_outbox");
    assert.equal(queued.length, 1);
    assert.equal(queued[0].event_key, "membership.activation.replacement");
    assert.equal(Buffer.from(queued[0].secret_payload_enc).includes(Buffer.from(issued.activationUrl.split("/").pop()!)), false, "token is encrypted at rest");
    assert.equal(JSON.stringify(queued[0].payload_json).includes(issued.activationUrl), false);
    assert.equal((await rows("SELECT * FROM audit_logs WHERE action = 'membership.activation_replacement_requested'")).length, 1);
    assert.equal(JSON.stringify(await rows("SELECT * FROM audit_logs")).includes(issued.activationUrl.split("/").pop()!), false, "the audit trail never holds the token");

    await assert.rejects(repository.activate("first-link", "A-strong-passphrase-1"), (error: { code?: string }) => error.code === "ACTIVATION_INVALID", "the earlier link no longer works");
    await repository.activate(decodeURIComponent(issued.activationUrl.split("/").pop()!), "A-strong-passphrase-1");
    assert.equal((await rows("SELECT account_status FROM users WHERE user_id = ?", [userId]))[0].account_status, "Active");
  });

  await t.test("asking again straight away does not send another link (cool-down), and the answer reveals nothing", async () => {
    const userId = await fixture();
    await token(userId, "first-link", "UTC_TIMESTAMP() + INTERVAL 1 HOUR");
    assert.ok(await repository.requestActivationReplacement("member@example.test"));
    assert.equal(await repository.requestActivationReplacement("member@example.test"), null);
    assert.equal((await rows("SELECT * FROM email_outbox")).length, 1);
  });

  await t.test("unknown addresses, active members and accounts that never had an activation link get nothing", async () => {
    await fixture();
    assert.equal(await repository.requestActivationReplacement("nobody@example.test"), null, "unknown");
    assert.equal(await repository.requestActivationReplacement("member@example.test"), null, "never had a link");
    const activeId = await fixture("Active");
    await token(activeId, "t", "UTC_TIMESTAMP() + INTERVAL 1 HOUR");
    assert.equal(await repository.requestActivationReplacement("member@example.test"), null, "already active");
    assert.equal((await rows("SELECT * FROM email_outbox")).length, 0);
  });
});
