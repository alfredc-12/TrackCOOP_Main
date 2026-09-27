import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { createPatronageRepository } from "./patronage.repository";

const auth: AuthContext = {
  user: {
    id: "1",
    displayName: "Chairman",
    email: "chairman@example.test",
    username: "chairman",
    role: "chairman",
  },
  sessionId: "10",
  tokenHash: "hash",
};

function fakeConnection(rows: unknown[][]) {
  const state = {
    executeCount: 0,
    committed: false,
    rolledBack: false,
  };
  const connection = {
    async beginTransaction() {},
    async commit() {
      state.committed = true;
    },
    async rollback() {
      state.rolledBack = true;
    },
    release() {},
    async execute() {
      const result = rows[state.executeCount] ?? [];
      state.executeCount += 1;
      return [result];
    },
  };

  return { connection, state };
}

function fakePool(rows: unknown[][]) {
  const state = {
    executeCount: 0,
    queries: [] as string[],
  };

  return {
    state,
    pool: {
      async execute(sql: string) {
        state.queries.push(sql);
        const result = rows[state.executeCount] ?? [];
        state.executeCount += 1;
        return [result];
      },
    },
  };
}

test("createPeriod rejects duplicate patronage period names before insert", async () => {
  const { connection, state } = fakeConnection([[{ patronage_period_id: 1 }]]);
  const repository = createPatronageRepository({
    async getConnection() {
      return connection as never;
    },
  } as never);

  await assert.rejects(
    () => repository.createPeriod({
      name: "2026 Patronage Refund",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      refundPool: 1000,
      notes: null,
    }, auth),
    (error) => error instanceof AppError && error.code === "PATRONAGE_PERIOD_NAME_DUPLICATE",
  );

  assert.equal(state.executeCount, 1);
  assert.equal(state.rolledBack, true);
  assert.equal(state.committed, false);
});

test("createPeriod rejects periods with no eligible member patronage", async () => {
  const { connection, state } = fakeConnection([[], [], []]);
  const repository = createPatronageRepository({
    async getConnection() {
      return connection as never;
    },
  } as never);

  await assert.rejects(
    () => repository.createPeriod({
      name: "August Patronage",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      refundPool: 1000,
      notes: null,
    }, auth),
    (error) => error instanceof AppError && error.code === "PATRONAGE_NO_ELIGIBLE_MEMBER_USAGE",
  );

  assert.equal(state.executeCount, 3);
  assert.equal(state.rolledBack, true);
  assert.equal(state.committed, false);
});

test("member patronage account is limited to active Associate and True Members", async () => {
  const { pool, state } = fakePool([[]]);
  const repository = createPatronageRepository(pool as never);

  await assert.rejects(
    () => repository.memberSummary({ ...auth, user: { ...auth.user, role: "member" } }),
    (error) => error instanceof AppError && error.code === "MEMBER_PATRONAGE_NOT_ELIGIBLE",
  );

  assert.match(state.queries[0], /approval_status = 'Approved'/);
  assert.match(state.queries[0], /official_member_status = 'Active'/);
  assert.match(state.queries[0], /membership_type IN \('Associate', 'True Member'\)/);
});
