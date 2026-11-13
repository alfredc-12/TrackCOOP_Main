import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { createFinanceRepository } from "./finance.repository";
import { listFinancialRecordsQuerySchema } from "./finance.schema";

function fakePool(rows: unknown[] = []) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool = { async execute(sql: string, values: unknown[] = []) { calls.push({ sql, values }); return [rows, []]; } } as unknown as Pool;
  return { pool, calls };
}

test("summary and trends use the shared posting rule instead of counting every active row", async () => {
  const { pool, calls } = fakePool([{ incomeTotal: "1500.50", expenseTotal: "500", adjustmentTotal: "-20", activeRecords: "7", voidedRecords: "1" }]);
  const repository = createFinanceRepository(pool);
  const summary = await repository.summary();
  await repository.trends();
  for (const call of calls) {
    assert.match(call.sql, /fr\.approved_by IS NOT NULL/, "unposted rows must not enter headline totals");
    assert.match(call.sql, /fr\.source_module = 'Share Capital'/, "capital movements stay out of operating totals");
  }
  assert.deepEqual([summary.incomeTotal, summary.expenseTotal, summary.netTotal, summary.adjustmentTotal, summary.activeRecords, summary.voidedRecords], [1500.5, 500, 1000.5, -20, 7, 1]);
});

test("ledger list query binds analytics drill-down filters", async () => {
  const query = listFinancialRecordsQuerySchema.parse({ startDate: "2026-10-01", endDate: "2026-10-31", financialCategoryIds: "3|4", sourceModules: "POS|Rental", posting: "unposted", recordType: "Income" });
  const { pool, calls } = fakePool();
  await createFinanceRepository(pool).listRecords(query);
  const list = calls[0];
  assert.match(list.sql, /r\.record_date >= \?/);
  assert.match(list.sql, /r\.record_date <= \?/);
  assert.match(list.sql, /r\.financial_category_id IN \(\?, \?\)/);
  assert.match(list.sql, /r\.source_module IN \(\?, \?\)/);
  assert.match(list.sql, /r\.approved_by IS NULL/);
  assert.deepEqual(list.values, ["Income", "2026-10-01", "2026-10-31", "3", "4", "POS", "Rental"]);
  assert.deepEqual(calls[1].values, list.values, "the total count uses the same filters as the page");
});

test("ledger query schema rejects bad filters but keeps existing queries valid", () => {
  assert.equal(listFinancialRecordsQuerySchema.safeParse({}).success, true);
  assert.equal(listFinancialRecordsQuerySchema.safeParse({ search: "FIN-1", recordType: "Income", sortBy: "amount" }).success, true);
  for (const bad of [{ startDate: "2026-10-31", endDate: "2026-10-01" }, { financialCategoryIds: "1; DROP" }, { sourceModules: "Crypto" }, { posting: "maybe" }, { startDate: "yesterday" }]) {
    assert.equal(listFinancialRecordsQuerySchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test("ledger reads preserve season values when supported and fall back only for a missing season column", async () => {
  const query = listFinancialRecordsQuerySchema.parse({ pageSize: 5 });
  for (const hasSeason of [true, false]) {
    const calls: string[] = [];
    const pool = { async execute(sql: string) {
      calls.push(sql);
      if (!hasSeason && sql.includes("CAST(r.season_id AS CHAR)")) {
        throw Object.assign(new Error("missing column"), { code: "ER_BAD_FIELD_ERROR", sqlMessage: "Unknown column 'r.season_id' in 'field list'" });
      }
      if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }], []];
      return [[{ id: "1", amount: "12.00", seasonId: hasSeason ? "7" : null }], []];
    } } as unknown as Pool;
    const repo = createFinanceRepository(pool);
    const list = await repo.listRecords(query);
    const detail = await repo.findRecordById("1");
    assert.equal(list.records[0].seasonId, hasSeason ? "7" : null);
    assert.equal(detail?.seasonId, hasSeason ? "7" : null);
    assert.equal(calls.filter(sql => sql.includes("NULL AS seasonId")).length, hasSeason ? 0 : 2);
    assert.equal(list.total, 1);
  }
});

test("ledger does not hide unrelated database errors", async () => {
  const error = Object.assign(new Error("different missing column"), { code: "ER_BAD_FIELD_ERROR", sqlMessage: "Unknown column 'r.amount' in 'field list'" });
  const pool = { async execute() { throw error; } } as unknown as Pool;
  await assert.rejects(createFinanceRepository(pool).listRecords(listFinancialRecordsQuerySchema.parse({})), e => e === error);
});
