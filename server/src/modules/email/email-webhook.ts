import { createHmac, timingSafeEqual } from "node:crypto";
import express, { Router } from "express";
import { env } from "../../config/env";
import { getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { createOutboxStore, deliveryStatusForEvent, type OutboxStore } from "./email-outbox.repository";

/**
 * Resend delivery webhooks (Svix-signed). Verification follows Svix's documented manual scheme:
 * HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${raw body}`, keyed with the base64-decoded secret that follows
 * the `whsec_` prefix, compared in constant time against every `v1,` signature in the header, with a timestamp
 * tolerance against replays.
 */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type SvixHeaders = { id?: string; timestamp?: string; signature?: string };

export function verifySvixSignature(input: {
  secret: string;
  headers: SvixHeaders;
  rawBody: Buffer | string;
  nowSeconds: number;
  toleranceSeconds?: number;
}) {
  const { id, timestamp, signature } = input.headers;
  if (!id || !timestamp || !signature) return false;
  const stamp = Number(timestamp);
  if (!Number.isFinite(stamp) || Math.abs(input.nowSeconds - stamp) > (input.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS)) return false;

  const key = Buffer.from(input.secret.replace(/^whsec_/, ""), "base64");
  if (!key.length) return false;
  const body = typeof input.rawBody === "string" ? input.rawBody : input.rawBody.toString("utf8");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const provided = Buffer.from(value, "base64");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
}

export type WebhookResult = { received: true; duplicate?: boolean; matched?: boolean; ignored?: boolean };

export async function handleResendWebhook(input: {
  rawBody: Buffer;
  headers: SvixHeaders;
  secret: string | undefined;
  store: OutboxStore;
  nowSeconds: number;
}): Promise<WebhookResult> {
  if (!input.secret) throw new AppError("Resend webhooks are not configured", 503, "EMAIL_WEBHOOK_NOT_CONFIGURED");
  if (!verifySvixSignature({ secret: input.secret, headers: input.headers, rawBody: input.rawBody, nowSeconds: input.nowSeconds })) {
    throw new AppError("Webhook signature is invalid", 401, "EMAIL_WEBHOOK_SIGNATURE_INVALID");
  }
  let event: { type?: unknown; data?: { email_id?: unknown } };
  try {
    event = JSON.parse(input.rawBody.toString("utf8"));
  } catch {
    throw new AppError("Webhook body is not valid JSON", 400, "EMAIL_WEBHOOK_BODY_INVALID");
  }
  const type = typeof event.type === "string" ? event.type : "";
  const emailId = typeof event.data?.email_id === "string" ? event.data.email_id : null;
  const status = deliveryStatusForEvent(type);

  // Apply first (it is monotonic and idempotent), then remember the delivery. A crash in between is safe: the
  // retry re-applies the same status and then records it.
  let matched = false;
  if (status && emailId) matched = await input.store.applyDeliveryStatus(emailId, status) || Boolean(await input.store.findByResendId(emailId));
  const first = await input.store.recordWebhookEvent(input.headers.id as string, type || "unknown", emailId, matched);
  return { received: true, duplicate: !first || undefined, matched: matched || undefined, ignored: !status || undefined };
}

export function createResendWebhookRouter(deps: { store?: OutboxStore; secret?: string; now?: () => number } = {}) {
  const router = Router();
  router.post(
    "/",
    express.raw({ type: "application/json", limit: "256kb" }),
    asyncHandler(async (request, response) => {
      if (!Buffer.isBuffer(request.body)) throw new AppError("Webhook body must be raw JSON", 400, "EMAIL_WEBHOOK_RAW_BODY_REQUIRED");
      const result = await handleResendWebhook({
        rawBody: request.body,
        headers: { id: request.get("svix-id"), timestamp: request.get("svix-timestamp"), signature: request.get("svix-signature") },
        secret: deps.secret ?? env.RESEND_WEBHOOK_SECRET,
        store: deps.store ?? createOutboxStore(getPool()),
        nowSeconds: Math.floor((deps.now ?? Date.now)() / 1000),
      });
      return sendSuccess(response, result, { message: "Resend webhook accepted" });
    }),
  );
  return router;
}
