import path from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({
  path: path.resolve(process.cwd(), "server", ".env"),
  quiet: true,
});

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

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
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid API environment configuration: ${details}`);
}

export const env = parsedEnv.data;
export type ServerEnvironment = typeof env;
