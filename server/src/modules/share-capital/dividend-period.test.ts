import assert from "node:assert/strict";
import test from "node:test";
import { isCompleteFiscalYearPeriod } from "./dividend-period";

test("accepts a complete calendar fiscal year", () => {
  assert.equal(isCompleteFiscalYearPeriod("2026-01-01", "2026-12-31"), true);
});

test("accepts a complete bylaws-defined fiscal year", () => {
  assert.equal(isCompleteFiscalYearPeriod("2026-07-01", "2027-06-30"), true);
});

test("rejects a partial fiscal year", () => {
  assert.equal(isCompleteFiscalYearPeriod("2026-01-01", "2026-09-29"), false);
});

test("handles a leap-day fiscal-year start", () => {
  assert.equal(isCompleteFiscalYearPeriod("2024-02-29", "2025-02-28"), true);
});
