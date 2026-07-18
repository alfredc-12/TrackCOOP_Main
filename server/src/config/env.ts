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
