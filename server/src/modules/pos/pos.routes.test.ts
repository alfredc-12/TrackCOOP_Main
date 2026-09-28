import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, AuthUser, RoleSlug } from "../auth/auth.types";
import { createPosRouter } from "./pos.routes";
import type { PosService } from "./pos.service";

const staffUser: AuthUser = {
  id: "1",
  displayName: "Staff User",
  email: "staff@example.test",
  username: "staff",
  role: "chairman",
};

function createAuthService(role: RoleSlug): AuthService {
  const auth: AuthContext = {
    sessionId: "1",
    tokenHash: "hash",
    user: { ...staffUser, role },
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

function createPosService() {
  let completed = 0;
  let confirmed = 0;

  const service = {
    async listOrders() {
      return [];
    },
    async listMemberHistory() {
      return [];
    },
    async checkout() {
      return {};
    },
    async confirmOrder() {
      confirmed += 1;
      return { receiptDocumentId: null, paymentReferenceId: 1 };
    },
    async completeOrder() {
      completed += 1;
    },
    async rejectOrder() {},
    async revokeOrder() {},
  } as unknown as PosService;

  return {
    service,
    calls: () => ({ completed, confirmed }),
  };
}

function createApp(role: RoleSlug) {
  const pos = createPosService();
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use((request, _response, next) => {
    request.requestId = "test-request";
    next();
  });
  app.use("/api", createPosRouter(createAuthService(role), pos.service));
  app.use(errorHandler);
  return { app, calls: pos.calls };
}

test("POS cash payment confirmation is bookkeeper-only", async () => {
  const { app, calls } = createApp("chairman");
  const response = await request(app)
    .put("/api/pos/orders/1/confirm")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({});

  assert.equal(response.status, 403);
  assert.equal(calls().confirmed, 0);
});

test("POS product release is chairman-only", async () => {
  const { app, calls } = createApp("bookkeeper");
  const response = await request(app)
    .put("/api/pos/orders/1/complete")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({});

  assert.equal(response.status, 403);
  assert.equal(calls().completed, 0);
});

test("Bookkeeper can confirm payment and chairman can release a paid order", async () => {
  const bookkeeper = createApp("bookkeeper");
  const bookkeeperResponse = await request(bookkeeper.app)
    .put("/api/pos/orders/1/confirm")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({});
  assert.equal(bookkeeperResponse.status, 200);
  assert.equal(bookkeeper.calls().confirmed, 1);

  const chairman = createApp("chairman");
  const chairmanResponse = await request(chairman.app)
    .put("/api/pos/orders/1/complete")
    .set("Cookie", "trackcoop_session=opaque-cookie-value")
    .send({});
  assert.equal(chairmanResponse.status, 200);
  assert.equal(chairman.calls().completed, 1);
});
