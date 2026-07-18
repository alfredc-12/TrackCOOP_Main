import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  MemberIndicator,
  MemberIndicatorListQuery,
  MemberIndicatorListResult,
  MemberIndicatorStatus,
  MemberIndicatorSummary,
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
  membershipType: string;
  approvalStatus: string;
  officialMemberStatus: string;
  applicationDate: Date | null;
  trueMemberSince: Date | null;
};

const sortColumns: Record<MemberIndicatorListQuery["sortBy"], string> = {
  fullName: "m.full_name",
  totalScore: "i.total_score",
  computedAt: "i.computed_at",
};

function indicatorSelect() {
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
            JOIN (
              SELECT member_id, MAX(indicator_id) AS latest_indicator_id
                FROM member_status_indicators
               GROUP BY member_id
            ) latest ON latest.latest_indicator_id = i.indicator_id`;
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

function dateOrNull(value: string | null | undefined) {
  return value ?? null;
}

function scoreMember(row: MemberForIndicatorRow) {
  if (["Inactive", "Suspended", "Terminated"].includes(row.officialMemberStatus)) {
    return {
      recencyScore: 1,
      frequencyScore: 1,
      contributionScore: 1,
      statusLabel: "Inactive" as MemberIndicatorStatus,
      basisSummary:
        "Indicator based on member profile status. Official member status was not changed.",
    };
  }

  if (row.approvalStatus === "Approved" && row.officialMemberStatus === "Active") {
    const contributionScore = row.membershipType === "True Member" ? 5 : 3;
    return {
      recencyScore: 5,
      frequencyScore: 4,
      contributionScore,
      statusLabel: "Active" as MemberIndicatorStatus,
      basisSummary:
        "Indicator based on approval and active profile status. Official member status was not changed.",
    };
  }

  return {
    recencyScore: 2,
    frequencyScore: 2,
    contributionScore: row.membershipType === "True Member" ? 3 : 2,
    statusLabel: "Needs Monitoring" as MemberIndicatorStatus,
    basisSummary:
      "Indicator requires staff review because the profile is pending, incomplete, or not active. Official member status was not changed.",
  };
}

export interface MemberIndicatorRepository {
  list(query: MemberIndicatorListQuery): Promise<MemberIndicatorListResult>;
  findLatestByMemberId(memberId: string): Promise<MemberIndicator | null>;
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
         LIMIT ? OFFSET ?`,
        [...values, query.pageSize, offset],
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
      };
    },

    async recalculate(input, auth) {
      return withTransaction(async (connection) => {
        const values: string[] = [];
        const whereSql = input.memberId ? " WHERE member_id = ?" : "";
        if (input.memberId) values.push(input.memberId);

        const [members] = await connection.execute<MemberForIndicatorRow[]>(
          `SELECT CAST(member_id AS CHAR) AS memberId,
                  membership_type AS membershipType,
                  approval_status AS approvalStatus,
                  official_member_status AS officialMemberStatus,
                  application_date AS applicationDate,
                  true_member_since AS trueMemberSince
             FROM member_profiles
             ${whereSql}`,
          values,
        );

        if (input.memberId && members.length === 0) {
          throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");
        }

        for (const member of members) {
          const score = scoreMember(member);
          const totalScore =
            score.recencyScore + score.frequencyScore + score.contributionScore;

          await connection.execute<ResultSetHeader>(
            `INSERT INTO member_status_indicators
               (member_id, basis_period_start, basis_period_end, recency_score, frequency_score,
                contribution_score, total_score, status_label, basis_summary, computed_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              member.memberId,
              dateOrNull(input.basisPeriodStart),
              dateOrNull(input.basisPeriodEnd),
              score.recencyScore,
              score.frequencyScore,
              score.contributionScore,
              totalScore,
              score.statusLabel,
              score.basisSummary,
              auth.user.id,
            ],
          );
        }

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'member_indicators.recalculated', 'member_status_indicators', ?, ?, CAST(? AS JSON))`,
          [
            auth.user.id,
            input.memberId ?? null,
            input.memberId
              ? "Member indicators were recalculated for one member."
              : "Member indicators were recalculated for all members.",
            JSON.stringify({
              memberId: input.memberId ?? null,
              recalculated: members.length,
              basisPeriodStart: input.basisPeriodStart ?? null,
              basisPeriodEnd: input.basisPeriodEnd ?? null,
            }),
          ],
        );

        return {
          recalculated: members.length,
          basisPeriodStart: input.basisPeriodStart ?? null,
          basisPeriodEnd: input.basisPeriodEnd ?? null,
        };
      }, databasePool());
    },
  };
}
