import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import type { Pool } from "mysql2/promise";
import type { AuthContext } from "../auth/auth.types";
import type { AuthService } from "../auth/auth.service";
import { errorHandler } from "../../middleware/error-handler";
import { requireTrueMember } from "../../middleware/true-member";
import { createMembershipUpgradeRouter } from "./membership-upgrade.routes";
import { createMembershipUpgradeService } from "./membership-upgrade.service";
import { createMemberSelfRepository } from "../member-self/member-self.repository";

const auth: AuthContext = { user: { id: "7", displayName: "Associate", email: "associate@example.test", username: null, role: "member" }, sessionId: "1", tokenHash: "hash" };

test("only the chairman can list or decide upgrade applications", async () => {
  const { pool, state } = fixture();
  const authService = { authenticate: async () => auth } as unknown as AuthService;
  const app = express(); app.use(express.json());
  app.use("/api", createMembershipUpgradeRouter(authService, pool)); app.use(errorHandler);
  assert.equal((await request(app).get("/api/membership-upgrades")).status, 403);
  assert.equal((await request(app).post("/api/membership-upgrades/1/decision").send({ decision: "Approved", reason: "Self approval" })).status, 403);
  assert.equal(state.writes.length, 0);
});

function fixture() {
  const state = { membership: "Associate", approval: "Approved", official: "Active", pending: false, capital: 0, commit: 0, rollback: 0, writes: [] as string[] };
  const connection = {
    async beginTransaction() {}, async commit() { state.commit++; }, async rollback() { state.rollback++; }, release() {},
    async execute(sql: string) {
      if (/^(INSERT|UPDATE)/.test(sql)) {
        state.writes.push(sql);
        if (sql.startsWith("INSERT INTO membership_upgrade_requests")) state.pending = true;
        if (sql.startsWith("UPDATE member_profiles")) state.membership = "True Member";
        return [{ affectedRows: 1, insertId: 1 }, []];
      }
      if (sql.includes("FROM membership_upgrade_requests")) return [state.pending ? [{ member_id: "12", request_status: "Pending", upgrade_request_id: 1 }] : [], []];
      if (sql.includes("SUM(CASE WHEN payment_status")) return [[{ validatedTotal: state.capital, pendingTotal: 2000, validatedPayments: 1 }], []];
      if (sql.includes("FROM member_profiles")) return [[{ member_id: "12", membership_type: state.membership, approval_status: state.approval, official_member_status: state.official }], []];
      return [[], []];
    },
  };
  const pool = { ...connection, async getConnection() { return connection; } } as unknown as Pool;
  return { state, pool, service: createMembershipUpgradeService(pool) };
}

test("financial access is checked against the database on every request", async () => {
  const { pool, state } = fixture();
  const app = express();
  app.use((req, _res, next) => { req.auth = auth; next(); });
  app.get("/financial", requireTrueMember(pool), (_req, res) => res.json({ secret: true }));
  app.use(errorHandler);
  assert.equal((await request(app).get("/financial")).status, 403);
  state.membership = "True Member";
  assert.equal((await request(app).get("/financial")).status, 200);
  state.membership = "Associate";
  assert.equal((await request(app).get("/financial")).status, 403);
});

test("associates can apply before completing contributions, but cannot submit twice", async () => {
  const { service, state } = fixture();
  await service.apply(auth, "Please review my membership.");
  assert.equal(state.commit, 1);
  await assert.rejects(service.apply(auth, "Duplicate"), /already pending/);
  assert.equal(state.rollback, 1);
  assert.equal(state.writes.filter((sql) => sql.startsWith("INSERT INTO membership_upgrade_requests")).length, 1);
});

test("True Members and inactive associates cannot submit upgrade applications", async () => {
  const { service, state } = fixture();
  state.membership = "True Member";
  await assert.rejects(service.apply(auth, "Upgrade"), /Only approved, active/);
  state.membership = "Associate"; state.official = "Suspended";
  await assert.rejects(service.apply(auth, "Upgrade"), /Only approved, active/);
  assert.equal(state.writes.length, 0);
});

test("approval requires validated capital and records promotion and decision together", async () => {
  const { service, state } = fixture(); state.pending = true;
  await assert.rejects(service.decide(auth, "1", "Approved", "Reviewed"), /PHP 3000/);
  assert.equal(state.writes.length, 0);
  state.capital = 3000;
  await service.decide(auth, "1", "Approved", "Requirements verified.");
  assert.equal(state.membership, "True Member");
  assert.ok(state.writes.some((sql) => sql.includes("INSERT INTO member_status_history")));
  assert.ok(state.writes.some((sql) => sql.includes("UPDATE membership_upgrade_requests")));
  assert.equal(state.commit, 1);
});

test("rejection records the decision without changing membership", async () => {
  const { service, state } = fixture(); state.pending = true;
  await service.decide(auth, "1", "Rejected", "Requirements incomplete.");
  assert.equal(state.membership, "Associate");
  assert.ok(!state.writes.some((sql) => sql.includes("UPDATE member_profiles")));
});

test("associate dashboard omits financial payloads and financial recent activity", async () => {
  const sqlCalls: string[] = [];
  const pool = { async execute(sql: string) {
    sqlCalls.push(sql);
    if (sql.includes("FROM member_profiles")) return [[{ member_id: "12", member_code: "ASSOC-12", membership_type: "Associate", referral_code: "REF-ASSOC-12" }], []];
    if (sql.includes("'Share Capital Deposit'")) return [[{ id: "secret-capital", type: "Share Capital Deposit", amount: 1000, date: "2026-01-01" }], []];
    return [[], []];
  } } as unknown as Pool;
  const data = await createMemberSelfRepository(pool).dashboard(auth);
  assert.equal(data.membershipType, "Associate");
  assert.equal(data.canAccessFinancials, false);
  assert.deepEqual(data.shareCapital, {total:0,deadline:undefined});
  assert.equal(data.financialTransparency, null);
  assert.equal(data.memberFinancialSummary, null);
  assert.deepEqual(data.recentCapitalContributions, []);
  assert.ok(!JSON.stringify(data.recentActivity).includes("secret-capital"));
  assert.ok(!sqlCalls.some((sql) => sql.includes("FROM financial_records")));
});
