import assert from "node:assert/strict";
import test from "node:test";
import { resolveDashboardPeriod } from "./bookkeeper-dashboard.period";

// 2026-11-04 22:42 in Manila is 14:42 UTC. 2026-11-05 07:30 Manila is 2026-11-04 23:30 UTC.
const wed = new Date("2026-11-04T14:42:00Z");

test("This Month is the default window and compares the same elapsed days of the previous month", () => {
  const period = resolveDashboardPeriod({}, wed);
  assert.equal(period.key, "month");
  assert.equal(period.start, "2026-11-01");
  assert.equal(period.end, "2026-11-04");
  assert.equal(period.previousStart, "2026-10-01");
  assert.equal(period.previousEnd, "2026-10-04");
});

test("the Philippine calendar day is used when UTC is still the previous day", () => {
  const justAfterManilaMidnight = new Date("2026-10-31T16:30:00Z"); // 2026-11-01 00:30 Manila
  const period = resolveDashboardPeriod({ period: "today" }, justAfterManilaMidnight);
  assert.equal(period.start, "2026-11-01");
  assert.equal(period.end, "2026-11-01");
  assert.equal(period.previousStart, "2026-10-31");
  const monthEnd = new Date("2026-10-31T15:59:00Z"); // 2026-10-31 23:59 Manila
  assert.equal(resolveDashboardPeriod({ period: "month" }, monthEnd).start, "2026-10-01");
});

test("week starts on Monday, quarter and year align to calendar units", () => {
  const week = resolveDashboardPeriod({ period: "week" }, wed);
  assert.equal(week.start, "2026-11-02");
  assert.equal(week.previousStart, "2026-10-26");
  assert.equal(week.previousEnd, "2026-10-28");
  const quarter = resolveDashboardPeriod({ period: "quarter" }, wed);
  assert.equal(quarter.start, "2026-10-01");
  assert.equal(quarter.previousStart, "2026-07-01");
  assert.equal(quarter.previousEnd, "2026-08-04"); // 35 elapsed days, like for like
});

test("a shorter previous month never extends past its own last day", () => {
  const march31 = new Date("2026-03-31T10:00:00Z");
  const period = resolveDashboardPeriod({ period: "month" }, march31);
  assert.equal(period.previousStart, "2026-02-01");
  assert.equal(period.previousEnd, "2026-02-28");
});

test("custom ranges are validated and compared with an equal-length preceding range", () => {
  const period = resolveDashboardPeriod({ period: "custom", start: "2026-10-10", end: "2026-10-19" }, wed);
  assert.equal(period.previousStart, "2026-09-30");
  assert.equal(period.previousEnd, "2026-10-09");
  assert.throws(() => resolveDashboardPeriod({ period: "custom", start: "2026-10-10" }, wed), /valid end/);
  assert.throws(() => resolveDashboardPeriod({ period: "custom", start: "2026-10-20", end: "2026-10-10" }, wed), /on or before/);
  assert.throws(() => resolveDashboardPeriod({ period: "custom", start: "2026-11-01", end: "2026-11-30" }, wed), /Future/);
  assert.throws(() => resolveDashboardPeriod({ period: "custom", start: "2026-02-31", end: "2026-03-01" }, wed), /valid start/);
  assert.throws(() => resolveDashboardPeriod({ period: "custom", start: "2018-01-01", end: "2026-10-01" }, wed), /five years/);
});

test("trend covers at least six months, widens to the period start, and caps at 24", () => {
  assert.equal(resolveDashboardPeriod({ period: "month" }, wed).trendMonths.length, 6);
  assert.deepEqual(resolveDashboardPeriod({ period: "month" }, wed).trendMonths.at(-1), "2026-11-01");
  assert.equal(resolveDashboardPeriod({ period: "year" }, wed).trendMonths.length, 11);
  const wide = resolveDashboardPeriod({ period: "custom", start: "2023-01-01", end: "2026-10-01" }, wed);
  assert.equal(wide.trendMonths.length, 24);
  assert.equal(wide.trendEnd, "2026-10-31");
});
