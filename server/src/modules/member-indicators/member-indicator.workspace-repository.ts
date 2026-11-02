import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { calculateMemberIndicator } from "./member-indicator.scoring";
import {
  configurationFromSettings,
  defaultRfmFilters,
  fingerprint,
  manilaToday,
  normalizeRfmBasis,
} from "./member-indicator.policy";
import {
  decorateRfmRow,
  eligibleRfmSql,
  histogramMedian,
  percentage,
  rfmDiagnostics,
  rfmSortColumns,
  rfmWorkspaceQuery,
} from "./member-indicator.workspace-query";
import type {
  RfmFilters,
  RfmHistory,
  RfmMemberRow,
  RfmPreview,
  RfmRecalculationInput,
  RfmRecalculationResult,
  RfmRun,
  RfmSnapshotMetadata,
  RfmWorkspace,
  RfmEvidence,
} from "./member-indicator.workspace-types";

type DbRow = Record<string, unknown>;
async function select<T = DbRow>(
  connection: PoolConnection,
  sql: string,
  values: Array<string | number | null> = [],
): Promise<T[]> {
  const [rows] = await connection.execute<RowDataPacket[]>(sql, values);
  return rows as unknown as T[];
}
export async function loadRfmSettings(connection: PoolConnection) {
  const rows = await select<{ key: string; value: string | null }>(
    connection,
    "SELECT setting_key AS `key`, setting_value AS value FROM system_settings WHERE setting_key IN ('member_indicators.fallback_thresholds', 'member_indicators.label_thresholds', 'member_indicators.qualifying_participation_statuses')",
  );
  return configurationFromSettings(
    new Map(rows.map((row) => [row.key, row.value])),
  );
}
export interface RfmWorkspaceRepository {
  workspace(filters: RfmFilters, allRows?: boolean): Promise<RfmWorkspace>;
  history(
    memberId: string,
    page: number,
    pageSize: number,
    allRows?: boolean,
  ): Promise<RfmHistory>;
  evidence(
    memberId: string,
    indicatorId: string,
  ): Promise<{ metadata: RfmSnapshotMetadata | null; message: string }>;
  runs(
    page: number,
    pageSize: number,
  ): Promise<{ rows: RfmRun[]; total: number }>;
  preview(input: RfmRecalculationInput): Promise<RfmPreview>;
  recalculate(
    input: RfmRecalculationInput,
    auth: AuthContext,
    expectedFingerprint?: string,
  ): Promise<RfmRecalculationResult>;
}
export function createRfmWorkspaceRepository(
  pool?: Pool,
): RfmWorkspaceRepository {
  const databasePool = () => pool ?? getPool();
  async function read<T>(work: (connection: PoolConnection) => Promise<T>) {
    const connection = await databasePool().getConnection();
    try {
      await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async function workspaceOn(
    connection: PoolConnection,
    q: RfmFilters,
    allRows: boolean,
  ) {
    const settings = await loadRfmSettings(connection);
    const sql = rfmWorkspaceQuery(q, settings);
    const from = ` FROM records ${sql.where}`;
    const aggregate = (
      await select(
        connection,
        `${sql.cte} SELECT COUNT(*) AS eligible, COUNT(totalScore) AS scored,
      COALESCE(SUM(classification = 'Active'), 0) AS active, COALESCE(SUM(classification = 'Needs Monitoring'), 0) AS needsMonitoring,
      COALESCE(SUM(classification = 'Inactive'), 0) AS inactive, AVG(totalScore) AS average, MAX(IF(totalScore IS NOT NULL, computedAt, NULL)) AS latestCalculation ${from}`,
        sql.values,
      )
    )[0];
    const total = Number(aggregate.eligible),
      scored = Number(aggregate.scored);
    if (allRows && total > 100000)
      throw new AppError(
        "This export exceeds 100,000 members. Narrow the filters before exporting.",
        422,
        "EXPORT_TOO_LARGE",
      );
    const page = Math.max(
      1,
      Math.min(q.page, Math.ceil(total / q.pageSize) || 1),
    );
    const rows = await select(
      connection,
      `${sql.cte} SELECT * ${from} ORDER BY ${rfmSortColumns[q.sortBy]} ${q.sortDirection === "asc" ? "ASC" : "DESC"}, memberId ASC ${allRows ? "" : `LIMIT ${q.pageSize} OFFSET ${(page - 1) * q.pageSize}`}`,
      sql.values,
    );
    const groupRows = await select(
      connection,
      `${sql.cte} SELECT recencyScore, frequencyScore, contributionScore, COUNT(*) AS count ${from} ${sql.where ? "AND" : "WHERE"} totalScore IS NOT NULL GROUP BY recencyScore, frequencyScore, contributionScore`,
      sql.values,
    );
    const groups = groupRows.map((g) => ({
      recencyScore: Number(g.recencyScore),
      frequencyScore: Number(g.frequencyScore),
      contributionScore: Number(g.contributionScore),
      count: Number(g.count),
    }));
    const qualities = await select(
      connection,
      `${sql.cte} SELECT quality AS status, COUNT(*) AS count ${from} GROUP BY quality`,
      sql.values,
    );
    const types = await select(
      connection,
      `${sql.cte} SELECT membershipType AS type, COUNT(*) AS eligible, COUNT(totalScore) AS scored ${from} GROUP BY membershipType`,
      sql.values,
    );
    const versions = await select(
      connection,
      `${sql.cte} SELECT scoringVersion AS version, COUNT(*) AS count ${from} ${sql.where ? "AND" : "WHERE"} totalScore IS NOT NULL GROUP BY scoringVersion`,
      sql.values,
    );
    const bases = await select(
      connection,
      `${sql.cte} SELECT basisStart AS start, basisEnd AS end, COUNT(*) AS count ${from} ${sql.where ? "AND" : "WHERE"} totalScore IS NOT NULL GROUP BY basisStart, basisEnd ORDER BY basisEnd DESC`,
      sql.values,
    );
    const optionRows = await select(
      connection,
      `SELECT DISTINCT m.barangay, m.sector FROM member_profiles m WHERE ${eligibleRfmSql}`,
    );
    const saved = await select(
      connection,
      `SELECT DISTINCT i.scoring_version AS version, DATE_FORMAT(i.basis_period_end, '%Y-%m-%d') AS basis FROM member_status_indicators i JOIN member_profiles m ON m.member_id = i.member_id WHERE ${eligibleRfmSql} AND i.basis_period_end <= ? ORDER BY basis DESC`,
      [manilaToday()],
    );
    return {
      rows: rows.map(decorateRfmRow),
      total,
      page,
      pageSize: q.pageSize,
      filters: q,
      settings,
      generatedAt: new Date().toISOString(),
      summary: {
        eligible: total,
        scored,
        notScored: total - scored,
        active: Number(aggregate.active),
        needsMonitoring: Number(aggregate.needsMonitoring),
        inactive: Number(aggregate.inactive),
        coverage: percentage(scored, total),
        average: aggregate.average == null ? null : Number(aggregate.average),
        median: histogramMedian(
          groups.map((g) => ({
            score: g.recencyScore + g.frequencyScore + g.contributionScore,
            count: g.count,
          })),
        ),
        latestCalculation: aggregate.latestCalculation as string | null,
        quality: qualities.map((g) => ({
          status: g.status as RfmMemberRow["quality"],
          count: Number(g.count),
        })),
        byType: types.map((g) => ({
          type: String(g.type),
          eligible: Number(g.eligible),
          scored: Number(g.scored),
          coverage: percentage(Number(g.scored), Number(g.eligible)),
        })),
        versions: versions.map((g) => ({
          version: String(g.version),
          count: Number(g.count),
        })),
        basisPeriods: bases.map((g) => ({
          start: g.start as string | null,
          end: g.end as string | null,
          count: Number(g.count),
        })),
      },
      ...rfmDiagnostics(groups, scored),
      options: {
        barangays: [
          ...new Set(
            optionRows
              .map((g) => g.barangay)
              .filter((v): v is string => typeof v === "string" && Boolean(v)),
          ),
        ].sort(),
        sectors: [
          ...new Set(
            optionRows
              .map((g) => g.sector)
              .filter((v): v is string => typeof v === "string" && Boolean(v)),
          ),
        ].sort(),
        versions: [...new Set(saved.map((g) => String(g.version)))],
        bases: [
          ...new Set(
            saved
              .map((g) => g.basis)
              .filter((v): v is string => typeof v === "string"),
          ),
        ],
      },
    } satisfies RfmWorkspace;
  }
  async function calculationOn(
    connection: PoolConnection,
    input: RfmRecalculationInput,
  ) {
    const basis = normalizeRfmBasis(input);
    const settings = await loadRfmSettings(connection);
    const memberSql = input.memberId ? " AND m.member_id = ?" : "";
    const memberValues = input.memberId ? [input.memberId] : [];
    const members = await select<{ memberId: string }>(
      connection,
      `SELECT CAST(m.member_id AS CHAR) AS memberId FROM member_profiles m WHERE ${eligibleRfmSql} ${memberSql} ORDER BY m.member_id`,
      memberValues,
    );
    if (input.memberId && !members.length)
      throw new AppError(
        "This member is missing or is outside the approved RFM population.",
        404,
        "MEMBER_NOT_ELIGIBLE",
      );
    const activity = await select(
      connection,
      `SELECT CAST(p.member_id AS CHAR) AS memberId, CAST(p.participation_id AS CHAR) AS id,
      CAST(a.activity_id AS CHAR) AS activityId, a.activity_name AS activity, DATE_FORMAT(p.participation_date, '%Y-%m-%d') AS date,
      p.participation_status AS status, a.is_rfm_qualifying AS qualifying
      FROM member_activity_participation p JOIN cooperative_activities a ON a.activity_id = p.activity_id
      JOIN member_profiles m ON m.member_id = p.member_id WHERE ${eligibleRfmSql} ${memberSql} AND p.participation_date <= ? ORDER BY p.member_id, p.participation_date, p.participation_id`,
      [...memberValues, basis.end],
    );
    const payments = await select(
      connection,
      `SELECT CAST(p.member_id AS CHAR) AS memberId, CAST(p.share_payment_id AS CHAR) AS id,
      DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS date, p.amount, p.payment_status AS status, CAST(p.reversal_of_payment_id AS CHAR) AS reversalOf
      FROM share_capital_payments p JOIN member_profiles m ON m.member_id = p.member_id
      WHERE ${eligibleRfmSql} ${memberSql} AND p.payment_date <= ? ORDER BY p.member_id, p.payment_date, p.share_payment_id`,
      [...memberValues, basis.end],
    );
    const existing = await select(
      connection,
      `SELECT CAST(i.member_id AS CHAR) AS memberId, CAST(i.indicator_id AS CHAR) AS id, i.status_label AS classification, i.basis_summary AS metadata,
      i.total_score AS totalScore, i.recency_score AS recencyScore, i.frequency_score AS frequencyScore, i.contribution_score AS contributionScore,
      i.recency_days AS recencyDays, i.frequency_count AS frequencyCount, i.validated_share_capital AS contributionAmount
      FROM member_status_indicators i JOIN member_profiles m ON m.member_id = i.member_id
      WHERE ${eligibleRfmSql} ${memberSql} AND i.basis_period_start = ? AND i.basis_period_end = ?
      ORDER BY i.computed_at DESC, i.indicator_id DESC`,
      [...memberValues, basis.start, basis.end],
    );
    const previous = new Map<string, DbRow>();
    for (const row of existing)
      if (!previous.has(String(row.memberId)))
        previous.set(String(row.memberId), row);
    function group(rows: DbRow[]) {
      const result = new Map<string, DbRow[]>();
      for (const row of rows) {
        const key = String(row.memberId);
        const items = result.get(key) ?? [];
        items.push(row);
        result.set(key, items);
      }
      return result;
    }
    const activitiesByMember = group(activity),
      paymentsByMember = group(payments);
    const calculations = members.map((member) => {
      const participation = (activitiesByMember.get(member.memberId) ?? []).map(
        (p) => {
          const qualifies =
            Boolean(Number(p.qualifying)) &&
            settings.qualifyingParticipationStatuses.includes(String(p.status));
          const inFrequencyWindow = qualifies && String(p.date) >= basis.start;
          return {
            id: String(p.id),
            activityId: String(p.activityId),
            activity: String(p.activity),
            date: String(p.date),
            status: String(p.status),
            qualifies,
            inFrequencyWindow,
            reason: !Number(p.qualifying)
              ? "Activity is not RFM qualifying"
              : !settings.qualifyingParticipationStatuses.includes(
                    String(p.status),
                  )
                ? "Participation status does not qualify"
                : inFrequencyWindow
                  ? "Included in frequency and recency"
                  : "Before frequency window; eligible for last participation",
          };
        },
      );
      const contributions = (paymentsByMember.get(member.memberId) ?? []).map(
        (p) => ({
          id: String(p.id),
          date: String(p.date),
          amount: Number(p.amount),
          status: String(p.status),
          qualifies: p.status === "Validated" && p.reversalOf == null,
          reason:
            p.reversalOf != null
              ? "Reversal entry is excluded"
              : p.status === "Validated"
                ? "Validated payment through basis date"
                : `${String(p.status)} payment is excluded`,
        }),
      );
      const qualifying = participation.filter((p) => p.qualifies);
      const lastParticipation = qualifying.at(-1)?.date ?? null;
      const recencyDays = lastParticipation
        ? Math.floor(
            (Date.parse(`${basis.end}T00:00:00Z`) -
              Date.parse(`${lastParticipation}T00:00:00Z`)) /
              86400000,
          )
        : null;
      const frequencyCount = participation.filter(
        (p) => p.inFrequencyWindow,
      ).length;
      const contributionAmount =
        Math.round(
          contributions
            .filter((p) => p.qualifies)
            .reduce((n, p) => n + p.amount, 0) * 100,
        ) / 100;
      if (contributionAmount < 0)
        throw new AppError(
          "A member has a negative validated contribution total. Verify source records before recalculating.",
          422,
          "SOURCE_REQUIRES_REVIEW",
        );
      const score = calculateMemberIndicator({
        recencyDays,
        frequencyCount,
        validatedShareCapital: contributionAmount,
        thresholds: settings.thresholds,
        labels: settings.labels,
      });
      const evidence: RfmEvidence = {
        participation,
        contributions,
        lastParticipation,
        qualifyingAllTimeThroughBasis: qualifying.length,
        frequencyInPeriod: frequencyCount,
        validatedPaymentCount: contributions.filter((p) => p.qualifies).length,
        sourceFreshness: "Not independently verified",
      };
      const metadata: RfmSnapshotMetadata = {
        formulaVersion: settings.formulaVersion,
        configurationFingerprint: settings.configurationFingerprint,
        configuration: settings,
        runId: "",
        advisoryOnly: true,
        officialStatusUnchanged: true,
        basisPeriod: basis,
        evidence,
        rawMetrics: {
          recencyDays,
          frequencyCount,
          contributionAmount,
          sourceCounts: {
            qualifyingParticipation: qualifying.length,
            validatedShareCapitalPayments: evidence.validatedPaymentCount,
          },
        },
        scoring: {
          method: "configured-thresholds",
          recencyScore: score.recencyScore,
          frequencyScore: score.frequencyScore,
          contributionScore: score.contributionScore,
          totalScore: score.totalScore,
          label: score.statusLabel,
          safeguardApplied: score.inactiveForNoRecentParticipation,
          explanation: score.inactiveForNoRecentParticipation
            ? "No qualifying participation in the rolling period or within 365 days; the inactivity safeguard applies regardless of total score."
            : "R + F + C, evaluated against the saved configured thresholds.",
        },
      };
      const old = previous.get(member.memberId);
      let oldMetadata: RfmSnapshotMetadata | null = null;
      try {
        oldMetadata = old?.metadata ? JSON.parse(String(old.metadata)) : null;
      } catch {
        /* Legacy metadata is never reconstructed. */
      }
      const identical = Boolean(
        oldMetadata &&
          fingerprint({ ...oldMetadata, runId: "" }) === fingerprint(metadata),
      );
      return { memberId: member.memberId, score, metadata, old, identical };
    });
    const preview: RfmPreview = {
      basis,
      settings,
      affected: members.length,
      newlyScored: calculations.filter((c) => !c.old).length,
      changed: calculations.filter(
        (c) => c.old && c.old.classification !== c.score.statusLabel,
      ).length,
      unchanged: calculations.filter(
        (c) => c.old && c.old.classification === c.score.statusLabel,
      ).length,
      missingParticipation: calculations.filter(
        (c) => c.metadata.evidence.qualifyingAllTimeThroughBasis === 0,
      ).length,
      zeroContributions: calculations.filter(
        (c) => c.metadata.rawMetrics.contributionAmount === 0,
      ).length,
      previewFingerprint: fingerprint({
        basis,
        settings,
        members: calculations.map((c) => ({
          id: c.memberId,
          previous: c.old?.id ?? null,
          metadata: c.metadata,
        })),
      }),
      generatedAt: new Date().toISOString(),
    };
    return { calculations, preview };
  }
  return {
    workspace(q, allRows = false) {
      return read((c) => workspaceOn(c, q, allRows));
    },
    history(memberId, page, pageSize, allRows = false) {
      return read(async (c) => {
        const settings = await loadRfmSettings(c),
          sql = rfmWorkspaceQuery(
            defaultRfmFilters(),
            settings,
            manilaToday(),
            true,
          );
        const condition = " WHERE memberId = ? AND indicatorId IS NOT NULL";
        const counts = await select(
          c,
          `${sql.cte} SELECT COUNT(*) AS total FROM records ${condition}`,
          [...sql.values, memberId],
        );
        if (allRows && Number(counts[0].total) > 10000)
          throw new AppError(
            "History export exceeds 10,000 observations.",
            422,
            "EXPORT_TOO_LARGE",
          );
        const rows = await select(
          c,
          `${sql.cte} SELECT * FROM records ${condition} ORDER BY basisEnd DESC, computedAt DESC, CAST(indicatorId AS UNSIGNED) DESC ${allRows ? "" : `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`}`,
          [...sql.values, memberId],
        );
        return {
          rows: rows.map(decorateRfmRow),
          total: Number(counts[0].total),
          page,
          pageSize,
        };
      });
    },
    evidence(memberId, indicatorId) {
      return read(async (c) => {
        const rows = await select(
          c,
          `SELECT i.basis_summary AS metadata FROM member_status_indicators i JOIN member_profiles m ON m.member_id = i.member_id WHERE ${eligibleRfmSql} AND i.member_id = ? AND i.indicator_id = ?`,
          [memberId, indicatorId],
        );
        if (!rows.length)
          throw new AppError(
            "Saved indicator not found in the eligible population.",
            404,
            "INDICATOR_NOT_FOUND",
          );
        let metadata: RfmSnapshotMetadata | null = null;
        try {
          const parsed = JSON.parse(String(rows[0].metadata));
          if (
            Array.isArray(parsed?.evidence?.participation) &&
            Array.isArray(parsed?.evidence?.contributions) &&
            Array.isArray(parsed?.configuration?.thresholds?.recencyDays) &&
            Array.isArray(parsed?.configuration?.thresholds?.frequencyCount) &&
            Array.isArray(
              parsed?.configuration?.thresholds?.contributionAmount,
            ) &&
            parsed?.configuration?.labels &&
            parsed?.scoring &&
            parsed?.rawMetrics &&
            parsed?.basisPeriod
          )
            metadata = parsed;
        } catch {
          /* Preserve legacy absence. */
        }
        return {
          metadata,
          message: metadata
            ? "Immutable source evidence captured when this calculation was saved. Source freshness is not independently verified."
            : "Detailed source records are unavailable for this saved calculation.",
        };
      });
    },
    runs(page, pageSize) {
      return read(async (c) => {
        const grouped = `SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(i.basis_summary) THEN i.basis_summary ELSE NULL END, '$.runId')), CONCAT('legacy:', i.basis_period_end, ':', DATE_FORMAT(i.computed_at, '%Y-%m-%dT%H:%i:%s'))) AS id,
          DATE_FORMAT(i.basis_period_start, '%Y-%m-%d') AS basisStart, DATE_FORMAT(i.basis_period_end, '%Y-%m-%d') AS basisEnd,
          MAX(DATE_FORMAT(i.computed_at, '%Y-%m-%dT%H:%i:%sZ')) AS computedAt, i.scoring_version AS version, COUNT(DISTINCT i.member_id) AS count
          FROM member_status_indicators i JOIN member_profiles m ON m.member_id = i.member_id WHERE ${eligibleRfmSql} AND i.basis_period_end <= ? GROUP BY id, i.basis_period_start, i.basis_period_end, i.scoring_version`;
        const rows = await select(
          c,
          `${grouped} ORDER BY computedAt DESC, id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
          [manilaToday()],
        );
        const count = await select(
          c,
          `SELECT COUNT(*) AS total FROM (${grouped}) runs`,
          [manilaToday()],
        );
        return {
          rows: rows.map((r) => ({
            ...r,
            count: Number(r.count),
            legacy: String(r.id).startsWith("legacy:"),
          })) as RfmRun[],
          total: Number(count[0].total),
        };
      });
    },
    preview(input) {
      return read(async (c) => (await calculationOn(c, input)).preview);
    },
    async recalculate(input, auth, expectedFingerprint) {
      if (auth.user.role !== "chairman")
        throw new AppError("Chairman access is required.", 403, "FORBIDDEN");
      const connection = await databasePool().getConnection();
      let locked = false;
      try {
        const lock = await select(
          connection,
          "SELECT GET_LOCK(CONCAT('rfm:', LEFT(SHA2(DATABASE(), 256), 48)), 0) AS acquired",
        );
        locked = Number(lock[0]?.acquired) === 1;
        if (!locked)
          throw new AppError(
            "Another indicator calculation is running. Retry after it completes.",
            409,
            "RFM_CALCULATION_BUSY",
          );
        await connection.query(
          "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ",
        );
        await connection.beginTransaction();
        const { calculations, preview } = await calculationOn(
          connection,
          input,
        );
        if (
          expectedFingerprint &&
          expectedFingerprint !== preview.previewFingerprint
        )
          throw new AppError(
            "The population, source records, configuration, or saved results changed after preview. Preview again before saving.",
            409,
            "RFM_PREVIEW_CHANGED",
          );
        const runId = randomUUID();
        let saved = 0;
        for (const calculation of calculations) {
          if (calculation.identical) continue;
          const { score, metadata } = calculation;
          metadata.runId = runId;
          await connection.execute(
            `INSERT INTO member_status_indicators (member_id, basis_period_start, basis_period_end, recency_days, frequency_count, validated_share_capital, recency_score, frequency_score, contribution_score, total_score, status_label, scoring_version, basis_summary, computed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              calculation.memberId,
              preview.basis.start,
              preview.basis.end,
              metadata.rawMetrics.recencyDays,
              metadata.rawMetrics.frequencyCount,
              metadata.rawMetrics.contributionAmount,
              score.recencyScore,
              score.frequencyScore,
              score.contributionScore,
              score.totalScore,
              score.statusLabel,
              preview.settings.formulaVersion,
              JSON.stringify(metadata),
              auth.user.id,
            ],
          );
          saved++;
        }
        const result: RfmRecalculationResult = {
          ...preview,
          runId,
          saved,
          skippedIdentical: calculations.length - saved,
          computedAt: new Date().toISOString(),
        };
        await connection.execute(
          "INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values) VALUES (?, 'member_indicators.recalculated', 'member_status_indicators', ?, ?, ?)",
          [
            auth.user.id,
            input.memberId ?? null,
            "RFM advisory indicators recalculated; official membership status unchanged.",
            JSON.stringify({
              ...result,
              settings: undefined,
              configurationFingerprint:
                preview.settings.configurationFingerprint,
            }),
          ],
        );
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ER_DATA_TOO_LONG"
        ) {
          throw new AppError(
            "Saved evidence exceeds the existing metadata column. Review and apply the member-indicator workspace metadata widening migration before retrying. No results were saved.",
            422,
            "RFM_METADATA_MIGRATION_REQUIRED",
          );
        }
        throw error;
      } finally {
        if (locked) {
          try {
            await connection.query(
              "SELECT RELEASE_LOCK(CONCAT('rfm:', LEFT(SHA2(DATABASE(), 256), 48)))",
            );
          } catch {
            connection.destroy();
          }
        }
        connection.release();
      }
    },
  };
}
