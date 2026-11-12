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
      name: "2026 Patronage",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
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

test("Associate summary explains ineligibility and preserves legacy payments without making them available", async () => {
  const { pool } = fakePool([
    [{ memberId: "7", memberCode: "M-7", memberName: "Member", membershipType: "Associate", trueMemberSince: null }],
    [],
    [
      { policyVersion: "Legacy", periodId: "1", refundAmount: "750.00", totalPatronage: "10000.00", paymentStatus: "Paid", capitalizedAmount: 0, pendingCapitalAmount: 0 },
      { policyVersion: "Legacy", periodId: "2", refundAmount: "100.00", totalPatronage: "2000.00", paymentStatus: "Pending", capitalizedAmount: 0, pendingCapitalAmount: 0 },
    ],
  ]);
  const result = await createPatronageRepository(pool as never).memberSummary({ ...auth, user: { ...auth.user, role: "member" } });
  assert.equal(result.member.eligible, false);
  assert.match(result.member.eligibilityMessage!, /Associate Members do not earn/);
  assert.equal(result.currentYear.estimatedRefund, 0);
  assert.equal(result.currentYear.purchasePatronage, 0);
  assert.equal(result.refunds.paidTotal, 750);
  assert.equal(result.refunds.pendingTotal, 0);
  assert.equal(result.history.length, 2);
});

test("True Members with a missing effective date receive guidance rather than an invented eligibility date", async () => {
  const { pool } = fakePool([
    [{ memberId: "7", memberCode: "M-7", memberName: "Member", membershipType: "True Member", trueMemberSince: null }], [], [],
  ]);
  const result = await createPatronageRepository(pool as never).memberSummary({ ...auth, user: { ...auth.user, role: "member" } });
  assert.equal(result.member.eligible, false);
  assert.match(result.member.eligibilityMessage!, /effective date is missing/);
  assert.equal(result.currentYear.estimatedRefund, 0);
  assert.equal(result.refunds.pendingTotal, 0);
});

test("a personal rental total cannot produce an estimate without the annual financial basis", async () => {
  const source = { memberId: "7", memberCode: "M-7", memberName: "Vince", membershipType: "True Member", purchasePatronage: 0, rentalPatronage: 1000 };
  const { pool } = fakePool([[{ ...source, trueMemberSince: "2025-01-01" }], [source], [], []]);
  const result = await createPatronageRepository(pool as never).memberSummary({ ...auth, user: { ...auth.user, role: "member" } });
  assert.equal(result.member.eligible, true);
  assert.equal(result.currentYear.totalPatronage, 1000);
  assert.equal(result.currentYear.estimateAvailable, false);
  assert.equal(result.currentYear.estimatedRefund, 0);
  assert.equal(result.currentYear.refundRate, 0);
});

test("member estimates use all participants as the denominator rather than allocating the full pool to one member", async () => {
  const source = { memberId: "7", memberCode: "M-7", memberName: "Vince", membershipType: "True Member", purchasePatronage: 0, rentalPatronage: 1000 };
  const { pool } = fakePool([
    [{ ...source, trueMemberSince: "2025-01-01" }], [source], [],
    [{ policyVersion: "RentalSurplusAnnual", refundPool: 30000, refundRate: 3 }],
    [source, { ...source, memberId: "8", rentalPatronage: 999000 }],
  ]);
  const result = await createPatronageRepository(pool as never).memberSummary({ ...auth, user: { ...auth.user, role: "member" } });
  assert.equal(result.currentYear.estimateAvailable, true);
  assert.equal(result.currentYear.estimatedRefund, 30);
  assert.equal(result.currentYear.refundRate, 3);
});

test("configured member estimates use the annual saved rate rather than a share of the funding pool", async () => {
  const source = { memberId: "7", memberCode: "M-7", memberName: "Vince", membershipType: "True Member", purchasePatronage: 0, rentalPatronage: 1000 };
  const { pool } = fakePool([
    [{ ...source, trueMemberSince: "2025-01-01" }], [source], [],
    [{ policyVersion: "RentalConfiguredAnnual", refundPool: 60000, refundRate: 4.25 }],
    [source, { ...source, memberId: "8", rentalPatronage: 999000 }],
  ]);
  const result = await createPatronageRepository(pool as never).memberSummary({ ...auth, user: { ...auth.user, role: "member" } });
  assert.equal(result.currentYear.estimatedRefund, 42.5);
  assert.equal(result.currentYear.refundRate, 4.25);
});

test("financialBasis excludes reversal adjustments from netOperatingSurplus and applies Manila +08:00 and Test gateway filters in source SQL", async () => {
  const { pool, state } = fakePool([
    [{ memberId: "1", memberCode: "M-1", memberName: "True Member", membershipType: "True Member", purchasePatronage: 0, rentalPatronage: 10000 }],
    [{
      posIncome: 50000,
      rentalIncome: 30000,
      posExpenses: 10000,
      rentalExpenses: 5000,
      otherExpenses: 5000,
      adjustments: -4000,
      postedRecordCount: 8,
      unpostedRecordCount: 1,
    }],
  ]);
  const basis = await createPatronageRepository(pool as never).financialBasis("2025-01-01", "2025-12-31");
  assert.equal(basis.totalOperatingIncome, 80000);
  assert.equal(basis.totalOperatingExpenses, 20000);
  assert.equal(basis.adjustments, -4000);
  assert.equal(basis.netOperatingSurplus, 60000);
  assert.equal(basis.eligibleMemberPatronage, 10000);
  assert.equal(basis.estimatedRefund, 300);
  assert.equal(basis.memberRefundRate, 3);
  assert.equal(basis.allocationRate, 30);
  assert.match(state.queries[0], /TIMESTAMPADD\(HOUR, 8, COALESCE\(payment\.validated_at, payment\.paid_at\)\)/);
  assert.match(state.queries[0], /COALESCE\(payment\.gateway_environment, ''\) = 'Test'/);
});
