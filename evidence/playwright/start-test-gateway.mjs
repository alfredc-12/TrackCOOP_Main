import { readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

// Test gateway only: a clean process environment, fixed local database and
// local storage, no delivery integrations, and no inheritance of live keys.
const root = process.cwd();
const connection = await mysql.createConnection({ host: "127.0.0.1", port: 33327, user: "root", database: "trackcoop_evidence_synthetic" });
const [rows] = await connection.query("SELECT @@port AS port,@@datadir AS dir,DATABASE() AS db");
await connection.end();
const dir = String(rows[0].dir).replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
if (Number(rows[0].port) !== 33327 || rows[0].db !== "trackcoop_evidence_synthetic" || !dir.endsWith("/trackcoop_main/scratch/playwright-isolated-mysql/data")) throw new Error("Refusing unverified database");
const source = dotenv.parse(readFileSync(path.join(root, "server/.env")));
const secret = source.PAYMONGO_TEST_SECRET_KEY || source.PAYMONGO_SECRET_KEY || "";
const webhook = source.PAYMONGO_TEST_WEBHOOK_SECRET || source.PAYMONGO_WEBHOOK_SECRET || "";
if (!secret.startsWith("sk_test_") || !webhook) throw new Error("A PayMongo test key and test webhook secret are required");
const safe = {};
for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "COMSPEC", "ComSpec", "PATHEXT", "TEMP", "TMP", "TMPDIR"]) if (process.env[key] !== undefined) safe[key] = process.env[key];
Object.assign(safe, {
  NODE_ENV: "development", DB_HOST: "127.0.0.1", DB_PORT: "33327", DB_NAME: "trackcoop_evidence_synthetic", DB_USER: "root", DB_PASSWORD: "", DB_SSL: "false",
  API_PORT: "3219", AUTH_LOGIN_RATE_LIMIT: "100", AUTH_LOGIN_RATE_WINDOW_MINUTES: "1", FRONTEND_URL: "http://127.0.0.1:3217", CORS_ALLOWED_ORIGINS: "http://127.0.0.1:3217",
  STORAGE_DRIVER: "local", LOCAL_STORAGE_ROOT: path.join(root, "scratch/playwright-isolated-mysql/uploads"), EMAIL_DELIVERY: "disabled", PAYMONGO_ENABLED: "true", PAYMONGO_MODE: "test",
  PAYMONGO_TEST_SECRET_KEY: secret, PAYMONGO_TEST_WEBHOOK_SECRET: webhook, PAYMONGO_SYSTEM_ACTOR_USER_ID: "1000", PAYMONGO_TEST_PAYMENT_METHOD_TYPES: "qrph",
  PAYMONGO_API_BASE_URL: "https://api.paymongo.com", PAYMENT_SUCCESS_URL: "http://127.0.0.1:3217/payment/success", PAYMENT_CANCEL_URL: "http://127.0.0.1:3217/payment/cancelled",
  AWS_EC2_METADATA_DISABLED: "true",
});
const child = spawn(process.execPath, [path.join(root, "node_modules/tsx/dist/cli.mjs"), path.join(root, "server/src/index.ts")], { cwd: path.join(root, "scratch/playwright-isolated-mysql"), env: safe, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
