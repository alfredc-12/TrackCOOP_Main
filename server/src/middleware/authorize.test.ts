import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { requireRoles } from "./authorize";
import { errorHandler } from "./error-handler";
import type { RoleSlug } from "../modules/auth/auth.types";

function createRoleApp(role: RoleSlug) {
  const app = express();
  app.use((request, _response, next) => {
    request.requestId = "test-request";
    request.auth = {
      sessionId: "1",
      tokenHash: "hash",
      user: {
        id: "1",
        displayName: "Test User",
        email: "test@example.test",
        username: null,
        role,
      },
    };
    next();
  });
  app.get("/chairman", requireRoles("chairman"), (_request, response) => {
    response.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

test("requireRoles permits an allowed role", async () => {
  const response = await request(createRoleApp("chairman")).get("/chairman");
  assert.equal(response.status, 200);
});

test("requireRoles rejects a different authenticated role", async () => {
  const response = await request(createRoleApp("bookkeeper")).get("/chairman");
  assert.equal(response.status, 403);
  assert.equal(response.body.errors[0].code, "FORBIDDEN");
});
