import assert from "node:assert/strict";
import test from "node:test";
import { calculatePatronageAllocations } from "./patronage-calculator";

test("allocates the refund pool proportionally and preserves every cent", () => {
  const allocations = calculatePatronageAllocations([
    { memberId: "1", memberCode: "M-1", memberName: "Ana", membershipType: "Associate", purchasePatronage: 50_000, rentalPatronage: 30_000 },
    { memberId: "2", memberCode: "M-2", memberName: "Ben", membershipType: "True Member", purchasePatronage: 20_000, rentalPatronage: 0 },
  ], 10_000);

  assert.equal(allocations.length, 2);
  assert.equal(allocations[0].totalPatronage, 80_000);
  assert.equal(allocations[0].refundAmount, 8_000);
  assert.equal(allocations[1].refundAmount, 2_000);
  assert.equal(allocations.reduce((sum, item) => sum + item.refundAmount, 0), 10_000);
});

test("excludes members with no eligible patronage", () => {
  const allocations = calculatePatronageAllocations([
    { memberId: "1", memberCode: "M-1", memberName: "Ana", membershipType: "Associate", purchasePatronage: 0, rentalPatronage: 0 },
  ], 5_000);
  assert.deepEqual(allocations, []);
});
