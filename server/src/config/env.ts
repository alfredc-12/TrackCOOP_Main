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

const allowedPaymongoPaymentMethodTypes = ["card"] as const;

const paymongoPaymentMethodTypes = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().default("card"),
  )
  .transform((value, context) => {
    const methods = [...new Set(value.split(",").map((method) => method.trim().toLowerCase()).filter(Boolean))];

    if (!methods.length) {
      return ["card"];
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

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  REQUEST_BODY_LIMIT: z.string().min(1).default("1mb"),
  TRUST_PROXY: booleanString.default(false),
  SESSION_COOKIE_NAME: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .default("trackcoop_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  PAYMONGO_ENABLED: booleanString.default(false),
  PAYMONGO_MODE: z.enum(["test", "live"]).default("test"),
  PAYMONGO_API_BASE_URL: z.string().url().default("https://api.paymongo.com"),
  PAYMONGO_SECRET_KEY: optionalTrimmedString,
  PAYMONGO_WEBHOOK_SECRET: optionalTrimmedString,
  PAYMONGO_SYSTEM_ACTOR_USER_ID: optionalTrimmedString,
  PAYMONGO_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  PAYMONGO_CHECKOUT_REUSE_MINUTES: z.coerce.number().int().min(1).max(1440).default(30),
  PAYMONGO_PAYMENT_METHOD_TYPES: paymongoPaymentMethodTypes,
  PAYMONGO_PASS_ON_FEES: booleanString.default(false),
  PAYMENT_SUCCESS_URL: z.string().url().default("http://localhost:3000/payment/success"),
  PAYMENT_CANCEL_URL: z.string().url().default("http://localhost:3000/payment/cancelled"),
}).superRefine((value, context) => {
  const secretKey = value.PAYMONGO_SECRET_KEY;
  const webhookSecret = value.PAYMONGO_WEBHOOK_SECRET;
  const systemActorUserId = value.PAYMONGO_SYSTEM_ACTOR_USER_ID;

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

  if (value.NODE_ENV !== "production" && value.PAYMONGO_MODE === "live") {
    context.addIssue({
      code: "custom",
      path: ["PAYMONGO_MODE"],
      message: "PayMongo live mode is not allowed outside production",
    });
  }

  if (secretKey?.startsWith("sk_live_") && value.NODE_ENV !== "production") {
    context.addIssue({
      code: "custom",
      path: ["PAYMONGO_SECRET_KEY"],
      message: "PayMongo live secret keys are not allowed outside production",
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
});

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
