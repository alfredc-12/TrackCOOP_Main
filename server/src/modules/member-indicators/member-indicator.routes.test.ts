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
        distribution: [
          { statusLabel: "Active", total: 0, percentage: 0 },
          { statusLabel: "Needs Monitoring", total: 0, percentage: 0 },
          { statusLabel: "Inactive", total: 0, percentage: 0 },
        ],
      };
    },
    async getMemberIndicatorHistory() {
      return {
        indicators: [
          {
            id: "1",
            memberId: "10",
            memberCode: "NFFAC-2026-000010",
            fullName: "Sample Member",
            membershipType: "Associate",
            officialMemberStatus: "Active",
            basisPeriodStart: new Date("2025-01-01T00:00:00.000Z"),
            basisPeriodEnd: new Date("2025-12-31T00:00:00.000Z"),
            recencyScore: 5,
            frequencyScore: 4,
            contributionScore: 3,
            totalScore: 12,
            statusLabel: "Active",
            basisSummary: JSON.stringify({
              formulaVersion: "transaction-rfm-v1",
              advisoryOnly: true,
              officialStatusUnchanged: true,
            }),
            computedBy: "1",
            computedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        total: 1,
      };
    },
    async recalculate() {
      return {
        recalculated: 3,
        basisPeriodStart: "2025-01-01",
        basisPeriodEnd: "2025-12-31",
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

test("GET /api/member-indicators/:memberId/history returns calculation history", async () => {
  const response = await request(createApp("chairman"))
    .get("/api/member-indicators/10/history")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].basisSummary.includes("transaction-rfm-v1"), true);
  assert.equal(response.body.meta.total, 1);
});
