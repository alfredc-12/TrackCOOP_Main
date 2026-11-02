import assert from "node:assert/strict";
import test from "node:test";
import {
  addMonths,
  buildBuckets,
  bucketKey,
  chooseGranularity,
  manilaToday,
  resolveComparison,
  resolvePeriod,
  startOfWeek,
} from "./expense-periods";

test("today is read in Asia/Manila, not UTC", () => {
  // 17:00 UTC on 31 Oct is already 1 Nov in Manila (UTC+8).
  assert.equal(manilaToday(new Date("2026-10-31T17:00:00Z")), "2026-11-01");
  assert.equal(manilaToday(new Date("2026-10-31T15:59:59Z")), "2026-10-31");
});

test("month arithmetic clamps to the target month and handles leap years", () => {
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(addMonths("2028-03-31", -1), "2028-02-29");
  assert.equal(addMonths("2028-02-29", -12), "2027-02-28");
  assert.equal(addMonths("2026-01-15", -1), "2025-12-15");
});

test("weeks start on Monday", () => {
  assert.equal(startOfWeek("2026-11-01"), "2026-10-26"); // a Sunday belongs to the week that began Monday
  assert.equal(startOfWeek("2026-10-26"), "2026-10-26");
});

test("presets resolve against Manila today", () => {
  const today = "2026-11-15";
  assert.deepEqual(resolvePeriod({ period: "this_month" }, today), { preset: "this_month", label: "This month", startDate: "2026-11-01", endDate: "2026-11-30" });
  assert.deepEqual(resolvePeriod({ period: "last_month" }, today), { preset: "last_month", label: "Last month", startDate: "2026-10-01", endDate: "2026-10-31" });
  assert.equal(resolvePeriod({ period: "last_7_days" }, today).startDate, "2026-11-09");
  assert.equal(resolvePeriod({ period: "last_3_months" }, today).startDate, "2026-09-01");
  assert.equal(resolvePeriod({ period: "this_quarter" }, today).endDate, "2026-12-31");
  assert.equal(resolvePeriod({ period: "last_year" }, today).startDate, "2025-01-01");
  assert.equal(resolvePeriod({ period: "all_time" }, today).startDate, null);
  assert.equal(resolvePeriod({ startDate: "2026-01-01", endDate: "2026-01-31" }, today).preset, "custom");
});

test("an unfinished month is compared with the same elapsed days of the previous month", () => {
  const today = "2026-11-12";
  const comparison = resolveComparison(resolvePeriod({ period: "this_month" }, today), "previous", today);
  assert.deepEqual(comparison.current, { startDate: "2026-11-01", endDate: "2026-11-12", days: 12, periodDays: 30, partial: true });
  assert.deepEqual(comparison.previous, { startDate: "2026-10-01", endDate: "2026-10-12", days: 12 });
});

test("a finished month is compared with the whole previous month, including month-end boundaries", () => {
  const today = "2026-03-20";
  const comparison = resolveComparison(resolvePeriod({ period: "last_month" }, today), "previous", today);
  assert.equal(comparison.current?.partial, false);
  assert.deepEqual(comparison.previous, { startDate: "2026-01-01", endDate: "2026-01-31", days: 31 });
  // March compared with February keeps the whole of February (28 days), not a 31-day window.
  const march = resolveComparison(resolvePeriod({ period: "this_month" }, "2026-03-31"), "previous", "2026-03-31");
  assert.deepEqual(march.previous, { startDate: "2026-02-01", endDate: "2026-02-28", days: 28 });
});

test("leap-year February and same-period-last-year comparisons", () => {
  const leap = resolveComparison(resolvePeriod({ period: "this_month" }, "2028-02-29"), "previous", "2028-02-29");
  assert.deepEqual(leap.previous, { startDate: "2028-01-01", endDate: "2028-01-31", days: 31 });
  const year = resolveComparison(resolvePeriod({ period: "this_month" }, "2028-02-29"), "last_year", "2028-02-29");
  assert.deepEqual(year.previous, { startDate: "2027-02-01", endDate: "2027-02-28", days: 28 });
  const mid = resolveComparison(resolvePeriod({ period: "this_month" }, "2026-11-12"), "last_year", "2026-11-12");
  assert.deepEqual(mid.previous, { startDate: "2025-11-01", endDate: "2025-11-12", days: 12 });
});

test("year transitions: January compares with December of the year before", () => {
  const comparison = resolveComparison(resolvePeriod({ period: "this_month" }, "2027-01-10"), "previous", "2027-01-10");
  assert.deepEqual(comparison.previous, { startDate: "2026-12-01", endDate: "2026-12-10", days: 10 });
  const ytd = resolveComparison(resolvePeriod({ period: "this_year" }, "2027-03-05"), "previous", "2027-03-05");
  assert.deepEqual(ytd.previous, { startDate: "2026-01-01", endDate: "2026-03-05", days: 64 });
});

test("rolling windows compare with the equal-length window right before", () => {
  const comparison = resolveComparison(resolvePeriod({ period: "last_7_days" }, "2026-11-15"), "previous", "2026-11-15");
  assert.deepEqual(comparison.previous, { startDate: "2026-11-02", endDate: "2026-11-08", days: 7 });
  const custom = resolveComparison(resolvePeriod({ startDate: "2026-05-10", endDate: "2026-05-19" }, "2026-11-15"), "previous", "2026-11-15");
  assert.deepEqual(custom.previous, { startDate: "2026-04-30", endDate: "2026-05-09", days: 10 });
});

test("no comparison is possible for All time, and none was asked for with mode none", () => {
  const allTime = resolveComparison(resolvePeriod({ period: "all_time" }, "2026-11-15"), "previous", "2026-11-15");
  assert.equal(allTime.previous, null);
  assert.match(allTime.unavailableReason ?? "", /All time/);
  const none = resolveComparison(resolvePeriod({ period: "this_month" }, "2026-11-15"), "none", "2026-11-15");
  assert.equal(none.previous, null);
  assert.equal(none.unavailableReason, null);
  const future = resolveComparison(resolvePeriod({ startDate: "2027-01-01", endDate: "2027-01-31" }, "2026-11-15"), "previous", "2026-11-15");
  assert.equal(future.previous, null);
});

test("granularity follows the length of the range", () => {
  assert.equal(chooseGranularity({ startDate: "2026-11-01", endDate: "2026-11-30" }), "day");
  assert.equal(chooseGranularity({ startDate: "2026-07-01", endDate: "2026-11-30" }), "week");
  assert.equal(chooseGranularity({ startDate: "2026-01-01", endDate: "2026-12-31" }), "month");
  assert.equal(chooseGranularity({ startDate: "2023-01-01", endDate: "2026-12-31" }), "quarter");
  assert.equal(chooseGranularity({ startDate: "2010-01-01", endDate: "2026-12-31" }), "year");
});

test("buckets are calendar-correct, zero-filled and clamped to the range", () => {
  const months = buildBuckets({ startDate: "2026-01-15", endDate: "2026-04-10" }, "month");
  assert.deepEqual(months.map((bucket) => [bucket.key, bucket.startDate, bucket.endDate]), [
    ["2026-01-01", "2026-01-15", "2026-01-31"],
    ["2026-02-01", "2026-02-01", "2026-02-28"],
    ["2026-03-01", "2026-03-01", "2026-03-31"],
    ["2026-04-01", "2026-04-01", "2026-04-10"],
  ]);
  const weeks = buildBuckets({ startDate: "2026-11-01", endDate: "2026-11-15" }, "week");
  assert.equal(weeks[0].key, "2026-10-26");
  assert.equal(weeks[0].startDate, "2026-11-01");
  assert.equal(bucketKey("2026-11-03", "week"), "2026-11-02");
  assert.equal(buildBuckets({ startDate: "2026-02-01", endDate: "2026-02-28" }, "day").length, 28);
  assert.equal(buildBuckets({ startDate: "2026-01-01", endDate: "2026-12-31" }, "quarter").length, 4);
  assert.equal(buildBuckets({ startDate: "2025-06-01", endDate: "2026-02-01" }, "year").map((bucket) => bucket.label).join(","), "2025,2026");
});
