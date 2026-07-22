import assert from "node:assert/strict";
import test from "node:test";
import { parseDatabaseConfig } from "./database";

test("parseDatabaseConfig validates and normalizes database settings", () => {
  const config = parseDatabaseConfig({
    DB_HOST: "trackcoop.example.rds.amazonaws.com",
    DB_PORT: "3307",
    DB_NAME: "trackcoopdb",
    DB_USER: "trackcoop_app",
    DB_PASSWORD: "private-password",
    DB_SSL: "true",
    DB_SSL_CA_PATH: "",
    DB_CONNECTION_LIMIT: "12",
  });

  assert.deepEqual(config, {
    host: "trackcoop.example.rds.amazonaws.com",
    port: 3307,
    database: "trackcoopdb",
    user: "trackcoop_app",
    password: "private-password",
    ssl: true,
    sslCaPath: undefined,
    connectionLimit: 12,
  });
});

test("parseDatabaseConfig allows an empty local database password", () => {
  const config = parseDatabaseConfig({
    DB_HOST: "127.0.0.1",
    DB_NAME: "trackcoopdb",
    DB_USER: "root",
    DB_PASSWORD: "",
    DB_SSL: "false",
  });

  assert.equal(config.password, "");
  assert.equal(config.ssl, false);
});

test("parseDatabaseConfig rejects missing required connection fields", () => {
  assert.throws(
    () =>
      parseDatabaseConfig({
        DB_HOST: "database.example",
        DB_NAME: "trackcoopdb",
      }),
    /DB_USER/,
  );
});
