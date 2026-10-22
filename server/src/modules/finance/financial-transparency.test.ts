import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { getFinancialTransparency } from "./financial-transparency";

test("financial transparency aggregates posted categories and keeps record counts", async () => {
  const queries: string[] = [];
  const pool = {
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.includes("recordType")) {
        return [[
          { recordType: "Income", category: "Product Sales", amount: "1250.50", recordCount: 2 },
          { recordType: "Expense", category: "Supplies", amount: 250, recordCount: 1 },
        ], []];
      }
      return [[{ sourceModule: "POS", amount: "1250.50" }], []];
    },
  } as unknown as Pool;

  const summary = await getFinancialTransparency(pool, { period: "all" });

  assert.equal(summary.incomeTotal, 1250.5);
  assert.equal(summary.expenseTotal, 250);
  assert.equal(summary.netTotal, 1000.5);
  assert.deepEqual(summary.incomeByCategory[0], { category: "Product Sales", amount: 1250.5, recordCount: 2 });
  assert.deepEqual(summary.expenseByCategory[0], { category: "Supplies", amount: 250, recordCount: 1 });
  assert.deepEqual(summary.incomeBySource, [{ sourceModule: "POS", amount: 1250.5 }]);
  assert.equal(summary.comparison, null);
  assert.equal(queries.length, 2);
  assert.match(queries[0], /SHARE_CAPITAL/);
});
