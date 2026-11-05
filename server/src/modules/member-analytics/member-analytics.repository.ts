import type { Pool, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import { getPool } from "../../db/pool";
import { endExclusive } from "./member-analytics.filters";
import type { AnalyticsFilters, AnalyticsSources } from "./member-analytics.types";

export const REQUIRED_ANALYTICS_COLUMNS: Record<string, string[]> = {
  member_sectors: ["member_id","sector_id"],
  cooperative_sectors: ["sector_id","sector_name"],
  member_profiles: ["member_id", "member_code", "full_name", "barangay", "sector", "membership_type", "approval_status", "official_member_status", "approved_at", "share_capital_deadline"],
  member_status_history: ["member_status_history_id", "member_id", "changed_at", "new_membership_type", "new_official_status"],
  membership_applications: ["membership_application_id", "converted_member_id", "application_source", "requested_membership_type", "application_status", "barangay", "sector", "submitted_at", "membership_fee_amount", "initial_share_capital_amount"],
  membership_application_status_history: ["membership_application_id", "new_status", "changed_at"],
  member_status_indicators: ["indicator_id", "member_id", "status_label", "total_score", "recency_score", "frequency_score", "contribution_score", "computed_at", "basis_period_start", "basis_period_end", "scoring_version", "basis_summary"],
  share_capital_transactions: ["share_capital_transaction_id", "member_id", "transaction_date", "direction", "transaction_type", "amount", "source_type", "source_id", "transaction_status"],
  share_capital_accounts: ["member_id", "current_balance"],
  share_capital_payments: ["share_payment_id", "member_id", "payment_date", "payment_status"],
  cooperative_activities: ["activity_id", "is_rfm_qualifying"],
  member_activity_participation: ["member_id", "activity_id", "participation_date", "participation_status"],
  member_referrals: ["member_referral_id", "referrer_member_id", "referred_member_id", "membership_application_id", "referral_status", "created_at", "qualified_at"],
  payment_references: ["related_entity_type", "related_entity_id", "validation_status", "validated_at", "payment_purpose", "amount"],
  system_settings: ["setting_key", "setting_value"],
};
const tables = Object.keys(REQUIRED_ANALYTICS_COLUMNS);
function json(value: unknown): Record<string, unknown> {
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return {}; } }
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}
export function createMemberAnalyticsRepository(injectedPool?: Pool) {
  return {
    async load(filters: AnalyticsFilters): Promise<AnalyticsSources> {
      const connection = await (injectedPool ?? getPool()).getConnection();
      const query = async <T>(sql: string, values: Array<string | number> = []) => {
        const [rows] = await connection.execute<RowDataPacket[]>(sql, values);
        return rows as T[];
      };
      try {
        await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
        await connection.beginTransaction();
        const columns = await query<{ tableName: string; columnName: string }>(`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tables.map(() => "?").join(",")})`, tables);
        const capabilities = Object.fromEntries(tables.map(t => [t, REQUIRED_ANALYTICS_COLUMNS[t].every(name => columns.some(c => c.tableName === t && c.columnName === name))]));
        if (!capabilities.member_profiles) throw new AppError("Member analytics requires the current member_profiles schema; check the database migrations", 503, "ANALYTICS_SOURCE_UNAVAILABLE");
        const paymentSourceColumn = capabilities.share_capital_payments && columns.some(c => c.tableName === "share_capital_payments" && c.columnName === "source_type");
        const read = async <T>(required: string[], sql: string, values: Array<string | number> = []) => required.every(t => capabilities[t]) ? query<T>(sql, values) : [];
        const settingsRows = await read<{ key: string; value: unknown }>(["system_settings"], "SELECT setting_key AS `key`, setting_value AS value FROM system_settings WHERE setting_key IN (?, ?, ?, ?)", ["membership.true_member_required_capital", "membership.maximum_share_capital", "member_indicators.qualifying_participation_statuses", "membership.initial_share_capital"]);
        const settingsMap = new Map(settingsRows.map(s => [s.key, s.value]));
        const numericSetting = (key: string, fallback: number) => {
          const raw = settingsMap.get(key); let value: unknown = raw;
          if (typeof raw === "string") { try { value = JSON.parse(raw); } catch { value = raw; } }
          return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
        };
        let statuses: unknown = settingsMap.get("member_indicators.qualifying_participation_statuses");
        if (typeof statuses === "string") { try { statuses = JSON.parse(statuses); } catch { statuses = null; } }
        const participationStatuses = Array.isArray(statuses) && statuses.length && statuses.every(s => typeof s === "string") ? statuses as string[] : ["Participated"];
        const before = endExclusive(filters.asOf);
        const sectorRows = await read<{memberId:string;sector:string}>(["member_sectors","cooperative_sectors"], "SELECT CAST(ms.member_id AS CHAR) AS memberId,s.sector_name AS sector FROM member_sectors ms JOIN cooperative_sectors s ON s.sector_id=ms.sector_id");
        const result: AnalyticsSources = {
          capabilities,
          settings: { target: numericSetting("membership.true_member_required_capital", 3000), maximum: numericSetting("membership.maximum_share_capital", 15000), participationStatuses },
          members: (await read<AnalyticsSources["members"][number]>(["member_profiles"], `SELECT CAST(member_id AS CHAR) AS id, member_code AS memberCode, full_name AS fullName, barangay, sector, membership_type AS membershipType, approval_status AS approvalStatus, official_member_status AS officialStatus, DATE_FORMAT(approved_at, '%Y-%m-%dT%H:%i:%sZ') AS approvedAt, DATE_FORMAT(share_capital_deadline, '%Y-%m-%d') AS deadline FROM member_profiles WHERE approval_status = 'Approved'`)).map(m=>({...m,selectedSectors:sectorRows.filter(r=>r.memberId===m.id).map(r=>r.sector)})),
          statusHistory: await read(["member_status_history"], `SELECT CAST(member_status_history_id AS CHAR) AS id, CAST(member_id AS CHAR) AS memberId, DATE_FORMAT(changed_at, '%Y-%m-%dT%H:%i:%sZ') AS at, new_membership_type AS membershipType, new_official_status AS officialStatus FROM member_status_history WHERE changed_at < ?`, [before]),
          applications: await read(["membership_applications"], `SELECT CAST(membership_application_id AS CHAR) AS id, CAST(converted_member_id AS CHAR) AS memberId, application_source AS source, requested_membership_type AS requestedType, application_status AS status, barangay, sector, DATE_FORMAT(submitted_at, '%Y-%m-%dT%H:%i:%sZ') AS submittedAt FROM membership_applications WHERE submitted_at < ?`, [before]),
          applicationHistory: await read(["membership_application_status_history"], `SELECT CAST(membership_application_id AS CHAR) AS id, new_status AS status, DATE_FORMAT(changed_at, '%Y-%m-%dT%H:%i:%sZ') AS at FROM membership_application_status_history WHERE changed_at < ?`, [before]),
          indicators: (await read<AnalyticsSources["indicators"][number] & { basisSummary: unknown }>(["member_status_indicators"], `SELECT CAST(indicator_id AS CHAR) AS id, CAST(member_id AS CHAR) AS memberId, status_label AS label, total_score AS score, recency_score AS recencyScore, frequency_score AS frequencyScore, contribution_score AS contributionScore, DATE_FORMAT(computed_at, '%Y-%m-%dT%H:%i:%sZ') AS computedAt, DATE_FORMAT(basis_period_start, '%Y-%m-%d') AS start, DATE_FORMAT(basis_period_end, '%Y-%m-%d') AS end, scoring_version AS version, basis_summary AS basisSummary FROM member_status_indicators WHERE computed_at < ?`, [before])).map(r => ({ ...r, score: Number(r.score), fingerprint: typeof json(r.basisSummary).configurationFingerprint === "string" ? json(r.basisSummary).configurationFingerprint as string : null })),
          // All posted entries are needed for account reconciliation, including later effective dates.
          capital: (await read<AnalyticsSources["capital"][number]>(["share_capital_transactions"], `SELECT CAST(t.share_capital_transaction_id AS CHAR) AS id, CAST(t.member_id AS CHAR) AS memberId, DATE_FORMAT(t.transaction_date, '%Y-%m-%d') AS date, t.direction, t.transaction_type AS type, t.amount, t.source_type AS source, CAST(t.source_id AS CHAR) AS sourceId, ${paymentSourceColumn ? 'p.source_type' : 'NULL'} AS paymentSource FROM share_capital_transactions t ${paymentSourceColumn ? "LEFT JOIN share_capital_payments p ON t.source_type = 'share_capital_payment' AND p.share_payment_id = t.source_id" : ''} WHERE t.transaction_status = 'Posted'`)).map(r => ({ ...r, amount: Number(r.amount) })),
          accounts: (await read<AnalyticsSources["accounts"][number]>(["share_capital_accounts"], "SELECT CAST(member_id AS CHAR) AS memberId, current_balance AS balance FROM share_capital_accounts")).map(r => ({ ...r, balance: Number(r.balance) })),
          capitalPayments: await read(["share_capital_payments"], `SELECT CAST(share_payment_id AS CHAR) AS id, CAST(member_id AS CHAR) AS memberId, DATE_FORMAT(payment_date, '%Y-%m-%d') AS date FROM share_capital_payments WHERE payment_status = 'Validated' AND payment_date <= ?`, [filters.asOf]),
          participation: await read(["cooperative_activities", "member_activity_participation"], `SELECT CAST(p.member_id AS CHAR) AS memberId, CAST(p.activity_id AS CHAR) AS activityId, DATE_FORMAT(p.participation_date, '%Y-%m-%d') AS date FROM member_activity_participation p JOIN cooperative_activities a ON a.activity_id = p.activity_id WHERE a.is_rfm_qualifying = 1 AND p.participation_status IN (${participationStatuses.map(() => "?").join(",")}) AND p.participation_date <= ?`, [...participationStatuses, filters.asOf]),
          referrals: await read(["member_referrals"], `SELECT CAST(member_referral_id AS CHAR) AS id, CAST(referrer_member_id AS CHAR) AS referrerId, CAST(referred_member_id AS CHAR) AS memberId, CAST(membership_application_id AS CHAR) AS applicationId, referral_status AS status, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt, DATE_FORMAT(qualified_at, '%Y-%m-%dT%H:%i:%sZ') AS qualifiedAt FROM member_referrals WHERE created_at < ?`, [before]),
          validatedApplications: (await read<{ id: string }>(["payment_references", "membership_applications"], `SELECT CAST(a.membership_application_id AS CHAR) AS id FROM membership_applications a JOIN payment_references p ON p.related_entity_type = 'membership_application' AND p.related_entity_id = a.membership_application_id WHERE p.validation_status = 'Validated' AND p.validated_at < ? AND p.payment_purpose = CASE WHEN a.requested_membership_type = 'True Member' THEN 'Share Capital' ELSE 'Associate Membership Fee' END GROUP BY a.membership_application_id, a.requested_membership_type, a.membership_fee_amount, a.initial_share_capital_amount HAVING SUM(p.amount) >= CASE WHEN a.requested_membership_type = 'True Member' THEN a.initial_share_capital_amount ELSE a.membership_fee_amount END`, [before])).map(r => r.id),
        };
        await connection.commit();
        return result;
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
  };
}
