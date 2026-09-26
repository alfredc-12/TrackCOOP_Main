import assert from "node:assert/strict";
import test from "node:test";
import {
  rentalDatePart,
  rentalIsoDateTime,
  rentalTimePart,
} from "./rental-db-date";

test("normalizes Date objects returned by mysql2", () => {
  const value = new Date("2026-09-26T07:15:30.000Z");

  assert.equal(rentalDatePart(value), "2026-09-26");
  assert.equal(rentalTimePart(value), "07:15");
  assert.equal(rentalIsoDateTime(value), "2026-09-26T07:15:30.000Z");
});

test("keeps compatibility with database date strings", () => {
  assert.equal(rentalDatePart("2026-09-26 15:15:30"), "2026-09-26");
  assert.equal(rentalTimePart("2026-09-26 15:15:30"), "15:15");
  assert.equal(
    rentalIsoDateTime("2026-09-26 15:15:30"),
    "2026-09-26T15:15:30+08:00",
  );
});
