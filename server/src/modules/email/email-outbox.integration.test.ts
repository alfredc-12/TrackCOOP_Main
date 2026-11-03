import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { enqueueInformationRequest } from "../membership-applications/membership-outbox";
import type { EmailConfig } from "./email-config";
import { createOutboxStore, enqueueEmail } from "./email-outbox.repository";
import { AMBIGUOUS_WINDOW_HOURS, backoffSeconds, runOutboxOnce, WORKER_LOCK_NAME } from "./email-outbox.worker";

/**
 * Runs against a throwaway MySQL only. It refuses anything that is not a local server and a database whose name ends
 * in _test, so it can never touch application data.
 *   EMAIL_TEST_DB_NAME=trackcoop_email_test EMAIL_TEST_DB_PORT=3398 npm run test:api
 */
const dbName = process.env.EMAIL_TEST_DB_NAME ?? "";
const enabled = /_test$/.test(dbName);
const skip = enabled ? false : "set EMAIL_TEST_DB_NAME=<name>_test (and EMAIL_TEST_DB_PORT) to run against a throwaway MySQL";

const secretKey = randomBytes(32);
const config = (overrides: Partial<EmailConfig> = {}): EmailConfig => ({
  mode: "resend", stage: "general", allowlist: [], fromName: "TrackCOOP", fromAddress: "notifications@notify.example.test", replyTo: "support@example.test",
  resendApiKey: "re_integration_test_key_000000", secretKey, apiPublicUrl: "https://api.example.test", frontendUrl: "https://app.example.test", ...overrides,
});

type Json = Record<string, unknown>;
let pool: Pool;
let turn: PoolConnection;

async function setup() {
  pool = mysql.createPool({
    host: "127.0.0.1", port: Number(process.env.EMAIL_TEST_DB_PORT ?? 3306), user: process.env.EMAIL_TEST_DB_USER ?? "root", password: process.env.EMAIL_TEST_DB_PASSWORD ?? "",
    database: dbName, timezone: "Z", supportBigNumbers: true, bigNumberStrings: true, connectionLimit: 8,
  });
  const [identity] = await pool.query<RowDataPacket[]>("SELECT @@hostname AS host, DATABASE() AS db");
  assert.equal(identity[0].db, dbName);
  // The integration files share one database and run as separate processes: take turns.
  turn = await pool.getConnection();
  await turn.query("SELECT GET_LOCK('trackcoop_email_integration_tests', 300)");
}

async function reset() {
  for (const table of ["email_outbox_attempts", "email_webhook_events", "email_outbox", "notifications", "membership_application_status_history", "membership_application_requirements", "membership_applications"]) {
    await pool.query(`DELETE FROM ${table}`);
  }
}

const rows = async (sql: string, values: unknown[] = []) => (await pool.execute<RowDataPacket[]>(sql, values as never))[0];
const outbox = async (id: string) => (await rows("SELECT * FROM email_outbox WHERE email_outbox_id = ?", [id]))[0];
const makeDue = (id: string) => pool.execute("UPDATE email_outbox SET next_attempt_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND, send_after = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE email_outbox_id = ?", [id]);

const queue = async (key: string, extra: Partial<Parameters<typeof enqueueEmail>[1]> = {}, cfg = config()) => {
  const result = await enqueueEmail(pool, { eventKey: "rental.status.updated", dedupeKey: key, to: { email: "customer@example.test", name: "Customer" }, payload: { subject: `Subject ${key}`, text: `Body ${key}` }, ...extra }, cfg);
  assert.ok("outboxId" in result, JSON.stringify(result));
  return result.outboxId;
};

type FetchCall = { headers: Record<string, string>; body: Json };
function fakeResend(responder: (call: FetchCall, index: number) => { status: number; body: unknown; headers?: Record<string, string> } = (_c, i) => ({ status: 200, body: { id: `resend-${i}` } })) {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const call = { headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) as Json };
    calls.push(call);
    const reply = responder(call, calls.length);
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: reply.headers });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}
const run = (fetchImpl: typeof fetch, overrides: Partial<Parameters<typeof runOutboxOnce>[0]> = {}) =>
  runOutboxOnce({ pool, config: config(), fetchImpl, sleep: async () => undefined, random: () => 0.5, ...overrides });

test("outbox integration", { skip }, async (t) => {
  await setup();
  t.after(async () => {
    await turn.query("SELECT RELEASE_LOCK('trackcoop_email_integration_tests')").catch(() => undefined);
    turn.release();
    await pool.end();
  });
  const step = async (name: string, body: () => Promise<void>) => { await reset(); await t.test(name, body); };

  await step("a queued email is part of the business transaction: committed with it, or gone with it", async () => {
    const rolledBack = await pool.getConnection();
    await rolledBack.beginTransaction();
    await enqueueEmail(rolledBack, { eventKey: "rental.status.updated", dedupeKey: "tx:rollback", to: { email: "a@example.test" }, payload: {} }, config());
    await rolledBack.rollback();
    rolledBack.release();
    assert.equal((await rows("SELECT * FROM email_outbox WHERE dedupe_key = 'tx:rollback'")).length, 0);

    const committed = await pool.getConnection();
    await committed.beginTransaction();
    await enqueueEmail(committed, { eventKey: "rental.status.updated", dedupeKey: "tx:commit", to: { email: "a@example.test" }, payload: {} }, config());
    assert.equal((await rows("SELECT * FROM email_outbox WHERE dedupe_key = 'tx:commit'")).length, 0, "invisible to others until commit");
    await committed.commit();
    committed.release();
    assert.equal((await rows("SELECT * FROM email_outbox WHERE dedupe_key = 'tx:commit'")).length, 1);
  });

  await step("the same event queued twice, even at the same time, is one row", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => enqueueEmail(pool, { eventKey: "rental.status.updated", dedupeKey: "same", to: { email: "a@example.test" }, payload: {} }, config())));
    assert.equal(results.filter((result) => result.outcome === "queued").length, 1);
    assert.equal(results.filter((result) => result.outcome === "duplicate").length, 5);
    assert.equal((await rows("SELECT * FROM email_outbox")).length, 1);
  });

  await step("a worker sends each due email once and records Resend's id, attempt and idempotency key", async () => {
    const ids = [await queue("a"), await queue("b"), await queue("c")];
    const resend = fakeResend();
    const summary = await run(resend.fetchImpl);
    assert.equal(summary.sent, 3);
    assert.deepEqual(resend.calls.map((call) => call.headers["Idempotency-Key"]), ["trackcoop/a", "trackcoop/b", "trackcoop/c"]);
    assert.deepEqual(resend.calls.map((call) => call.body.to), [["customer@example.test"], ["customer@example.test"], ["customer@example.test"]]);
    for (const id of ids) {
      const row = await outbox(id);
      assert.equal(row.status, "Sent");
      assert.ok(row.resend_email_id);
      assert.equal(row.delivery_status, "sent");
    }
    assert.equal((await rows("SELECT * FROM email_outbox_attempts")).length, 3);
    // A second run finds nothing: nothing is ever sent twice.
    assert.equal((await run(resend.fetchImpl)).claimed, 0);
    assert.equal(resend.calls.length, 3);
  });

  await step("two workers at once never send the same email twice", async () => {
    for (let index = 0; index < 12; index += 1) await queue(`race-${index}`);
    const resend = fakeResend();
    const results = await Promise.all([run(resend.fetchImpl), run(resend.fetchImpl), run(resend.fetchImpl)]);
    assert.equal(results.filter((result) => result.ran).length, 1, "the database lock lets one run at a time");
    assert.equal(results.filter((result) => result.reason === "locked").length, 2);
    assert.equal(resend.calls.length, 12);
    assert.equal(new Set(resend.calls.map((call) => call.headers["Idempotency-Key"])).size, 12);
  });

  await step("even without the run lock, atomic claiming hands each row to exactly one worker", async () => {
    for (let index = 0; index < 30; index += 1) await queue(`claim-${index}`);
    const store = createOutboxStore(pool);
    const batches = await Promise.all(["w1", "w2", "w3", "w4"].map((token) => store.claim(token, 100)));
    const all = batches.flat().map((row) => row.id);
    assert.equal(all.length, 30);
    assert.equal(new Set(all).size, 30);
  });

  await step("the run lock is released at the end of a run, so the next cron tick can run", async () => {
    await queue("x");
    const resend = fakeResend();
    assert.equal((await run(resend.fetchImpl)).ran, true);
    const [free] = await rows("SELECT IS_FREE_LOCK(?) AS free", [WORKER_LOCK_NAME]);
    assert.equal(Number(free.free), 1);
    assert.equal((await run(resend.fetchImpl)).ran, true);
  });

  await step("a temporary failure is retried later with the same idempotency key and then succeeds", async () => {
    const id = await queue("retry-me");
    const resend = fakeResend((_call, index) => (index === 1 ? { status: 500, body: { name: "application_error", message: "boom" } } : { status: 200, body: { id: "resend-ok" } }));
    const first = await run(resend.fetchImpl);
    assert.equal(first.retried, 1);
    let row = await outbox(id);
    assert.equal(row.status, "Pending");
    assert.equal(row.attempt_count, 1);
    assert.equal(row.last_error_code, "application_error");
    assert.ok(new Date(row.next_attempt_at).getTime() > Date.now() + 30_000, "backed off");
    assert.equal((await run(resend.fetchImpl)).claimed, 0, "not due yet");
    await makeDue(id);
    assert.equal((await run(resend.fetchImpl)).sent, 1);
    row = await outbox(id);
    assert.equal(row.status, "Sent");
    assert.equal(row.attempt_count, 2);
    assert.equal(row.last_error_code, null);
    assert.deepEqual(resend.calls.map((call) => call.headers["Idempotency-Key"]), ["trackcoop/retry-me", "trackcoop/retry-me"]);
  });

  await step("a permanent failure stops retrying and keeps a safe reason", async () => {
    const id = await queue("permanent");
    const resend = fakeResend(() => ({ status: 422, body: { name: "invalid_parameter", message: "Invalid `to` field." } }));
    assert.equal((await run(resend.fetchImpl)).failed, 1);
    const row = await outbox(id);
    assert.equal(row.status, "Failed");
    assert.equal(row.last_error_code, "invalid_parameter");
    await makeDue(id);
    assert.equal((await run(resend.fetchImpl)).claimed, 0);
    assert.equal(resend.calls.length, 1);
  });

  await step("an email that keeps failing gives up after the attempt limit", async () => {
    const id = await queue("exhaust");
    await pool.execute("UPDATE email_outbox SET attempt_count = 9 WHERE email_outbox_id = ?", [id]);
    const resend = fakeResend(() => ({ status: 503, body: { name: "service_unavailable", message: "down" } }));
    assert.equal((await run(resend.fetchImpl)).failed, 1);
    assert.equal((await outbox(id)).last_error_code, "retries_exhausted");
  });

  await step("a rejected key stops the whole batch and gives the rest back untouched", async () => {
    const ids = [await queue("s1"), await queue("s2"), await queue("s3")];
    const resend = fakeResend(() => ({ status: 401, body: { name: "missing_api_key", message: "no" } }));
    const summary = await run(resend.fetchImpl);
    assert.equal(summary.systemic, "missing_api_key");
    assert.equal(resend.calls.length, 1, "no point asking again for the others");
    for (const id of ids) {
      const row = await outbox(id);
      assert.equal(row.status, "Pending");
      assert.equal(row.attempt_count, 0, "no attempt was spent");
      assert.ok(new Date(row.next_attempt_at).getTime() > Date.now() + 10 * 60_000);
    }
  });

  await step("a rate limit waits at least as long as Resend asks", async () => {
    const id = await queue("rate");
    const resend = fakeResend(() => ({ status: 429, body: { name: "rate_limit_exceeded", message: "slow" }, headers: { "retry-after": "900" } }));
    await run(resend.fetchImpl);
    assert.ok(new Date((await outbox(id)).next_attempt_at).getTime() >= Date.now() + 890_000);
  });

  await step("a crashed worker's emails are recovered, and flagged so a duplicate is avoided", async () => {
    const id = await queue("crash");
    const store = createOutboxStore(pool);
    await store.claim("dead-worker", 10, 300);
    await pool.execute("UPDATE email_outbox SET locked_until = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE email_outbox_id = ?", [id]);
    const resend = fakeResend();
    const summary = await run(resend.fetchImpl);
    assert.equal(summary.reclaimed, 1);
    assert.equal(summary.sent, 1);
    assert.equal(resend.calls[0].headers["Idempotency-Key"], "trackcoop/crash", "same key as the unfinished attempt, so Resend de-duplicates");
    assert.equal((await outbox(id)).ambiguous_since, null, "cleared after a definite answer");
  });

  await step("a row that is still being sent by a live worker is left alone", async () => {
    await queue("live");
    const store = createOutboxStore(pool);
    await store.claim("live-worker", 10, 300);
    const resend = fakeResend();
    const summary = await run(resend.fetchImpl);
    assert.equal(summary.reclaimed, 0);
    assert.equal(resend.calls.length, 0);
  });

  await step("after an unanswered attempt, nothing is re-sent once Resend would no longer recognise the key", async () => {
    const id = await queue("ambiguous");
    await pool.execute("UPDATE email_outbox SET ambiguous_since = UTC_TIMESTAMP() - INTERVAL ? HOUR WHERE email_outbox_id = ?", [AMBIGUOUS_WINDOW_HOURS + 1, id]);
    const resend = fakeResend();
    assert.equal((await run(resend.fetchImpl)).failed, 1);
    assert.equal(resend.calls.length, 0);
    const row = await outbox(id);
    assert.equal(row.status, "Failed");
    assert.equal(row.last_error_code, "needs_review");
  });

  await step("an unanswered attempt within the window is retried, and a timeout is remembered as ambiguous", async () => {
    const id = await queue("timeout");
    const resend = fakeResend(() => { throw new Error("socket hang up"); });
    await run(resend.fetchImpl);
    const row = await outbox(id);
    assert.equal(row.status, "Pending");
    assert.ok(row.ambiguous_since, "marked ambiguous");
  });

  await step("a run stops when its time is up and gives the unprocessed emails back", async () => {
    for (let index = 0; index < 5; index += 1) await queue(`slow-${index}`);
    let clock = 0;
    const resend = fakeResend();
    const summary = await run(resend.fetchImpl, { maxRunMs: 1000, now: () => new Date(Date.UTC(2026, 10, 3) + (clock += 600)) });
    assert.ok(summary.sent >= 1 && summary.sent < 5, `sent ${summary.sent}`);
    const pending = await rows("SELECT * FROM email_outbox WHERE status = 'Pending'");
    assert.equal(pending.length, 5 - summary.sent);
    assert.ok(pending.every((row) => Number(row.attempt_count) === 0));
  });

  await step("a send is paced, never faster than the configured interval", async () => {
    await queue("p1");
    await queue("p2");
    const sleeps: number[] = [];
    await run(fakeResend().fetchImpl, { sendIntervalMs: 250, sleep: async (ms) => { sleeps.push(ms); } });
    assert.deepEqual(sleeps, [250, 250]);
  });

  await step("restricted stage: only allowlisted recipients are queued, everyone else is Blocked and never sent", async () => {
    const restricted = config({ stage: "restricted", allowlist: ["tester@example.test"] });
    const allowed = await queue("allowed", { to: { email: "tester@example.test" } }, restricted);
    const blocked = await queue("blocked", { to: { email: "real.customer@example.test" } }, restricted);
    assert.equal((await outbox(blocked)).status, "Blocked");
    const resend = fakeResend();
    await run(resend.fetchImpl, { config: restricted });
    assert.equal(resend.calls.length, 1);
    assert.deepEqual(resend.calls[0].body.to, ["tester@example.test"]);
    assert.equal((await outbox(allowed)).status, "Sent");
    assert.equal((await outbox(blocked)).status, "Blocked");
  });

  await step("removing the allowlist never releases blocked messages; only the explicit action, and not old ones", async () => {
    const restricted = config({ stage: "restricted", allowlist: ["tester@example.test"] });
    const fresh = await queue("fresh-blocked", { to: { email: "one@example.test" } }, restricted);
    const old = await queue("old-blocked", { to: { email: "two@example.test" } }, restricted);
    await pool.execute("UPDATE email_outbox SET created_at = UTC_TIMESTAMP() - INTERVAL 3 DAY WHERE email_outbox_id = ?", [old]);
    const resend = fakeResend();
    assert.equal((await run(resend.fetchImpl, { config: config({ stage: "general" }) })).claimed, 0);
    assert.equal(resend.calls.length, 0, "going live does not send the test-stage backlog");
    const store = createOutboxStore(pool);
    assert.equal(await store.releaseBlocked([fresh, old], "general"), 1, "the 3-day-old one is refused");
    assert.equal((await outbox(old)).status, "Blocked");
    await run(resend.fetchImpl, { config: config({ stage: "general" }) });
    assert.equal(resend.calls.length, 1);
  });

  await step("mail queued under one stage is cancelled, not sent, when the stage changes", async () => {
    const restricted = config({ stage: "restricted", allowlist: ["tester@example.test"] });
    const id = await queue("stage", { to: { email: "tester@example.test" } }, restricted);
    const resend = fakeResend();
    const summary = await run(resend.fetchImpl, { config: config({ stage: "general" }) });
    assert.equal(summary.cancelled, 1);
    assert.equal(resend.calls.length, 0);
    assert.equal((await outbox(id)).skip_reason, "stage_changed");
  });

  await step("a recipient taken off the allowlist after queueing is dropped at send time", async () => {
    const id = await queue("late-remove", { to: { email: "tester@example.test" } }, config({ stage: "restricted", allowlist: ["tester@example.test"] }));
    const resend = fakeResend();
    const summary = await run(resend.fetchImpl, { config: config({ stage: "restricted", allowlist: ["someone.else@example.test"] }) });
    assert.equal(summary.dropped, 1);
    assert.equal(resend.calls.length, 0);
    assert.equal((await outbox(id)).skip_reason, "not_allowlisted");
  });

  await step("missing and invalid addresses are Skipped and never reach the provider", async () => {
    const none = await queue("none", { to: { email: null } });
    const bad = await queue("bad", { to: { email: "nope" } });
    const resend = fakeResend();
    await run(resend.fetchImpl);
    assert.equal(resend.calls.length, 0);
    assert.equal((await outbox(none)).skip_reason, "no_recipient");
    assert.equal((await outbox(bad)).skip_reason, "invalid_recipient");
  });

  await step("an activation link is encrypted at rest, goes out once, and is erased after sending", async () => {
    const link = "https://app.example.test/membership/activate/SECRETTOKEN-9f8e7d";
    const expires = new Date(Date.now() + 72 * 3600_000);
    const message = "Approved. Activate here: {{ACTIVATION_URL}}\nThis link can be used once and expires on {{ACTIVATION_EXPIRES}}.";
    const id = await queue("membership.approved:app:1", {
      eventKey: "membership.application.approved",
      payload: { name: "Ana", applicationCode: "MEM-APP-1", status: "Approved", subject: "Approved", message, activationExpiresAt: expires.toISOString() },
      secret: { activationUrl: link }, expiresAt: expires, related: { type: "membership_applications", id: "1" },
    });
    const stored = await outbox(id);
    assert.equal(Buffer.from(stored.secret_payload_enc).includes(Buffer.from("SECRETTOKEN")), false);
    assert.equal(JSON.stringify(stored.payload_json).includes("SECRETTOKEN"), false);
    const resend = fakeResend();
    await run(resend.fetchImpl);
    assert.ok(String(resend.calls[0].body.text).includes(link), "the member receives the real link");
    const after = await outbox(id);
    assert.equal(after.status, "Sent");
    assert.equal(after.secret_payload_enc, null, "the link is gone once sent");
    const everything = JSON.stringify([await rows("SELECT * FROM email_outbox"), await rows("SELECT * FROM email_outbox_attempts")]);
    assert.equal(everything.includes("SECRETTOKEN"), false, "no table holds the token afterwards");
  });

  await step("an unsent activation email stops being sendable once the link expires, and the secret is wiped", async () => {
    const id = await queue("membership.approved:app:2", {
      eventKey: "membership.application.approved", payload: { subject: "s", message: "{{ACTIVATION_URL}}" }, secret: { activationUrl: "https://app.example.test/membership/activate/OLD" },
      expiresAt: new Date(Date.now() + 60_000),
    });
    await pool.execute("UPDATE email_outbox SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE email_outbox_id = ?", [id]);
    const resend = fakeResend();
    await run(resend.fetchImpl);
    const row = await outbox(id);
    assert.equal(row.status, "Cancelled");
    assert.equal(row.secret_payload_enc, null);
    assert.equal(resend.calls.length, 0);
  });

  await step("a permanently failed approval email alerts the Chairman with no link or token", async () => {
    await pool.query("INSERT IGNORE INTO roles (role_name, role_slug) VALUES ('Chairman', 'chairman')");
    const [role] = await rows("SELECT role_id FROM roles WHERE role_slug = 'chairman'");
    await pool.execute("DELETE FROM users WHERE email = 'chair@example.test'");
    await pool.execute("INSERT INTO users (role_id, email, password_hash, display_name, account_status) VALUES (?, 'chair@example.test', 'x', 'Chair', 'Active')", [role.role_id]);
    await queue("membership.approved:app:3", {
      eventKey: "membership.application.approved", payload: { applicationCode: "MEM-APP-3", subject: "s", message: "{{ACTIVATION_URL}}" },
      secret: { activationUrl: "https://app.example.test/membership/activate/NEVERLOG" }, related: { type: "membership_applications", id: "3" },
    });
    await run(fakeResend(() => ({ status: 422, body: { name: "invalid_parameter", message: "bad" } })).fetchImpl);
    const notices = await rows("SELECT * FROM notifications WHERE title = 'Membership approval email could not be sent'");
    assert.equal(notices.length, 1);
    assert.match(String(notices[0].message), /MEM-APP-3/);
    assert.equal(JSON.stringify(notices).includes("NEVERLOG"), false);
    assert.equal(/https?:/.test(String(notices[0].message)), false);
    await pool.execute("DELETE FROM users WHERE email = 'chair@example.test'");
  });

  await step("a failure of an ordinary email does not alert the Chairman", async () => {
    await queue("ordinary");
    await run(fakeResend(() => ({ status: 422, body: { name: "invalid_parameter", message: "bad" } })).fetchImpl);
    assert.equal((await rows("SELECT * FROM notifications")).length, 0);
  });

  await step("information requests inside the window collapse into one digest built from the latest state", async () => {
    await pool.execute("INSERT INTO membership_applications (membership_application_id, application_code, public_tracking_token_hash, first_name, last_name, contact_number, current_address, terms_version, applicant_signature_name, signed_at, signed_place, application_status) VALUES (501, 'MEM-APP-000501', REPEAT('a', 64), 'Ana', 'Reyes', '0', 'x', 'v1', 'Ana', NOW(), 'x', 'Needs Information')");
    await pool.execute("INSERT INTO membership_application_requirements (membership_application_id, requirement_type, requirement_status, remarks) VALUES (501, 'Valid ID', 'Pending', 'Front and back'), (501, 'Proof of Residency', 'Pending', NULL)");
    await pool.execute("INSERT INTO membership_application_status_history (membership_application_id, new_status, applicant_message) VALUES (501, 'Needs Information', 'Please send clear photos.')");
    const application = { applicationId: "501", applicationCode: "MEM-APP-000501", email: "ana@example.test", name: "Ana Reyes" };
    await enqueueInformationRequest(pool, application, config());
    await enqueueInformationRequest(pool, application, config());
    await enqueueInformationRequest(pool, application, config());
    const queued = await rows("SELECT * FROM email_outbox");
    assert.equal(queued.length, 1, "three triggers, one email");
    assert.ok(new Date(queued[0].send_after).getTime() > Date.now() + 4 * 60_000, "held for about five minutes");

    const resend = fakeResend();
    assert.equal((await run(resend.fetchImpl)).claimed, 0, "not before the window ends");
    await makeDue(String(queued[0].email_outbox_id));
    // The applicant uploads one of the two files in the meantime: the email reflects what is still missing.
    await pool.execute("UPDATE membership_application_requirements SET requirement_status = 'Submitted' WHERE requirement_type = 'Valid ID'");
    assert.equal((await run(resend.fetchImpl)).sent, 1);
    const text = String(resend.calls[0].body.text);
    assert.match(text, /Proof of Residency/);
    assert.equal(text.includes("Valid ID"), false);
    assert.match(text, /Please send clear photos\./);
    assert.equal((text.match(/application-status\?code=/g) ?? []).length, 1);

    // After it was sent, a fresh request is allowed again (the slot is free).
    await pool.execute("UPDATE membership_application_requirements SET requirement_status = 'Rejected' WHERE requirement_type = 'Valid ID'");
    await enqueueInformationRequest(pool, application, config());
    assert.equal((await rows("SELECT * FROM email_outbox")).length, 2);
  });

  await step("a digest whose requirements were all supplied before the window ended is cancelled, not sent", async () => {
    await pool.execute("INSERT INTO membership_applications (membership_application_id, application_code, public_tracking_token_hash, first_name, last_name, contact_number, current_address, terms_version, applicant_signature_name, signed_at, signed_place, application_status) VALUES (502, 'MEM-APP-000502', REPEAT('b', 64), 'Ben', 'Cruz', '0', 'x', 'v1', 'Ben', NOW(), 'x', 'Under Review')");
    await enqueueInformationRequest(pool, { applicationId: "502", applicationCode: "MEM-APP-000502", email: "ben@example.test", name: "Ben" }, config());
    await pool.execute("UPDATE email_outbox SET send_after = UTC_TIMESTAMP() - INTERVAL 1 SECOND, next_attempt_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND");
    const resend = fakeResend();
    assert.equal((await run(resend.fetchImpl)).dropped, 1);
    assert.equal(resend.calls.length, 0);
    await pool.execute("DELETE FROM membership_applications WHERE membership_application_id IN (501, 502)");
  });

  await step("delivery events update the status, in order, however many times and in whatever order they arrive", async () => {
    const id = await queue("delivery");
    await run(fakeResend(() => ({ status: 200, body: { id: "resend-delivery-1" } })).fetchImpl);
    const store = createOutboxStore(pool);
    assert.equal(await store.applyDeliveryStatus("resend-delivery-1", "delivered"), true);
    assert.equal((await outbox(id)).delivery_status, "delivered");
    await store.applyDeliveryStatus("resend-delivery-1", "sent");
    await store.applyDeliveryStatus("resend-delivery-1", "delayed");
    assert.equal((await outbox(id)).delivery_status, "delivered", "a late older event cannot move it back");
    await store.applyDeliveryStatus("resend-delivery-1", "bounced");
    await store.applyDeliveryStatus("resend-delivery-1", "delivered");
    assert.equal((await outbox(id)).delivery_status, "bounced");
    assert.equal(await store.applyDeliveryStatus("resend-unknown", "delivered"), false);
    assert.equal(await store.recordWebhookEvent("msg_1", "email.delivered", "resend-delivery-1", true), true);
    assert.equal(await store.recordWebhookEvent("msg_1", "email.delivered", "resend-delivery-1", true), false, "the same delivery twice is recognised");
    assert.equal(await store.findByResendId("resend-delivery-1"), id);
  });

  await step("a delivery event that arrives before the send was recorded is applied afterwards", async () => {
    const id = await queue("early-event");
    const store = createOutboxStore(pool);
    await store.recordWebhookEvent("msg_early", "email.delivered", "resend-early", false);
    await store.claim("w", 10);
    await store.markSent(id, "resend-early");
    assert.equal((await outbox(id)).delivery_status, "delivered");
  });

  await step("the stored email never contains the API key, and attempts hold only codes", async () => {
    await queue("hygiene");
    await run(fakeResend(() => ({ status: 500, body: { name: "application_error", message: "token re_integration_test_key_000000 leaked" } })).fetchImpl);
    const everything = JSON.stringify([await rows("SELECT * FROM email_outbox"), await rows("SELECT * FROM email_outbox_attempts")]);
    assert.equal(everything.includes("re_integration_test_key_000000"), false);
  });

});

test("backoff grows, is capped, and is jittered within 20 percent", { skip: false }, () => {
  const middle = () => 0.5;
  assert.deepEqual([1, 2, 3, 4, 5].map((attempt) => backoffSeconds(attempt, middle)), [60, 120, 240, 480, 960]);
  assert.equal(backoffSeconds(30, middle), 6 * 3600);
  assert.equal(backoffSeconds(1, () => 0), 48);
  assert.equal(backoffSeconds(1, () => 1), 72);
  assert.equal(backoffSeconds(0, middle), 60);
});
