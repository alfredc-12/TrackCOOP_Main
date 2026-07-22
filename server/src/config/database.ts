import { z } from "zod";
import { loadServerEnv } from "./load-env";

loadServerEnv();

const databaseEnvSchema = z.object({
  DB_HOST: z.string().trim().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().trim().min(1),
  DB_USER: z.string().trim().min(1),
  DB_PASSWORD: z.string().default(""),
  DB_SSL: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  DB_SSL_CA_PATH: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
});

export type DatabaseConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  sslCaPath?: string;
  connectionLimit: number;
};

export function parseDatabaseConfig(
  source: Record<string, string | undefined>,
): DatabaseConfig {
  const result = databaseEnvSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid database environment configuration: ${details}`);
  }

  return {
    host: result.data.DB_HOST,
    port: result.data.DB_PORT,
    database: result.data.DB_NAME,
    user: result.data.DB_USER,
    password: result.data.DB_PASSWORD,
    ssl: result.data.DB_SSL,
    sslCaPath: result.data.DB_SSL_CA_PATH,
    connectionLimit: result.data.DB_CONNECTION_LIMIT,
  };
}

let databaseConfig: DatabaseConfig | undefined;

export function getDatabaseConfig() {
  databaseConfig ??= parseDatabaseConfig(process.env);
  return databaseConfig;
}
