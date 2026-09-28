import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { limitOffsetSql } from "../../db/pagination";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { calculateMemberIndicator, type IndicatorLabelThresholds, type IndicatorThresholds } from "./member-indicator.scoring";
import type {
  MemberIndicator,
  MemberIndicatorBasisSummary,
  MemberIndicatorListQuery,
  MemberIndicatorListResult,
  MemberIndicatorStatus,
  MemberIndicatorSummary,
  MemberIndicatorSourceCounts,
  RecalculateIndicatorsInput,
  RecalculateIndicatorsResult,
} from "./member-indicator.types";

type IndicatorRow = RowDataPacket & {
  id: string;
  memberId: string;
  memberCode: string;
  fullName: string;
  membershipType: string;
  officialMemberStatus: string;
  basisPeriodStart: Date | null;
  basisPeriodEnd: Date | null;
  recencyDays: number | string | null;
  frequencyCount: number | string;
  validatedShareCapital: number | string;
  recencyScore: number;
  frequencyScore: number;
  contributionScore: number;
  totalScore: number;
  statusLabel: MemberIndicatorStatus;
  scoringVersion: string;
  basisSummary: string | null;
  computedBy: string | null;
  computedAt: Date;
};

type CountRow = RowDataPacket & { total: number };
type SummaryRow = RowDataPacket & {
  totalTracked: number;
  active: number;
  needsMonitoring: number;
  inactive: number;
  averageScore: number | null;
};

type MemberForIndicatorRow = RowDataPacket & {
  memberId: string;
};

type ActivityMetricRow = RowDataPacket & {
  memberId: string;
  lastParticipationAt: Date | string | null;
  frequencyCount: number | string | null;
  contributionAmount: number | string | null;
  qualifyingParticipation: number | string | null;
  validatedShareCapitalPayments: number | string | null;
};

type SettingRow = RowDataPacket & {
  settingKey: string;
  settingValue: string | null;
};

const sortColumns: Record<MemberIndicatorListQuery["sortBy"], string> = {
  fullName: "m.full_name",
  totalScore: "i.total_score",
  recencyScore: "i.recency_score",
  frequencyScore: "i.frequency_score",
  contributionScore: "i.contribution_score",
  computedAt: "i.computed_at",
};

const formulaVersion = "TRACKCOOP_RFM_V1";
const fallbackThresholds: IndicatorThresholds = {
  recencyDays: [
    { max: 30, score: 5 },
    { max: 90, score: 4 },
    { max: 180, score: 3 },
    { max: 365, score: 2 },
  ],
  frequencyCount: [
    { min: 12, score: 5 },
    { min: 6, score: 4 },
    { min: 3, score: 3 },
    { min: 1, score: 2 },
  ],
  contributionAmount: [
    { min: 15000, score: 5 },
    { min: 3000, score: 4 },
    { min: 1500, score: 3 },
    { min: 0.01, score: 2 },
  ],
};
const labelThresholds: IndicatorLabelThresholds = {
  activeMin: 12,
  needsMonitoringMin: 7,
};

function indicatorSelect({ latestOnly = true }: { latestOnly?: boolean } = {}) {
  const latestJoin = latestOnly
    ? `JOIN (
              SELECT member_id, MAX(indicator_id) AS latest_indicator_id
                FROM member_status_indicators
               GROUP BY member_id
            ) latest ON latest.latest_indicator_id = i.indicator_id`
    : "";

  return `SELECT CAST(i.indicator_id AS CHAR) AS id,
                 CAST(i.member_id AS CHAR) AS memberId,
                 m.member_code AS memberCode,
                 m.full_name AS fullName,
                 m.membership_type AS membershipType,
                 m.official_member_status AS officialMemberStatus,
                 i.basis_period_start AS basisPeriodStart,
                 i.basis_period_end AS basisPeriodEnd,
                 i.recency_days AS recencyDays,
                 i.frequency_count AS frequencyCount,
                 i.validated_share_capital AS validatedShareCapital,
                 i.recency_score AS recencyScore,
                 i.frequency_score AS frequencyScore,
                 i.contribution_score AS contributionScore,
                 i.total_score AS totalScore,
                 i.status_label AS statusLabel,
                 i.scoring_version AS scoringVersion,
                 i.basis_summary AS basisSummary,
                 CAST(i.computed_by AS CHAR) AS computedBy,
                 i.computed_at AS computedAt
            FROM member_status_indicators i
            JOIN member_profiles m ON m.member_id = i.member_id
            ${latestJoin}`;
}

function mapIndicator(row: IndicatorRow): MemberIndicator {
  return {
    ...row,
    recencyScore: Number(row.recencyScore),
    frequencyScore: Number(row.frequencyScore),
    contributionScore: Number(row.contributionScore),
    totalScore: Number(row.totalScore),
    recencyDays: row.recencyDays === null ? null : Number(row.recencyDays),
    frequencyCount: Number(row.frequencyCount),
    validatedShareCapital: Number(row.validatedShareCapital),
  };
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addUtcMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function normalizeBasis(input: RecalculateIndicatorsInput) {
  const end = parseIsoDate(input.basisPeriodEnd) ?? new Date();
  const start = parseIsoDate(input.basisPeriodStart) ?? addUtcMonths(end, -12);
  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
  };
}

function dateToTime(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function daysSince(activityDate: Date | string | null, basisEnd: string) {
  const activityTime = dateToTime(activityDate);
  const endTime = parseIsoDate(basisEnd)?.getTime() ?? Date.now();
  if (!activityTime) return null;
  return Math.max(0, Math.floor((endTime - activityTime) / 86_400_000));
}


export interface MemberIndicatorRepository {
  list(query: MemberIndicatorListQuery): Promise<MemberIndicatorListResult>;
  findLatestByMemberId(memberId: string): Promise<MemberIndicator | null>;
  history(memberId: string): Promise<{ indicators: MemberIndicator[]; total: number }>;
  summary(): Promise<MemberIndicatorSummary>;
  recalculate(
    input: RecalculateIndicatorsInput,
    auth: AuthContext,
  ): Promise<RecalculateIndicatorsResult>;
}

export function createMemberIndicatorRepository(
  pool?: Pool,
): MemberIndicatorRepository {
  const databasePool = () => pool ?? getPool();

  async function loadIndicatorSettings(connection: PoolConnection) {
    const [rows] = await connection.execute<SettingRow[]>(
      `SELECT setting_key AS settingKey,
              setting_value AS settingValue
         FROM system_settings
        WHERE setting_key IN (
          'member_indicators.fallback_thresholds',
          'member_indicators.label_thresholds',
          'member_indicators.qualifying_participation_statuses'
        )`,
    );
    const settings = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
    let thresholds = fallbackThresholds;
    let labels = labelThresholds;
    let qualifyingParticipationStatuses = ["Participated"];

    try {
      thresholds = {
        ...fallbackThresholds,
        ...JSON.parse(settings.get("member_indicators.fallback_thresholds") ?? "{}"),
      };
    } catch {
      thresholds = fallbackThresholds;
    }

    try {
      labels = {
        ...labelThresholds,
        ...JSON.parse(settings.get("member_indicators.label_thresholds") ?? "{}"),
      };
    } catch {
      labels = labelThresholds;
    }

    try {
      const parsed = JSON.parse(
        settings.get("member_indicators.qualifying_participation_statuses") ?? "[]",
      );
      if (Array.isArray(parsed)) {
        const statuses = parsed
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean);
        if (statuses.length > 0) qualifyingParticipationStatuses = statuses;
      }
    } catch {
      qualifyingParticipationStatuses = ["Participated"];
    }

    return {
      thresholds,
      labels,
      qualifyingParticipationStatuses,
    };
  }

  async function loadActivityMetrics(
    connection: PoolConnection,
    basisStart: string,
    basisEnd: string,
    qualifyingParticipationStatuses: string[],
  ) {
    const statusPlaceholders = qualifyingParticipationStatuses.map(() => "?").join(", ");
    const [rows] = await connection.execute<ActivityMetricRow[]>(
      `SELECT CAST(m.member_id AS CHAR) AS memberId,
              MAX(participation.participation_date) AS lastParticipationAt,
              COALESCE(SUM(
                CASE WHEN participation.participation_date BETWEEN ? AND ? THEN 1 ELSE 0 END
              ), 0) AS frequencyCount,
              COALESCE(capital.validatedShareCapital, 0) AS contributionAmount,
              COUNT(participation.participation_id) AS qualifyingParticipation,
              COALESCE(capital.validatedShareCapitalPayments, 0) AS validatedShareCapitalPayments
         FROM member_profiles m
         LEFT JOIN (
           SELECT map.participation_id, map.member_id, map.participation_date
             FROM member_activity_participation map
             JOIN cooperative_activities activity ON activity.activity_id = map.activity_id
            WHERE activity.is_rfm_qualifying = 1
              AND map.participation_status IN (${statusPlaceholders})
         ) participation ON participation.member_id = m.member_id
                         AND participation.participation_date <= ?
         LEFT JOIN (
           SELECT member_id,
                  SUM(amount) AS validatedShareCapital,
                  COUNT(*) AS validatedShareCapitalPayments
             FROM share_capital_payments
            WHERE payment_status = 'Validated'
              AND payment_date <= ?
            GROUP BY member_id
         ) capital ON capital.member_id = m.member_id
        GROUP BY m.member_id, capital.validatedShareCapital, capital.validatedShareCapitalPayments`,
      [
        basisStart,
        basisEnd,
        ...qualifyingParticipationStatuses,
        basisEnd,
        basisEnd,
      ],
    );

    return new Map(rows.map((row) => [row.memberId, row]));
  }

  return {
    async list(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];

      if (query.search) {
        where.push("(m.full_name LIKE ? OR m.member_code LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search);
      }

      if (query.statusLabel) {
        where.push("i.status_label = ?");
        values.push(query.statusLabel);
      }

      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;

      const [rows] = await databasePool().execute<IndicatorRow[]>(
        `${indicatorSelect()}
         ${whereSql}
         ORDER BY ${sortColumns[query.sortBy]} ${orderDirection}, i.indicator_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total
           FROM member_status_indicators i
           JOIN member_profiles m ON m.member_id = i.member_id
           JOIN (
             SELECT member_id, MAX(indicator_id) AS latest_indicator_id
               FROM member_status_indicators
              GROUP BY member_id
           ) latest ON latest.latest_indicator_id = i.indicator_id
          ${whereSql}`,
        values,
      );

      return {
        indicators: rows.map(mapIndicator),
        total: Number(countRows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async findLatestByMemberId(memberId) {
      const [rows] = await databasePool().execute<IndicatorRow[]>(
        `${indicatorSelect()}
          WHERE i.member_id = ?
          ORDER BY i.indicator_id DESC
          LIMIT 1`,
        [memberId],
      );

      return rows[0] ? mapIndicator(rows[0]) : null;
    },

    async history(memberId) {
      const [rows] = await databasePool().execute<IndicatorRow[]>(
        `${indicatorSelect({ latestOnly: false })}
          WHERE i.member_id = ?
          ORDER BY i.computed_at DESC, i.indicator_id DESC
          LIMIT 20`,
        [memberId],
      );

      return {
        indicators: rows.map(mapIndicator),
        total: rows.length,
      };
    },

    async summary() {
      const [rows] = await databasePool().execute<SummaryRow[]>(
        `SELECT COUNT(*) AS totalTracked,
                SUM(i.status_label = 'Active') AS active,
                SUM(i.status_label = 'Needs Monitoring') AS needsMonitoring,
                SUM(i.status_label = 'Inactive') AS inactive,
                AVG(i.total_score) AS averageScore
           FROM member_status_indicators i
           JOIN (
             SELECT member_id, MAX(indicator_id) AS latest_indicator_id
               FROM member_status_indicators
              GROUP BY member_id
           ) latest ON latest.latest_indicator_id = i.indicator_id`,
      );

      const row = rows[0];
      return {
        totalTracked: Number(row?.totalTracked ?? 0),
        active: Number(row?.active ?? 0),
        needsMonitoring: Number(row?.needsMonitoring ?? 0),
        inactive: Number(row?.inactive ?? 0),
        averageScore: Number(row?.averageScore ?? 0),
        distribution: [
          {
            statusLabel: "Active",
            total: Number(row?.active ?? 0),
            percentage: row?.totalTracked ? Math.round((Number(row.active ?? 0) / Number(row.totalTracked)) * 100) : 0,
          },
          {
            statusLabel: "Needs Monitoring",
            total: Number(row?.needsMonitoring ?? 0),
            percentage: row?.totalTracked ? Math.round((Number(row.needsMonitoring ?? 0) / Number(row.totalTracked)) * 100) : 0,
          },
          {
            statusLabel: "Inactive",
            total: Number(row?.inactive ?? 0),
            percentage: row?.totalTracked ? Math.round((Number(row.inactive ?? 0) / Number(row.totalTracked)) * 100) : 0,
          },
        ],
      };
    },

    async recalculate(input, auth) {
      return withTransaction(async (connection) => {
        const basis = normalizeBasis(input);
        const settings = await loadIndicatorSettings(connection);
        const values: string[] = [];
        const whereSql = input.memberId ? " WHERE member_id = ?" : "";
        if (input.memberId) values.push(input.memberId);

        const [members] = await connection.execute<MemberForIndicatorRow[]>(
          `SELECT CAST(member_id AS CHAR) AS memberId,
                  membership_type AS membershipType,
                  approval_status AS approvalStatus,
                  official_member_status AS officialMemberStatus
             FROM member_profiles
             ${whereSql}`,
          values,
        );

        if (input.memberId && members.length === 0) {
          throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");
        }

        const metrics = await loadActivityMetrics(
          connection,
          basis.start,
          basis.end,
          settings.qualifyingParticipationStatuses,
        );
        const scoredMembers = members.map((member) => {
          const metricRow = metrics.get(member.memberId);
          const sourceCounts: MemberIndicatorSourceCounts = {
            qualifyingParticipation: Number(metricRow?.qualifyingParticipation ?? 0),
            validatedShareCapitalPayments: Number(metricRow?.validatedShareCapitalPayments ?? 0),
          };
          return {
            member,
            recencyDays: daysSince(metricRow?.lastParticipationAt ?? null, basis.end),
            frequencyCount: Number(metricRow?.frequencyCount ?? 0),
            contributionAmount: Number(metricRow?.contributionAmount ?? 0),
            sourceCounts,
          };
        });

        for (const scored of scoredMembers) {
          const calculation = calculateMemberIndicator({
            recencyDays: scored.recencyDays,
            frequencyCount: scored.frequencyCount,
            validatedShareCapital: scored.contributionAmount,
            thresholds: settings.thresholds,
            labels: settings.labels,
          });
          const basisSummary: MemberIndicatorBasisSummary = {
            formulaVersion,
            advisoryOnly: true,
            officialStatusUnchanged: true,
            rawMetrics: {
              recencyDays: scored.recencyDays,
              frequencyCount: scored.frequencyCount,
              contributionAmount: scored.contributionAmount,
              sourceCounts: scored.sourceCounts,
            },
            basisPeriod: basis,
            scoring: {
              method: "configured-thresholds",
              recencyScore: calculation.recencyScore,
              frequencyScore: calculation.frequencyScore,
              contributionScore: calculation.contributionScore,
              totalScore: calculation.totalScore,
              label: calculation.statusLabel,
              explanation: calculation.inactiveForNoRecentParticipation
                ? "No qualifying participation was recorded during the previous 12 months and none was recorded within 365 days, so the inactivity safeguard applies."
                : "Scores use qualifying cooperative participation and validated share capital against the configured RFM-inspired thresholds.",
            },
          };

          await connection.execute<ResultSetHeader>(
            `INSERT INTO member_status_indicators
               (member_id, basis_period_start, basis_period_end, recency_days, frequency_count,
                validated_share_capital, recency_score, frequency_score, contribution_score,
                total_score, status_label, scoring_version, basis_summary, computed_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              scored.member.memberId,
              basis.start,
              basis.end,
              scored.recencyDays,
              scored.frequencyCount,
              scored.contributionAmount,
              calculation.recencyScore,
              calculation.frequencyScore,
              calculation.contributionScore,
              calculation.totalScore,
              calculation.statusLabel,
              formulaVersion,
              JSON.stringify(basisSummary),
              auth.user.id,
            ],
          );
        }

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'member_indicators.recalculated', 'member_status_indicators', ?, ?, ?)`,
          [
            auth.user.id,
            input.memberId ?? null,
            input.memberId
              ? "Member indicators were recalculated for one member."
              : "Member indicators were recalculated for all members.",
            JSON.stringify({
              memberId: input.memberId ?? null,
              recalculated: members.length,
              basisPeriodStart: basis.start,
              basisPeriodEnd: basis.end,
              formulaVersion,
            }),
          ],
        );

        return {
          recalculated: members.length,
          basisPeriodStart: basis.start,
          basisPeriodEnd: basis.end,
        };
      }, databasePool());
    },
  };
}
