import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import mysql from "mysql2/promise";
import JSZip from "jszip";
import { defaultRfmFilters } from "./member-indicator.policy";
import { createRfmWorkspaceRepository } from "./member-indicator.workspace-repository";
import { createMemberIndicatorRepository } from "./member-indicator.repository";
import { exportRfmWorkspace } from "./member-indicator.export";
import type { AuthContext } from "../auth/auth.types";

// Opt in only against the disposable, loopback-only MySQL fixture server. Never use application DB credentials.
test(
  "MySQL 8 workspace: eligibility, sources, exact snapshots, exports, history and safe writes",
  { skip: process.env.RFM_MYSQL_TEST_PORT !== "3317" },
  async () => {
    const admin = await mysql.createConnection({
      host: "127.0.0.1",
      port: 3317,
      user: "root",
      password: "",
      multipleStatements: true,
    });
    const name = `trackcoop_rfm_test_${randomUUID().replaceAll("-", "")}`;
    assert.match(name, /^trackcoop_rfm_test_[a-f0-9]{32}$/);
    await admin.query(`CREATE DATABASE ${name}`);
    const pool = mysql.createPool({
      host: "127.0.0.1",
      port: 3317,
      user: "root",
      password: "",
      database: name,
      timezone: "Z",
      multipleStatements: true,
      connectionLimit: 4,
    });
    try {
      await pool.query(`
      CREATE TABLE member_profiles (member_id BIGINT PRIMARY KEY, member_code VARCHAR(60), full_name VARCHAR(190), membership_type VARCHAR(30), official_member_status VARCHAR(30), approval_status VARCHAR(30), barangay VARCHAR(120), sector VARCHAR(100));
      CREATE TABLE system_settings (setting_key VARCHAR(190), setting_value TEXT);
      CREATE TABLE cooperative_activities (activity_id BIGINT PRIMARY KEY, activity_name VARCHAR(190), is_rfm_qualifying TINYINT);
      CREATE TABLE member_activity_participation (participation_id BIGINT PRIMARY KEY, member_id BIGINT, activity_id BIGINT, participation_date DATE, participation_status VARCHAR(80));
      CREATE TABLE share_capital_payments (share_payment_id BIGINT PRIMARY KEY, member_id BIGINT, payment_date DATE, amount DECIMAL(12,2), payment_status VARCHAR(30), reversal_of_payment_id BIGINT NULL);
      CREATE TABLE member_status_indicators (indicator_id BIGINT AUTO_INCREMENT PRIMARY KEY, member_id BIGINT, basis_period_start DATE NULL, basis_period_end DATE NULL, recency_days INT NULL, frequency_count INT DEFAULT 0, validated_share_capital DECIMAL(12,2) DEFAULT 0, recency_score SMALLINT, frequency_score SMALLINT, contribution_score SMALLINT, total_score SMALLINT, status_label VARCHAR(30), scoring_version VARCHAR(40), basis_summary TEXT NULL, computed_by BIGINT NULL, computed_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE audit_logs (audit_log_id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT, action VARCHAR(190), entity_table VARCHAR(190), record_id VARCHAR(190), description TEXT, new_values MEDIUMTEXT);
      INSERT INTO member_profiles VALUES (10,'M10','=Formula-safe member','Associate','Active','Approved','Wawa','Rice'), (11,'M11','Unscored member','True Member','Inactive','Approved','Palico','Fishery'), (12,'M12','Rejected member','Associate','Active','Rejected','Wawa','Rice'), (13,'M13','Suspended member','Associate','Suspended','Approved','Wawa','Rice'), (14,'M14','Terminated member','Associate','Terminated','Approved','Wawa','Rice'), (15,'M15','Pending member','Associate','Pending','Pending','Wawa','Rice');
      INSERT INTO cooperative_activities VALUES (1,'Assembly',1),(2,'Excluded event',0);
      INSERT INTO member_activity_participation VALUES (1,10,1,'2025-01-01','Participated'), (2,10,1,'2026-01-31','Participated'), (3,10,1,'2026-02-01','Participated'), (4,10,1,'2026-01-01','Absent'), (5,10,2,'2026-01-01','Participated');
      INSERT INTO share_capital_payments VALUES (1,10,'2026-01-01',3000,'Validated',NULL), (2,10,'2026-02-01',1500,'Validated',NULL), (3,10,'2026-01-01',500,'Rejected',NULL), (4,10,'2026-01-01',1000,'Reversed',NULL), (5,10,'2026-01-01',-1000,'Reversed',4);
    `);
      const migration = await readFile(
        path.resolve(
          "server/database/migrations/20261102_member_indicator_workspace.sql",
        ),
        "utf8",
      );
      await pool.query(migration);
      await pool.query(migration); // Idempotent and preserves existing results.
      const repository = createRfmWorkspaceRepository(pool);
      const auth: AuthContext = {
        sessionId: "1",
        tokenHash: "fixture",
        user: {
          id: "1",
          displayName: "Chair",
          username: "chair",
          email: "fixture@example.test",
          role: "chairman",
        },
      };
      const before = await repository.workspace(defaultRfmFilters());
      assert.equal(before.summary.eligible, 2);
      assert.equal(before.summary.notScored, 2);
      assert.equal(before.summary.coverage, 0);
      assert.equal(before.summary.average, null);
      const preview = await repository.preview({
        memberId: "10",
        basisPeriodEnd: "2026-01-31",
      });
      const saved = await repository.recalculate(
        { memberId: "10", basisPeriodEnd: "2026-01-31" },
        auth,
        preview.previewFingerprint,
      );
      assert.equal(saved.saved, 1);
      const current = await repository.workspace(defaultRfmFilters());
      assert.equal(current.summary.scored, 1);
      assert.equal(current.summary.notScored, 1);
      assert.equal(current.summary.coverage, 50);
      assert.equal(
        current.rows.find((r) => r.memberId === "10")!.frequencyCount,
        1,
      );
      assert.equal(
        current.rows.find((r) => r.memberId === "10")!.validatedShareCapital,
        3000,
      );
      assert.equal(
        current.matrix.reduce((n, cell) => n + cell.count, 0),
        1,
      );
      const selected = current.rows.find((r) => r.memberId === "10")!;
      const evidence = await repository.evidence("10", selected.indicatorId!);
      assert.equal(
        evidence.metadata!.evidence.qualifyingAllTimeThroughBasis,
        2,
      );
      assert.equal(evidence.metadata!.evidence.frequencyInPeriod, 1);
      assert.equal(
        evidence.metadata!.evidence.participation.some(
          (p) => p.date === "2026-02-01",
        ),
        false,
      );
      assert.equal(
        evidence.metadata!.evidence.contributions.filter((p) => p.qualifies)
          .length,
        1,
      );
      assert.equal(selected.participationEvidenceCount, 2);
      assert.equal(selected.paymentEvidenceCount, 1);
      const missing = await repository.workspace({
        ...defaultRfmFilters(),
        context: "historical",
        basisEnd: "2025-01-31",
      });
      assert.equal(missing.summary.scored, 0);
      assert.equal(
        missing.rows.every((r) => r.classification === null),
        true,
      );
      const historical = await repository.workspace({
        ...defaultRfmFilters(),
        context: "historical",
        basisEnd: "2026-01-31",
        search: "M10",
      });
      assert.equal(historical.summary.eligible, 1);
      assert.equal(historical.summary.scored, 1);
      const run = await repository.workspace({
        ...defaultRfmFilters(),
        context: "run",
        runId: saved.runId,
      });
      assert.equal(run.summary.scored, 1);
      const runs = await repository.runs(1, 20);
      assert.equal(runs.rows[0].id, saved.runId);
      // Recompute an older basis AFTER the newer saved score; neither the workspace nor legacy API may replace it.
      await repository.recalculate(
        { memberId: "10", basisPeriodEnd: "2025-12-31" },
        auth,
      );
      assert.equal(
        (await repository.workspace(defaultRfmFilters())).rows.find(
          (r) => r.memberId === "10",
        )!.basisEnd,
        "2026-01-31",
      );
      assert.equal(
        (await createMemberIndicatorRepository(pool).findLatestByMemberId(
          "10",
        ))!
          .basisPeriodEnd!.toISOString()
          .slice(0, 10),
        "2026-01-31",
      );
      const duplicate = await repository.recalculate(
        { memberId: "10", basisPeriodEnd: "2026-01-31" },
        auth,
      );
      assert.equal(duplicate.saved, 0);
      assert.equal(duplicate.skippedIdentical, 1);
      const emptyScoreRange = await repository.workspace({
        ...defaultRfmFilters(),
        minScore: 15,
      });
      assert.equal(emptyScoreRange.total, 0);
      const notScored = await repository.workspace({
        ...defaultRfmFilters(),
        classification: "Not Yet Scored",
      });
      assert.equal(notScored.total, 1);
      assert.equal(notScored.rows[0].memberId, "11");
      const all = await repository.workspace(
        { ...defaultRfmFilters(), pageSize: 1 },
        true,
      );
      assert.equal(all.rows.length, 2);
      const zip = await JSZip.loadAsync(await exportRfmWorkspace(all));
      assert.match(
        await zip.file("xl/worksheets/sheet2.xml")!.async("string"),
        /&apos;=Formula-safe member/,
      );
      await pool.query(
        "INSERT INTO system_settings VALUES ('member_indicators.label_thresholds', '{\"activeMin\":11,\"needsMonitoringMin\":7}')",
      );
      const incompatible = await repository.workspace(defaultRfmFilters());
      assert.equal(
        incompatible.rows.find((r) => r.memberId === "10")!.quality,
        "Incompatible Version",
      );
      const revised = await repository.preview({
        memberId: "10",
        basisPeriodEnd: "2026-01-31",
      });
      assert.equal(revised.changed, 1);
      await repository.recalculate(
        { memberId: "10", basisPeriodEnd: "2026-01-31" },
        auth,
        revised.previewFingerprint,
      );
      assert.equal(
        (await repository.evidence("10", selected.indicatorId!)).metadata!
          .configuration.labels.activeMin,
        12,
      );
      assert.equal(
        (await repository.workspace(defaultRfmFilters())).rows.find(
          (r) => r.memberId === "10",
        )!.classification,
        "Active",
      );
      // Legacy undated observations remain inspectable in history, but never pretend to be current valid scores.
      await pool.query(
        "INSERT INTO member_status_indicators (member_id,recency_score,frequency_score,contribution_score,total_score,status_label,scoring_version) VALUES (10,1,1,1,3,'Inactive','legacy')",
      );
      const history = await repository.history("10", 1, 100, true);
      assert.equal(history.total, 4);
      assert.equal(history.rows.at(-1)!.basisEnd, null);
      assert.equal(history.rows.at(-1)!.totalScore, 3);
      assert.equal(history.rows.at(-1)!.quality, "Requires Review");
      const [official] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT official_member_status FROM member_profiles WHERE member_id=10",
      );
      assert.equal(official[0].official_member_status, "Active");
      const [audits] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM audit_logs",
      );
      assert.equal(Number(audits[0].total), 4);
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE ${name}`);
      await admin.end();
    }
  },
);
