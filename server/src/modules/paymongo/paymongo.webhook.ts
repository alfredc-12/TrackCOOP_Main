import crypto from "node:crypto";
import { AppError } from "../../utils/app-error";
import { validatePaymongoConfig } from "./paymongo.client";
import { paymongoWebhookEventSchema } from "./paymongo.schema";
import type { PaymongoConfig } from "./paymongo.types";

type ParsedSignature = {
  timestamp: number;
  testSignature?: string;
  liveSignature?: string;
};

export type ParsedPaymongoWebhook = {
  payload: ReturnType<typeof paymongoWebhookEventSchema.parse>;
  rawBodyUtf8: string;
  payloadHash: string;
};

function parseSignatureHeader(header: string | undefined): ParsedSignature {
  if (!header?.trim()) {
    throw new AppError("PayMongo signature is required", 401, "PAYMONGO_SIGNATURE_REQUIRED");
  }

  const parts = new Map(
    header.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  const timestamp = Number(parts.get("t"));
  if (!Number.isInteger(timestamp) || timestamp <= 0) {
    throw new AppError("PayMongo signature timestamp is invalid", 401, "PAYMONGO_SIGNATURE_INVALID");
  }

  return {
    timestamp,
    testSignature: parts.get("te") || undefined,
    liveSignature: parts.get("li") || undefined,
  };
}

function timingSafeHexEquals(expectedHex: string, actualHex: string) {
  if (!/^[a-f0-9]+$/i.test(expectedHex) || !/^[a-f0-9]+$/i.test(actualHex)) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function verifyAndParsePaymongoWebhook(input: {
  rawBody: Buffer;
  signatureHeader: string | undefined;
  config: PaymongoConfig;
  nowSeconds?: number;
}): ParsedPaymongoWebhook {
  validatePaymongoConfig(input.config);
  if (!input.config.webhookSecret) {
    throw new AppError("PayMongo webhook secret is not configured", 503, "PAYMONGO_WEBHOOK_NOT_CONFIGURED");
  }

  const parsedSignature = parseSignatureHeader(input.signatureHeader);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsedSignature.timestamp) > input.config.webhookToleranceSeconds) {
    throw new AppError("PayMongo signature timestamp is outside tolerance", 401, "PAYMONGO_SIGNATURE_STALE");
  }

  const rawBodyUtf8 = input.rawBody.toString("utf8");
  const signedPayload = `${parsedSignature.timestamp}.${rawBodyUtf8}`;
  const expected = crypto
    .createHmac("sha256", input.config.webhookSecret)
    .update(signedPayload)
    .digest("hex");
  const actual = input.config.mode === "live"
    ? parsedSignature.liveSignature
    : parsedSignature.testSignature;

  if (!actual || !timingSafeHexEquals(expected, actual)) {
    throw new AppError("PayMongo signature is invalid", 401, "PAYMONGO_SIGNATURE_INVALID");
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBodyUtf8) as unknown;
  } catch {
    throw new AppError("PayMongo webhook JSON is malformed", 400, "PAYMONGO_WEBHOOK_JSON_INVALID");
  }
  const parsedPayload = paymongoWebhookEventSchema.safeParse(json);
  if (!parsedPayload.success) {
    throw new AppError(
      "PayMongo webhook payload is invalid",
      400,
      "PAYMONGO_WEBHOOK_PAYLOAD_INVALID",
      parsedPayload.error.issues.map((issue) => ({
        code: "VALIDATION_ERROR",
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return {
    payload: parsedPayload.data,
    rawBodyUtf8,
    payloadHash: crypto.createHash("sha256").update(input.rawBody).digest("hex"),
  };
}

export function paymongoEventFingerprint(input: {
  eventType: string;
  checkoutId: string;
  paymentId: string;
  payloadHash: string;
}) {
  return crypto
    .createHash("sha256")
    .update(`${input.eventType}:${input.checkoutId}:${input.paymentId}:${input.payloadHash}`)
    .digest("hex");
}
