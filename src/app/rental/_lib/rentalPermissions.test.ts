import assert from "node:assert/strict";
import test from "node:test";
import { canAccessRental } from "./rentalPermissions";

test("keeps rental approval and operations with the Chairman", () => {
  assert.equal(canAccessRental("Chairman", "inquiries"), true);
  assert.equal(canAccessRental("Chairman", "schedule"), true);
  assert.equal(canAccessRental("Chairman", "operations"), true);
  assert.equal(canAccessRental("Bookkeeper", "inquiries"), false);
  assert.equal(canAccessRental("Bookkeeper", "schedule"), false);
  assert.equal(canAccessRental("Bookkeeper", "operations"), false);
});

test("keeps rental finance actions with the Bookkeeper", () => {
  assert.equal(canAccessRental("Bookkeeper", "payments"), true);
  assert.equal(canAccessRental("Bookkeeper", "expenses"), true);
  assert.equal(canAccessRental("Chairman", "payments"), false);
  assert.equal(canAccessRental("Chairman", "expenses"), false);
});
