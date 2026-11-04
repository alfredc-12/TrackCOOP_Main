import assert from "node:assert/strict";
import test from "node:test";
import { closeAllTime, filtersToParams, parseFinancialAnalyticsFilters, withWindow } from "./financial-analytics.filters";

const now = new Date("2026-11-02T01:00:00Z");
const parse = (query: Record<string, unknown>) => parseFinancialAnalyticsFilters(query, now);

test("defaults to this year with a previous-equivalent comparison", () => {
  const f = parse({});
  assert.deepEqual([f.period, f.start, f.end, f.compare, f.compareStart, f.compareEnd, f.recordType, f.asOf], ["this-year", "2026-01-01", "2026-11-02", "previous", "2025-01-01", "2025-11-02", "all", "2026-11-02"]);
});

test("custom ranges, categories, sources and amounts are validated and normalized", () => {
  const f = parse({ period: "custom", start: "2026-03-01", end: "2026-03-31", categories: "3|4|4", sources: "POS|Rental", minAmount: "100", maxAmount: "5000", reference: " FIN-1 ", compare: "none" });
  assert.deepEqual([f.categoryIds, f.sourceModules, f.minAmount, f.maxAmount, f.reference, f.compareStart], [["3", "4"], ["POS", "Rental"], 100, 5000, "FIN-1", null]);
});

const invalidQueries: Array<[string, Record<string, unknown>]> = [
  ["a start after the end", { period: "custom", start: "2026-05-01", end: "2026-04-01" }],
  ["an impossible calendar date", { period: "custom", start: "2026-02-30", end: "2026-03-01" }],
  ["a custom range missing a date", { period: "custom", start: "2026-02-01" }],
  ["a future end date", { period: "custom", start: "2026-02-01", end: "2026-12-01" }],
  ["an eleven year range", { period: "custom", start: "2015-01-01", end: "2026-11-01" }],
  ["Share Capital as a source", { sources: "Share Capital" }],
  ["an invented source", { sources: "Crypto" }],
  ["a non-numeric category id", { categories: "1; DROP TABLE x" }],
  ["a minimum above the maximum", { minAmount: "10", maxAmount: "5" }],
  ["an unknown preset", { period: "forever" }],
  ["an unknown record type", { recordType: "Adjustment" }],
  ["a custom comparison with a missing date", { compare: "custom", compareStart: "2025-01-01" }],
  ["a custom comparison that overlaps the period", { period: "custom", start: "2026-03-01", end: "2026-03-31", compare: "custom", compareStart: "2026-03-15", compareEnd: "2026-04-15" }],
];
for (const [label, query] of invalidQueries) test(`rejects ${label}`, () => assert.throws(() => parse(query), /./));

test("custom comparison is accepted when it is separate from the period", () => {
  const f = parse({ period: "custom", start: "2026-03-01", end: "2026-03-31", compare: "custom", compareStart: "2025-03-01", compareEnd: "2025-03-31" });
  assert.deepEqual([f.compareStart, f.compareEnd], ["2025-03-01", "2025-03-31"]);
});

test("all time closes at the first ledger date and never compares", () => {
  const f = parse({ period: "all-time" });
  assert.equal(f.compareStart, null);
  assert.equal(closeAllTime(f, "2025-02-14").start, "2025-02-14");
  assert.equal(closeAllTime(f, null).start, f.end);
  assert.equal(closeAllTime(parse({}), "2020-01-01").start, "2026-01-01");
});

test("filters round-trip through query parameters and window overrides keep other filters", () => {
  const f = parse({ period: "custom", start: "2026-03-01", end: "2026-03-31", categories: "3", sources: "POS", compare: "last-year" });
  assert.deepEqual(parse(Object.fromEntries(filtersToParams(f))), f);
  const w = withWindow(f, { start: "2026-03-10", end: "2026-03-12" });
  assert.deepEqual([w.start, w.end, w.categoryIds, w.sourceModules, w.compareStart, w.compareEnd], ["2026-03-10", "2026-03-12", ["3"], ["POS"], "2026-03-07", "2026-03-09"]);
  assert.throws(() => withWindow(f, { start: "2026-03-10", end: "2027-01-01" }));
});
