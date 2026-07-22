import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, AuthUser, RoleSlug } from "../auth/auth.types";
import { createMemberIndicatorRouter } from "./member-indicator.routes";
import type { MemberIndicatorService } from "./member-indicator.service";

const user: AuthUser = {
  id: "1",
  displayName: "Chair Person",
  email: "chair@example.test",
  username: "chair",
  role: "chairman",
};

function createAuthService(role: RoleSlug): AuthService {
  const auth: AuthContext = {
    sessionId: "1",
    tokenHash: "hash",
    user: { ...user, role },
  };

  return {
    async login() {
      throw new Error("not used");
    },
    async authenticate(rawToken) {
      if (!rawToken) throw new Error("missing token");
      return auth;
    },
    async logout() {},
    async listSessions() {
      return [];
    },
    async revokeSession() {},
  };
}

function createService(): MemberIndicatorService {
  return {
    async listIndicators(query) {
      return { indicators: [], total: 0, page: query.page, pageSize: query.pageSize };
    },
    async getMemberIndicator() {
      return null;
    },
    async summary() {
      return {
        totalTracked: 0,
        active: 0,
        needsMonitoring: 0,
        inactive: 0,
        averageScore: 0,
      };
    },
    async recalculate() {
      return {
        recalculated: 3,
        basisPeriodStart: null,
        basisPeriodEnd: null,
      };
    },
  };
}

function createApp(role: RoleSlug) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use((request, _response, next) => {
    request.requestId = "test-request";
    next();
  });
  app.use(
    "/api",
    createMemberIndicatorRouter(createAuthService(role), createService()),
  );
  app.use(errorHandler);
  return app;
}

test("POST /api/member-indicators/recalculate is available to chairmen", async () => {
  const response = await request(createApp("chairman"))
    .post("/api/member-indicators/recalculate")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.data.recalculated, 3);
});

test("POST /api/member-indicators/recalculate rejects bookkeepers", async () => {
  const response = await request(createApp("bookkeeper"))
    .post("/api/member-indicators/recalculate")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({});

  assert.equal(response.status, 403);
  assert.equal(response.body.errors[0].code, "FORBIDDEN");
});
