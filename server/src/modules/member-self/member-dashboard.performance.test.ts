import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import type { AuthContext } from "../auth/auth.types";
import { createMemberSelfRepository } from "./member-self.repository";

const auth = { user: { id: "7", role: "member" } } as AuthContext;
function fixture(membershipType = "True Member") {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let active = 0, maximum = 0;
  const pool = { async execute(sql: string, params: unknown[] = []) {
    calls.push({ sql, params });
    active++; maximum = Math.max(maximum, active);
    try {
      await new Promise<void>(resolve => setImmediate(resolve));
      if (sql.includes("FROM member_profiles")) return [[{ member_id: 12, membership_type: membershipType, referral_code: "REF-12", occupation: "Farmer", livelihoods: [] }], []];
      if (sql.includes("AS validatedTotal")) return [[{ validatedTotal: "1500.00" }], []];
      if (sql.includes("'Rental Booking' as type")) return [[{ id: "rental-12", type: "Rental Booking", date: "2026-11-01", amount: 200, status: "Scheduled" }], []];
      if (sql.includes("fr.member_id = ?")) return [[{ id: "income-12", recordType: "Income", category: "Other", amount: "125.50", date: "2026-11-01", source: "Manual" }], []];
      if (sql.includes("COUNT(*) as count FROM rental_bookings")) return [[{ count: 1 }], []];
      return [[], []];
    } finally { active--; }
  } } as unknown as Pool;
  return { calls, maximum: () => maximum, repository: createMemberSelfRepository(pool) };
}

test("home summary avoids all six financial-history reads and preserves personal dashboard data", async () => {
  const full = fixture(), home = fixture();
  const fullData = await full.repository.dashboard(auth, { period: "year" });
  const homeData = await home.repository.dashboard(auth, { period: "year", includeFinancialSummary: "false" });
  assert.equal(full.calls.length - home.calls.length, 6);
  assert.equal(homeData.memberFinancialSummary, null);
  const { memberFinancialSummary, ...unchanged } = fullData;
  const { memberFinancialSummary: omitted, ...homeFields } = homeData;
  assert.deepEqual(homeFields, unchanged);
  assert.equal((memberFinancialSummary as { totalEarnings: number }).totalEarnings, 125.5);
  assert.equal(omitted, null);
  assert.equal((homeData.shareCapital as { total: number }).total, 1500);
  assert.equal((homeData.stats as { rentals: number }).rentals, 1);
});

test("independent reads overlap with a maximum of three database operations per dashboard request", async () => {
  const { repository, maximum } = fixture();
  await repository.dashboard(auth);
  assert.equal(maximum(), 3);
});

test("financial summary opt-in cannot grant Associates financial access or issue benefit-history queries", async () => {
  const { repository, calls } = fixture("Associate");
  const data = await repository.dashboard(auth, { includeFinancialSummary: "true" });
  assert.equal(data.canAccessFinancials, false);
  assert.equal(data.memberFinancialSummary, null);
  assert.deepEqual(data.recentCapitalContributions, []);
  assert.ok(!calls.some(call => /FROM financial_records|FROM member_dividends|FROM patronage_allocations|FROM share_capital_transactions/.test(call.sql)));
  const profile = calls.find(call => call.sql.includes("WHERE user_id = ?"));
  assert.deepEqual(profile?.params, ["7"]);
});

test("unlinked account returns immediately without scheduling dashboard reads", async () => {
  let calls = 0;
  const pool = { async execute() { calls++; return [[], []]; } } as unknown as Pool;
  assert.deepEqual(await createMemberSelfRepository(pool).dashboard(auth), { isLinked: false });
  assert.equal(calls, 1);
});
