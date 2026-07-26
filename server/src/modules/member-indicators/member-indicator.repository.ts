import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { limitOffsetSql } from "../../db/pagination";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
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
  recencyScore: number;
  frequencyScore: number;
  contributionScore: number;
  totalScore: number;
  statusLabel: MemberIndicatorStatus;
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
  lastActivityAt: Date | string | null;
  frequencyCount: number | string | null;
  contributionAmount: number | string | null;
  shareCapitalPayments: number | string | null;
  posSales: number | string | null;
  rentalBookings: number | string | null;
  paymentReferences: number | string | null;
  financialRecords: number | string | null;
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

const formulaVersion = "transaction-rfm-v1";
const minimumQuintilePopulation = 5;
const fallbackThresholds = {
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
    { min: 10000, score: 5 },
    { min: 5000, score: 4 },
    { min: 1500, score: 3 },
    { min: 1, score: 2 },
  ],
};
const labelThresholds = {
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
                 i.recency_score AS recencyScore,
                 i.frequency_score AS frequencyScore,
                 i.contribution_score AS contributionScore,
                 i.total_score AS totalScore,
                 i.status_label AS statusLabel,
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

function statusFromTotal(totalScore: number, thresholds = labelThresholds): MemberIndicatorStatus {
  if (totalScore >= thresholds.activeMin) return "Active";
  if (totalScore >= thresholds.needsMonitoringMin) return "Needs Monitoring";
  return "Inactive";
}

function scoreRecencyFallback(value: number | null, thresholds = fallbackThresholds.recencyDays) {
  if (value === null) return 1;
  return thresholds.find((threshold) => value <= threshold.max)?.score ?? 1;
}

function scoreMinimumFallback(value: number, thresholds: Array<{ min: number; score: number }>) {
  return thresholds.find((threshold) => value >= threshold.min)?.score ?? 1;
}

function quintileScores<T>(
  values: T[],
  metric: (value: T) => number | null,
  lowerIsBetter: boolean,
  tieBreaker: (value: T) => string,
) {
  const sorted = [...values].sort((left, right) => {
    const leftValue = metric(left);
    const rightValue = metric(right);
    const normalizedLeft = leftValue ?? (lowerIsBetter ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
    const normalizedRight = rightValue ?? (lowerIsBetter ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
    const comparison = lowerIsBetter
      ? normalizedRight - normalizedLeft
      : normalizedLeft - normalizedRight;
    return comparison || tieBreaker(left).localeCompare(tieBreaker(right));
  });
  const scores = new Map<T, number>();
  sorted.forEach((value, index) => {
    scores.set(value, Math.max(1, Math.ceil(((index + 1) * 5) / sorted.length)));
  });
  return scores;
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
          'member_indicators.minimum_quintile_population',
          'member_indicators.fallback_thresholds',
          'member_indicators.label_thresholds'
        )`,
    );
    const settings = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
    const minimumPopulation = Number(
      settings.get("member_indicators.minimum_quintile_population") ?? minimumQuintilePopulation,
    );
    let thresholds = fallbackThresholds;
    let labels = labelThresholds;

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

    return {
      minimumPopulation: Number.isFinite(minimumPopulation)
        ? Math.max(5, minimumPopulation)
        : minimumQuintilePopulation,
      thresholds,
      labels,
    };
  }

  async function loadActivityMetrics(
    connection: PoolConnection,
    basisStart: string,
    basisEnd: string,
  ) {
    const [rows] = await connection.execute<ActivityMetricRow[]>(
      `SELECT memberId,
              MAX(activityDate) AS lastActivityAt,
              COUNT(*) AS frequencyCount,
              COALESCE(SUM(amount), 0) AS contributionAmount,
              SUM(source = 'shareCapitalPayment') AS shareCapitalPayments,
              SUM(source = 'posSale') AS posSales,
              SUM(source = 'rentalBooking') AS rentalBookings,
              SUM(source = 'paymentReference') AS paymentReferences,
              SUM(source = 'financialRecord') AS financialRecords
         FROM (
           SELECT CAST(member_id AS CHAR) AS memberId,
                  payment_date AS activityDate,
                  amount,
                  'shareCapitalPayment' AS source
             FROM share_capital_payments
            WHERE payment_status = 'Validated'
              AND payment_date BETWEEN ? AND ?
           UNION ALL
           SELECT CAST(member_id AS CHAR) AS memberId,
                  DATE(sale_date) AS activityDate,
                  total_amount AS amount,
                  'posSale' AS source
             FROM pos_sales
            WHERE member_id IS NOT NULL
              AND sale_status IN ('Paid', 'Completed')
              AND payment_status = 'Paid'
              AND DATE(sale_date) BETWEEN ? AND ?
           UNION ALL
           SELECT CAST(member_id AS CHAR) AS memberId,
                  DATE(COALESCE(completed_at, end_datetime)) AS activityDate,
                  total_amount AS amount,
                  'rentalBooking' AS source
             FROM rental_bookings
            WHERE member_id IS NOT NULL
              AND booking_status = 'Completed'
              AND payment_status = 'Paid'
              AND DATE(COALESCE(completed_at, end_datetime)) BETWEEN ? AND ?
           UNION ALL
           SELECT CAST(p.member_id AS CHAR) AS memberId,
                  DATE(COALESCE(p.validated_at, p.submitted_at)) AS activityDate,
                  p.amount,
                  'paymentReference' AS source
             FROM payment_references p
            WHERE p.member_id IS NOT NULL
              AND p.validation_status = 'Validated'
              AND p.payment_purpose IN ('Associate Membership Fee', 'Document/Certificate', 'Other')
              AND DATE(COALESCE(p.validated_at, p.submitted_at)) BETWEEN ? AND ?
              AND NOT EXISTS (
                SELECT 1 FROM share_capital_payments s
                 WHERE s.payment_reference_id = p.payment_reference_id
              )
              AND NOT EXISTS (
                SELECT 1 FROM pos_sales ps
                 WHERE ps.payment_reference_id = p.payment_reference_id
              )
              AND NOT EXISTS (
                SELECT 1 FROM rental_bookings rb
                 WHERE rb.payment_reference_id = p.payment_reference_id
              )
           UNION ALL
           SELECT CAST(member_id AS CHAR) AS memberId,
                  record_date AS activityDate,
                  amount,
                  'financialRecord' AS source
             FROM financial_records
            WHERE member_id IS NOT NULL
              AND record_type = 'Income'
              AND record_status = 'Active'
              AND source_module IN ('Manual', 'Document', 'Other')
              AND payment_reference_id IS NULL
              AND record_date BETWEEN ? AND ?
         ) qualifiedActivity
        GROUP BY memberId`,
      [
        basisStart,
        basisEnd,
        basisStart,
        basisEnd,
        basisStart,
        basisEnd,
        basisStart,
        basisEnd,
        basisStart,
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

        const metrics = await loadActivityMetrics(connection, basis.start, basis.end);
        const scoredMembers = members.map((member) => {
          const metricRow = metrics.get(member.memberId);
          const sourceCounts: MemberIndicatorSourceCounts = {
            shareCapitalPayments: Number(metricRow?.shareCapitalPayments ?? 0),
            posSales: Number(metricRow?.posSales ?? 0),
            rentalBookings: Number(metricRow?.rentalBookings ?? 0),
            paymentReferences: Number(metricRow?.paymentReferences ?? 0),
            financialRecords: Number(metricRow?.financialRecords ?? 0),
          };
          return {
            member,
            recencyDays: daysSince(metricRow?.lastActivityAt ?? null, basis.end),
            frequencyCount: Number(metricRow?.frequencyCount ?? 0),
            contributionAmount: Number(metricRow?.contributionAmount ?? 0),
            sourceCounts,
          };
        });
        const useQuintiles = scoredMembers.length >= settings.minimumPopulation;
        const recencyRanks = useQuintiles
          ? quintileScores(scoredMembers, (member) => member.recencyDays, true, (member) => member.member.memberId)
          : new Map<typeof scoredMembers[number], number>();
        const frequencyRanks = useQuintiles
          ? quintileScores(scoredMembers, (member) => member.frequencyCount, false, (member) => member.member.memberId)
          : new Map<typeof scoredMembers[number], number>();
        const contributionRanks = useQuintiles
          ? quintileScores(scoredMembers, (member) => member.contributionAmount, false, (member) => member.member.memberId)
          : new Map<typeof scoredMembers[number], number>();

        for (const scored of scoredMembers) {
          const recencyScore = useQuintiles
            ? recencyRanks.get(scored) ?? 1
            : scoreRecencyFallback(scored.recencyDays, settings.thresholds.recencyDays);
          const frequencyScore = useQuintiles
            ? frequencyRanks.get(scored) ?? 1
            : scoreMinimumFallback(scored.frequencyCount, settings.thresholds.frequencyCount);
          const contributionScore = useQuintiles
            ? contributionRanks.get(scored) ?? 1
            : scoreMinimumFallback(scored.contributionAmount, settings.thresholds.contributionAmount);
          const totalScore = recencyScore + frequencyScore + contributionScore;
          const statusLabel = statusFromTotal(totalScore, settings.labels);
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
              method: useQuintiles ? "quintile-rank" : "fallback-thresholds",
              recencyScore,
              frequencyScore,
              contributionScore,
              totalScore,
              label: statusLabel,
              explanation: useQuintiles
                ? "Scores use deterministic population ranks. Lower recency days and higher frequency/contribution rank higher."
                : "Scores use configured fallback thresholds because the current population is too small for stable quintiles.",
            },
          };

          await connection.execute<ResultSetHeader>(
            `INSERT INTO member_status_indicators
               (member_id, basis_period_start, basis_period_end, recency_score, frequency_score,
                contribution_score, total_score, status_label, basis_summary, computed_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              scored.member.memberId,
              basis.start,
              basis.end,
              recencyScore,
              frequencyScore,
              contributionScore,
              totalScore,
              statusLabel,
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
