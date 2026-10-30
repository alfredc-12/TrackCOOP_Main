import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { selectMemberStatement } from "./member-statement.repository";

function database(rows: unknown[][]) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  return { queries, pool: { query: async (sql: string, params: unknown[]) => { queries.push({ sql, params }); return [rows[queries.length - 1] ?? []]; } } as unknown as Pool };
}

test("statement uses signed ledger changes including reinvestments and deductions", async () => {
  const db = database([[{ member_id: "5" }], [{ balance: "2400.00" }], [
    { amount: "2000.00", ref: "PAY-1" }, { amount: "300.00", ref: "DIV-CAP-1" },
    { amount: "200.00", ref: "PAT-CAP-1" }, { amount: "-100.00", ref: "REV-1" },
  ], []]);
  const result = await selectMemberStatement(db.pool, "owner-1");
  assert.equal(result?.capitalBalance, 2400);
  assert.equal(result?.ledgerBalance, 2400);
  assert.equal(result?.reconciled, true);
  assert.equal(result?.deposits.length, 4);
  assert.deepEqual(db.queries[0].params, ["owner-1"]);
  assert.ok(db.queries.slice(1).every((query) => query.params[0] === "5"));
  assert.match(db.queries[2].sql, /ELSE -amount/);
  assert.match(db.queries[2].sql, /patronage_capital_transfer/);
  assert.match(db.queries[3].sql, /payment_status = 'Paid'/);
});

test("statement preserves the account balance and flags a ledger mismatch", async () => {
  const db = database([[{ member_id: "5" }], [{ balance: "3000.00" }], [{ amount: "2000.00" }], []]);
  const result = await selectMemberStatement(db.pool, "owner-1");
  assert.equal(result?.capitalBalance, 3000);
  assert.equal(result?.reconciled, false);
});

test("legacy members without a ledger still receive validated payment history", async () => {
  const db = database([[{ member_id: "5" }], [], [], [{ amount: "100.10" }, { amount: "0.20" }], []]);
  const result = await selectMemberStatement(db.pool, "owner-1");
  assert.equal(result?.capitalBalance, 100.3);
  assert.equal(result?.reconciled, true);
  assert.match(db.queries[3].sql, /payment_status = 'Validated'/);
});

test("a user without a linked member cannot read statement records", async () => {
  const db = database([[]]);
  assert.equal(await selectMemberStatement(db.pool, "unlinked"), null);
  assert.equal(db.queries.length, 1);
});
