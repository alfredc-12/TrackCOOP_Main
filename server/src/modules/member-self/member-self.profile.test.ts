import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "mysql2/promise";
import type { AuthContext } from "../auth/auth.types";
import { createMemberSelfRepository } from "./member-self.repository";

const auth: AuthContext = {
  user: { id: "7", displayName: "Test Member", email: "member@example.test", username: "member", role: "member" },
  sessionId: "test-session", tokenHash: "test-hash",
};

test("profile updates bind all occupations to the authenticated member", async () => {
  const calls: { sql: string; values: unknown[] }[] = [];
  const pool = {
    async execute(sql: string, values: unknown[]) {
      calls.push({ sql, values });
      return sql.includes("SELECT member_id") ? [[{ member_id: "12" }], []] : [{ affectedRows: 1 }, []];
    },
  } as unknown as Pool;
  await createMemberSelfRepository(pool).updateProfile(auth, {
    contact_number: "9171234567", email: "member@example.test", barangay: "Bucana",
    municipality: "Nasugbu", province: "Batangas", occupation: " Farmer; Livestock raiser; Farm operator ",
  });
  assert.deepEqual(calls[0].values, ["7"]);
  assert.deepEqual(calls.find((call) => call.sql.includes("UPDATE member_profiles"))?.values,
    ["9171234567", "member@example.test", "Bucana", "Nasugbu", "Batangas", "Farmer; Livestock raiser; Farm operator", null, "12"]);
});

test("older profile clients preserve saved occupations when the field is omitted", async () => {
  let update = "";
  let parameters: unknown[] = [];
  const pool = {
    async execute(sql: string, values: unknown[]) {
      if (sql.includes("UPDATE member_profiles")) { update = sql; parameters = values; }
      return sql.includes("SELECT member_id") ? [[{ member_id: "12" }], []] : [{ affectedRows: 1 }, []];
    },
  } as unknown as Pool;
  await createMemberSelfRepository(pool).updateProfile(auth, {});
  assert.match(update, /occupation = COALESCE\(\?, occupation\)/);
  assert.equal(parameters[5], null);
});

test("invalid occupations are rejected before any database change", async () => {
  let called = false;
  const pool = { async execute() { called = true; throw new Error("Database must not be reached"); } } as unknown as Pool;
  for (const occupation of ["", "   ", "x".repeat(191), 123]) {
    await assert.rejects(createMemberSelfRepository(pool).updateProfile(auth, { occupation: occupation as string }), /Choose at least one occupation/);
  }
  assert.equal(called, false);
});

test("livelihoods save to the authenticated member and can be explicitly cleared", async () => {
  const writes: unknown[][] = [];
  const pool = {
    async execute(sql: string, values: unknown[]) {
      if (sql.includes("UPDATE member_profiles")) writes.push(values);
      return sql.includes("SELECT member_id") ? [[{ member_id: "12" }], []] : [{ affectedRows: 1 }, []];
    },
  } as unknown as Pool;
  const repository = createMemberSelfRepository(pool);
  const livelihoods = [{ activity: "Sugarcane", plantingDate: "2025-11-01" }, { activity: "Poultry" }];
  await repository.updateProfile(auth, { livelihoods });
  await repository.updateProfile(auth, { livelihoods: [] });
  await repository.updateProfile(auth, {});
  assert.equal(writes[0][6], JSON.stringify(livelihoods));
  assert.equal(writes[1][6], "[]");
  assert.equal(writes[2][6], null);
  assert.equal(writes[0][7], "12");
});

test("bad livelihood dates are rejected before saving member details", async () => {
  let called = false;
  const pool = { async execute() { called = true; throw new Error("Database must not be reached"); } } as unknown as Pool;
  await assert.rejects(createMemberSelfRepository(pool).updateProfile(auth, { livelihoods: [{ activity: "Rice", plantingDate: "2099-01-01" }] }), /Check your crops and livelihoods/);
  assert.equal(called, false);
});
