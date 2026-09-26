import { z } from "zod";
import { loadServerEnv } from "./load-env";

loadServerEnv();

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalTrimmedUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed || undefined;
  },
  z.string().url().optional(),
);

const commaSeparatedOrigins = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().default("http://localhost:3000"),
  )
  .transform((value) => [...new Set(value.split(",").map((origin) => origin.trim()).filter(Boolean))]);

const allowedPaymongoPaymentMethodTypes = ["card", "qrph"] as const;

const optionalPaymongoPaymentMethodTypes = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().optional(),
  )
  .transform((value, context) => {
    if (!value) return undefined;
    const methods = [...new Set(value.split(",").map((method) => method.trim().toLowerCase()).filter(Boolean))];

    if (!methods.length) {
      return undefined;
    }

    for (const method of methods) {
      if (!allowedPaymongoPaymentMethodTypes.includes(method as (typeof allowedPaymongoPaymentMethodTypes)[number])) {
        context.addIssue({
          code: "custom",
          message: `Unsupported PayMongo payment method type: ${method}`,
        });
      }
    }

    return methods;
  });

function defaultPaymongoMethods() {
  return ["qrph"];
}

function activePaymongoSecret(value: {
  PAYMONGO_MODE: "test" | "live";
  PAYMONGO_SECRET_KEY?: string;
  PAYMONGO_TEST_SECRET_KEY?: string;
  PAYMONGO_LIVE_SECRET_KEY?: string;
}) {
  return value.PAYMONGO_MODE === "live"
    ? value.PAYMONGO_LIVE_SECRET_KEY ?? value.PAYMONGO_SECRET_KEY
    : value.PAYMONGO_TEST_SECRET_KEY ?? value.PAYMONGO_SECRET_KEY;
}

function activePaymongoWebhookSecret(value: {
  PAYMONGO_MODE: "test" | "live";
  PAYMONGO_WEBHOOK_SECRET?: string;
  PAYMONGO_TEST_WEBHOOK_SECRET?: string;
  PAYMONGO_LIVE_WEBHOOK_SECRET?: string;
}) {
  return value.PAYMONGO_MODE === "live"
    ? value.PAYMONGO_LIVE_WEBHOOK_SECRET ?? value.PAYMONGO_WEBHOOK_SECRET
    : value.PAYMONGO_TEST_WEBHOOK_SECRET ?? value.PAYMONGO_WEBHOOK_SECRET;
}

function activePaymongoPaymentMethodTypes(value: {
  PAYMONGO_MODE: "test" | "live";
  PAYMONGO_PAYMENT_METHOD_TYPES?: string[];
  PAYMONGO_TEST_PAYMENT_METHOD_TYPES?: string[];
  PAYMONGO_LIVE_PAYMENT_METHOD_TYPES?: string[];
}) {
  const selected = value.PAYMONGO_MODE === "live"
    ? value.PAYMONGO_LIVE_PAYMENT_METHOD_TYPES
    : value.PAYMONGO_TEST_PAYMENT_METHOD_TYPES;
  return selected ?? value.PAYMONGO_PAYMENT_METHOD_TYPES ?? defaultPaymongoMethods();
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CORS_ALLOWED_ORIGINS: commaSeparatedOrigins,
  REQUEST_BODY_LIMIT: z.string().min(1).default("1mb"),
  TRUST_PROXY: booleanString.default(false),
  SESSION_COOKIE_NAME: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .default("trackcoop_session"),
  SESSION_COOKIE_DOMAIN: optionalTrimmedString,
  SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  SESSION_COOKIE_SECURE: booleanString.default(false),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_ROOT: z.string().trim().min(1).default("storage/uploads"),
  S3_ENDPOINT: optionalTrimmedString,
  S3_REGION: optionalTrimmedString,
  S3_BUCKET: optionalTrimmedString,
  S3_ACCESS_KEY_ID: optionalTrimmedString,
  S3_SECRET_ACCESS_KEY: optionalTrimmedString,
  S3_FORCE_PATH_STYLE: booleanString.default(false),
  S3_PUBLIC_BASE_URL: optionalTrimmedString,
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  AUTH_LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  AUTH_LOGIN_RATE_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  PAYMONGO_ENABLED: booleanString.default(false),
  PAYMONGO_MODE: z.enum(["test", "live"]).default("test"),
  PAYMONGO_ALLOW_LIVE_LOCAL: booleanString.default(false),
  PAYMONGO_API_BASE_URL: z.string().url().default("https://api.paymongo.com"),
  PAYMONGO_SECRET_KEY: optionalTrimmedString,
  PAYMONGO_WEBHOOK_SECRET: optionalTrimmedString,
  PAYMONGO_TEST_SECRET_KEY: optionalTrimmedString,
  PAYMONGO_TEST_WEBHOOK_SECRET: optionalTrimmedString,
  PAYMONGO_TEST_PAYMENT_METHOD_TYPES: optionalPaymongoPaymentMethodTypes,
  PAYMONGO_LIVE_SECRET_KEY: optionalTrimmedString,
  PAYMONGO_LIVE_WEBHOOK_SECRET: optionalTrimmedString,
  PAYMONGO_LIVE_PAYMENT_METHOD_TYPES: optionalPaymongoPaymentMethodTypes,
  PAYMONGO_SYSTEM_ACTOR_USER_ID: optionalTrimmedString,
  PAYMONGO_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  PAYMONGO_CHECKOUT_REUSE_MINUTES: z.coerce.number().int().min(1).max(1440).default(30),
  PAYMONGO_PAYMENT_METHOD_TYPES: optionalPaymongoPaymentMethodTypes,
  PAYMONGO_PASS_ON_FEES: booleanString.default(false),
  PAYMENT_SUCCESS_URL: z.string().url().default("http://localhost:3000/payment/success"),
  PAYMENT_CANCEL_URL: z.string().url().default("http://localhost:3000/payment/cancelled"),
  RENTAL_STATUS_EMAIL_WEBHOOK_URL: optionalTrimmedUrl,
  RENTAL_STATUS_EMAIL_WEBHOOK_TOKEN: optionalTrimmedString,
  MEMBERSHIP_EMAIL_WEBHOOK_URL: optionalTrimmedUrl,
  MEMBERSHIP_EMAIL_WEBHOOK_TOKEN: optionalTrimmedString,
}).superRefine((value, context) => {
  const secretKey = activePaymongoSecret(value);
  const webhookSecret = activePaymongoWebhookSecret(value);
  const systemActorUserId = value.PAYMONGO_SYSTEM_ACTOR_USER_ID;

  if (value.SESSION_COOKIE_SAME_SITE === "none" && !value.SESSION_COOKIE_SECURE) {
    context.addIssue({
      code: "custom",
      path: ["SESSION_COOKIE_SECURE"],
      message: "SESSION_COOKIE_SECURE must be true when SESSION_COOKIE_SAME_SITE is none",
    });
  }

  if (value.SESSION_COOKIE_DOMAIN?.includes("localhost")) {
    context.addIssue({
      code: "custom",
      path: ["SESSION_COOKIE_DOMAIN"],
      message: "SESSION_COOKIE_DOMAIN must be empty for localhost",
    });
  }

  if (value.STORAGE_DRIVER === "s3") {
    if (!value.S3_BUCKET) {
      context.addIssue({
        code: "custom",
        path: ["S3_BUCKET"],
        message: "S3_BUCKET is required when STORAGE_DRIVER is s3",
      });
    }
    if (!value.S3_REGION) {
      context.addIssue({
        code: "custom",
        path: ["S3_REGION"],
        message: "S3_REGION is required when STORAGE_DRIVER is s3",
      });
    }
  }

  if (!value.PAYMONGO_ENABLED) {
    return;
  }

  if (!secretKey) {
    context.addIssue({
      code: "custom",
      path: ["PAYMONGO_SECRET_KEY"],
      message: "PAYMONGO_SECRET_KEY is required when PayMongo is enabled",
    });
  }

  if (!webhookSecret) {
    context.addIssue({
      code: "custom",
      path: ["PAYMONGO_WEBHOOK_SECRET"],
      message: "PAYMONGO_WEBHOOK_SECRET is required when PayMongo is enabled",
    });
  }

  if (!systemActorUserId) {
    context.addIssue({
      code: "custom",
      path: ["PAYMONGO_SYSTEM_ACTOR_USER_ID"],
      message: "PAYMONGO_SYSTEM_ACTOR_USER_ID is required when PayMongo is enabled",
    });
  } else if (!/^[1-9]\d*$/.test(systemActorUserId)) {
    context.addIssue({
      code: "custom",
      path: ["PAYMONGO_SYSTEM_ACTOR_USER_ID"],
      message: "PAYMONGO_SYSTEM_ACTOR_USER_ID must be a positive numeric user ID",
    });
  }

  if (
    value.NODE_ENV !== "production"
    && value.PAYMONGO_MODE === "live"
    && !value.PAYMONGO_ALLOW_LIVE_LOCAL
  ) {
    context.addIssue({
      code: "custom",
      path: ["PAYMONGO_ALLOW_LIVE_LOCAL"],
      message: "PayMongo live mode outside production requires PAYMONGO_ALLOW_LIVE_LOCAL=true",
    });
  }

  if (value.PAYMONGO_MODE === "test" && secretKey && !secretKey.startsWith("sk_test_")) {
    context.addIssue({
      code: "custom",
      path: ["PAYMONGO_SECRET_KEY"],
      message: "PayMongo test mode requires a sk_test_ secret key",
    });
  }

  if (value.PAYMONGO_MODE === "live" && secretKey && !secretKey.startsWith("sk_live_")) {
    context.addIssue({
      code: "custom",
      path: ["PAYMONGO_SECRET_KEY"],
      message: "PayMongo live mode requires a sk_live_ secret key",
    });
  }
}).transform((value) => ({
  ...value,
  PAYMONGO_SECRET_KEY: activePaymongoSecret(value),
  PAYMONGO_WEBHOOK_SECRET: activePaymongoWebhookSecret(value),
  PAYMONGO_PAYMENT_METHOD_TYPES: activePaymongoPaymentMethodTypes(value),
}));

export type ServerEnvironment = z.infer<typeof envSchema>;

export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnvironment {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid API environment configuration: ${details}`);
  }

  return result.data;
}

export const env = parseServerEnv(process.env);
