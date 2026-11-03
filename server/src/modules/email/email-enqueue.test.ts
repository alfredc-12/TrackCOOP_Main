import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { parseAllowlist, type EmailConfig } from "./email-config";
import { decryptSecret } from "./email-crypto";
import { enqueueEmail, normalizeEmail, type SqlExecutor } from "./email-outbox.repository";

const secretKey = randomBytes(32);
const config = (overrides: Partial<EmailConfig> = {}): EmailConfig => ({
  mode: "resend",
  stage: "restricted",
  allowlist: ["tester@example.test"],
  fromName: "TrackCOOP",
  fromAddress: "notifications@notify.example.test",
  replyTo: "support@example.test",
  resendApiKey: "re_x",
  secretKey,
  apiPublicUrl: "https://api.example.test",
  frontendUrl: "https://app.example.test",
  ...overrides,
});

type Call = { sql: string; values: unknown[] };
function fakeExecutor(options: { duplicate?: boolean } = {}) {
  const calls: Call[] = [];
  const executor = {
    async execute(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      if (sql.includes("INSERT INTO email_outbox")) {
        if (options.duplicate) throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 });
        return [{ insertId: 11 }, []];
      }
      return [[{ id: "3" }], []];
    },
  } as unknown as SqlExecutor;
  return { executor, calls };
}

// INSERT column order: event, dedupe, coalesce, email, name, payload, secret, status, reason, stage, delay, expires, type, id
const col = { event: 0, dedupe: 1, coalesce: 2, email: 3, name: 4, payload: 5, secret: 6, status: 7, reason: 8, stage: 9, delay: 10 };

const base = { eventKey: "rental.status.updated", dedupeKey: "k:1", payload: { subject: "s", text: "t" } };

test("outside resend mode enqueueing does nothing, so legacy behaviour is untouched", async () => {
  for (const mode of ["disabled", "smtp", "webhook"] as const) {
    const { executor, calls } = fakeExecutor();
    assert.deepEqual(await enqueueEmail(executor, { ...base, to: { email: "a@b.test" } }, config({ mode })), { outcome: "disabled" });
    assert.equal(calls.length, 0);
  }
});

test("an allowlisted recipient is queued as Pending in the current stage", async () => {
  const { executor, calls } = fakeExecutor();
  const result = await enqueueEmail(executor, { ...base, to: { email: "  Tester@Example.test ", name: "Tess" } }, config());
  assert.deepEqual(result, { outcome: "queued", outboxId: "11" });
  assert.equal(calls[0].values[col.email], "tester@example.test");
  assert.equal(calls[0].values[col.status], "Pending");
  assert.equal(calls[0].values[col.stage], "restricted");
});

test("during the restricted stage a real customer's email is stored as Blocked, never queued", async () => {
  const { executor, calls } = fakeExecutor();
  const result = await enqueueEmail(executor, { ...base, to: { email: "real.customer@example.test" }, coalesceKey: "c:1" }, config());
  assert.deepEqual(result, { outcome: "blocked", outboxId: "11", reason: "not_allowlisted" });
  assert.equal(calls[0].values[col.status], "Blocked");
  assert.equal(calls[0].values[col.coalesce], null, "a blocked row must not hold a digest slot");
});

test("in the general stage everyone is queued", async () => {
  const { executor, calls } = fakeExecutor();
  await enqueueEmail(executor, { ...base, to: { email: "real.customer@example.test" } }, config({ stage: "general", allowlist: [] }));
  assert.equal(calls[0].values[col.status], "Pending");
  assert.equal(calls[0].values[col.stage], "general");
});

test("a missing or invalid address is recorded as Skipped so the workflow is never blocked", async () => {
  for (const [email, reason] of [[null, "no_recipient"], ["   ", "no_recipient"], [undefined, "no_recipient"], ["not-an-email", "invalid_recipient"], ["a@b", "invalid_recipient"], ["a b@c.test", "invalid_recipient"]] as const) {
    const { executor, calls } = fakeExecutor();
    const result = await enqueueEmail(executor, { ...base, to: { email } }, config({ stage: "general" }));
    assert.deepEqual(result, { outcome: "skipped", outboxId: "11", reason }, String(email));
    assert.equal(calls[0].values[col.status], "Skipped");
  }
});

test("enqueueing the same event twice is a no-op that returns the first row", async () => {
  const { executor } = fakeExecutor({ duplicate: true });
  assert.deepEqual(await enqueueEmail(executor, { ...base, to: { email: "tester@example.test" } }, config()), { outcome: "duplicate", outboxId: "3" });
});

test("a secret is stored encrypted, bound to the row, and never in the readable payload", async () => {
  const { executor, calls } = fakeExecutor();
  await enqueueEmail(executor, { ...base, dedupeKey: "membership.approved:app:9", payload: { name: "Ana" }, secret: { activationUrl: "https://app.example.test/membership/activate/TOKEN123" }, to: { email: "tester@example.test" } }, config());
  const blob = calls[0].values[col.secret] as Buffer;
  assert.ok(Buffer.isBuffer(blob));
  assert.equal(blob.includes(Buffer.from("TOKEN123")), false);
  assert.equal(String(calls[0].values[col.payload]).includes("TOKEN123"), false);
  assert.deepEqual(JSON.parse(decryptSecret(blob, secretKey, "membership.approved:app:9")), { activationUrl: "https://app.example.test/membership/activate/TOKEN123" });
});

test("queuing a secret without a master key fails loudly instead of storing it in clear", async () => {
  const { executor } = fakeExecutor();
  await assert.rejects(enqueueEmail(executor, { ...base, secret: { activationUrl: "x" }, to: { email: "tester@example.test" } }, config({ secretKey: undefined })), /EMAIL_SECRET_KEY/);
});

test("no secret is stored for a row that will never be sent", async () => {
  const { executor, calls } = fakeExecutor();
  await enqueueEmail(executor, { ...base, secret: { activationUrl: "x" }, to: { email: "outsider@example.test" } }, config());
  assert.equal(calls[0].values[col.secret], null);
});

test("keys are length-checked because the database would truncate silently", async () => {
  const { executor } = fakeExecutor();
  await assert.rejects(enqueueEmail(executor, { ...base, dedupeKey: "x".repeat(191), to: { email: "tester@example.test" } }, config()), /dedupeKey/);
  await assert.rejects(enqueueEmail(executor, { ...base, dedupeKey: "", to: { email: "tester@example.test" } }, config()), /dedupeKey/);
  await assert.rejects(enqueueEmail(executor, { ...base, eventKey: "e".repeat(81), to: { email: "tester@example.test" } }, config()), /eventKey/);
});

test("a delay is applied as seconds from now", async () => {
  const { executor, calls } = fakeExecutor();
  await enqueueEmail(executor, { ...base, delaySeconds: 300, to: { email: "tester@example.test" } }, config());
  assert.equal(calls[0].values[col.delay], 300);
});

test("helpers: addresses and allowlists are normalised", () => {
  assert.equal(normalizeEmail("  A@B.Test "), "a@b.test");
  assert.equal(normalizeEmail(null), "");
  assert.deepEqual(parseAllowlist(" One@x.test, two@x.test ,, "), ["one@x.test", "two@x.test"]);
  assert.deepEqual(parseAllowlist(undefined), []);
});
