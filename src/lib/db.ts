import { readFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import {
  getDatabaseConfig,
  type DatabaseConfig,
} from "../../server/src/config/database";

declare global {
  var trackCoopMysqlPool: mysql.Pool | undefined;
  var trackCoopMysqlPoolConfigKey: string | undefined;
}

function sslOptions(config: DatabaseConfig) {
  if (!config.ssl) {
    return undefined;
  }

  return {
    rejectUnauthorized: true,
    ...(config.sslCaPath
      ? {
          ca: readFileSync(path.resolve(config.sslCaPath), "utf8"),
        }
      : {}),
  };
}

function createPoolConfigKey(config: DatabaseConfig) {
  return JSON.stringify({
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
    ssl: config.ssl,
    sslCaPath: config.sslCaPath ?? "",
  });
}

function createPoolOptions(config: DatabaseConfig): mysql.PoolOptions {
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    dateStrings: true,
    ssl: sslOptions(config),
  };
}

const databaseConfig = getDatabaseConfig();
const poolConfigKey = createPoolConfigKey(databaseConfig);

export const db =
  globalThis.trackCoopMysqlPool && globalThis.trackCoopMysqlPoolConfigKey === poolConfigKey
    ? globalThis.trackCoopMysqlPool
    : mysql.createPool(createPoolOptions(databaseConfig));

if (process.env.NODE_ENV !== "production") {
  globalThis.trackCoopMysqlPool = db;
  globalThis.trackCoopMysqlPoolConfigKey = poolConfigKey;
}
