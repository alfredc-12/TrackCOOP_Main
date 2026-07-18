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
          {
            id: "7",
            username: "bookkeeper",
            email: "bookkeeper@example.test",
            displayName: "Book Keeper",
            role: "bookkeeper",
            accountStatus: "Active",
            lastLoginAt: null,
            createdAt: new Date("2026-07-18T00:00:00.000Z"),
            updatedAt: new Date("2026-07-18T00:00:00.000Z"),
          },
        ],
        total: 1,
        page: query.page,
        pageSize: query.pageSize,
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
    async getUser() {
      return null;
    },
    async createUser() {
      throw new Error("not used");
    },
    async updateUser() {
      throw new Error("not used");
    },
    async updateStatus() {
      throw new Error("not used");
    },
    async updateRole() {
      throw new Error("not used");
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
