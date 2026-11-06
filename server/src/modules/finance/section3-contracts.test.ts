import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, RoleSlug } from "../auth/auth.types";
import { createFinanceRouter } from "./finance.routes";
import type { FinanceService } from "./finance.service";

function appFor(role: RoleSlug) {
  let posts = 0;
  let expenses = 0;
  const auth: AuthContext = {
    sessionId: "1", tokenHash: "synthetic", user: {
      id: "1", displayName: "Fixture", email: "fixture@example.test", username: "fixture", role,
    },
  };
  const authService = {
    async authenticate(token?: string) {
      if (!token) throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
      return auth;
    },
  } as AuthService;
  const financeService = {
    async postRecord(id: string) { posts += 1; return { id }; },
    async createOperatingExpense() { expenses += 1; return {}; },
  } as unknown as FinanceService;
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", createFinanceRouter(authService, financeService));
  app.use(errorHandler);
  return { app, calls: () => ({ posts, expenses }) };
}

for (const role of ["member", "chairman"] as const) {
  test(`${role} cannot reach either direct manual-finance write`, async () => {
    const fixture = appFor(role);
    for (const path of ["/api/financial-records/42/post", "/api/operating-expenses"]) {
      const response = await request(fixture.app).post(path)
        .set("Cookie", "trackcoop_session=synthetic").send({});
      assert.equal(response.status, 403);
    }
    assert.deepEqual(fixture.calls(), { posts: 0, expenses: 0 });
  });
}

test("anonymous callers cannot post a financial record", async () => {
  const fixture = appFor("bookkeeper");
  const response = await request(fixture.app).post("/api/financial-records/42/post").send({});
  assert.equal(response.status, 401);
  assert.deepEqual(fixture.calls(), { posts: 0, expenses: 0 });
});

test("Bookkeeper post uses the existing finance service and source ID", async () => {
  const fixture = appFor("bookkeeper");
  const response = await request(fixture.app).post("/api/financial-records/42/post")
    .set("Cookie", "trackcoop_session=synthetic").send({});
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.calls(), { posts: 1, expenses: 0 });
  assert.equal(response.body.data.id, "42");
});
