import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import type { Pool } from "mysql2/promise";
import type { AuthContext } from "../auth/auth.types";
import type { AuthService } from "../auth/auth.service";
import { errorHandler } from "../../middleware/error-handler";
import { createMembershipProgressRouter } from "./membership-progress.routes";
function fixture(role = "member") {
  const calls: { sql: string; params: unknown[] }[] = [];
  const pool = {
    async execute(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (sql.includes("FROM member_profiles WHERE user_id"))
        return [
          [{ id: "12", membershipType: "Associate", deadline: null }],
          [],
        ];
      if (sql.includes("COUNT(*) AS total")) return [[{ total: 21 }], []];
      if (sql.includes("FROM member_referrals r"))
        return [
          [
            {
              id: "2",
              applicantName: "M. Santos",
              applicationCode: "MEM-TEST",
              status: "Pending",
              createdAt: "2026-11-01",
            },
          ],
          [],
        ];
      if (sql.includes("SELECT p.reference_number"))
        return [
          [
            {
              reference: "FEE-12",
              purpose: "Associate Membership Fee",
              status: "Validated",
              amount: "200.00",
            },
          ],
          [],
        ];
      return [[], []];
    },
  } as unknown as Pool;
  const auth = {
    user: {
      id: "7",
      displayName: "Member",
      email: "member@example.test",
      username: null,
      role,
    },
    sessionId: "test",
    tokenHash: "test",
  } as AuthContext;
  const authService = {
    authenticate: async () => auth,
  } as unknown as AuthService;
  const app = express();
  app.use(express.json());
  app.use("/api", createMembershipProgressRouter(authService, pool));
  app.use(errorHandler);
  return { app, calls };
}
test("Associate referral history is paginated, masked and scoped to the authenticated profile", async () => {
  const { app, calls } = fixture();
  const response = await request(app).get(
    "/api/members/me/referrals?page=2&pageSize=10&memberId=999",
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.data.total, 21);
  assert.equal(response.body.data.items[0].applicantName, "M. Santos");
  const query = calls.find((c) => c.sql.includes("FROM member_referrals r"))!;
  assert.deepEqual(query.params, ["12"]);
  assert.match(query.sql, /LIMIT 10 OFFSET 10/);
  assert.ok(!JSON.stringify(response.body).includes("reward"));
});
test("Associate personal payment history checks owner and converted-application entity type", async () => {
  const { app, calls } = fixture();
  const response = await request(app).get(
    "/api/members/me/membership-payments?memberId=999",
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.data.items[0].amount, 200);
  const query = calls.find((c) => c.sql.includes("SELECT p.reference_number"))!;
  assert.deepEqual(query.params, ["12", "12"]);
  assert.match(query.sql, /p.related_entity_type='membership_application'/);
  assert.match(query.sql, /a.converted_member_id=\?/);
});
test("Member cannot inspect staff capital progress or monthly finance aggregates", async () => {
  const { app, calls } = fixture();
  assert.equal(
    (
      await request(app).get(
        "/api/membership-applications/999/capital-progress",
      )
    ).status,
    403,
  );
  assert.equal(
    (await request(app).get("/api/chairman/membership-capital/monthly")).status,
    403,
  );
  assert.equal(calls.length, 0);
});
test("Unbounded pagination is rejected before querying personal data", async () => {
  const { app } = fixture();
  assert.equal(
    (await request(app).get("/api/members/me/referrals?pageSize=999999"))
      .status,
    400,
  );
});

test("invalid self-service sector values are rejected without a write", async () => {
  const { app, calls } = fixture();
  const response = await request(app)
    .put("/api/members/me/membership-sectors")
    .send({ sectors: ["Unapproved sector"] });
  assert.equal(response.status, 400);
  assert.ok(!calls.some((c) => /INSERT|UPDATE|DELETE/.test(c.sql)));
});
