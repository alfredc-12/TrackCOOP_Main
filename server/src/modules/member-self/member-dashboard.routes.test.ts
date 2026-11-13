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
  const writeValues: unknown[][] = [];
  const pool = { async execute(sql: string, values: unknown[] = []) {
    if (/^(UPDATE|INSERT|DELETE)/.test(sql)) { writes.push(sql); writeValues.push(values); }
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
  return { app, writes, writeValues };
}

for (const [name, value, unavailable, expected] of [
  ["legacy string entries", ["Rice farming"], false, [{ activity: "Rice farming" }]],
  ["invalid saved dates", [{ activity: "Rice", plantingDate: "2099-01-01" }], true, [{ activity: "Rice" }]],
  ["duplicate activities", [{ activity: "Rice" }, { activity: "rice" }], false, [{ activity: "Rice" }]],
  ["malformed JSON", "not-json", true, []],
] as const) {
  test(`dashboard remains available with ${name} and does not rewrite saved data`, async () => {
    const { app, writes } = fixture(value);
    const response = await request(app).get("/api/members/me/dashboard?period=year&includeFinancialSummary=false");
    assert.equal(response.status, 200);
    assert.equal(response.body.isLinked, true);
    assert.equal(response.body.member.livelihoodsUnavailable, unavailable);
    assert.deepEqual(response.body.member.livelihoods, expected);
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

test("self profile exposes the original invalid metadata for review without writing it", async () => {
  const saved = [{ activity: "Rice", plantingDate: "2099-01-01" }, { activity: "Poultry" }];
  const { app, writes } = fixture(saved);
  const profile = await request(app).get("/api/members/me/profile");
  assert.equal(profile.status, 200);
  assert.deepEqual(profile.body.livelihoods, [{ activity: "Rice" }, { activity: "Poultry" }]);
  assert.deepEqual(JSON.parse(profile.body.livelihoodsReview.original), saved);
  assert.ok(profile.body.livelihoodsReview.issues.length);
  assert.deepEqual(writes, []);
});

test("replacing invalid saved data requires explicit review confirmation", async () => {
  const { app, writes } = fixture([{ activity: "Rice", plantingDate: "2099-01-01" }]);
  const corrected = { livelihoods: [{ activity: "Rice", plantingDate: "2020-01-01" }] };
  const denied = await request(app).put("/api/members/me/profile").send(corrected);
  assert.equal(denied.status, 409);
  assert.deepEqual(writes, []);
  const allowed = await request(app).put("/api/members/me/profile").send({ ...corrected, confirmLivelihoodsRepair: true });
  assert.equal(allowed.status, 200);
  assert.equal(writes.length, 1);
});

test("invalid livelihood writes remain rejected", async () => {
  const { app, writes } = fixture([]);
  const response = await request(app).put("/api/members/me/profile").send({ occupation: "Farmer", livelihoods: [{ activity: "Rice", plantingDate: "2099-01-01" }] });
  assert.equal(response.status, 400);
  assert.deepEqual(writes, []);
});

test("contact-only updates preserve invalid saved livelihoods and remain member scoped", async () => {
  const { app, writeValues } = fixture("not-json");
  const response = await request(app).put("/api/members/me/profile").send({ contact_number: "09000000000" });
  assert.equal(response.status, 200);
  assert.equal(writeValues.length, 1);
  assert.equal(writeValues[0][6], null);
  assert.equal(writeValues[0][7], 12);
});

test("original metadata is restricted to self profile and preview size is bounded", async () => {
  const saved = "<script>unsafe</script>".repeat(1000);
  const { app, writes } = fixture(saved);
  const dashboard = await request(app).get("/api/members/me/dashboard?includeFinancialSummary=false");
  assert.equal(dashboard.body.member.livelihoodsReview, undefined);
  const profile = await request(app).get("/api/members/me/profile");
  assert.equal(profile.body.livelihoodsReview.original.length, 12000);
  assert.equal(profile.body.livelihoodsReview.truncated, true);
  assert.deepEqual(writes, []);
});

test("dashboard does not hide database failures as healthy empty results", async () => {
  const failure = Object.assign(new Error("Synthetic database failure"), { code: "ER_BAD_FIELD_ERROR" });
  const response = await request(fixture([], failure).app).get("/api/members/me/dashboard?includeFinancialSummary=false");
  assert.equal(response.status, 500);
  assert.equal(response.body.error, "Failed to fetch dashboard data");
  assert.equal(response.body.isLinked, undefined);
});
