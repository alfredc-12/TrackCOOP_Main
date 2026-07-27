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
  BCRYPT_ROUNDS: "12",
};

test("parseServerEnv keeps PayMongo disabled by default without secrets", () => {
  const config = parseServerEnv(baseEnv);

  assert.equal(config.PAYMONGO_ENABLED, false);
  assert.equal(config.PAYMONGO_MODE, "test");
  assert.equal(config.PAYMONGO_API_BASE_URL, "https://api.paymongo.com");
  assert.equal(config.PAYMONGO_SECRET_KEY, undefined);
  assert.equal(config.PAYMONGO_WEBHOOK_SECRET, undefined);
  assert.equal(config.PAYMONGO_WEBHOOK_TOLERANCE_SECONDS, 300);
  assert.equal(config.PAYMONGO_CHECKOUT_REUSE_MINUTES, 30);
  assert.deepEqual(config.PAYMONGO_PAYMENT_METHOD_TYPES, ["card"]);
  assert.equal(config.PAYMONGO_PASS_ON_FEES, false);
});

test("parseServerEnv accepts enabled PayMongo test configuration", () => {
  const config = parseServerEnv({
    ...baseEnv,
    PAYMONGO_ENABLED: "true",
    PAYMONGO_MODE: "test",
    PAYMONGO_SECRET_KEY: "sk_test_example",
    PAYMONGO_WEBHOOK_SECRET: "whsec_test_example",
    PAYMONGO_CHECKOUT_REUSE_MINUTES: "45",
    PAYMONGO_PAYMENT_METHOD_TYPES: "card",
    PAYMONGO_PASS_ON_FEES: "true",
  });

  assert.equal(config.PAYMONGO_ENABLED, true);
  assert.equal(config.PAYMONGO_SECRET_KEY, "sk_test_example");
  assert.equal(config.PAYMONGO_WEBHOOK_SECRET, "whsec_test_example");
  assert.equal(config.PAYMONGO_CHECKOUT_REUSE_MINUTES, 45);
  assert.deepEqual(config.PAYMONGO_PAYMENT_METHOD_TYPES, ["card"]);
  assert.equal(config.PAYMONGO_PASS_ON_FEES, true);
});

test("parseServerEnv validates the PayMongo checkout reuse interval", () => {
  for (const value of ["0", "1441", "1.5"]) {
    assert.throws(
      () => parseServerEnv({ ...baseEnv, PAYMONGO_CHECKOUT_REUSE_MINUTES: value }),
      /PAYMONGO_CHECKOUT_REUSE_MINUTES/,
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
    /PAYMONGO_SECRET_KEY.*PAYMONGO_WEBHOOK_SECRET/,
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
      }),
    /PayMongo live secret keys are not allowed outside production/,
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
        PAYMONGO_PAYMENT_METHOD_TYPES: "card,unsupported",
      }),
    /Unsupported PayMongo payment method type: unsupported/,
  );
});
