import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { createShareCapitalRepository } from "./share-capital.repository";

test("capital summary keeps ledger balances and holders distinct from validated payment history", async () => {
  const statements: string[] = [];
  const pool = { execute: async (sql: string) => {
    statements.push(sql);
    if (sql.includes("FROM share_capital_accounts")) return [[{ currentBalance: "6500.00", holders: 2 }], []];
    if (sql.includes("FROM share_capital_payments")) return [[{ validatedTotal: "5000.00", pendingTotal: "250.00", validatedPayments: 3, membersWithValidatedCapital: 1 }], []];
    throw new Error("Unexpected query");
  } } as unknown as Pool;
  const summary = await createShareCapitalRepository(pool).summary();
  assert.equal(summary.currentBalance, 6500);
  assert.equal(summary.capitalHolders, 2);
  assert.equal(summary.validatedTotal, 5000);
  assert.equal(summary.pendingTotal, 250);
  assert.equal(summary.membersWithValidatedCapital, 1);
  assert.match(statements[1], /current_balance > 0/);
});

test("share-capital list applies search and status to rows and total with stable pagination", async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool = { execute: async (sql: string, values: unknown[]) => {
    calls.push({ sql, values });
    if (sql.includes("COUNT(*)")) return [[{ total: 611 }], []];
    return [[], []];
  } } as unknown as Pool;
  const result = await createShareCapitalRepository(pool).list({ page: 3, pageSize: 20, search: "Maria", paymentStatus: "Validated", sortBy: "createdAt", sortDirection: "desc" });
  assert.equal(result.total, 611);
  assert.equal(result.page, 3);
  assert.equal(result.pageSize, 20);
  assert.deepEqual(calls[0].values, ["%Maria%", "%Maria%", "Validated"]);
  assert.deepEqual(calls[1].values, calls[0].values);
  assert.match(calls[0].sql, /ORDER BY s\.created_at DESC, s\.share_payment_id DESC/);
  assert.match(calls[0].sql, /LIMIT 20 OFFSET 40/);
});
