import assert from "node:assert/strict";
import type { Pool } from "mysql2/promise";
import { fallbackRfmConfiguration } from "../member-indicators/member-indicator.policy";
export async function seedAdministration(pool: Pool) {
  const [identity] = await pool.query<import("mysql2/promise").RowDataPacket[]>(
    "SELECT @@datadir AS directory,DATABASE() AS name",
  );
  assert.match(
    String(identity[0].directory).replace(/\\/g, "/"),
    /TrackCOOP_SystemSettingsAudit_Worktree\/\.system-admin-test-data/i,
  );
  assert.equal(identity[0].name, "trackcoop_system_admin_fixture");
  for (const table of [
    "audit_logs",
    "system_settings",
    "member_activity_participation",
    "users",
  ])
    await pool.query(`DROP TABLE IF EXISTS ${table}`);
  await pool.query(
    `CREATE TABLE users(user_id BIGINT PRIMARY KEY,display_name VARCHAR(190))`,
  );
  await pool.query(
    `CREATE TABLE system_settings(system_setting_id BIGINT AUTO_INCREMENT PRIMARY KEY,setting_group VARCHAR(100),setting_key VARCHAR(160) UNIQUE,setting_value LONGTEXT,value_type VARCHAR(20),description TEXT,is_public TINYINT,effective_date DATE,updated_by BIGINT,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
  );
  await pool.query(
    `CREATE TABLE audit_logs(audit_log_id BIGINT AUTO_INCREMENT PRIMARY KEY,user_id BIGINT,action VARCHAR(100),entity_table VARCHAR(100),record_id BIGINT,description TEXT,old_values JSON,new_values JSON,action_time DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  );
  await pool.query(
    `CREATE TABLE member_activity_participation(participation_status VARCHAR(80))`,
  );
  await pool.query(
    `INSERT INTO users VALUES (1,'Chair Officer'),(2,'Bookkeeping Officer'),(3,'Maria Officer')`,
  );
  await pool.query(
    `INSERT INTO member_activity_participation VALUES ('Participated'),('Attended')`,
  );
  const set = async (key: string, value: string, type = "Number") =>
    pool.execute(
      "INSERT INTO system_settings(setting_group,setting_key,setting_value,value_type,is_public) VALUES(?,?,?,?,0)",
      ["membership", key, value, type],
    );
  await set("membership.associate_fee", "240");
  await set("membership.initial_share_capital", "1600");
  await set("membership.activation_token_hours", "48");
  await set(
    "referrals.reward_policy",
    '{"enabled":false,"creditsPerSuccessfulReferral":7,"label":"Referral points"}',
    "JSON",
  );
  await set("inventory.allow_negative_stock", "true", "Boolean");
  await set(
    "member_indicators.fallback_thresholds",
    JSON.stringify(fallbackRfmConfiguration.thresholds),
    "JSON",
  );
  await set(
    "member_indicators.label_thresholds",
    '{"activeMin":12,"needsMonitoringMin":7}',
    "JSON",
  );
  await set(
    "member_indicators.qualifying_participation_statuses",
    '["Participated"]',
    "JSON",
  );
  await set("smtp.password", "private-value-for-redaction-test", "String");
  await set("legacy.setting", "private-value-for-redaction-test", "String");
  for (let i = 1; i <= 35; i++)
    await pool.execute(
      "INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,new_values,action_time) VALUES(?,?,?,?,?,?,?)",
      [
        i % 2 ? 1 : 2,
        "financial_record.posted",
        "financial_records",
        i,
        `Posted financial entry ${i}`,
        JSON.stringify({
          recordNumber: `FIN-${i}`,
          amount: i,
          password: "private-value-for-redaction-test",
        }),
        "2026-11-02 01:00:00",
      ],
    );
  await pool.execute(
    "INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,new_values,action_time) VALUES(?,?,?,?,?,?,?)",
    [
      3,
      "landing.gallery.created",
      "gallery_groups",
      77,
      "A gallery was created.",
      JSON.stringify({ title: "Cooperative orientation" }),
      "2026-11-01 17:00:00",
    ],
  );
  await pool.execute(
    "INSERT INTO audit_logs(user_id,action,entity_table,description,new_values,action_time) VALUES(?,?,?,?,?,?)",
    [
      null,
      "user.password_reset",
      "users",
      "New password is private-value-for-redaction-test",
      JSON.stringify({
        password: "private-value-for-redaction-test",
        activationUrl: "https://example.invalid/activate/private",
      }),
      "2026-11-02 03:00:00",
    ],
  );
}
