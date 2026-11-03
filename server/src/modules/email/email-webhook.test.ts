import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import test from "node:test";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import { deliveryRank, deliveryStatusForEvent, type OutboxStore } from "./email-outbox.repository";
import { createResendWebhookRouter, handleResendWebhook, verifySvixSignature } from "./email-webhook";

const secretBytes = randomBytes(24);
const secret = `whsec_${secretBytes.toString("base64")}`;
const now = 1_800_000_000;

/** Signs exactly as Svix documents it, independent of the implementation under test. */
function sign(id: string, timestamp: number, body: string, key = secretBytes) {
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}

const body = JSON.stringify({ type: "email.delivered", created_at: "2026-11-03T00:00:00Z", data: { email_id: "re-123" } });

test("a correctly signed, fresh webhook verifies", () => {
  assert.equal(verifySvixSignature({ secret, headers: { id: "msg_1", timestamp: String(now), signature: sign("msg_1", now, body) }, rawBody: body, nowSeconds: now }), true);
});

test("a header with several signatures verifies if any one is valid", () => {
  const header = `v1,AAAA ${sign("msg_1", now, body)} v2,BBBB`;
  assert.equal(verifySvixSignature({ secret, headers: { id: "msg_1", timestamp: String(now), signature: header }, rawBody: body, nowSeconds: now }), true);
});

test("wrong secret, altered body, altered id or timestamp, and unknown versions are rejected", () => {
  const good = { id: "msg_1", timestamp: String(now), signature: sign("msg_1", now, body) };
  assert.equal(verifySvixSignature({ secret: `whsec_${randomBytes(24).toString("base64")}`, headers: good, rawBody: body, nowSeconds: now }), false);
  assert.equal(verifySvixSignature({ secret, headers: good, rawBody: `${body} `, nowSeconds: now }), false);
  assert.equal(verifySvixSignature({ secret, headers: { ...good, id: "msg_2" }, rawBody: body, nowSeconds: now }), false);
  assert.equal(verifySvixSignature({ secret, headers: { ...good, timestamp: String(now + 1) }, rawBody: body, nowSeconds: now }), false);
  assert.equal(verifySvixSignature({ secret, headers: { ...good, signature: good.signature.replace("v1,", "v2,") }, rawBody: body, nowSeconds: now }), false);
  assert.equal(verifySvixSignature({ secret, headers: { id: "msg_1", timestamp: String(now) }, rawBody: body, nowSeconds: now }), false);
});

test("a replayed (stale) or future-dated webhook is rejected", () => {
  const stale = now - 301;
  assert.equal(verifySvixSignature({ secret, headers: { id: "m", timestamp: String(stale), signature: sign("m", stale, body) }, rawBody: body, nowSeconds: now }), false);
  const future = now + 301;
  assert.equal(verifySvixSignature({ secret, headers: { id: "m", timestamp: String(future), signature: sign("m", future, body) }, rawBody: body, nowSeconds: now }), false);
  const edge = now - 300;
  assert.equal(verifySvixSignature({ secret, headers: { id: "m", timestamp: String(edge), signature: sign("m", edge, body) }, rawBody: body, nowSeconds: now }), true);
  assert.equal(verifySvixSignature({ secret, headers: { id: "m", timestamp: "not-a-number", signature: "v1,x" }, rawBody: body, nowSeconds: now }), false);
});

test("delivery events map to statuses, and a late 'sent' can never overwrite 'delivered'", () => {
  assert.equal(deliveryStatusForEvent("email.delivered"), "delivered");
  assert.equal(deliveryStatusForEvent("email.delivery_delayed"), "delayed");
  assert.equal(deliveryStatusForEvent("email.bounced"), "bounced");
  assert.equal(deliveryStatusForEvent("email.opened"), null);
  assert.ok(deliveryRank("delivered") > deliveryRank("delayed"));
  assert.ok(deliveryRank("delayed") > deliveryRank("sent"));
  assert.ok(deliveryRank("bounced") > deliveryRank("delivered"));
  assert.equal(deliveryRank("bounced"), deliveryRank("suppressed"));
});

function fakeStore(overrides: Partial<Record<string, unknown>> = {}) {
  const log: string[] = [];
  const seen = new Set<string>();
  const store = {
    async applyDeliveryStatus(id: string, status: string) { log.push(`apply:${id}:${status}`); return id === "re-123"; },
    async findByResendId(id: string) { return id === "re-123" ? "9" : null; },
    async recordWebhookEvent(svixId: string, type: string, emailId: string | null, matched: boolean) {
      log.push(`record:${svixId}:${type}:${emailId}:${matched}`);
      if (seen.has(svixId)) return false;
      seen.add(svixId);
      return true;
    },
    ...overrides,
  } as unknown as OutboxStore;
  return { store, log };
}

function app(store: OutboxStore, webhookSecret: string | null = secret) {
  const server = express();
  server.use("/api/webhooks/resend", createResendWebhookRouter({ store, secret: webhookSecret ?? undefined, now: () => now * 1000 }));
  server.use((req, _res, next) => { req.requestId = "t"; next(); });
  server.use(errorHandler);
  return server;
}

const post = (server: express.Express, payload: string, headers: Record<string, string>) =>
  request(server).post("/api/webhooks/resend").set("Content-Type", "application/json").set(headers).send(payload);

const signedHeaders = (id: string, payload = body) => ({ "svix-id": id, "svix-timestamp": String(now), "svix-signature": sign(id, now, payload) });

test("the webhook route accepts a valid delivery event and updates the matching email", async () => {
  const { store, log } = fakeStore();
  const response = await post(app(store), body, signedHeaders("msg_a"));
  assert.equal(response.status, 200);
  assert.deepEqual(log, ["apply:re-123:delivered", "record:msg_a:email.delivered:re-123:true"]);
});

test("the same delivery sent twice is applied safely and reported as a duplicate", async () => {
  const { store } = fakeStore();
  const server = app(store);
  assert.equal((await post(server, body, signedHeaders("msg_b"))).body.data.duplicate, undefined);
  const second = await post(server, body, signedHeaders("msg_b"));
  assert.equal(second.status, 200);
  assert.equal(second.body.data.duplicate, true);
});

test("an invalid signature is refused and changes nothing; a missing secret is a clear 503", async () => {
  const { store, log } = fakeStore();
  const bad = await post(app(store), body, { ...signedHeaders("msg_c"), "svix-signature": "v1,AAAA" });
  assert.equal(bad.status, 401);
  assert.deepEqual(log, []);
  const unconfigured = await post(app(store, null), body, signedHeaders("msg_d"));
  assert.equal(unconfigured.status, 503);
});

test("an event for an email we do not know is acknowledged and remembered, not retried forever", async () => {
  const { store, log } = fakeStore();
  const unknown = JSON.stringify({ type: "email.delivered", data: { email_id: "someone-else" } });
  const response = await post(app(store), unknown, signedHeaders("msg_e", unknown));
  assert.equal(response.status, 200);
  assert.deepEqual(log, ["apply:someone-else:delivered", "record:msg_e:email.delivered:someone-else:false"]);
});

test("event types we do not track are acknowledged without touching any email", async () => {
  const { store, log } = fakeStore();
  const opened = JSON.stringify({ type: "email.opened", data: { email_id: "re-123" } });
  const response = await post(app(store), opened, signedHeaders("msg_f", opened));
  assert.equal(response.status, 200);
  assert.equal(response.body.data.ignored, true);
  assert.deepEqual(log, ["record:msg_f:email.opened:re-123:false"]);
});

test("handleResendWebhook rejects a body that is not JSON after the signature passes", async () => {
  const { store } = fakeStore();
  const garbage = "not json";
  await assert.rejects(
    handleResendWebhook({ rawBody: Buffer.from(garbage), headers: { id: "m", timestamp: String(now), signature: sign("m", now, garbage) }, secret, store, nowSeconds: now }),
    /not valid JSON/,
  );
});
