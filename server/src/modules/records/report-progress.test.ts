import assert from "node:assert/strict";
import test from "node:test";
import { attentionQuery, comparisonRows, completeTrendMonths, manilaDate, overviewQuery, progressRange, progressSummary, trendQuery } from "./report-progress";
import type { AuthorizedUser } from "./records-auth";

test("comparison uses inclusive equal-length windows across leap years and year boundaries", () => {
  assert.deepEqual(progressRange({ dateFrom: "2024-03-01", dateTo: "2024-03-31" }), { dateFrom: "2024-03-01", dateTo: "2024-03-31", previousFrom: "2024-01-30", previousTo: "2024-02-29" });
  assert.equal(progressRange({ dateFrom: "2026-01-01", dateTo: "2026-01-01" }).previousFrom, "2025-12-31");
  assert.equal(manilaDate(new Date("2026-01-31T17:00:00Z")), "2026-02-01");
  assert.equal(progressRange({}, new Date("2026-01-31T17:00:00Z")).dateFrom, "2026-02-01");
});

test("invalid dates, backwards ranges, and excessive periods are rejected", () => {
  for (const filters of [{ dateFrom: "2026-02-29" }, { dateFrom: "2026-11-31" }, { dateFrom: "x" }, { dateFrom: "2026-12-01", dateTo: "2026-11-01" }, { dateFrom: "2000-01-01", dateTo: "2026-01-01" }]) assert.throws(() => progressRange(filters));
});

test("comparison handles zero and negative baselines without infinity or a false percentage", () => {
  const rows = comparisonRows([{ metric: "Income", currentValue: "10.25", previousValue: "0" }, { metric: "Net", currentValue: 50, previousValue: -100 }, { metric: "Expense", currentValue: 90, previousValue: 100 }]);
  assert.equal(rows[0].changePercent, null);
  assert.equal(rows[0].change, 10.25);
  assert.equal(rows[1].changePercent, 150);
  assert.equal(rows[2].changePercent, -10);
});

test("missing months are zero-filled, not connected across gaps or dropped", () => {
  const rows = completeTrendMonths([{ period: "2026-02", value0: 50, value1: 20, value2: 30 }], { dateFrom: "2026-01-15", dateTo: "2026-03-12" });
  assert.deepEqual(rows.map((row) => row.period), ["2026-01", "2026-02", "2026-03"]);
  assert.equal(rows[0].value0, 0);
  assert.equal(rows[1].value0, 50);
  assert.equal(progressSummary("performance-trends", rows)[1].value, 50);
});

test("overview/trends require confirmed records and bind dates rather than interpolating input", () => {
  for (const query of [overviewQuery({ dateFrom: "2026-01-01", dateTo: "2026-02-28" }), trendQuery({ dateFrom: "2026-01-01", dateTo: "2026-02-28" })]) {
    assert.equal((query.sql.match(/\?/g) ?? []).length, query.values.length);
    assert.match(query.sql, /approved_by IS NOT NULL/);
    assert.match(query.sql, /ps.payment_status = 'Paid'/);
    assert.match(query.sql, /linked.validation_status = 'Validated'/);
    assert.match(query.sql, /scp.payment_status = 'Validated'/);
    assert.doesNotMatch(query.sql, /2026-01-01/);
  }
});

test("attention uses current issues, reservations, and the existing document access policy", () => {
  const user = { role: "bookkeeper", numericId: 1 } as AuthorizedUser;
  const query = attentionQuery(user);
  assert.match(query.sql, /validation_status IN \('Pending','Needs Clarification'\)/);
  assert.match(query.sql, /NOT EXISTS/);
  assert.match(query.sql, /stock.onHand,0\)-COALESCE\(reserved.quantity,0\)/);
  assert.match(query.sql, /d.access_level <> 'Admin-only'/);
  assert.match(query.sql, /product_status IN \('Active','Out of Stock'\)/);
  assert.equal(progressSummary("attention-needed", [{}, {}])[0].value, 2);
});
