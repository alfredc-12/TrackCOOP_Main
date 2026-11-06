import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { createFinancialPolicyRepository } from "./financial-policy.repository";

test("draft and approval append distinct versions, record audit events and reject stale writers", async () => {
  let head = 0;
  const rows: Array<Record<string, unknown>> = [];
  const audits: unknown[][] = [];
  const statements: string[] = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql: string, params: unknown[]) {
      statements.push(sql);
      if (sql.startsWith("SELECT current_version")) return [[{ version: head }]];
      if (sql.startsWith("INSERT INTO finance_policy_revisions")) {
        rows.push({ kind: params[0], version: params[1], state: params[2], config: params[3], createdBy: params[4], createdAt: "2026-11-06T00:00:00Z", approvedBy: params[5], approvedAt: params[5] ? "2026-11-06T00:00:00Z" : null, effectiveAt: params[6] ? "2026-11-07T00:00:00Z" : null });
        return [{ insertId: rows.length }];
      }
      if (sql.startsWith("UPDATE finance_policy_heads")) { head = Number(params[0]); return [{ affectedRows: 1 }]; }
      if (sql.startsWith("INSERT INTO audit_logs")) { audits.push(params); return [{ insertId: audits.length }]; }
      if (sql.includes("FROM finance_policy_revisions")) return [[...rows.filter((r) => r.kind === params[0] && r.version === params[1])]];
      throw new Error(`Unexpected query ${sql}`);
    },
  };
  const pool = { getConnection: async () => connection } as unknown as Pool;
  const repo = createFinancialPolicyRepository(pool);
  const draft = await repo.save("threshold", 0, "1", { type: "draft", config: { amountPhp: "123.45" } });
  const approved = await repo.save("threshold", 1, "2", { type: "approve", effectiveAt: "2026-11-07T00:00:00Z" });
  assert.equal(draft.state, "DRAFT");
  assert.equal(approved.state, "APPROVED");
  assert.equal(approved.approvedBy, "2");
  assert.equal(rows[0].state, "DRAFT");
  assert.equal(rows.length, 2);
  assert.equal(audits.length, 2);
  await assert.rejects(repo.save("threshold", 1, "1", { type: "draft", config: { amountPhp: "5" } }), (e: unknown) => (e as { code?: string }).code === "POLICY_VERSION_CONFLICT");
  await assert.rejects(repo.save("threshold", 2, "1", { type: "approve", effectiveAt: "2026-11-07T00:00:00Z" }), (e: unknown) => (e as { code?: string }).code === "POLICY_NOT_DRAFT");
  assert.equal(rows.length, 2);
  assert.ok(!statements.some((sql) => /^UPDATE finance_policy_revisions/i.test(sql)));
});
