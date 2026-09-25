import assert from "node:assert/strict";
import test from "node:test";
import { parseServerEnv } from "./env";

const baseEnv = {
  NODE_ENV: "development",
  API_PORT: "5000",
  FRONTEND_URL: "http://localhost:3000",
  REQUEST_BODY_LIMIT: "1mb",
  TRUST_PROXY: "false",
  SESSION_COOKIE_NAME: "trackcoop_session",
  SESSION_TTL_HOURS: "12",
  AUTH_MAX_FAILED_ATTEMPTS: "5",
  AUTH_LOCKOUT_MINUTES: "15",
  AUTH_LOGIN_RATE_LIMIT: "10",
  AUTH_LOGIN_RATE_WINDOW_MINUTES: "15",
  BCRYPT_ROUNDS: "12",
};

test("parseServerEnv keeps PayMongo disabled by default without secrets", () => {
  const config = parseServerEnv(baseEnv);

  assert.equal(config.PORT, undefined);
  assert.equal(config.PAYMONGO_ENABLED, false);
  assert.equal(config.PAYMONGO_MODE, "test");
  assert.equal(config.PAYMONGO_API_BASE_URL, "https://api.paymongo.com");
  assert.equal(config.PAYMONGO_SECRET_KEY, undefined);
  assert.equal(config.PAYMONGO_WEBHOOK_SECRET, undefined);
  assert.equal(config.PAYMONGO_WEBHOOK_TOLERANCE_SECONDS, 300);
  assert.equal(config.PAYMONGO_CHECKOUT_REUSE_MINUTES, 30);
  assert.deepEqual(config.PAYMONGO_PAYMENT_METHOD_TYPES, ["card"]);
  assert.equal(config.PAYMONGO_PASS_ON_FEES, false);
  assert.deepEqual(config.CORS_ALLOWED_ORIGINS, ["http://localhost:3000"]);
  assert.equal(config.SESSION_COOKIE_SAME_SITE, "lax");
  assert.equal(config.SESSION_COOKIE_SECURE, false);
  assert.equal(config.STORAGE_DRIVER, "local");
  assert.equal(config.LOCAL_STORAGE_ROOT, "storage/uploads");
  assert.equal(config.AUTH_LOGIN_RATE_LIMIT, 10);
  assert.equal(config.AUTH_LOGIN_RATE_WINDOW_MINUTES, 15);
});

test("parseServerEnv accepts PORT override while keeping API_PORT fallback", () => {
  const localConfig = parseServerEnv(baseEnv);
  const hostedConfig = parseServerEnv({ ...baseEnv, PORT: "4173" });

  assert.equal(localConfig.API_PORT, 5000);
  assert.equal(localConfig.PORT, undefined);
  assert.equal(hostedConfig.API_PORT, 5000);
  assert.equal(hostedConfig.PORT, 4173);
});

test("parseServerEnv accepts portable production cookie settings", () => {
  const config = parseServerEnv({
    ...baseEnv,
    NODE_ENV: "production",
    FRONTEND_URL: "https://app.example.com",
    CORS_ALLOWED_ORIGINS: "https://app.example.com,https://admin.example.com",
    SESSION_COOKIE_DOMAIN: ".example.com",
    SESSION_COOKIE_SAME_SITE: "lax",
    SESSION_COOKIE_SECURE: "true",
    TRUST_PROXY: "true",
  });

  assert.deepEqual(config.CORS_ALLOWED_ORIGINS, [
    "https://app.example.com",
    "https://admin.example.com",
  ]);
  assert.equal(config.SESSION_COOKIE_DOMAIN, ".example.com");
  assert.equal(config.SESSION_COOKIE_SECURE, true);
  assert.equal(config.TRUST_PROXY, true);
});

test("parseServerEnv rejects SameSite none without Secure cookies", () => {
  assert.throws(
    () => parseServerEnv({
      ...baseEnv,
      SESSION_COOKIE_SAME_SITE: "none",
      SESSION_COOKIE_SECURE: "false",
    }),
    /SESSION_COOKIE_SECURE must be true/,
  );
});

test("parseServerEnv rejects localhost cookie domains", () => {
  assert.throws(
    () => parseServerEnv({
      ...baseEnv,
      SESSION_COOKIE_DOMAIN: "localhost",
    }),
    /SESSION_COOKIE_DOMAIN must be empty for localhost/,
  );
});

test("parseServerEnv validates S3 storage requirements", () => {
  assert.throws(
    () => parseServerEnv({ ...baseEnv, STORAGE_DRIVER: "s3" }),
    /S3_BUCKET.*S3_REGION/,
  );

  const config = parseServerEnv({
    ...baseEnv,
    STORAGE_DRIVER: "s3",
    S3_BUCKET: "trackcoop-uploads",
    S3_REGION: "auto",
    S3_ENDPOINT: "https://object-storage.example.com",
    S3_FORCE_PATH_STYLE: "true",
  });

  assert.equal(config.STORAGE_DRIVER, "s3");
  assert.equal(config.S3_BUCKET, "trackcoop-uploads");
  assert.equal(config.S3_FORCE_PATH_STYLE, true);
});

test("parseServerEnv accepts enabled PayMongo test configuration", () => {
  const config = parseServerEnv({
    ...baseEnv,
    PAYMONGO_ENABLED: "true",
    PAYMONGO_MODE: "test",
    PAYMONGO_SECRET_KEY: "sk_test_example",
    PAYMONGO_WEBHOOK_SECRET: "whsec_test_example",
    PAYMONGO_SYSTEM_ACTOR_USER_ID: "900",
    PAYMONGO_CHECKOUT_REUSE_MINUTES: "45",
    PAYMONGO_PAYMENT_METHOD_TYPES: "card",
    PAYMONGO_PASS_ON_FEES: "true",
  });

  assert.equal(config.PAYMONGO_ENABLED, true);
  assert.equal(config.PAYMONGO_SECRET_KEY, "sk_test_example");
  assert.equal(config.PAYMONGO_WEBHOOK_SECRET, "whsec_test_example");
  assert.equal(config.PAYMONGO_SYSTEM_ACTOR_USER_ID, "900");
  assert.equal(config.PAYMONGO_CHECKOUT_REUSE_MINUTES, 45);
  assert.deepEqual(config.PAYMONGO_PAYMENT_METHOD_TYPES, ["card"]);
  assert.equal(config.PAYMONGO_PASS_ON_FEES, true);
});

test("parseServerEnv accepts PayMongo QR Ph in production live mode", () => {
  const config = parseServerEnv({
    ...baseEnv,
    NODE_ENV: "production",
    PAYMONGO_ENABLED: "true",
    PAYMONGO_MODE: "live",
    PAYMONGO_SECRET_KEY: "sk_live_example",
    PAYMONGO_WEBHOOK_SECRET: "whsec_live_example",
    PAYMONGO_SYSTEM_ACTOR_USER_ID: "900",
    PAYMONGO_PAYMENT_METHOD_TYPES: "qrph",
  });

  assert.equal(config.PAYMONGO_MODE, "live");
  assert.equal(config.PAYMONGO_SECRET_KEY, "sk_live_example");
  assert.deepEqual(config.PAYMONGO_PAYMENT_METHOD_TYPES, ["qrph"]);
});

test("parseServerEnv validates the PayMongo checkout reuse interval", () => {
  for (const value of ["0", "1441", "1.5"]) {
    assert.throws(
      () => parseServerEnv({ ...baseEnv, PAYMONGO_CHECKOUT_REUSE_MINUTES: value }),
      /PAYMONGO_CHECKOUT_REUSE_MINUTES/,
    );
  }
});

test("parseServerEnv accepts custom login rate limit configuration", () => {
  const config = parseServerEnv({
    ...baseEnv,
    AUTH_LOGIN_RATE_LIMIT: "7",
    AUTH_LOGIN_RATE_WINDOW_MINUTES: "30",
  });

  assert.equal(config.AUTH_LOGIN_RATE_LIMIT, 7);
  assert.equal(config.AUTH_LOGIN_RATE_WINDOW_MINUTES, 30);
});

test("parseServerEnv rejects invalid login rate limit values", () => {
  for (const value of ["0", "101", "1.5", "abc"]) {
    assert.throws(
      () => parseServerEnv({ ...baseEnv, AUTH_LOGIN_RATE_LIMIT: value }),
      /AUTH_LOGIN_RATE_LIMIT/,
    );
  }
});

test("parseServerEnv rejects invalid login rate window values", () => {
  for (const value of ["0", "1441", "1.5", "abc"]) {
    assert.throws(
      () => parseServerEnv({ ...baseEnv, AUTH_LOGIN_RATE_WINDOW_MINUTES: value }),
      /AUTH_LOGIN_RATE_WINDOW_MINUTES/,
    );
  }
});

test("parseServerEnv requires PayMongo secrets when enabled", () => {
  assert.throws(
    () =>
      parseServerEnv({
        ...baseEnv,
        PAYMONGO_ENABLED: "true",
      }),
    /PAYMONGO_SECRET_KEY.*PAYMONGO_WEBHOOK_SECRET.*PAYMONGO_SYSTEM_ACTOR_USER_ID/,
  );
});

test("parseServerEnv rejects PayMongo live keys outside production", () => {
  assert.throws(
    () =>
      parseServerEnv({
        ...baseEnv,
        PAYMONGO_ENABLED: "true",
        PAYMONGO_MODE: "test",
        PAYMONGO_SECRET_KEY: "sk_live_example",
        PAYMONGO_WEBHOOK_SECRET: "whsec_test_example",
        PAYMONGO_SYSTEM_ACTOR_USER_ID: "900",
      }),
    /PayMongo live secret keys are not allowed outside production/,
  );
});

test("parseServerEnv rejects PayMongo live mode outside production", () => {
  assert.throws(
    () =>
      parseServerEnv({
        ...baseEnv,
        PAYMONGO_ENABLED: "true",
        PAYMONGO_MODE: "live",
        PAYMONGO_SECRET_KEY: "sk_live_example",
        PAYMONGO_WEBHOOK_SECRET: "whsec_live_example",
        PAYMONGO_SYSTEM_ACTOR_USER_ID: "900",
        PAYMONGO_PAYMENT_METHOD_TYPES: "qrph",
      }),
    /PayMongo live mode is not allowed outside production/,
  );
});

test("parseServerEnv rejects PayMongo test keys in production live mode", () => {
  assert.throws(
    () =>
      parseServerEnv({
        ...baseEnv,
        NODE_ENV: "production",
        PAYMONGO_ENABLED: "true",
        PAYMONGO_MODE: "live",
        PAYMONGO_SECRET_KEY: "sk_test_example",
        PAYMONGO_WEBHOOK_SECRET: "whsec_live_example",
        PAYMONGO_SYSTEM_ACTOR_USER_ID: "900",
        PAYMONGO_PAYMENT_METHOD_TYPES: "qrph",
      }),
    /PayMongo live mode requires a sk_live_ secret key/,
  );
});

test("parseServerEnv rejects unsupported PayMongo payment methods", () => {
  assert.throws(
    () =>
      parseServerEnv({
        ...baseEnv,
        PAYMONGO_ENABLED: "true",
        PAYMONGO_SECRET_KEY: "sk_test_example",
        PAYMONGO_WEBHOOK_SECRET: "whsec_test_example",
        PAYMONGO_SYSTEM_ACTOR_USER_ID: "900",
        PAYMONGO_PAYMENT_METHOD_TYPES: "card,unsupported",
      }),
    /Unsupported PayMongo payment method type: unsupported/,
  );
});


test("parseServerEnv requires a configured PayMongo system actor when enabled", () => {
  assert.throws(
    () => parseServerEnv({
      ...baseEnv,
      PAYMONGO_ENABLED: "true",
      PAYMONGO_SECRET_KEY: "sk_test_example",
      PAYMONGO_WEBHOOK_SECRET: "whsec_test_example",
    }),
    /PAYMONGO_SYSTEM_ACTOR_USER_ID/,
  );
});

test("parseServerEnv rejects a nonnumeric PayMongo system actor ID", () => {
  assert.throws(
    () => parseServerEnv({
      ...baseEnv,
      PAYMONGO_ENABLED: "true",
      PAYMONGO_SECRET_KEY: "sk_test_example",
      PAYMONGO_WEBHOOK_SECRET: "whsec_test_example",
      PAYMONGO_SYSTEM_ACTOR_USER_ID: "bookkeeper-first",
    }),
    /positive numeric user ID/,
  );
});
