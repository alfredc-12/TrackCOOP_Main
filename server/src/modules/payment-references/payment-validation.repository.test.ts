import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { createPaymentValidationRepository } from "./payment-validation.repository";

class ValidationPool {
  queries: Array<{ sql: string; values: unknown[] }> = [];
  async beginTransaction() {}
  async commit() {}
  async rollback() {}
  release() {}
  async getConnection() { return this; }
  async execute<T = unknown>(sql: string, values: unknown[] = []): Promise<[T, unknown]> {
    this.queries.push({ sql, values });
    if (sql.includes("COUNT(DISTINCT p.payment_reference_id)")) {
      return [[{ total: 37 }] as T, null];
    }
    return [[] as T, null];
  }
}

function query() {
  return {
    page: 3,
    pageSize: 10,
    search: "NFFAC-2026-0042",
    failedEvents: true,
    amountMin: 200,
    amountMax: 3000,
    sortBy: "amount" as const,
    sortDirection: "asc" as const,
  };
}

test("validation list supports member/application search, failed events, amount maximum, and pagination", async () => {
  const pool = new ValidationPool();
  const result = await createPaymentValidationRepository(pool as unknown as Pool).list(query());
  assert.deepEqual(result, { items: [], total: 37, page: 3, pageSize: 10 });
  assert.equal(pool.queries.length, 2);
  const listSql = pool.queries[1].sql;
  assert.match(listSql, /m\.member_code LIKE \?/);
  assert.match(listSql, /m\.full_name LIKE \?/);
  assert.match(listSql, /a\.application_code LIKE \?/);
  assert.match(listSql, /a\.first_name/);
  assert.match(listSql, /processing_status = 'Failed'/);
  assert.match(listSql, /p\.amount >= \?/);
  assert.match(listSql, /p\.amount <= \?/);
  assert.match(listSql, /ORDER BY p\.amount ASC/);
  assert.match(listSql, /LIMIT 10 OFFSET 20/);
  assert.equal(pool.queries[1].values.filter((value) => value === "%NFFAC-2026-0042%").length, 8);
  assert.deepEqual(pool.queries[1].values.slice(-2), [200, 3000]);
});

test("safe detail query does not select raw webhook payloads, signatures, or tracking hashes", async () => {
  const pool = new ValidationPool();
  await createPaymentValidationRepository(pool as unknown as Pool).detail("42");
  const combined = pool.queries.map((entry) => entry.sql).join("\n");
  assert.doesNotMatch(combined, /raw_payload|payload_json|signature_header|webhook_signature|tracking_token_hash|session_token_hash/i);
});
