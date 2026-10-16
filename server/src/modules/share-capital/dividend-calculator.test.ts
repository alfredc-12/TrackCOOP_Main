import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDividendAllocations,
  calculateDividendPool,
  calculateInterestOnShareCapital,
  calculateMonthlyShareCapitalBalances,
} from "./dividend-calculator";

test("computes the dividend pool from qualified member balances", () => {
  const allocations = calculateDividendAllocations([
    {
      memberId: "1",
      memberCode: "M-001",
      memberName: "Ana",
      membershipType: "Associate",
      shareCapitalBalance: 1_500,
    },
    {
      memberId: "2",
      memberCode: "M-002",
      memberName: "Ben",
      membershipType: "True Member",
      shareCapitalBalance: 999.99,
    },
    {
      memberId: "3",
      memberCode: "M-003",
      memberName: "Cara",
      membershipType: "Associate",
      shareCapitalBalance: 0,
    },
  ], 5);

  assert.deepEqual(allocations.map((allocation) => allocation.dividendAmount), [75, 50]);
  assert.equal(calculateDividendPool(allocations), 125);
});

test("rejects rates outside the supported percentage range", () => {
  assert.throws(
    () => calculateDividendAllocations([], 100.01),
    /Dividend rate must be greater than 0/,
  );
});

test("computes interest on share capital from average share months", () => {
  const calculation = calculateInterestOnShareCapital([
    {
      memberId: "1",
      memberCode: "M-001",
      memberName: "Ana",
      membershipType: "Associate",
      monthlyShareCapital: [100, 100],
    },
    {
      memberId: "2",
      memberCode: "M-002",
      memberName: "Ben",
      membershipType: "True Member",
      monthlyShareCapital: [300, 300],
    },
  ], 10_000, 2_000, 50);

  assert.equal(calculation.distributableSurplus, 8_000);
  assert.equal(calculation.interestAllocationAmount, 4_000);
  assert.equal(calculation.totalAverageShareMonth, 400);
  assert.equal(calculation.ratePerPeso, 10);
  assert.equal(calculation.interestRate, 10);
  assert.deepEqual(calculation.allocations.map((allocation) => allocation.dividendAmount), [1_000, 3_000]);
});

test("rejects statutory reserves above net surplus", () => {
  assert.throws(
    () => calculateInterestOnShareCapital([], 100, 101, 50),
    /Statutory reserves cannot exceed net surplus/,
  );
});

test("keeps at least thirty percent of distributable surplus for patronage refund", () => {
  assert.throws(
    () => calculateInterestOnShareCapital([], 100, 0, 70.01),
    /between 0 and 70 percent/,
  );
});

test("applies the seventh-day cutoff to monthly share capital balances", () => {
  const monthlyBalances = calculateMonthlyShareCapitalBalances([
    { transactionId: "1", transactionDate: "2026-01-07", direction: "Credit", amount: 100 },
    { transactionId: "2", transactionDate: "2026-01-08", direction: "Credit", amount: 50 },
    { transactionId: "3", transactionDate: "2026-02-07", direction: "Debit", amount: 25 },
  ], "2026-01-01", "2026-02-28");

  assert.deepEqual(monthlyBalances, [100, 125]);
});

test("matches the documented CDA-aligned three-member example", () => {
  const members = [
    {
      memberId: "1",
      memberCode: "M-001",
      memberName: "Ana",
      membershipType: "Associate" as const,
      transactions: [
        { transactionId: "a-1", transactionDate: "2026-01-05", direction: "Credit" as const, amount: 10_000 },
        { transactionId: "a-2", transactionDate: "2026-06-10", direction: "Credit" as const, amount: 5_000 },
      ],
    },
    {
      memberId: "2",
      memberCode: "M-002",
      memberName: "Ben",
      membershipType: "True Member" as const,
      transactions: [
        { transactionId: "b-1", transactionDate: "2026-03-07", direction: "Credit" as const, amount: 8_000 },
      ],
    },
    {
      memberId: "3",
      memberCode: "M-003",
      memberName: "Cara",
      membershipType: "Associate" as const,
      transactions: [
        { transactionId: "c-1", transactionDate: "2026-02-08", direction: "Credit" as const, amount: 12_000 },
        { transactionId: "c-2", transactionDate: "2026-11-07", direction: "Debit" as const, amount: 2_000 },
      ],
    },
  ].map((member) => ({
    ...member,
    monthlyShareCapital: calculateMonthlyShareCapitalBalances(member.transactions, "2026-01-01", "2026-12-31"),
  }));

  const calculation = calculateInterestOnShareCapital(members, 500_000, 100_000, 50);

  assert.equal(calculation.interestAllocationAmount, 200_000);
  assert.equal(calculation.totalAverageShareMonth, 28_833.34);
  assert.deepEqual(
    calculation.allocations.map((allocation) => allocation.dividendAmount),
    [86_705.18, 46_242.79, 67_052.03],
  );
  assert.equal(
    calculation.allocations.reduce((total, allocation) => total + allocation.dividendAmount, 0),
    calculation.interestAllocationAmount,
  );
});
