import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, AuthUser, RoleSlug } from "../auth/auth.types";
import { createLandingRouter } from "./landing.routes";
import type { LandingService } from "./landing.service";

const baseUser: AuthUser = {
  id: "1",
  displayName: "Chair Person",
  email: "chair@example.test",
  username: "chair",
  role: "chairman",
};

function createAuthService(role: RoleSlug): AuthService {
  const auth: AuthContext = {
    sessionId: "session-1",
    tokenHash: "token-hash",
    user: { ...baseUser, role },
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

function createLandingService() {
  const calls: Array<{ method: string; authRole?: RoleSlug; input?: Record<string, unknown> }> = [];

  const service: LandingService = {
    async publicLanding() {
      calls.push({ method: "publicLanding" });
      return {
        contentBlocks: [],
        services: [{ id: "svc-1", title: "Membership Assistance" }],
        programs: [],
        partners: [],
        gallery: [],
      };
    },
    async list(_collection, query) {
      calls.push({ method: "list" });
      return { records: [], total: 0, page: query.page, pageSize: query.pageSize };
    },
    async create(collection, input, auth) {
      calls.push({ method: `create:${collection}`, authRole: auth.user.role, input });
      return { id: "created-1", ...input };
    },
    async update(collection, id, input, auth) {
      calls.push({ method: `update:${collection}:${id}`, authRole: auth.user.role, input });
      return { id, ...input };
    },
    async listSettings(query) {
      calls.push({ method: "listSettings" });
      return { records: [], total: 0, page: query.page, pageSize: query.pageSize };
    },
    async upsertSetting(input, auth) {
      calls.push({ method: "upsertSetting", authRole: auth.user.role, input });
      return { id: "setting-1", ...input };
    },
    async listAuditLogs(query) {
      calls.push({ method: "listAuditLogs" });
      return { records: [], total: 0, page: query.page, pageSize: query.pageSize };
    },
  };

  return { service, calls };
}

function createApp(role: RoleSlug) {
  const app = express();
  const landing = createLandingService();

  app.use(cookieParser());
  app.use(express.json());
  app.use((request, _response, next) => {
    request.requestId = "test-request";
    next();
  });
  app.use("/api", createLandingRouter(createAuthService(role), landing.service));
  app.use(errorHandler);

  return { app, calls: landing.calls };
}

test("GET /api/public/landing is available without a session", async () => {
  const { app, calls } = createApp("bookkeeper");

  const response = await request(app).get("/api/public/landing");

  assert.equal(response.status, 200);
  assert.equal(response.body.data.services[0].title, "Membership Assistance");
  assert.equal(calls[0].method, "publicLanding");
});

test("POST /api/landing/services allows chairman landing edits", async () => {
  const { app, calls } = createApp("chairman");

  const response = await request(app)
    .post("/api/landing/services")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({
      serviceCode: "MEMBERSHIP",
      serviceType: "Membership",
      title: "Membership Assistance",
      serviceStatus: "Active",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.title, "Membership Assistance");
  assert.equal(calls[0].method, "create:services");
  assert.equal(calls[0].authRole, "chairman");
});

test("POST /api/landing/services rejects invalid payloads before persistence", async () => {
  const { app, calls } = createApp("chairman");

  const response = await request(app)
    .post("/api/landing/services")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({
      serviceCode: "MEMBERSHIP",
      serviceType: "Unsupported",
      title: "",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.errors[0].code, "VALIDATION_ERROR");
  assert.equal(calls.length, 0);
});

test("PUT /api/system-settings is restricted to chairmen", async () => {
  const { app, calls } = createApp("bookkeeper");

  const response = await request(app)
    .put("/api/system-settings")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({
      settingGroup: "landing",
      settingKey: "homepage_mode",
      settingValue: "published",
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.errors[0].code, "FORBIDDEN");
  assert.equal(calls.length, 0);
});
