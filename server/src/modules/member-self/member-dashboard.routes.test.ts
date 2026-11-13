import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import type { Pool } from "mysql2/promise";
import type { AuthService } from "../auth/auth.service";
import { createMemberSelfRouter } from "./member-self.routes";
import { createMemberSelfService } from "./member-self.service";
import { createMemberSelfRepository } from "./member-self.repository";

function fixture(livelihoods: unknown, failure?: Error) {
  const writes: string[] = [];
  const pool = { async execute(sql: string, values: unknown[] = []) {
    if (/^(UPDATE|INSERT|DELETE)/.test(sql)) writes.push(sql);
    if (sql.includes("FROM member_profiles")) {
      assert.deepEqual(values, ["7"]);
      if (failure) throw failure;
      return [[{ member_id: 12, membership_type: "True Member", member_code: "TEST-12", referral_code: "REF-12", livelihoods, occupation: "Farmer" }], []];
    }
    if (sql.includes("AS validatedTotal")) return [[{ validatedTotal: "1500.00" }], []];
    if (sql.includes("COUNT(*) as count FROM pos_sales")) return [[{ count: 2 }], []];
    return [[], []];
  } } as unknown as Pool;
  const authService = { async authenticate() { return { user: { id: "7", role: "member" }, sessionId: "synthetic", tokenHash: "synthetic" }; } } as unknown as AuthService;
  const app = express();
  app.use(express.json());
  app.use("/api", createMemberSelfRouter(authService, createMemberSelfService(createMemberSelfRepository(pool))));
  return { app, writes };
}

for (const [name, value] of [
  ["legacy string entries", ["Rice farming"]],
  ["invalid saved dates", [{ activity: "Rice", plantingDate: "2099-01-01" }]],
  ["duplicate activities", [{ activity: "Rice" }, { activity: "rice" }]],
  ["malformed JSON", "not-json"],
] as const) {
  test(`dashboard remains available with ${name} and does not rewrite saved data`, async () => {
    const { app, writes } = fixture(value);
    const response = await request(app).get("/api/members/me/dashboard?period=year&includeFinancialSummary=false");
    assert.equal(response.status, 200);
    assert.equal(response.body.isLinked, true);
    assert.equal(response.body.member.livelihoodsUnavailable, true);
    assert.deepEqual(response.body.member.livelihoods, []);
    assert.equal(response.body.shareCapital.total, 1500);
    assert.equal(response.body.stats.purchases, 2);
    assert.deepEqual(writes, []);
  });
}

test("dashboard preserves valid saved livelihoods", async () => {
  const livelihoods = [{ activity: "Rice", plantingDate: "2020-01-01" }];
  const response = await request(fixture(livelihoods).app).get("/api/members/me/dashboard?includeFinancialSummary=false");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.member.livelihoods, livelihoods);
  assert.equal(response.body.member.livelihoodsUnavailable, false);
});

test("invalid livelihood writes remain rejected", async () => {
  const { app, writes } = fixture([]);
  const response = await request(app).put("/api/members/me/profile").send({ occupation: "Farmer", livelihoods: [{ activity: "Rice", plantingDate: "2099-01-01" }] });
  assert.equal(response.status, 400);
  assert.deepEqual(writes, []);
});

test("dashboard does not hide database failures as healthy empty results", async () => {
  const failure = Object.assign(new Error("Synthetic database failure"), { code: "ER_BAD_FIELD_ERROR" });
  const response = await request(fixture([], failure).app).get("/api/members/me/dashboard?includeFinancialSummary=false");
  assert.equal(response.status, 500);
  assert.equal(response.body.error, "Failed to fetch dashboard data");
  assert.equal(response.body.isLinked, undefined);
});
