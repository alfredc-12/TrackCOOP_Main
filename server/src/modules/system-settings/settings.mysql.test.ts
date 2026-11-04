import assert from "node:assert/strict";
import test from "node:test";
import mysql from "mysql2/promise";
import { createSettingsRepository } from "./settings.repository";
import { createActivityRepository } from "../audit-logs/activity.repository";
import { parseActivityQuery } from "../audit-logs/activity.schema";
import { seedAdministration } from "./settings.test-fixture";
const enabled = process.env.SYSTEM_ADMIN_LOCAL_SQL_TEST === "1";

test(
  "System Administration real SQL: safe catalog, atomic changes, audit filtering and pagination",
  { skip: !enabled },
  async (t) => {
    const setup = await mysql.createConnection({
      host: "127.0.0.1",
      port: 33327,
      user: "root",
    });
    const [dir] = await setup.query<mysql.RowDataPacket[]>(
      "SELECT @@datadir AS directory",
    );
    assert.match(
      String(dir[0].directory).replace(/\\/g, "/"),
      /TrackCOOP_SystemSettingsAudit_Worktree\/\.system-admin-test-data/i,
    );
    await setup.query(
      "CREATE DATABASE IF NOT EXISTS trackcoop_system_admin_fixture",
    );
    await setup.end();
    const pool = mysql.createPool({
      host: "127.0.0.1",
      port: 33327,
      user: "root",
      database: "trackcoop_system_admin_fixture",
      timezone: "Z",
      dateStrings: true,
    });
    try {
      await seedAdministration(pool);
      const settings = createSettingsRepository(pool),
        activity = createActivityRepository(pool);
      await t.test(
        "catalog uses saved values, preserves defaults explicitly and never returns unknown secrets",
        async () => {
          const c = await settings.catalog();
          assert.equal(
            c.settings.find((s) => s.key === "membership.associate_fee")!.value,
            240,
          );
          assert.equal(
            c.settings.find((s) => s.key === "membership.terms_version")!
              .source,
            "default",
          );
          const capital = c.settings.find(
            (s) => s.key === "membership.initial_share_capital",
          )!;
          assert.equal(capital.value, 1600);
          assert.equal(capital.enforced, 1500);
          assert.equal(capital.editable, false);
          assert.ok(!JSON.stringify(c).includes("private-value"));
          assert.ok(!c.technical.some((t) => t.key === "smtp.password"));
          assert.ok(c.technical.some((t) => t.key === "legacy.setting"));
          assert.ok(c.participationStatuses.includes("Attended"));
        },
      );
      await t.test(
        "a saved referral policy remains functional and writes exact safe old/new values in one audit record",
        async () => {
          const before = await settings.catalog(),
            entry = before.settings.find(
              (s) => s.key === "referrals.reward_policy",
            )!;
          const after = await settings.save(
            [
              {
                key: entry.key,
                value: {
                  enabled: true,
                  creditsPerSuccessfulReferral: 4,
                  label: "Member credits",
                },
                expectedRevision: entry.revision,
              },
            ],
            "1",
          );
          assert.deepEqual(
            after.settings.find((s) => s.key === entry.key)!.value,
            {
              enabled: true,
              creditsPerSuccessfulReferral: 4,
              label: "Member credits",
            },
          );
          const list = await activity.list(
            parseActivityQuery({ category: "settings" }),
          );
          assert.equal(list.total, 1);
          const detail = await activity.detail(list.items[0].id);
          assert.equal(detail.previous!["Credits per successful referral"], 7);
          assert.equal(detail.next!["Credits per successful referral"], 4);
          assert.ok(!JSON.stringify(detail).includes("private-value"));
        },
      );
      await t.test(
        "historical settings with only a recorded key are identifiable and searchable by their friendly name",
        async () => {
          await pool.execute(
            "INSERT INTO audit_logs(user_id,action,entity_table,description,new_values) VALUES(1,'system_setting.upserted','system_settings','A system setting was saved.',?)",
            [
              JSON.stringify({
                settingKey: "membership.activation_token_hours",
                settingValue: "48",
              }),
            ],
          );
          const result = await activity.list(
            parseActivityQuery({ search: "Account activation link validity" }),
          );
          assert.equal(result.total, 1);
          assert.equal(
            result.items[0].reference,
            "Account activation link validity",
          );
        },
      );
      await t.test(
        "stale, read-only, unknown and invalid multi-key saves leave all values untouched",
        async () => {
          const c = await settings.catalog(),
            fee = c.settings.find((s) => s.key === "membership.associate_fee")!,
            token = c.settings.find(
              (s) => s.key === "membership.activation_token_hours",
            )!;
          await assert.rejects(() =>
            settings.save(
              [
                { key: fee.key, value: 300, expectedRevision: fee.revision },
                { key: token.key, value: -2, expectedRevision: token.revision },
              ],
              "1",
            ),
          );
          assert.equal(
            (await settings.catalog()).settings.find((s) => s.key === fee.key)!
              .value,
            240,
          );
          await settings.save(
            [{ key: fee.key, value: 250, expectedRevision: fee.revision }],
            "1",
          );
          await assert.rejects(
            () =>
              settings.save(
                [{ key: fee.key, value: 260, expectedRevision: fee.revision }],
                "1",
              ),
            { code: "SETTING_CONFLICT" },
          );
          await assert.rejects(
            () =>
              settings.save(
                [
                  {
                    key: "membership.maximum_share_capital",
                    value: 20000,
                    expectedRevision: "0".repeat(64),
                  },
                ],
                "1",
              ),
            { code: "SETTING_READ_ONLY" },
          );
          await assert.rejects(
            () =>
              settings.save(
                [
                  {
                    key: "smtp.password",
                    value: "new",
                    expectedRevision: "0".repeat(64),
                  },
                ],
                "1",
              ),
            { code: "SETTING_NOT_APPROVED" },
          );
        },
      );
      await t.test(
        "audit failure rolls back the setting change rather than committing an unaudited update",
        async () => {
          const catalog = await settings.catalog(),
            fee = catalog.settings.find(
              (s) => s.key === "membership.associate_fee",
            )!;
          await pool.query(
            "CREATE TRIGGER fixture_fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture audit failure'",
          );
          try {
            await assert.rejects(() =>
              settings.save(
                [{ key: fee.key, value: 275, expectedRevision: fee.revision }],
                "1",
              ),
            );
            assert.equal(
              (await settings.catalog()).settings.find(
                (s) => s.key === fee.key,
              )!.value,
              fee.value,
            );
          } finally {
            await pool.query("DROP TRIGGER fixture_fail_audit");
          }
        },
      );
      await t.test(
        "RFM edits are cross-validated without changing the scoring formula or existing snapshots",
        async () => {
          const c = await settings.catalog(),
            labels = c.settings.find(
              (s) => s.key === "member_indicators.label_thresholds",
            )!;
          await assert.rejects(() =>
            settings.save(
              [
                {
                  key: labels.key,
                  value: { activeMin: 6, needsMonitoringMin: 9 },
                  expectedRevision: labels.revision,
                },
              ],
              "1",
            ),
          );
          assert.deepEqual(
            (await settings.catalog()).settings.find(
              (s) => s.key === labels.key,
            )!.value,
            { activeMin: 12, needsMonitoringMin: 7 },
          );
        },
      );
      await t.test(
        "all pages and totals come from the server, with stable timestamp/ID ordering",
        async () => {
          const a = await activity.list(
              parseActivityQuery({
                category: "finance",
                page: 1,
                pageSize: 10,
              }),
            ),
            b = await activity.list(
              parseActivityQuery({
                category: "finance",
                page: 2,
                pageSize: 10,
              }),
            );
          assert.equal(a.total, 35);
          assert.equal(a.items.length, 10);
          assert.equal(b.items.length, 10);
          assert.ok(!a.items.some((x) => b.items.some((y) => x.id === y.id)));
          assert.equal(a.items[0].reference, "FIN-35");
          assert.equal(
            (
              await activity.list(
                parseActivityQuery({
                  category: "finance",
                  page: 100,
                  pageSize: 10,
                }),
              )
            ).page,
            4,
          );
        },
      );
      await t.test(
        "human activity search, actor filtering and Manila day bounds work together",
        async () => {
          const r = await activity.list(
            parseActivityQuery({
              search: "Created a gallery",
              userId: "3",
              start: "2026-11-02",
              end: "2026-11-02",
              category: "website",
            }),
          );
          assert.equal(r.total, 1);
          assert.equal(r.items[0].at, "2026-11-01T17:00:00.000Z");
          assert.equal(
            (await activity.list(parseActivityQuery({ search: "100%_!" })))
              .total,
            0,
          );
          assert.equal(
            (await activity.list(parseActivityQuery({ search: "FIN-23" })))
              .total,
            1,
          );
        },
      );
      await t.test(
        "activity list/detail and options never expose secret values, raw snapshots, links or unrecorded values",
        async () => {
          const list = await activity.list(
            parseActivityQuery({ userId: "system" }),
          );
          assert.equal(list.total, 1);
          assert.ok(!JSON.stringify(list).includes("private-value"));
          const detail = await activity.detail(list.items[0].id);
          assert.equal(detail.next, null);
          assert.equal(detail.previous, null);
          assert.ok(!JSON.stringify(detail).includes("https://"));
          assert.ok(!JSON.stringify(detail).includes("private-value"));
          await assert.rejects(() => activity.detail("999999"), {
            code: "ACTIVITY_NOT_FOUND",
          });
          const options = await activity.options("Maria");
          assert.equal(options.users.length, 1);
          assert.equal(options.users[0].id, "3");
        },
      );
    } finally {
      await pool.end();
    }
  },
);
