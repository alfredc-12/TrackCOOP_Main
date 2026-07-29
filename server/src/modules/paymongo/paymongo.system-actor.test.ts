import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import { createAuthService } from "../auth/auth.service";
import type { AuthRepository } from "../auth/auth.repository";
import {
  assertPaymongoPortalLoginAllowed,
  resolvePaymongoSettlementActor,
} from "./paymongo.system-actor";

class ActorConnection {
  queries: string[] = [];
  constructor(private readonly rows: Record<string, unknown>) {}
  async beginTransaction() {}
  async commit() {}
  async rollback() {}
  release() {}
  async getConnection() { return this; }
  async execute<T = unknown>(sql: string, values: unknown[] = []): Promise<[T, unknown]> {
    this.queries.push(sql);
    const row = this.rows[String(values[0])];
    return [[...(row ? [row] : [])] as T, null];
  }
}

const systemRow = {
  id: "900", displayName: "PayMongo System Service", username: "paymongo-system",
  accountStatus: "Active", role: "bookkeeper", roleIsActive: 1,
};
const bookkeeperRow = {
  id: "42", displayName: "Bookkeeper Forty Two", username: "bk42",
  accountStatus: "Active", role: "bookkeeper", roleIsActive: 1,
};

test("webhook attribution uses only the configured service account without staff fallback", async () => {
  const connection = new ActorConnection({ "900": systemRow });
  const actor = await resolvePaymongoSettlementActor(connection as unknown as PoolConnection, {
    validationSource: "PayMongo Webhook", actorUserId: null,
    configuredSystemActorUserId: "900",
  });
  assert.deepEqual(actor, { id: "900", actorType: "PayMongo System Service" });
  assert.equal(connection.queries.length, 1);
  assert.match(connection.queries[0], /WHERE u\.user_id = \?/);
  assert.doesNotMatch(connection.queries[0], /ORDER BY/);
});

test("missing and invalid configured system actors fail safely", async () => {
  await assert.rejects(
    () => resolvePaymongoSettlementActor(new ActorConnection({}) as unknown as PoolConnection, {
      validationSource: "PayMongo Webhook", actorUserId: null,
    }),
    (error) => error instanceof AppError && error.code === "PAYMONGO_SYSTEM_ACTOR_REQUIRED",
  );
  await assert.rejects(
    () => resolvePaymongoSettlementActor(new ActorConnection({ "900": { ...systemRow, displayName: "Human Bookkeeper" } }) as unknown as PoolConnection, {
      validationSource: "PayMongo Webhook", actorUserId: null,
      configuredSystemActorUserId: "900",
    }),
    (error) => error instanceof AppError && error.code === "PAYMONGO_SYSTEM_ACTOR_INVALID",
  );
});

test("manual settlement keeps authenticated Bookkeeper attribution", async () => {
  const actor = await resolvePaymongoSettlementActor(new ActorConnection({ "42": bookkeeperRow }) as unknown as PoolConnection, {
    validationSource: "Manual Bookkeeper", actorUserId: "42",
    configuredSystemActorUserId: "900",
  });
  assert.deepEqual(actor, { id: "42", actorType: "Authenticated Bookkeeper" });
});

test("configured service account cannot use normal portal login", async () => {
  let sessions = 0;
  const repository: AuthRepository = {
    async findLoginAccount() {
      return {
        id: "900", displayName: "PayMongo System Service", email: "paymongo-system@example.test",
        username: "paymongo-system", role: "bookkeeper", passwordHash: "hash",
        accountStatus: "Active", failedLoginCount: 0, lockedUntil: null, roleIsActive: true,
      };
    },
    async recordFailedLogin() {},
    async createSession() { sessions += 1; },
    async findSession() {
      return {
        sessionId: "session-900", tokenHash: "token-hash",
        user: { id: "900", displayName: "PayMongo System Service",
          email: "paymongo-system@example.test", username: "paymongo-system",
          role: "bookkeeper" },
      };
    },
    async revokeCurrentSession() {},
    async listSessions() { return []; },
    async revokeSessionById() { return false; },
  };
  const auth = createAuthService(repository, {
    verifyPassword: async () => true,
    paymongoSystemActorUserId: "900",
  });
  await assert.rejects(
    () => auth.login(
      { identifier: "paymongo-system", password: "correct" },
      { ipAddress: null, userAgent: null },
    ),
    (error) => error instanceof AppError
      && error.code === "PAYMONGO_SYSTEM_ACCOUNT_LOGIN_DISABLED",
  );
  assert.equal(sessions, 0);
  await assert.rejects(
    () => auth.authenticate("x".repeat(40)),
    (error) => error instanceof AppError
      && error.code === "PAYMONGO_SYSTEM_ACCOUNT_LOGIN_DISABLED",
  );
  assert.throws(
    () => assertPaymongoPortalLoginAllowed("900", "900"),
    (error) => error instanceof AppError
      && error.code === "PAYMONGO_SYSTEM_ACCOUNT_LOGIN_DISABLED",
  );
});
import type { PoolConnection } from "mysql2/promise";
