import assert from "node:assert/strict";
import test from "node:test";
import { calculatePatronageAllocations } from "./patronage-calculator";
import { assertAnnualPatronage, assertCurrentPatronagePolicy, rentalRefund } from "./patronage-policy";
import type { PatronageSourceAmount } from "./patronage.types";
const source = (id: string, rental: number, purchase = 0, membershipType: PatronageSourceAmount["membershipType"] = "True Member"): PatronageSourceAmount => ({ memberId: id, memberCode: id, memberName: id, membershipType, purchasePatronage: purchase, rentalPatronage: rental });

test("each True Member earns exactly 3% of eligible rentals; POS is excluded", () => {
  const allocations = calculatePatronageAllocations([source("1", 10000, 90000), source("2", 3000, 500)]);
  assert.deepEqual(allocations.map((item) => [item.purchasePatronage, item.totalPatronage, item.patronageSharePercent, item.refundAmount]), [[0,10000,3,300],[0,3000,3,90]]);
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
});
