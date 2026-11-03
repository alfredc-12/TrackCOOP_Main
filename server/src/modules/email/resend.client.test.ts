import assert from "node:assert/strict";
import test from "node:test";
import { classifyResendError, formatFrom, safeProviderMessage, sendResendEmail, tagValue, type ResendMessage } from "./resend.client";

const message: ResendMessage = {
  from: "TrackCOOP <notifications@notify.example.test>",
  to: "person@example.test",
  replyTo: "support@example.test",
  subject: "Hello",
  text: "Body",
  html: "<p>Body</p>",
  tags: [{ name: "event", value: "membership_application_submitted" }],
};
const options = { apiKey: "re_test_key_value_1234567890" };
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  (async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;

test("a successful send returns Resend's email id and sends the right request", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }), { status: 200 });
  }) as unknown as typeof fetch;
  const outcome = await sendResendEmail({ ...options, fetchImpl }, message, "trackcoop/dedupe-1");
  assert.deepEqual(outcome, { kind: "sent", id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" });
  assert.equal(seen?.url, "https://api.resend.com/emails");
  assert.equal(seen?.init.method, "POST");
  const headers = seen?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${options.apiKey}`);
  assert.equal(headers["Idempotency-Key"], "trackcoop/dedupe-1");
  const body = JSON.parse(String(seen?.init.body));
  assert.deepEqual(body.to, ["person@example.test"]);
  assert.equal(body.reply_to, "support@example.test");
  assert.equal(body.from, message.from);
  assert.equal(body.html, "<p>Body</p>");
  assert.deepEqual(body.tags, message.tags);
});

test("a 2xx answer without an id is not trusted as sent", async () => {
  const outcome = await sendResendEmail({ ...options, fetchImpl: reply(200, {}) }, message, "k");
  assert.equal(outcome.kind, "retry");
  assert.equal(outcome.kind === "retry" && outcome.ambiguous, true);
});

test("rate limits are retried and honour Retry-After", async () => {
  const outcome = await sendResendEmail({ ...options, fetchImpl: reply(429, { name: "rate_limit_exceeded", message: "slow down" }, { "retry-after": "7" }) }, message, "k");
  assert.equal(outcome.kind, "retry");
  assert.equal(outcome.kind === "retry" && outcome.minDelaySeconds, 7);
  assert.equal(outcome.kind === "retry" && outcome.ambiguous, false);
});

test("a daily quota waits until after the next UTC midnight; a monthly quota stops the queue", () => {
  const now = new Date("2026-11-03T22:00:00Z");
  const daily = classifyResendError({ status: 429, name: "daily_quota_exceeded", now });
  assert.equal(daily.kind, "retry");
  assert.equal(daily.kind === "retry" && daily.minDelaySeconds, 2 * 3600 + 60);
  assert.equal(classifyResendError({ status: 429, name: "monthly_quota_exceeded", now }).kind, "systemic");
});

test("server errors and idempotency contention are retried; they are definite answers, not ambiguous", () => {
  const now = new Date();
  for (const [status, name] of [[500, "application_error"], [503, "service_unavailable"], [409, "concurrent_idempotent_requests"], [409, "resource_locked"]] as const) {
    const outcome = classifyResendError({ status, name, now });
    assert.equal(outcome.kind, "retry", `${status} ${name}`);
    assert.equal(outcome.kind === "retry" && outcome.ambiguous, false);
  }
});

test("bad requests and bad recipients are permanent; a reused key with another body is a bug", () => {
  const now = new Date();
  for (const [status, name] of [[400, "validation_error"], [422, "missing_required_field"], [422, "invalid_parameter"], [409, "invalid_idempotent_request"], [400, "invalid_idempotency_key"]] as const) {
    assert.equal(classifyResendError({ status, name, now }).kind, "permanent", `${status} ${name}`);
  }
});

test("key, account and domain problems stop the whole queue instead of failing every message", () => {
  const now = new Date();
  for (const [status, name] of [[401, "missing_api_key"], [401, "validation_error"], [403, "validation_error"], [403, "email_above_quota"], [403, "restricted_api_key"], [403, "suspended_api_key"]] as const) {
    assert.equal(classifyResendError({ status, name, now }).kind, "systemic", `${status} ${name}`);
  }
});

test("a timeout is an ambiguous retry, and the request is actually aborted", async () => {
  let aborted = false;
  const fetchImpl = ((_: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => {
      aborted = true;
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  })) as unknown as typeof fetch;
  const outcome = await sendResendEmail({ ...options, fetchImpl, timeoutMs: 20 }, message, "k");
  assert.equal(aborted, true);
  assert.deepEqual(outcome, { kind: "retry", code: "timeout", message: "The request to Resend timed out.", ambiguous: true });
});

test("a network failure is an ambiguous retry and never leaks the key or the cause", async () => {
  const fetchImpl = (async () => { throw new Error(`socket hang up for ${options.apiKey}`); }) as unknown as typeof fetch;
  const outcome = await sendResendEmail({ ...options, fetchImpl }, message, "k");
  assert.equal(outcome.kind, "retry");
  assert.equal(outcome.kind === "retry" && outcome.ambiguous, true);
  assert.equal(JSON.stringify(outcome).includes(options.apiKey), false);
});

test("provider text is shortened and any API key in it is hidden", () => {
  assert.equal(safeProviderMessage("bad key re_abcdefghij_klmnopqrstuvwx used").includes("re_abcdefghij"), false);
  assert.equal(safeProviderMessage("x".repeat(500)).length, 200);
  assert.equal(safeProviderMessage(undefined), "");
});

test("tags and the From header are made safe", () => {
  assert.equal(tagValue("membership.application:approved 1"), "membership_application_approved_1");
  assert.equal(formatFrom("Track\"COOP\r\n<x>", "a@b.test"), "TrackCOOPx <a@b.test>");
  assert.equal(formatFrom("", "a@b.test"), "a@b.test");
});
