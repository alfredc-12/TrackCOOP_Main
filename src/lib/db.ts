import mysql from "mysql2/promise";

declare global {
  var trackCoopMysqlPool: mysql.Pool | undefined;
}

const databaseUrl = process.env.DATABASE_URL;

function numberFromEnv(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasDiscreteDatabaseConfig() {
  return Boolean(
    process.env.MYSQL_HOST ||
      process.env.DB_HOST ||
      process.env.MYSQL_PORT ||
      process.env.DB_PORT ||
      process.env.MYSQL_USER ||
      process.env.DB_USER ||
      process.env.MYSQL_DATABASE ||
      process.env.DB_NAME,
  );
}

function createPoolOptions(): mysql.PoolOptions {
  const sharedOptions = {
    waitForConnections: true,
    connectionLimit: numberFromEnv(process.env.DB_CONNECTION_LIMIT, 10),
    dateStrings: true,
  };

  if (databaseUrl) {
    return {
      uri: databaseUrl,
      ...sharedOptions,
    };
  }

  if (hasDiscreteDatabaseConfig()) {
    return {
      host: process.env.MYSQL_HOST ?? process.env.DB_HOST ?? "127.0.0.1",
      port: numberFromEnv(process.env.MYSQL_PORT ?? process.env.DB_PORT, 3307),
      user: process.env.MYSQL_USER ?? process.env.DB_USER ?? "root",
      password: process.env.MYSQL_PASSWORD ?? process.env.DB_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE ?? process.env.DB_NAME ?? "trackcoop",
      ...sharedOptions,
    };
  }

  return {
    uri: "mysql://root:@localhost:3306/trackcoopdb",
    ...sharedOptions,
  };
}

export const db =
  globalThis.trackCoopMysqlPool ?? mysql.createPool(createPoolOptions());

if (process.env.NODE_ENV !== "production") {
  globalThis.trackCoopMysqlPool = db;
}
