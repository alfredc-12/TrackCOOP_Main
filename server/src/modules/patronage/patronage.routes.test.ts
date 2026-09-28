import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, AuthUser } from "../auth/auth.types";
import { createPatronageRouter } from "./patronage.routes";
import type { PatronageService } from "./patronage.service";

function user(role: AuthUser["role"]): AuthUser {
  return {
    id: role === "chairman" ? "1" : role === "bookkeeper" ? "2" : "3",
    displayName: role,
    email: `${role}@example.test`,
    username: role,
    role,
  };
}

function authService(): AuthService {
  return {
    async login() {
      throw new Error("not used");
    },
    async authenticate(rawToken) {
      const role = rawToken === "chairman" ? "chairman" : rawToken === "bookkeeper" ? "bookkeeper" : "member";
      return {
        user: user(role),
        sessionId: "10",
        tokenHash: "hash",
      } satisfies AuthContext;
    },
    async logout() {},
    async listSessions() {
      return [];
    },
    async revokeSession() {},
  };
}

function patronageService(): PatronageService {
  return {
    async overview() {
      return {
        periods: [],
        selectedPeriod: null,
        allocations: [],
      };
    },
    async financialBasis() {
      throw new Error("not used");
    },
    async createPeriod() {
      throw new Error("not used");
    },
    async recalculate() {
      throw new Error("not used");
    },
    async finalize() {
      throw new Error("not used");
    },
    async markPaid() {
      throw new Error("not used");
    },
    async memberSummary() {
      throw new Error("not used");
    },
  };
}

function app() {
  const server = express();
  server.use(express.json());
  server.use(cookieParser());
  server.use("/api", createPatronageRouter(authService(), patronageService()));
  server.use(errorHandler);
  return server;
}

test("bookkeeper can open patronage overview", async () => {
  const response = await request(app())
    .get("/api/patronage")
    .set("Cookie", "trackcoop_session=bookkeeper");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, {
    periods: [],
    selectedPeriod: null,
    allocations: [],
  });
});

test("bookkeeper cannot create patronage periods", async () => {
  const response = await request(app())
    .post("/api/patronage/periods")
    .set("Cookie", "trackcoop_session=bookkeeper")
    .send({
      name: "2026 Patronage Refund",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      refundPool: 1000,
    });

  assert.equal(response.status, 403);
});
