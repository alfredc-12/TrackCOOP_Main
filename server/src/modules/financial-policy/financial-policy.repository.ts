import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import { validateConfig, type PolicyConfig, type PolicyKind, type PolicyRevision } from "./financial-policy.model";

type Row = RowDataPacket & { kind: PolicyKind; version: number; state: "DRAFT" | "APPROVED"; config: string | PolicyConfig; createdBy: string; createdAt: string; approvedBy: string | null; approvedAt: string | null; effectiveAt: string | null };
const select = `SELECT policy_kind AS kind, version, state, configuration AS config,
 CAST(created_by AS CHAR) AS createdBy, CONCAT(DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%f'),'Z') AS createdAt,
 CAST(approved_by AS CHAR) AS approvedBy, IF(approved_at IS NULL,NULL,CONCAT(DATE_FORMAT(approved_at,'%Y-%m-%dT%H:%i:%s.%f'),'Z')) AS approvedAt,
 IF(effective_at IS NULL,NULL,CONCAT(DATE_FORMAT(effective_at,'%Y-%m-%dT%H:%i:%s.%f'),'Z')) AS effectiveAt FROM finance_policy_revisions`;
function map(row: Row): PolicyRevision {
  return { ...row, version: Number(row.version), config: typeof row.config === "string" ? JSON.parse(row.config) : row.config };
}
async function validateCategories(c: PoolConnection, kind: PolicyKind, config: PolicyConfig) {
  if (kind !== "restrictions") return;
  const ids = (config as { categoryIds: string[] }).categoryIds;
  if (!ids.length) return;
  const [rows] = await c.execute<RowDataPacket[]>(`SELECT CAST(financial_category_id AS CHAR) AS id FROM financial_categories WHERE is_active=1 AND financial_category_id IN (${ids.map(() => "?").join(",")}) FOR UPDATE`, ids);
  if (rows.length !== ids.length) throw new AppError("A category does not exist or is inactive.", 422, "INVALID_POLICY_CATEGORY");
}
export function createFinancialPolicyRepository(pool?: Pool) {
  const db = () => pool ?? getPool();
  async function history(kind: PolicyKind): Promise<PolicyRevision[]> {
    const [rows] = await db().execute<Row[]>(`${select} WHERE policy_kind=? ORDER BY version DESC`, [kind]);
    return rows.map(map);
  }
  async function save(kind: PolicyKind, expectedVersion: number, actor: string, action: { type: "draft"; config: PolicyConfig } | { type: "approve"; effectiveAt: string }): Promise<PolicyRevision> {
    try {
      return await withTransaction(async (c) => {
        const [heads] = await c.execute<RowDataPacket[]>("SELECT current_version AS version FROM finance_policy_heads WHERE policy_kind=? FOR UPDATE", [kind]);
        if (!heads.length) throw new AppError("Policy configuration is unavailable.", 503, "POLICY_CONFIGURATION_REQUIRED");
        const current = Number(heads[0].version);
        if (current !== expectedVersion) throw new AppError("Policy changed; reload before saving.", 409, "POLICY_VERSION_CONFLICT");
        let config: PolicyConfig;
        let effectiveAt: string | null = null;
        if (action.type === "draft") config = validateConfig(kind, action.config);
        else {
          const [rows] = await c.execute<Row[]>(`${select} WHERE policy_kind=? AND version=?`, [kind, current]);
          if (!rows.length || rows[0].state !== "DRAFT") throw new AppError("Only the current draft can be approved.", 409, "POLICY_NOT_DRAFT");
          config = validateConfig(kind, map(rows[0]).config);
          effectiveAt = new Date(action.effectiveAt).toISOString().slice(0, 23).replace("T", " ");
        }
        await validateCategories(c, kind, config);
        const version = current + 1;
        const [result] = await c.execute<ResultSetHeader>(`INSERT INTO finance_policy_revisions(policy_kind,version,state,configuration,created_by,created_at,approved_by,approved_at,effective_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP(3),?,${action.type === "approve" ? "UTC_TIMESTAMP(3)" : "NULL"},?)`, [kind, version, action.type === "draft" ? "DRAFT" : "APPROVED", JSON.stringify(config), actor, action.type === "approve" ? actor : null, effectiveAt]);
        await c.execute("UPDATE finance_policy_heads SET current_version=? WHERE policy_kind=? AND current_version=?", [version, kind, current]);
        await c.execute(`INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,old_values,new_values,action_time) VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP())`, [actor, `finance_policy.${action.type}`, "finance_policy_revisions", result.insertId, `Financial policy ${action.type}`, JSON.stringify({ kind, version: current }), JSON.stringify({ kind, version, config, effectiveAt }),]);
        const [rows] = await c.execute<Row[]>(`${select} WHERE policy_kind=? AND version=?`, [kind, version]);
        return map(rows[0]);
      }, db());
    } catch (error) {
      if (["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT", "ER_DUP_ENTRY"].includes((error as { code?: string }).code ?? "")) throw new AppError("Policy changed; reload before saving.", 409, "POLICY_VERSION_CONFLICT");
      throw error;
    }
  }
  return { history, save };
}
export type FinancialPolicyRepository = ReturnType<typeof createFinancialPolicyRepository>;
