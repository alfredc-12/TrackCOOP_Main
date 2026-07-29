import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, AuthUser, RoleSlug } from "../auth/auth.types";
import { createUserRouter } from "./user.routes";
import type { UserService } from "./user.service";

const chairman: AuthUser = {
  id: "1",
  displayName: "Chair Person",
  email: "chair@example.test",
  username: "chair",
  role: "chairman",
};

const userSummary = {
  id: "7",
  username: "bookkeeper",
  email: "bookkeeper@example.test",
  displayName: "Book Keeper",
  role: "bookkeeper" as const,
  accountStatus: "Active" as const,
  lastLoginAt: null,
  createdAt: new Date("2026-07-18T00:00:00.000Z"),
  linkedMemberId: "12",
  linkedMemberCode: "NFFAC-2026-000012",
  linkedMemberName: "Member Linked",
  activeSessionCount: 2,
  activationTokenExpiresAt: null,
};

const userDetail = {
  ...userSummary,
  sessions: [
    {
      id: "99",
      ipAddress: "127.0.0.1",
      userAgent: "Playwright",
      createdAt: new Date("2026-07-24T00:00:00.000Z"),
      expiresAt: new Date("2026-07-25T00:00:00.000Z"),
      isCurrent: false,
    },
  ],
};

function createAuthService(role: RoleSlug): AuthService {
  const auth: AuthContext = {
    sessionId: "1",
    tokenHash: "hash",
    user: { ...chairman, role },
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

function createUserService(): UserService {
  return {
    async listUsers(query) {
      return {
        users: [
          userSummary,
        ],
        total: 1,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
    async getSummary() {
      return {
        total: 1,
        active: 1,
        pendingActivation: 0,
        suspendedInactive: 0,
      };
    },
    async listRoles() {
      return [
        {
          id: "2",
          slug: "bookkeeper",
          name: "Bookkeeper",
          description: null,
          isActive: true,
        },
      ];
    },
    async listLinkableMembers() {
      return [
        {
          id: "11",
          memberCode: "NFFAC-2026-000011",
          fullName: "Unlinked Member",
          email: "member@example.test",
        },
      ];
    },
    async getUser() {
      return userDetail;
    },
    async createUser() {
      return { user: userSummary };
    },
    async updateUser() {
      return userSummary;
    },
    async updateStatus() {
      return { ...userSummary, accountStatus: "Suspended" };
    },
    async updateRole() {
      return { ...userSummary, role: "member" };
    },
    async issueActivationLink() {
      return {
        user: { ...userSummary, accountStatus: "Pending" },
        activationUrl: "http://localhost:3000/activate?token=secret",
        activationTokenExpiresAt: new Date("2026-07-25T00:00:00.000Z"),
      };
    },
    async revokeSession() {
      return { ...userDetail, sessions: [] };
    },
    async revokeAllSessions() {
      return { ...userDetail, sessions: [] };
    },
    async linkMember() {
      return { ...userDetail, linkedMemberId: "11" };
    },
    async unlinkMember() {
      return { ...userDetail, linkedMemberId: null, linkedMemberCode: null, linkedMemberName: null };
    },
    async deleteUser() {},
    async resetPassword() {},
    async exportUsersCsv() {
      return "User ID,Username\n";
    },
    async bulkAction() {
      return { count: 0 };
    },
    async getAuditLogs() {
      return [];
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
  app.use("/api", createUserRouter(createAuthService(role), createUserService()));
  app.use(errorHandler);
  return app;
}

test("GET /api/users returns accounts for chairmen", async () => {
  const response = await request(createApp("chairman"))
    .get("/api/users")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].role, "bookkeeper");
  assert.equal(response.body.meta.total, 1);
});

test("GET /api/users rejects non-chairman roles", async () => {
  const response = await request(createApp("bookkeeper"))
    .get("/api/users")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 403);
  assert.equal(response.body.errors[0].code, "FORBIDDEN");
});

test("GET /api/users/summary returns account lifecycle totals", async () => {
  const response = await request(createApp("chairman"))
    .get("/api/users/summary")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.equal(response.body.data.active, 1);
});

test("GET /api/users/linkable-members returns unlinked approved members", async () => {
  const response = await request(createApp("chairman"))
    .get("/api/users/linkable-members")
    .set("Cookie", "trackcoop_session=opaque-cookie-value");

  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].memberCode, "NFFAC-2026-000011");
});

test("Chairman lifecycle routes accept reasoned account actions", async () => {
  const app = createApp("chairman");
  const cookie = "trackcoop_session=opaque-cookie-value";

  const status = await request(app)
    .patch("/api/users/7/status")
    .set("Cookie", cookie)
    .send({ accountStatus: "Suspended", reason: "Board-authorized access review." });
  assert.equal(status.status, 200);
  assert.equal(status.body.data.accountStatus, "Suspended");

  const role = await request(app)
    .patch("/api/users/7/role")
    .set("Cookie", cookie)
    .send({ role: "member", reason: "Converted to member self-service only." });
  assert.equal(role.status, 200);
  assert.equal(role.body.data.role, "member");

  const activation = await request(app)
    .post("/api/users/7/activation-link")
    .set("Cookie", cookie)
    .send({ reason: "Original activation link expired." });
  assert.equal(activation.status, 200);
  assert.match(activation.body.data.activationUrl, /activate\?token=/);
});

test("Chairman session and member-link lifecycle routes are available", async () => {
  const app = createApp("chairman");
  const cookie = "trackcoop_session=opaque-cookie-value";

  const revokeOne = await request(app)
    .post("/api/users/7/sessions/99/revoke")
    .set("Cookie", cookie)
    .send({ reason: "Lost device." });
  assert.equal(revokeOne.status, 200);
  assert.equal(revokeOne.body.data.sessions.length, 0);

  const revokeAll = await request(app)
    .post("/api/users/7/sessions/revoke")
    .set("Cookie", cookie)
    .send({ reason: "Role changed." });
  assert.equal(revokeAll.status, 200);

  const link = await request(app)
    .post("/api/users/7/member-link")
    .set("Cookie", cookie)
    .send({ memberId: "11", reason: "Approved member account setup." });
  assert.equal(link.status, 200);
  assert.equal(link.body.data.linkedMemberId, "11");

  const unlink = await request(app)
    .delete("/api/users/7/member-link")
    .set("Cookie", cookie)
    .send({ reason: "Incorrect member profile selected." });
  assert.equal(unlink.status, 200);
  assert.equal(unlink.body.data.linkedMemberId, null);
});
