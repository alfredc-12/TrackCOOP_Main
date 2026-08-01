import assert from "node:assert/strict";
import test from "node:test";
import { expectedDatabaseTables } from "./expected-tables";

const requiredPaymongoTables = [
  "payment_references",
  "payment_gateway_events",
  "payment_gateway_checkout_attempts",
  "payment_validation_history",
  "payment_receipts",
  "share_capital_payments",
  "financial_records",
] as const;

test("final TrackCOOP schema requires 52 unique base tables", () => {
  assert.equal(expectedDatabaseTables.length, 52);
  assert.equal(new Set(expectedDatabaseTables).size, 52);
});

test("final schema includes PayMongo lifecycle and receipt tables", () => {
  for (const table of requiredPaymongoTables) {
    assert.ok(expectedDatabaseTables.includes(table));
  }
});

test("expected table list matches authoritative schema naming", () => {
  assert.ok(expectedDatabaseTables.includes("announcement_acknowledgments"));
  assert.ok(expectedDatabaseTables.includes("rental_maintenance_periods"));
  assert.ok(expectedDatabaseTables.includes("rental_booking_sequences"));
  assert.ok(expectedDatabaseTables.includes("rental_idempotency_keys"));
  assert.ok(expectedDatabaseTables.includes("document_versions"));
  assert.ok(expectedDatabaseTables.includes("membership_application_notes"));
  assert.ok(expectedDatabaseTables.includes("membership_application_payments"));
  assert.ok(expectedDatabaseTables.includes("membership_account_activations"));
});
