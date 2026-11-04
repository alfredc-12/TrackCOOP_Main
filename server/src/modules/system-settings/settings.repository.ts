import type { Pool, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import {
  categories,
  definitions,
  byKey,
  parseStored,
  validateValue,
  validateRfmState,
  revision,
  encodeValue,
  type SettingValue,
  type SettingDefinition,
} from "./settings.registry";
import { safeText } from "../audit-logs/activity.presentation";
type Row = RowDataPacket & {
  id: string;
  settingKey: string;
  settingValue: string | null;
  updatedAt: string;
};
type Executor = Pick<Pool, "execute">;
export type SettingEntry = {
  id: string | null;
  key: string;
  category: string;
  label: string;
  help: string;
  kind: SettingDefinition["kind"];
  value: SettingValue;
  source: "saved" | "default" | "invalid";
  editable: boolean;
  revision: string;
  unit?: string;
  enforced?: SettingValue;
  updatedAt: string | null;
};
export type SettingsCatalog = {
  categories: typeof categories;
  settings: SettingEntry[];
  technical: Array<{ key: string; type: string }>;
  participationStatuses: string[];
};
export type SettingChange = {
  key: string;
  value: unknown;
  expectedRevision: string;
};
const select = `SELECT CAST(system_setting_id AS CHAR) AS id,setting_key AS settingKey,setting_value AS settingValue,CAST(updated_at AS CHAR) AS updatedAt FROM system_settings WHERE setting_key IN (${definitions.map(() => "?").join(",")})`;
const keys = definitions.map((d) => d.key);
function entry(d: SettingDefinition, row?: Row): SettingEntry {
  let value: SettingValue = d.fallback,
    source: SettingEntry["source"] =
      row?.settingValue !== null && row?.settingValue !== undefined
        ? "saved"
        : "default";
  try {
    value = parseStored(d, row?.settingValue ?? null);
    if (JSON.stringify(value) !== safeText(JSON.stringify(value), 10000))
      throw new Error("Unsafe saved value");
  } catch {
    source = "invalid";
    value = d.fallback;
  }
  return {
    id: row?.id ?? null,
    key: d.key,
    category: d.category,
    label: d.label,
    help: d.help,
    kind: d.kind,
    value,
    source,
    editable: d.editable,
    revision: revision(d.key, row?.settingValue ?? null, Boolean(row)),
    unit: d.unit,
    enforced: d.enforced,
    updatedAt: row?.updatedAt ?? null,
  };
}
export function createSettingsRepository(pool?: Pool) {
  const db = () => pool ?? getPool();
  async function catalog(c: Executor = db()): Promise<SettingsCatalog> {
    const [rows] = await c.execute<Row[]>(select, keys);
    const [technical] = await c.execute<RowDataPacket[]>(
      "SELECT setting_key AS `key`,value_type AS type FROM system_settings ORDER BY setting_key",
    );
    const [statuses] = await c.execute<RowDataPacket[]>(
      "SELECT DISTINCT participation_status AS status FROM member_activity_participation WHERE participation_status IS NOT NULL ORDER BY participation_status LIMIT 100",
    );
    return {
      categories,
      settings: definitions.map((d) =>
        entry(
          d,
          rows.find((r) => r.settingKey === d.key),
        ),
      ),
      technical: technical
        .filter(
          (r) =>
            !byKey.has(String(r.key)) &&
            !/password|secret|token|credential|api.?key|smtp|webhook|session/i.test(
              String(r.key),
            ) &&
            /^[a-z0-9_.-]{1,160}$/i.test(String(r.key)),
        )
        .map((r) => ({ key: String(r.key), type: String(r.type) })),
      participationStatuses: [
        ...new Set([
          "Participated",
          ...statuses.map((r) => safeText(r.status, 80)).filter(Boolean),
          ...rows
            .filter(
              (r) =>
                r.settingKey ===
                "member_indicators.qualifying_participation_statuses",
            )
            .flatMap((r) => {
              try {
                const v = JSON.parse(r.settingValue ?? "[]");
                return Array.isArray(v)
                  ? v
                      .filter(
                        (x: unknown): x is string => typeof x === "string",
                      )
                      .map((x: string) => safeText(x, 80))
                  : [];
              } catch {
                return [];
              }
            }),
        ]),
      ],
    };
  }
  async function save(changes: SettingChange[], userId: string) {
    if (
      !changes.length ||
      changes.length > definitions.length ||
      new Set(changes.map((c) => c.key)).size !== changes.length
    )
      throw new AppError(
        "Select distinct supported settings to save.",
        422,
        "INVALID_SETTING_CHANGES",
      );
    const checked = changes.map((c) => {
      const definition = byKey.get(c.key);
      if (!definition)
        throw new AppError(
          "This setting is not approved for editing.",
          422,
          "SETTING_NOT_APPROVED",
        );
      if (!/^[a-f0-9]{64}$/.test(c.expectedRevision))
        throw new AppError(
          "Reload the saved values before making changes.",
          422,
          "SETTING_REVISION_REQUIRED",
        );
      return { ...c, definition, value: validateValue(definition, c.value) };
    });
    try {
      return await withTransaction(async (c) => {
        const [rows] = await c.execute<Row[]>(select + " FOR UPDATE", keys);
        const values = new Map(rows.map((r) => [r.settingKey, r.settingValue]));
        for (const change of checked) {
          const row = rows.find((r) => r.settingKey === change.key);
          if (
            revision(change.key, row?.settingValue ?? null, Boolean(row)) !==
            change.expectedRevision
          )
            throw new AppError(
              "Someone changed these settings. Refresh and review the latest saved values.",
              409,
              "SETTING_CONFLICT",
            );
          values.set(change.key, encodeValue(change.definition, change.value));
        }
        if (checked.some((v) => v.key.startsWith("member_indicators.")))
          validateRfmState(values);
        for (const change of checked) {
          const old = rows.find((r) => r.settingKey === change.key),
            raw = encodeValue(change.definition, change.value);
          if (old?.settingValue === raw) continue;
          await c.execute(
            `INSERT INTO system_settings(setting_group,setting_key,setting_value,value_type,description,is_public,effective_date,updated_by) VALUES(?,?,?,?,?,0,DATE(UTC_TIMESTAMP()+INTERVAL 8 HOUR),?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),value_type=VALUES(value_type),updated_by=VALUES(updated_by)`,
            [
              change.definition.group,
              change.key,
              raw,
              change.definition.kind === "text"
                ? "String"
                : change.definition.kind === "number"
                  ? "Number"
                  : change.definition.kind === "boolean"
                    ? "Boolean"
                    : "JSON",
              change.definition.help,
              userId,
            ],
          );
          const [ids] = await c.execute<RowDataPacket[]>(
            "SELECT CAST(system_setting_id AS CHAR) AS id FROM system_settings WHERE setting_key=?",
            [change.key],
          );
          const previous = old ? entry(change.definition, old) : null;
          await c.execute(
            `INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,old_values,new_values,action_time) VALUES(?,'system_setting.upserted','system_settings',?,?,?,?,UTC_TIMESTAMP())`,
            [
              userId,
              ids[0].id,
              `Updated ${change.definition.label.toLowerCase()}.`,
              JSON.stringify({
                settingKey: change.key,
                settingValue:
                  previous?.source === "saved" ? old!.settingValue : null,
              }),
              JSON.stringify({ settingKey: change.key, settingValue: raw }),
            ],
          );
        }
        return catalog(c);
      }, db());
    } catch (e) {
      if (
        ["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(
          (e as { code?: string }).code ?? "",
        )
      )
        throw new AppError(
          "Settings changed during this save. Refresh and try again.",
          409,
          "SETTING_CONFLICT",
        );
      throw e;
    }
  }
  return { catalog, save };
}
export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
