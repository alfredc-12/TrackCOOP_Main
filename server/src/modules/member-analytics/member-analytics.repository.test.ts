import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { createMemberAnalyticsRepository, REQUIRED_ANALYTICS_COLUMNS } from "./member-analytics.repository";
import { fixtureFilters } from "./member-analytics.test-fixture";

test("source load uses a consistent read-only transaction, parameterized dates/statuses and actual schema keys", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let released = false;
  const connection = {
    async query(sql: string) { calls.push({ sql }); }, async beginTransaction() { calls.push({ sql: "BEGIN" }); }, async commit() { calls.push({ sql: "COMMIT" }); }, async rollback() { calls.push({ sql: "ROLLBACK" }); }, release() { released = true; },
    async execute(sql: string, values: unknown[]) { calls.push({ sql, values }); return [sql.includes("information_schema") ? [...Object.entries(REQUIRED_ANALYTICS_COLUMNS).flatMap(([tableName, names]) => names.map(columnName => ({ tableName, columnName }))), { tableName: "share_capital_payments", columnName: "source_type" }] : []]; },
  };
  const pool = { async getConnection() { return connection; } } as unknown as Pool;
  const source = await createMemberAnalyticsRepository(pool).load(fixtureFilters);
  assert.equal(source.members.length, 0); assert.ok(released);
  assert.deepEqual(calls.slice(0, 2).map(c => c.sql), ["SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY", "BEGIN"]);
  assert.equal(calls.at(-1)?.sql, "COMMIT");
  assert.ok(calls.every(c => !/INSERT|UPDATE |DELETE |ALTER |CREATE |FOR UPDATE/i.test(c.sql)));
  const sql = calls.map(c => c.sql).join("\n");
  assert.match(sql, /share_capital_transaction_id/); assert.match(sql, /member_referral_id/); assert.match(sql, /membership_application_id/); assert.match(sql, /share_payment_id/);
  assert.doesNotMatch(sql, /CAST\((application_id|referral_id|transaction_id|share_capital_payment_id)/);
  const activity = calls.find(c => c.sql.includes("FROM member_activity_participation"))!;
  assert.deepEqual(activity.values, ["Participated", "2026-11-02"]);
  assert.match(sql, /related_entity_type = 'membership_application'/);
  assert.match(sql, /'Associate Membership Fee'/);
});
test("missing optional tables do not trigger invalid queries; failures roll back and release connection", async () => {
  let rolledBack = false, released = false;
  const connection = { async query() {}, async beginTransaction() {}, async commit() {}, async rollback() { rolledBack = true; }, release() { released = true; }, async execute() { throw new Error("fixture disconnected"); } };
  await assert.rejects(createMemberAnalyticsRepository({ async getConnection() { return connection; } } as unknown as Pool).load(fixtureFilters), /disconnected/);
  assert.ok(rolledBack && released);
});
