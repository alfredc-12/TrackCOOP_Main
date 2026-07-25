import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import express from "express";
import request from "supertest";
import { errorHandler } from "./error-handler";

function createErrorApp() {
  const app = express();
  app.use((request, _response, next) => {
    request.requestId = "test-request";
    next();
  });
  app.get("/boom", () => {
    throw new Error("database host secret should not leak");
  });
  app.use(errorHandler);
  return app;
}

test("unexpected errors are sanitized and do not write debug files", async () => {
  const response = await request(createErrorApp()).get("/boom");

  assert.equal(response.status, 500);
  assert.equal(response.body.message, "An unexpected error occurred");
  assert.deepEqual(response.body.errors, []);
  assert.equal(existsSync(path.join(process.cwd(), "debug.log")), false);
});
