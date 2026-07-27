import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const app = source("server/src/app.ts");
const envSource = source("server/src/config/env.ts");
const webhookRoutes = source("server/src/modules/paymongo/paymongo.webhook.routes.ts");
const webhookParser = source("server/src/modules/paymongo/paymongo.webhook.ts");
const webhookService = source("server/src/modules/paymongo/paymongo.webhook.service.ts");
const paymentRoutes = source("server/src/modules/payment-references/payment-reference.routes.ts");
const memberRoutes = source("server/src/modules/paymongo/paymongo.routes.ts");
const completionSql = source("server/database/TrackCOOP_PAYMONGO_Core_Completion.sql");

const publicPaymentUi = source(
  "src/features/membership-applications/components/ApplicationStatusPayments.tsx",
);
const memberPaymentUi = source(
  "src/features/member-share-capital/MemberShareCapitalLauncher.tsx",
);
const memberPaymentApi = source("src/features/member-share-capital/api.ts");

function position(haystack: string, needle: string) {
  const index = haystack.indexOf(needle);
  assert.notEqual(index, -1, `Expected source to contain: ${needle}`);
  return index;
}

test("PayMongo remains test-first and rejects live configuration outside production", () => {
  assert.match(envSource, /PAYMONGO_MODE: z\.enum\(\["test", "live"\]\)\.default\("test"\)/);
  assert.match(envSource, /value\.NODE_ENV !== "production" && value\.PAYMONGO_MODE === "live"/);
  assert.match(envSource, /secretKey\?\.startsWith\("sk_live_"\)/);
  assert.match(envSource, /PAYMONGO_SYSTEM_ACTOR_USER_ID is required/);
});

test("raw PayMongo webhook route is mounted before JSON parsing", () => {
  assert.ok(position(app, 'app.use("/api/webhooks/paymongo"') < position(app, "app.use(express.json"));
  assert.match(webhookRoutes, /express\.raw\(\{ type: "application\/json" \}\)/);
  assert.match(webhookRoutes, /request\.get\("Paymongo-Signature"\)/);
});

test("signature verification uses raw bytes, tolerance, HMAC, and timing-safe comparison", () => {
  assert.match(webhookParser, /timingSafeEqual/);
  assert.match(webhookParser, /createHmac\("sha256"/);
  assert.match(webhookParser, /PAYMONGO_WEBHOOK_TOLERANCE_SECONDS|webhookToleranceSeconds/);
  assert.match(webhookParser, /te|li/);
  assert.match(webhookParser, /rawBody/);
});

test("webhook processing is paid-only, safe, idempotent, and retry-aware", () => {
  assert.match(webhookService, /checkout_session\.payment\.paid/);
  assert.match(webhookService, /processing_status/);
  assert.match(webhookService, /Ignored/);
  assert.match(webhookService, /Failed/);
  assert.match(webhookService, /event_fingerprint|gateway_event_object_id/);
  assert.doesNotMatch(webhookService, /INSERT[\s\S]{0,300}(raw_body|signature_header)/i);
});

test("payment mutations are Bookkeeper-only while Chairman remains read-only", () => {
  assert.match(paymentRoutes, /const staff = \[createAuthenticate\(authService\), requireRoles\("chairman", "bookkeeper"\)\]/);
  assert.match(paymentRoutes, /const bookkeeperOnly = \[createAuthenticate\(authService\), requireRoles\("bookkeeper"\)\]/);
  assert.match(paymentRoutes, /router\.get\("\/payment-references"[\s\S]*\.\.\.staff/);
  assert.match(paymentRoutes, /retry"[\s\S]*\.\.\.bookkeeperOnly/);
});

test("authenticated Member checkout routes resolve only the current Member", () => {
  assert.match(memberRoutes, /requireRoles\("member"\)/);
  assert.match(memberRoutes, /members\/me\/share-capital/);
  assert.doesNotMatch(memberRoutes, /members\/:memberId\/share-capital/);
});

test("completion schema contains final PayMongo lifecycle tables without secrets", () => {
  assert.match(completionSql, /CREATE TABLE(?: IF NOT EXISTS)? payment_gateway_checkout_attempts/);
  assert.match(completionSql, /CREATE TABLE(?: IF NOT EXISTS)? payment_receipts/);
  assert.match(completionSql, /signature_verified_at/);
  assert.match(completionSql, /client_request_id/);
  assert.doesNotMatch(completionSql, /sk_(?:test|live)_[A-Za-z0-9]{12,}/);
  assert.doesNotMatch(completionSql, /whsec_[A-Za-z0-9]{12,}/);
});

const browserFiles = [
  "src/features/finance/finance-api.ts",
  "src/features/member-share-capital/api.ts",
  "src/features/membership-applications/membership-application-api.ts",
];

test("browser payment modules contain no server PayMongo secrets", () => {
  for (const file of browserFiles) {
    const content = source(file);
    assert.doesNotMatch(content, /PAYMONGO_SECRET_KEY|PAYMONGO_WEBHOOK_SECRET|sk_live_|sk_test_|whsec_/);
  }
});

test("public payment UI keeps tracking-token checkout safe and test-mode explicit", () => {
  assert.match(publicPaymentUi, /application code and private tracking secret/i);
  assert.match(publicPaymentUi, /PayMongo Test Mode — No real money will be charged/);
  assert.match(publicPaymentUi, /Remaining to PHP 3,000/);
  assert.match(publicPaymentUi, /Remaining to PHP 15,000 max/);
  assert.match(publicPaymentUi, /Start Share Capital Installment/);
  assert.match(publicPaymentUi, /Internal IDs,[\s\S]*webhook data,[\s\S]*tracking hashes stay hidden/);
  assert.doesNotMatch(publicPaymentUi, /PAYMONGO_SECRET_KEY|PAYMONGO_WEBHOOK_SECRET|signatureHeader|rawBodyUtf8/);
});

test("Member payment UI uses owner-only routes and enforces contribution limits", () => {
  assert.match(memberPaymentUi, /Pay Share Capital with PayMongo/);
  assert.match(memberPaymentUi, /PayMongo Test Mode/);
  assert.match(memberPaymentUi, /Remaining to PHP 3,000/);
  assert.match(memberPaymentUi, /cannot make your total exceed PHP 15,000/);
  assert.match(memberPaymentUi, /Payment history/);
  assert.match(memberPaymentApi, /\/api\/paymongo\/members\/me\/share-capital/);
  assert.match(memberPaymentApi, /\/api\/paymongo\/checkouts\/members\/me\/share-capital/);
  assert.doesNotMatch(memberPaymentApi, /memberId/);
});
