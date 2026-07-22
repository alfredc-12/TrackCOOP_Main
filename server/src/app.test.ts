import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "./app";

const frontendUrl = "http://localhost:3000";

test("GET /api/health returns the standard success envelope", async () => {
  const response = await request(
    createApp({ enableRequestLogging: false, frontendUrl }),
  ).get("/api/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "ok");
  assert.equal(response.body.data.service, "trackcoop-api");
  assert.equal(response.body.message, "API is healthy");
  assert.deepEqual(response.body.meta, {});
  assert.match(response.headers["x-request-id"], /^[0-9a-f-]{36}$/);
});

test("GET /api/health/database reports an injected successful probe", async () => {
  const response = await request(
    createApp({
      databaseProbe: async () => ({ latencyMs: 7 }),
      enableRequestLogging: false,
      frontendUrl,
    }),
  ).get("/api/health/database");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "ok");
  assert.equal(response.body.data.latencyMs, 7);
  assert.equal(response.body.message, "Database is reachable");
});

test("GET /api/health/database hides database failure details", async () => {
  const response = await request(
    createApp({
      databaseProbe: async () => {
        throw new Error("sensitive connection detail");
      },
      enableRequestLogging: false,
      frontendUrl,
    }),
  ).get("/api/health/database");

  assert.equal(response.status, 503);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Database is unavailable");
  assert.equal(response.body.errors[0].code, "DATABASE_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(response.body), /sensitive connection detail/);
});

test("unknown routes return the standard failure envelope", async () => {
  const response = await request(
    createApp({ enableRequestLogging: false, frontendUrl }),
  ).get("/api/does-not-exist");

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.errors[0].code, "ROUTE_NOT_FOUND");
});

test("browser mutation requests from an untrusted origin are rejected", async () => {
  const response = await request(
    createApp({ enableRequestLogging: false, frontendUrl }),
  )
    .post("/api/does-not-exist")
    .set("Origin", "https://untrusted.example")
    .send({});

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.errors[0].code, "CORS_ORIGIN_DENIED");
});

test("browser mutation requests from the configured frontend pass origin checks", async () => {
  const response = await request(
    createApp({ enableRequestLogging: false, frontendUrl }),
  )
    .post("/api/does-not-exist")
    .set("Origin", frontendUrl)
    .send({});

  assert.equal(response.status, 404);
  assert.equal(response.body.errors[0].code, "ROUTE_NOT_FOUND");
});
