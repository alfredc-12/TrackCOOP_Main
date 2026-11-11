import assert from "node:assert/strict";
import test from "node:test";
import { calculatePatronageAllocations } from "./patronage-calculator";
import { assertAnnualPatronage, assertCurrentPatronagePolicy, rentalRefund, surplusRefundPool } from "./patronage-policy";
import { createPatronagePeriodSchema } from "./patronage.schema";
import type { PatronageSourceAmount } from "./patronage.types";
const source = (id: string, rental: number, purchase = 0, membershipType: PatronageSourceAmount["membershipType"] = "True Member"): PatronageSourceAmount => ({ memberId: id, memberCode: id, memberName: id, membershipType, purchasePatronage: purchase, rentalPatronage: rental });

test("historical fixed-rate periods retain their 3% rental calculation; POS is excluded", () => {
  const allocations = calculatePatronageAllocations([source("1", 10000, 90000), source("2", 3000, 500)]);
  assert.deepEqual(allocations.map((item) => [item.purchasePatronage, item.totalPatronage, item.patronageSharePercent, item.refundAmount]), [[0,10000,3,300],[0,3000,3,90]]);
});

test("historical proportional periods distribute the entire surplus-funded pool", () => {
  const pool = surplusRefundPool(150000, 50000);
  assert.equal(pool, 30000);
  const allocations = calculatePatronageAllocations([source("vince", 1000), source("b", 20000), source("others", 979000)], pool);
  assert.deepEqual(allocations.map((item) => [item.patronageSharePercent, item.refundAmount]), [[0.1, 30], [2, 600], [97.9, 29370]]);
  assert.equal(allocations.reduce((sum, item) => sum + item.refundAmount, 0), pool);
});

test("historical proportional periods retain their computed rate", () => {
  const sources = [source("1", 1000, 99999), source("2", 20000)];
  assert.deepEqual(calculatePatronageAllocations(sources, 30000).map((item) => item.refundAmount), [1428.57, 28571.43]);
  assert.deepEqual(calculatePatronageAllocations(sources, 630).map((item) => item.refundAmount), [30, 600]);
  assert.deepEqual(calculatePatronageAllocations(sources, 1260).map((item) => item.refundAmount), [60, 1200]);
  assert.deepEqual(calculatePatronageAllocations([source("associate", 100000, 0, "Associate"), source("true", 100)], 10).map((item) => item.refundAmount), [10]);
});

test("configured rental percentages apply to each member's own rentals and round independently", () => {
  const sources = [source("vince", 1000), source("other", 20000)];
  assert.deepEqual(calculatePatronageAllocations(sources, undefined, 3).map((item) => [item.patronageSharePercent, item.refundAmount]), [[3, 30], [3, 600]]);
  assert.deepEqual(calculatePatronageAllocations(sources, undefined, 4.25).map((item) => item.refundAmount), [42.5, 850]);
  assert.equal(rentalRefund(1234.56, 4.25), 52.47);
  for (const rate of [0, -1, 101, NaN]) assert.throws(() => calculatePatronageAllocations(sources, undefined, rate));
});

test("cent allocation exhausts the pool and is stable when member order changes", () => {
  const sources = [source("a", 1), source("b", 1), source("c", 1)];
  assert.deepEqual(calculatePatronageAllocations(sources, 100).map((item) => item.refundAmount), [33.34, 33.33, 33.33]);
  assert.deepEqual(calculatePatronageAllocations([...sources].reverse(), 0.01).map((item) => [item.memberId, item.refundAmount]), [["c", 0], ["b", 0], ["a", 0.01]]);
  assert.deepEqual(calculatePatronageAllocations([], 100), []);
  assert.throws(() => calculatePatronageAllocations(sources, NaN));
});

test("surplus funding rejects missing, negative or excessive statutory deductions", () => {
  assert.equal(surplusRefundPool(150000, 50000, 40), 40000);
  assert.equal(surplusRefundPool(100, 100), 0);
  for (const values of [[NaN, 0, 30], [100, 101, 30], [-100, 0, 30], [100, -1, 30], [100, 0, 29], [100, 0, 101]]) {
    assert.throws(() => surplusRefundPool(values[0], values[1], values[2]));
  }
  const input = { name: "2025 Refund", startDate: "2025-01-01", endDate: "2025-12-31", netSurplus: 150000, statutoryReserves: 50000 };
  assert.equal(createPatronagePeriodSchema.safeParse(input).success, true);
  assert.equal(createPatronagePeriodSchema.safeParse({ ...input, netSurplus: undefined }).success, false);
  assert.equal(createPatronagePeriodSchema.safeParse({ ...input, statutoryReserves: 160000 }).success, false);
  assert.equal(createPatronagePeriodSchema.safeParse({ ...input, netSurplus: 150000.123 }).success, false);
});
test("Associates and members with only POS purchases or no eligible rentals earn nothing", () => {
  assert.deepEqual(calculatePatronageAllocations([source("1", 10000, 0, "Associate"), source("2", 0, 50000), source("3", -50)]), []);
});
test("rounds each refund to cents without moving money between members", () => {
  assert.equal(rentalRefund(1234.56), 37.04);
  const allocations = calculatePatronageAllocations([source("1", 0.50), source("2", 0.50)]);
  assert.deepEqual(allocations.map((item) => item.refundAmount), [0.02,0.02]);
});
test("only a complete January–December year can be processed", () => {
  assert.doesNotThrow(() => assertAnnualPatronage("2025-01-01", "2025-12-31", true));
  assert.throws(() => assertAnnualPatronage("2025-07-01", "2025-12-31"), /January 1/);
  assert.throws(() => assertAnnualPatronage("2025-01-01", "2026-12-31"), /January 1/);
  assert.throws(() => assertAnnualPatronage("2099-01-01", "2099-12-31", true), /Finish the calendar year/);
});
test("legacy allocations cannot be silently paid or capitalized under the new policy", () => {
  assert.throws(() => assertCurrentPatronagePolicy("Legacy"), /legacy allocation/);
  assert.doesNotThrow(() => assertCurrentPatronagePolicy("Rental3PercentAnnual"));
  assert.doesNotThrow(() => assertCurrentPatronagePolicy("RentalSurplusAnnual"));
  assert.doesNotThrow(() => assertCurrentPatronagePolicy("RentalConfiguredAnnual"));
});
