import assert from "node:assert/strict";
import test from "node:test";
import { addMonths, buildBuckets, endOfMonth, inclusiveDays, localDate, resolveComparison, resolveGranularity, resolvePreset } from "./financial-analytics.periods";
import type { ReportingPreset } from "./financial-analytics.types";

const today = "2026-11-02";

test("Manila calendar date rolls over at 16:00 UTC", () => {
  assert.equal(localDate("2026-11-01T15:59:59Z"), "2026-11-01");
  assert.equal(localDate("2026-11-01T16:00:00Z"), "2026-11-02");
});

test("every reporting preset resolves to inclusive local dates", () => {
  const expected: Record<Exclude<ReportingPreset, "custom">, [string, string]> = {
    "today": ["2026-11-02", "2026-11-02"],
    "this-month": ["2026-11-01", "2026-11-02"],
    "last-month": ["2026-10-01", "2026-10-31"],
    "last-3-months": ["2026-09-01", "2026-11-02"],
    "last-6-months": ["2026-06-01", "2026-11-02"],
    "this-quarter": ["2026-10-01", "2026-11-02"],
    "this-year": ["2026-01-01", "2026-11-02"],
    "last-year": ["2025-01-01", "2025-12-31"],
    "all-time": ["1970-01-01", "2026-11-02"],
  };
  for (const [preset, [start, end]] of Object.entries(expected)) {
    const range = resolvePreset(preset as ReportingPreset, today);
    assert.deepEqual([range.start, range.end], [start, end], preset);
  }
  assert.deepEqual(resolvePreset("custom", today, "2026-02-03", "2026-03-04"), { start: "2026-02-03", end: "2026-03-04", label: "Custom range" });
});

test("month arithmetic clamps to month end and handles leap years", () => {
  assert.equal(addMonths("2024-03-31", -1), "2024-02-29");
  assert.equal(addMonths("2025-03-31", -1), "2025-02-28");
  assert.equal(addMonths("2024-02-29", -12), "2023-02-28");
  assert.equal(endOfMonth("2024-02-10"), "2024-02-29");
});

test("calendar presets never compare a partial period with a whole one", () => {
  const month = resolvePreset("this-month", today);
  const previous = resolveComparison({ preset: "this-month", ...month, today, mode: "previous" });
  assert.deepEqual([previous.start, previous.end, previous.days, previous.note], ["2026-10-01", "2026-10-02", 2, null]);
  const year = resolvePreset("this-year", today);
  const ytd = resolveComparison({ preset: "this-year", ...year, today, mode: "previous" });
  assert.equal(ytd.days, inclusiveDays(year.start, year.end));
  assert.equal(ytd.start, "2025-01-01");
  const quarter = resolveComparison({ preset: "this-quarter", ...resolvePreset("this-quarter", today), today, mode: "previous" });
  assert.deepEqual([quarter.start, quarter.end], ["2026-07-01", "2026-08-02"]);
  const lastMonth = resolveComparison({ preset: "last-month", ...resolvePreset("last-month", today), today, mode: "previous" });
  assert.deepEqual([lastMonth.start, lastMonth.end], ["2026-09-01", "2026-09-30"]);
});

test("rolling and custom ranges compare with the immediately preceding equal-length range", () => {
  const comparison = resolveComparison({ preset: "custom", start: "2026-03-10", end: "2026-03-19", today, mode: "previous" });
  assert.deepEqual([comparison.start, comparison.end, comparison.days], ["2026-02-28", "2026-03-09", 10]);
  const sameLastYear = resolveComparison({ preset: "this-year", ...resolvePreset("this-year", today), today, mode: "last-year" });
  assert.deepEqual([sameLastYear.start, sameLastYear.end], ["2025-01-01", "2025-11-02"]);
});

test("no comparison, all time and mismatched custom comparisons are explicit", () => {
  assert.equal(resolveComparison({ preset: "this-year", start: "2026-01-01", end: today, today, mode: "none" }).enabled, false);
  const allTime = resolveComparison({ preset: "all-time", start: "1970-01-01", end: today, today, mode: "previous" });
  assert.equal(allTime.enabled, false);
  assert.match(allTime.note ?? "", /no equivalent/);
  const custom = resolveComparison({ preset: "custom", start: "2026-03-01", end: "2026-03-31", today, mode: "custom", compareStart: "2026-01-01", compareEnd: "2026-01-15" });
  assert.equal(custom.enabled, true);
  assert.match(custom.note ?? "", /15 days against 31/);
  assert.equal(resolveComparison({ preset: "custom", start: "2026-03-01", end: "2026-03-31", today, mode: "custom" }).enabled, false);
});

test("granularity follows the span and coarsens when buckets would be unreadable", () => {
  assert.equal(resolveGranularity("auto", "2026-11-01", "2026-11-02").granularity, "daily");
  assert.equal(resolveGranularity("auto", "2026-09-15", "2026-11-02").granularity, "weekly");
  assert.equal(resolveGranularity("auto", "2026-01-01", "2026-11-02").granularity, "monthly");
  assert.equal(resolveGranularity("auto", "2020-01-01", "2026-11-02").granularity, "quarterly");
  const daily = resolveGranularity("daily", "2026-01-01", "2026-11-02");
  assert.equal(daily.granularity, "monthly");
  assert.match(daily.note ?? "", /92 days/);
  assert.equal(resolveGranularity("weekly", "2016-01-01", "2026-11-02").granularity, "monthly");
});

test("buckets are contiguous, clipped to the range and keyed stably", () => {
  const monthly = buildBuckets("monthly", "2026-01-15", "2026-03-10");
  assert.deepEqual(monthly.map(b => [b.key, b.from, b.to]), [["2026-01", "2026-01-15", "2026-01-31"], ["2026-02", "2026-02-01", "2026-02-28"], ["2026-03", "2026-03-01", "2026-03-10"]]);
  const weekly = buildBuckets("weekly", "2026-11-01", "2026-11-10");
  assert.deepEqual(weekly.map(b => b.key), ["2026-10-26", "2026-11-02", "2026-11-09"]);
  assert.equal(weekly[0].from, "2026-11-01");
  assert.deepEqual(weekly.map(b => b.label), ["Nov 1, 2026", "Nov 2–8, 2026", "Nov 9–10, 2026"]);
  assert.equal(buildBuckets("weekly", "2026-10-26", "2026-11-08")[0].label, "Oct 26 – Nov 1, 2026");
  assert.deepEqual(buildBuckets("quarterly", "2025-11-01", "2026-02-01").map(b => b.key), ["2025-Q4", "2026-Q1"]);
  assert.deepEqual(buildBuckets("yearly", "2025-06-01", "2026-06-01").map(b => b.label), ["2025", "2026"]);
});
