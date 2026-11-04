import { byKey, definitions } from "../system-settings/settings.registry";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import { utcBoundary } from "../../utils/manila-calendar";
import {
  activityAreas,
  matchingActions,
  activityLabel,
  areaFor,
  safeText,
  safeActionCode,
  safeAuditValues,
} from "./activity.presentation";
import type { ActivityQuery } from "./activity.schema";
type Row = RowDataPacket & Record<string, unknown>;
export type ActivityItem = {
  entityTable: string;
  actionTime: string;
  id: string;
  action: string;
  label: string;
  category: string;
  area: string;
  userId: string | null;
  userName: string;
  recordId: string | null;
  reference: string | null;
  description: string;
  at: string;
};
export type ActivityDetail = ActivityItem & {
  previous: Record<string, string | number | boolean | null> | null;
  next: Record<string, string | number | boolean | null> | null;
  detailsNote: string;
};
const from = "audit_logs a LEFT JOIN users u ON u.user_id=a.user_id";
const recordedReferenceSql = `COALESCE(${["new_values", "old_values"].flatMap((column) => ["recordNumber", "referenceNumber", "applicationCode", "memberCode"].map((field) => `NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.${column},'$.${field}')),'null'),'')`)).join(",")})`;
const columns = `CAST(a.audit_log_id AS CHAR) AS id,CAST(a.user_id AS CHAR) AS userId,u.display_name AS userName,a.action,a.entity_table AS entityTable,CAST(a.record_id AS CHAR) AS recordId,a.description,DATE_FORMAT(a.action_time,'%Y-%m-%dT%H:%i:%s.000Z') AS at,${recordedReferenceSql} AS recordReference,JSON_UNQUOTE(JSON_EXTRACT(a.new_values,'$.settingKey')) AS settingKeyReference`;
const escaped = (text: string) => text.replace(/[!%_]/g, "!$&");
export function categorySql(id: string) {
  const clauses = activityAreas
    .filter((a) => a.id !== "other")
    .map((a) => ({
      id: a.id,
      sql: `(${a.tables
        .map((t) => `a.entity_table='${t}'`)
        .concat(
          a.prefixes.map(
            (p) => `a.action LIKE '${p.replace(/_/g, "!_")}%' ESCAPE '!'`,
          ),
        )
        .join(" OR ")})`,
    }));
  const selected = activityAreas.some((area) => area.id === id) ? id : "other";
  return `(CASE ${clauses.map((c) => `WHEN ${c.sql} THEN '${c.id}'`).join(" ")} ELSE 'other' END) = '${selected}'`;
}
export function activityScope(f: ActivityQuery) {
  const clauses: string[] = [],
    values: Array<string | number> = [];
  if (f.search) {
    const term = `%${escaped(f.search)}%`,
      actions = matchingActions(f.search);
    const settings = definitions
      .filter((d) =>
        (d.label + " " + d.key).toLowerCase().includes(f.search.toLowerCase()),
      )
      .map((d) => d.key);
    const alternatives = [
      "a.action LIKE ? ESCAPE '!'",
      "a.description LIKE ? ESCAPE '!'",
      "a.entity_table LIKE ? ESCAPE '!'",
      "u.display_name LIKE ? ESCAPE '!'",
      "CAST(a.record_id AS CHAR)=?",
      `${recordedReferenceSql} LIKE ? ESCAPE '!'`,
    ];
    values.push(term, term, term, term, f.search, term);
    if (actions.length) {
      alternatives.push(`a.action IN (${actions.map(() => "?").join(",")})`);
      values.push(...actions);
    }
    if (settings.length) {
      alternatives.push(
        `(a.entity_table='system_settings' AND JSON_UNQUOTE(JSON_EXTRACT(a.new_values,'$.settingKey')) IN (${settings.map(() => "?").join(",")}))`,
      );
      values.push(...settings);
    }
    clauses.push("(" + alternatives.join(" OR ") + ")");
  }
  if (f.start) {
    clauses.push("a.action_time>=?");
    values.push(utcBoundary(f.start));
  }
  if (f.end) {
    clauses.push("a.action_time<?");
    values.push(utcBoundary(f.end, true));
  }
  if (f.userId) {
    clauses.push(f.userId === "system" ? "a.user_id IS NULL" : "a.user_id=?");
    if (f.userId !== "system") values.push(f.userId);
  }
  if (f.category) clauses.push(categorySql(f.category));
  return {
    sql: clauses.length ? " WHERE " + clauses.join(" AND ") : "",
    values,
  };
}
function map(r: Row): ActivityItem {
  const action = String(r.action ?? ""),
    area = areaFor(action, String(r.entityTable ?? ""));
  return {
    entityTable: activityAreas.some((a) =>
      a.tables.includes(String(r.entityTable)),
    )
      ? String(r.entityTable)
      : "other",
    actionTime: String(r.at),
    id: String(r.id),
    action: safeActionCode(action),
    label: activityLabel(action),
    category: area.id,
    area: area.label,
    userId: r.userId ? String(r.userId) : null,
    userName:
      safeText(r.userName, 120) ||
      (r.userId ? "Unavailable user" : "System / unavailable user"),
    recordId: r.recordId ? String(r.recordId) : null,
    reference:
      r.entityTable === "system_settings" &&
      byKey.has(String(r.settingKeyReference))
        ? byKey.get(String(r.settingKeyReference))!.label
        : typeof r.recordReference === "string" &&
            r.recordReference !== "null" &&
            safeText(r.recordReference, 160) === r.recordReference
          ? r.recordReference
          : r.recordId
            ? `Record #${String(r.recordId)}`
            : null,
    description: /password|activation|credential|secret|token|session/i.test(
      action,
    )
      ? "Sensitive details are withheld for this activity."
      : activityLabel(action) === "Recorded system activity"
        ? "No approved activity description is available."
        : safeText(r.description),
    at: String(r.at),
  };
}
export function createActivityRepository(pool?: Pool) {
  const db = () => pool ?? getPool();
  return {
    async list(f: ActivityQuery) {
      const q = activityScope(f);
      const [counts] = await db().execute<Row[]>(
        `SELECT COUNT(*) AS total FROM ${from}${q.sql}`,
        q.values,
      );
      const total = Number(counts[0]?.total ?? 0),
        page = Math.min(f.page, Math.max(1, Math.ceil(total / f.pageSize))),
        offset = (page - 1) * f.pageSize;
      const [rows] = await db().execute<Row[]>(
        `SELECT ${columns} FROM ${from}${q.sql} ORDER BY a.action_time DESC,a.audit_log_id DESC LIMIT ${f.pageSize} OFFSET ${offset}`,
        q.values,
      );
      return { items: rows.map(map), total, page, pageSize: f.pageSize };
    },
    async options(search = "") {
      const [users] = await db().execute<Row[]>(
        `SELECT DISTINCT CAST(a.user_id AS CHAR) AS id,u.display_name AS name FROM ${from} WHERE a.user_id IS NOT NULL AND u.display_name IS NOT NULL AND u.display_name LIKE ? ESCAPE '!' ORDER BY u.display_name,a.user_id LIMIT 101`,
        [`%${escaped(search)}%`],
      );
      return {
        categories: activityAreas.map((a) => ({ id: a.id, label: a.label })),
        users: users
          .slice(0, 100)
          .map((r) => ({ id: String(r.id), name: safeText(r.name, 120) })),
        usersTruncated: users.length > 100,
      };
    },
    async detail(id: string): Promise<ActivityDetail> {
      const [rows] = await db().execute<Row[]>(
        `SELECT ${columns},a.old_values AS oldValues,a.new_values AS newValues FROM ${from} WHERE a.audit_log_id=? LIMIT 1`,
        [id],
      );
      if (!rows[0])
        throw new AppError(
          "This activity record was not found.",
          404,
          "ACTIVITY_NOT_FOUND",
        );
      const row = rows[0];
      return {
        ...map(row),
        previous: safeAuditValues(row.oldValues),
        next: safeAuditValues(row.newValues),
        detailsNote:
          "Only recorded, approved display fields are shown. Secret fields, links and unsupported details are withheld. Missing previous or new values are not reconstructed.",
      };
    },
  };
}
export type ActivityRepository = ReturnType<typeof createActivityRepository>;
