import { readFileSync } from "node:fs";
import path from "node:path";
import mysql, { type Pool, type PoolOptions } from "mysql2/promise";
import { getDatabaseConfig } from "../config/database";

let pool: Pool | undefined;

function createPoolOptions(): PoolOptions {
  const config = getDatabaseConfig();
  const ssl = config.ssl
    ? {
        rejectUnauthorized: true,
        ...(config.sslCaPath
          ? {
              ca: readFileSync(path.resolve(config.sslCaPath), "utf8"),
            }
          : {}),
      }
    : undefined;

  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    maxIdle: config.connectionLimit,
    idleTimeout: 60_000,
    queueLimit: 0,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    decimalNumbers: false,
    namedPlaceholders: false,
  };
}

export function getPool() {
  pool ??= mysql.createPool(createPoolOptions());
  return pool;
}

export async function probeDatabase() {
  const startedAt = performance.now();
  await getPool().execute("SELECT 1 AS connection_ok");

  return {
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
  };
}

export async function closePool() {
  if (!pool) {
    return;
  }

  const activePool = pool;
  pool = undefined;
  await activePool.end();
}
