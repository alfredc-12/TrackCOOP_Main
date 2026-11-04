import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { createFinancialAnalyticsRepository, OPTIONAL_FINANCIAL_COLUMNS, REQUIRED_FINANCIAL_COLUMNS } from "./financial-analytics.repository";
import { fixtureFilters } from "./financial-analytics.test-fixture";

type Call = { sql: string; values: unknown[] };

function fakePool(options: { omit?: string[]; handler?: (sql: string, values: unknown[]) => unknown[] | undefined } = {}) {
  const calls: Call[] = [];
  const all = { ...REQUIRED_FINANCIAL_COLUMNS, ...OPTIONAL_FINANCIAL_COLUMNS };
  const connection = {
    async query() { return [[], []]; },
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      if (sql.includes("information_schema.COLUMNS")) {
        return [Object.entries(all).filter(([table]) => !options.omit?.includes(table)).flatMap(([tableName, columns]) => columns.map(columnName => ({ tableName, columnName }))), []];
      }
      return [options.handler?.(sql, values) ?? [], []];
    },
  };
  return { pool: { getConnection: async () => connection } as unknown as Pool, calls };
}

test("facts query uses the shared posting rule, groups by day/type/category/source and binds every value", async () => {
  const { pool, calls } = fakePool();
  const filters = fixtureFilters({ categoryIds: ["3", "4"], sourceModules: ["POS"], minAmount: 10, maxAmount: 500, reference: "FIN-100%_x'; DROP TABLE financial_records;--" });
  await createFinancialAnalyticsRepository(pool).load(filters, "2026-09-05");
  const facts = calls.find(call => call.sql.includes("GROUP BY fr.record_date, fr.record_type"))!;
  assert.match(facts.sql, /fr\.record_status = 'Active' AND fr\.approved_by IS NOT NULL/);
  assert.match(facts.sql, /fr\.record_type IN \('Income', 'Expense'\)/);
  assert.match(facts.sql, /fr\.source_module = 'Share Capital'/);
  assert.match(facts.sql, /fr\.financial_category_id IN \(\?,\?\)/);
  assert.match(facts.sql, /fr\.source_module IN \(\?\)/);
  assert.deepEqual(facts.values.slice(0, 5), ["2026-11-02", "3", "4", "POS", 10]);
  assert.equal(facts.values[5], 500);
  assert.equal(facts.values[6], "%FIN-100\\%\\_x'; DROP TABLE financial\\_records;--%", "LIKE wildcards are escaped and the text is only ever a bound value");
  assert.equal(facts.sql.includes("DROP TABLE"), false);
  assert.equal(facts.values.length, (facts.sql.match(/\?/g) ?? []).length);
});

test("unpublished lookups are bound parameters, never concatenated", async () => {
  const { pool, calls } = fakePool();
  await createFinancialAnalyticsRepository(pool).load(fixtureFilters(), "2026-09-05");
  for (const call of calls) assert.equal(call.values.length, (call.sql.match(/\?/g) ?? []).length, call.sql.slice(0, 80));
});

test("first record date follows the same eligibility rule", async () => {
  const { pool, calls } = fakePool({ handler: sql => (sql.includes("MIN(fr.record_date)") ? [{ first: "2025-02-14" }] : undefined) });
  assert.equal(await createFinancialAnalyticsRepository(pool).firstRecordDate("2026-11-02"), "2025-02-14");
  assert.match(calls.at(-1)!.sql, /approved_by IS NOT NULL/);
});

test("fact rows convert to integer centavos and counts", async () => {
  const { pool } = fakePool({ handler: sql => (sql.includes("GROUP BY fr.record_date, fr.record_type") ? [{ date: "2026-10-03", type: "Income", categoryId: "1", source: "POS", cents: "1200000", count: "5" }] : undefined) });
  const sources = await createFinancialAnalyticsRepository(pool).load(fixtureFilters(), "2026-09-05");
  assert.deepEqual(sources.facts, [{ date: "2026-10-03", type: "Income", categoryId: "1", source: "POS", cents: 1_200_000, count: 5 }]);
});

test("a missing required financial table fails loudly", async () => {
  const { pool } = fakePool({ omit: ["financial_categories"] });
  await assert.rejects(createFinancialAnalyticsRepository(pool).load(fixtureFilters(), null), /financial_records and financial_categories schema/);
});

test("missing optional sources are reported as unavailable, not zero", async () => {
  const { pool } = fakePool({ omit: ["pos_sales", "payment_references", "share_capital_accounts"] });
  const sources = await createFinancialAnalyticsRepository(pool).load(fixtureFilters(), null);
  assert.equal(sources.capital.available, false);
  assert.equal(sources.capital.totalBalance, null);
  const pos = sources.integrity.reconciliation.find(row => row.module === "POS")!;
  assert.deepEqual([pos.available, pos.operationalAmount, pos.difference], [false, null, null]);
  const unmatched = sources.integrity.issues.find(issue => issue.code === "unmatched-payment-postings")!;
  assert.equal(unmatched.available, false);
  assert.match(unmatched.limitation ?? "", /Missing data is not zero/);
});

test("integrity checks are read-only, period scoped and neutral", async () => {
  const { pool, calls } = fakePool();
  const sources = await createFinancialAnalyticsRepository(pool).load(fixtureFilters(), "2026-09-05");
  assert.equal(calls.some(call => /\b(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(call.sql)), false);
  assert.deepEqual(sources.integrity.issues.map(issue => issue.code), ["unposted", "classification", "voided", "corrected-or-reversed", "adjustments", "excluded-capital", "unmatched-payment-postings", "pos-reconciliation"]);
  const allowed = new Set(["Requires Review", "Unposted", "Unmatched", "Classification Issue", "Reconciliation Difference", "Informational"]);
  for (const issue of sources.integrity.issues) { assert.ok(allowed.has(issue.label), issue.label); assert.equal(issue.dateRange.from, "2026-10-01"); }
});

test("capital movements: balance, contributions, interest and deductions are separated from operating results", async () => {
  const { pool } = fakePool({ handler: sql => {
    if (sql.includes("FROM share_capital_accounts")) return [{ total: "250000.50" }];
    if (sql.includes("FROM share_capital_transactions")) return [
      { type: "Initial Share Capital", direction: "Credit", cents: "100000" },
      { type: "Additional Capital Contribution", direction: "Credit", cents: "50000" },
      { type: "Dividend Added to Share Capital", direction: "Credit", cents: "20000" },
      { type: "Capital Adjustment Credit", direction: "Credit", cents: "5000" },
      { type: "Reversal", direction: "Debit", cents: "10000" },
    ];
    return undefined;
  } });
  const { capital } = await createFinancialAnalyticsRepository(pool).load(fixtureFilters(), "2026-09-05");
  assert.deepEqual([capital.totalBalance, capital.memberContributions, capital.interestAdditions, capital.otherCredits, capital.addedInPeriod, capital.deductions], [250000.5, 1500, 200, 50, 1750, 100]);
});
