import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import type { AuthContext } from "../auth/auth.types";
import { defaultRfmFilters, manilaToday } from "./member-indicator.policy";
import {
  loadRfmSettings,
  createRfmWorkspaceRepository,
} from "./member-indicator.workspace-repository";
import {
  rfmSortColumns,
  rfmWorkspaceQuery,
} from "./member-indicator.workspace-query";
import type {
  MemberIndicator,
  MemberIndicatorHistoryResult,
  MemberIndicatorListQuery,
  MemberIndicatorListResult,
  MemberIndicatorSummary,
  RecalculateIndicatorsInput,
  RecalculateIndicatorsResult,
} from "./member-indicator.types";

export interface MemberIndicatorRepository {
  list(query: MemberIndicatorListQuery): Promise<MemberIndicatorListResult>;
  findLatestByMemberId(memberId: string): Promise<MemberIndicator | null>;
  history(memberId: string): Promise<MemberIndicatorHistoryResult>;
  summary(query?: MemberIndicatorListQuery): Promise<MemberIndicatorSummary>;
  recalculate(
    input: RecalculateIndicatorsInput,
    auth: AuthContext,
  ): Promise<RecalculateIndicatorsResult>;
}
// Keep the original API response shape for existing consumers. The workspace has its own nullable-row contract.
function legacyIndicator(row: RowDataPacket): MemberIndicator {
  const date = (value: unknown) => (value ? new Date(String(value)) : null);
  return {
    id: String(row.indicatorId),
    memberId: String(row.memberId),
    memberCode: String(row.memberCode),
    fullName: String(row.fullName),
    membershipType: String(row.membershipType),
    officialMemberStatus: String(row.officialMemberStatus),
    basisPeriodStart: date(row.basisStart),
    basisPeriodEnd: date(row.basisEnd),
    recencyDays: row.recencyDays == null ? null : Number(row.recencyDays),
    frequencyCount: Number(row.frequencyCount),
    validatedShareCapital: Number(row.validatedShareCapital),
    recencyScore: Number(row.recencyScore),
    frequencyScore: Number(row.frequencyScore),
    contributionScore: Number(row.contributionScore),
    totalScore: Number(row.totalScore),
    statusLabel: row.classification,
    scoringVersion: String(row.scoringVersion),
    basisSummary:
      row.metadata == null
        ? null
        : typeof row.metadata === "string"
          ? row.metadata
          : JSON.stringify(row.metadata),
    computedBy: row.computedBy,
    computedAt: date(row.computedAt)!,
  };
}
export function createMemberIndicatorRepository(
  pool?: Pool,
): MemberIndicatorRepository {
  const database = () => pool ?? getPool();
  const workspace = createRfmWorkspaceRepository(pool);
  async function read<T>(work: (connection: PoolConnection) => Promise<T>) {
    const connection = await database().getConnection();
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
  return {
    list(q) {
      return read(async (c) => {
        const settings = await loadRfmSettings(c);
        const query = rfmWorkspaceQuery(
          {
            ...defaultRfmFilters(),
            ...q,
            classification: q.statusLabel,
            minScore: 3,
          },
          settings,
        );
        const [rows] = await c.execute<RowDataPacket[]>(
          `${query.cte} SELECT * FROM records ${query.where} ORDER BY ${rfmSortColumns[q.sortBy]} ${q.sortDirection === "asc" ? "ASC" : "DESC"}, memberId ASC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
          query.values,
        );
        const [counts] = await c.execute<RowDataPacket[]>(
          `${query.cte} SELECT COUNT(*) AS total FROM records ${query.where}`,
          query.values,
        );
        return {
          indicators: rows.map(legacyIndicator),
          total: Number(counts[0].total),
          page: q.page,
          pageSize: q.pageSize,
        };
      });
    },
    findLatestByMemberId(memberId) {
      return read(async (c) => {
        const settings = await loadRfmSettings(c),
          query = rfmWorkspaceQuery(defaultRfmFilters(), settings);
        const [rows] = await c.execute<RowDataPacket[]>(
          `${query.cte} SELECT * FROM records WHERE memberId = ? AND totalScore IS NOT NULL`,
          [...query.values, memberId],
        );
        return rows[0] ? legacyIndicator(rows[0]) : null;
      });
    },
    history(memberId) {
      return read(async (c) => {
        const settings = await loadRfmSettings(c),
          query = rfmWorkspaceQuery(
            defaultRfmFilters(),
            settings,
            manilaToday(),
            true,
          );
        const [rows] = await c.execute<RowDataPacket[]>(
          `${query.cte} SELECT * FROM records WHERE memberId = ? AND totalScore IS NOT NULL ORDER BY basisEnd DESC, computedAt DESC, CAST(indicatorId AS UNSIGNED) DESC`,
          [...query.values, memberId],
        );
        return { indicators: rows.map(legacyIndicator), total: rows.length };
      });
    },
    async summary(q) {
      const result = await workspace.workspace({
        ...defaultRfmFilters(),
        ...q,
        classification: q?.statusLabel,
        minScore: 3,
      });
      const s = result.summary;
      return {
        totalTracked: s.scored,
        active: s.active,
        needsMonitoring: s.needsMonitoring,
        inactive: s.inactive,
        averageScore: s.average ?? 0,
        distribution: (["Active", "Needs Monitoring", "Inactive"] as const).map(
          (statusLabel) => {
            const total =
              statusLabel === "Active"
                ? s.active
                : statusLabel === "Inactive"
                  ? s.inactive
                  : s.needsMonitoring;
            return {
              statusLabel,
              total,
              percentage: s.scored ? Math.round((total / s.scored) * 100) : 0,
            };
          },
        ),
      };
    },
    async recalculate(input, auth) {
      const result = await workspace.recalculate(
        {
          memberId: input.memberId,
          basisPeriodEnd: input.basisPeriodEnd ?? manilaToday(),
          basisPeriodStart: input.basisPeriodStart,
        },
        auth,
      );
      return {
        recalculated: result.affected,
        basisPeriodStart: result.basis.start,
        basisPeriodEnd: result.basis.end,
      };
    },
  };
}
