import assert from "node:assert/strict";
import test from "node:test";
import {
  overviewFilterSchema,
  periodFor,
  signedMoney,
  change,
  cents,
} from "./overview.schema";
import { classifyFinancialRecord } from "../finance/financial-posting-rules";
const f = (patch: Record<string, unknown> = {}) =>
  overviewFilterSchema.parse(patch);
test("Manila presets and elapsed comparisons handle year boundaries, rolling days, quarters and leap years", () => {
  const now = new Date("2026-11-02T16:00:00Z");
  assert.equal(
    periodFor(f({ period: "today" }), now).effective.startDate,
    "2026-11-03",
  );
  assert.equal(
    periodFor(f({ period: "last_30_days" }), now).effective.startDate,
    "2026-10-05",
  );
  const partial = periodFor(f({ period: "this_month" }), now);
  assert.deepEqual(partial.previous, {
    startDate: "2026-10-01",
    endDate: "2026-10-03",
    days: 3,
  });
  assert.equal(partial.partial, true);
  assert.equal(
    periodFor(f({ period: "yesterday" }), new Date("2026-01-01T01:00:00Z"))
      .effective.startDate,
    "2025-12-31",
  );
  const leap = periodFor(
    f({ period: "last_month" }),
    new Date("2024-03-01T01:00:00Z"),
  );
  assert.equal(leap.effective.endDate, "2024-02-29");
  const quarter = periodFor(f({ period: "this_quarter" }), now);
  assert.equal(quarter.effective.startDate, "2026-10-01");
  assert.equal(quarter.previous?.startDate, "2026-07-01");
  assert.equal(periodFor(f({ period: "all_time" }), now).previous, null);
});
test("comparison arithmetic stays in exact decimal cents and percentages require positive previous amounts", () => {
  assert.equal(signedMoney(cents("0.10") + cents("0.20")), "0.30");
  assert.deepEqual(change("150.00", "100.00"), {
    amount: "50.00",
    percent: 50,
  });
  assert.deepEqual(change("-100.00", "0.00"), {
    amount: "-100.00",
    percent: null,
  });
  assert.equal(change("0.00", null).amount, null);
  assert.equal(
    signedMoney(cents("9007199254740993.07")),
    "9007199254740993.07",
  );
});
test("invalid filters/ranges and sort injections fail before database access", () => {
  assert.equal(
    overviewFilterSchema.safeParse({ sortBy: "record_date; DROP TABLE users" })
      .success,
    false,
  );
  assert.equal(
    overviewFilterSchema.safeParse({ pageSize: 101 }).success,
    false,
  );
  assert.equal(
    overviewFilterSchema.safeParse({ amountMin: "1e8" }).success,
    false,
  );
  assert.throws(() =>
    periodFor(
      f({ period: "custom", startDate: "2026-10-31", endDate: "2026-10-01" }),
    ),
  );
  assert.throws(() => periodFor(f({ amountMin: "5.01", amountMax: "5.00" })));
  assert.throws(() => periodFor(f({ focusStart: "2026-10-01" })));
});
test("financial record classification preserves grants, custom compatible expense categories and audit distinctions", () => {
  const row = {
    recordType: "Income",
    recordStatus: "Active",
    approvedBy: "2",
    sourceModule: "Other",
    categoryCode: "DONATIONS_GRANTS",
    categoryType: "Income",
    amount: 50,
  };
  assert.equal(classifyFinancialRecord(row), "operating-income");
  assert.equal(
    classifyFinancialRecord({
      ...row,
      recordType: "Expense",
      categoryType: "Both",
      categoryCode: "CUSTOM",
      sourceModule: "Rental",
    }),
    "operating-expense",
  );
  assert.equal(
    classifyFinancialRecord({ ...row, approvedBy: null }),
    "unposted",
  );
  assert.equal(
    classifyFinancialRecord({ ...row, sourceModule: "Share Capital" }),
    "capital-movement",
  );
  assert.equal(
    classifyFinancialRecord({ ...row, categoryCode: "TRANSFER" }),
    "capital-movement",
  );
  assert.equal(
    classifyFinancialRecord({ ...row, recordType: "Adjustment" }),
    "adjustment",
  );
  assert.equal(
    classifyFinancialRecord({ ...row, recordStatus: "Corrected" }),
    "inactive",
  );
  assert.equal(
    classifyFinancialRecord({ ...row, superseded: true }),
    "inactive",
  );
  assert.equal(
    classifyFinancialRecord({ ...row, duplicate: true }),
    "classification-review",
  );
});
