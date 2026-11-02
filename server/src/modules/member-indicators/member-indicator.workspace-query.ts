import type {
  RfmFilters,
  RfmMemberRow,
  RfmSettings,
  RfmWorkspace,
} from "./member-indicator.workspace-types";
import { manilaToday } from "./member-indicator.policy";

export const eligibleRfmSql =
  "m.approval_status = 'Approved' AND m.official_member_status IN ('Active', 'Inactive')";
export const validRfmSql = `(i.basis_period_start IS NOT NULL AND i.basis_period_end IS NOT NULL
  AND i.basis_period_start <= i.basis_period_end AND i.basis_period_end <= ?
  AND i.recency_score BETWEEN 1 AND 5 AND i.frequency_score BETWEEN 1 AND 5 AND i.contribution_score BETWEEN 1 AND 5
  AND i.total_score = i.recency_score + i.frequency_score + i.contribution_score
  AND i.frequency_count >= 0 AND i.validated_share_capital >= 0
  AND i.status_label IN ('Active', 'Needs Monitoring', 'Inactive'))`;
export const rfmSortColumns: Record<RfmFilters["sortBy"], string> = {
  fullName: "fullName",
  totalScore: "totalScore",
  recencyScore: "recencyScore",
  frequencyScore: "frequencyScore",
  contributionScore: "contributionScore",
  computedAt: "computedAt",
  recencyDays: "recencyDays",
  frequencyCount: "frequencyCount",
  validatedShareCapital: "validatedShareCapital",
};
export function rfmWorkspaceQuery(
  q: RfmFilters,
  settings: RfmSettings,
  today = manilaToday(),
  allHistory = false,
) {
  const values: Array<string | number> = [today];
  const context: string[] = allHistory
    ? ["1 = 1"]
    : ["i.basis_period_end <= ?"];
  if (!allHistory) values.push(today);
  if (q.context === "historical") {
    context.push("i.basis_period_end = ?");
    values.push(q.basisEnd!);
  }
  if (q.context === "run") {
    context.push(
      "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(i.basis_summary) THEN i.basis_summary ELSE NULL END, '$.runId')), CONCAT('legacy:', i.basis_period_end, ':', DATE_FORMAT(i.computed_at, '%Y-%m-%dT%H:%i:%s'))) = ?",
    );
    values.push(q.runId!);
  }
  // History preserves the recorded component scores even when the old basis is incomplete.
  const scoreValidity = allHistory
    ? "i.recency_score BETWEEN 1 AND 5 AND i.frequency_score BETWEEN 1 AND 5 AND i.contribution_score BETWEEN 1 AND 5 AND i.total_score = i.recency_score + i.frequency_score + i.contribution_score"
    : "i.validScore";
  // Basis date precedes computation time and ID. A historical recalculation cannot displace a later basis.
  const cte = `WITH observations AS (
    SELECT i.*, ${validRfmSql} AS validScore
    FROM member_status_indicators i WHERE ${context.join(" AND ")}
  ), ranked AS (
    SELECT observations.*, ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY validScore DESC, basis_period_end DESC, computed_at DESC, indicator_id DESC) AS position
    FROM observations
  ), population AS (
    SELECT CAST(m.member_id AS CHAR) AS memberId, m.member_code AS memberCode, m.full_name AS fullName,
      m.membership_type AS membershipType, m.official_member_status AS officialMemberStatus, m.barangay, m.sector,
      CAST(i.indicator_id AS CHAR) AS indicatorId, DATE_FORMAT(i.basis_period_start, '%Y-%m-%d') AS basisStart,
      DATE_FORMAT(i.basis_period_end, '%Y-%m-%d') AS basisEnd,
      i.recency_days AS recencyDays, IF(${scoreValidity}, i.frequency_count, NULL) AS frequencyCount,
      IF(${scoreValidity}, i.validated_share_capital, NULL) AS validatedShareCapital,
      IF(${scoreValidity}, i.recency_score, NULL) AS recencyScore, IF(${scoreValidity}, i.frequency_score, NULL) AS frequencyScore,
      IF(${scoreValidity}, i.contribution_score, NULL) AS contributionScore, IF(${scoreValidity}, i.total_score, NULL) AS totalScore,
      IF(${scoreValidity}, i.status_label, NULL) AS classification, i.scoring_version AS scoringVersion,
      DATE_FORMAT(i.computed_at, '%Y-%m-%dT%H:%i:%sZ') AS computedAt, CAST(i.computed_by AS CHAR) AS computedBy,
      CASE WHEN JSON_VALID(i.basis_summary) THEN i.basis_summary ELSE NULL END AS metadata
    FROM member_profiles m LEFT JOIN ranked i ON i.member_id = m.member_id ${allHistory ? "" : "AND i.position = 1"}
    WHERE ${eligibleRfmSql} ${q.context === "run" ? "AND i.indicator_id IS NOT NULL" : ""}
  ), records AS (
    SELECT population.*, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.configurationFingerprint')) AS configurationFingerprint,
      JSON_CONTAINS_PATH(metadata, 'one', '$.evidence') AS evidenceAvailable,
      JSON_EXTRACT(metadata, '$.rawMetrics.sourceCounts.qualifyingParticipation') AS participationEvidenceCount,
      JSON_EXTRACT(metadata, '$.rawMetrics.sourceCounts.validatedShareCapitalPayments') AS paymentEvidenceCount,
      JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.evidence.lastParticipation')) AS lastParticipation,
      GREATEST(0, FLOOR(TIMESTAMPDIFF(SECOND, STR_TO_DATE(LEFT(computedAt, 19), '%Y-%m-%dT%H:%i:%s'), UTC_TIMESTAMP()) / 86400)) AS calculationAgeDays,
      DATEDIFF(?, basisEnd) AS basisAgeDays,
      CASE WHEN indicatorId IS NULL THEN 'Missing' WHEN totalScore IS NULL THEN 'Requires Review'
        WHEN basisStart IS NULL OR basisEnd IS NULL OR basisStart > basisEnd THEN 'Requires Review'
        WHEN scoringVersion <> ? THEN 'Incompatible Version'
        WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.configurationFingerprint')) IS NULL THEN 'Requires Review'
        WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.configurationFingerprint')) <> ? THEN 'Incompatible Version'
        WHEN COALESCE(JSON_CONTAINS_PATH(metadata, 'one', '$.evidence'), 0) <> 1 THEN 'Requires Review'
        WHEN ? <> 'current' THEN 'Historical' WHEN basisEnd < ? THEN 'Potentially Outdated' ELSE 'Current' END AS quality
    FROM population
  )`;
  values.push(
    today,
    settings.formulaVersion,
    settings.configurationFingerprint,
    q.context,
    today,
  );
  const clauses: string[] = [];
  const add = (sql: string, ...items: Array<string | number>) => {
    clauses.push(sql);
    values.push(...items);
  };
  if (q.search) {
    const term = `%${q.search.replace(/[!%_]/g, "!$&")}%`;
    add(
      "(fullName LIKE ? ESCAPE '!' OR memberCode LIKE ? ESCAPE '!')",
      term,
      term,
    );
  }
  if (q.classification === "Not Yet Scored") clauses.push("totalScore IS NULL");
  else if (q.classification) add("classification = ?", q.classification);
  for (const [key, column] of [
    ["membershipType", "membershipType"],
    ["officialStatus", "officialMemberStatus"],
    ["barangay", "barangay"],
    ["sector", "sector"],
    ["version", "scoringVersion"],
    ["quality", "quality"],
    ["recencyScore", "recencyScore"],
    ["frequencyScore", "frequencyScore"],
    ["contributionScore", "contributionScore"],
  ] as const)
    if (q[key] !== undefined) add(`${column} = ?`, q[key]!);
  for (const [key, column, operator] of [
    ["minScore", "totalScore", ">="],
    ["maxScore", "totalScore", "<="],
    ["minRecency", "recencyDays", ">="],
    ["maxRecency", "recencyDays", "<="],
    ["minFrequency", "frequencyCount", ">="],
    ["maxFrequency", "frequencyCount", "<="],
    ["minContribution", "validatedShareCapital", ">="],
    ["maxContribution", "validatedShareCapital", "<="],
  ] as const)
    if (q[key] !== undefined)
      add(`totalScore IS NOT NULL AND ${column} ${operator} ?`, q[key]!);
  return {
    cte,
    where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}
export const percentage = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 1000) / 10 : null;
export function histogramMedian(
  histogram: Array<{ score: number; count: number }>,
): number | null {
  const total = histogram.reduce((n, x) => n + x.count, 0);
  if (!total) return null;
  const positions = [Math.floor((total - 1) / 2), Math.floor(total / 2)];
  const scores = positions.map((position) => {
    let count = 0;
    for (const item of [...histogram].sort((a, b) => a.score - b.score)) {
      count += item.count;
      if (count > position) return item.score;
    }
    return 0;
  });
  return (scores[0] + scores[1]) / 2;
}
export function decorateRfmRow(raw: Record<string, unknown>): RfmMemberRow {
  const row = { ...raw } as unknown as RfmMemberRow;
  for (const key of [
    "recencyDays",
    "frequencyCount",
    "validatedShareCapital",
    "recencyScore",
    "frequencyScore",
    "contributionScore",
    "totalScore",
    "calculationAgeDays",
    "basisAgeDays",
    "participationEvidenceCount",
    "paymentEvidenceCount",
  ] as const)
    row[key] = raw[key] == null ? null : Number(raw[key]);
  row.evidenceAvailable = Boolean(Number(raw.evidenceAvailable));
  row.lastParticipation =
    raw.lastParticipation === "null" ? null : row.lastParticipation;
  row.lowestComponents = [];
  if (row.totalScore !== null) {
    const lowest = Math.min(
      row.recencyScore!,
      row.frequencyScore!,
      row.contributionScore!,
    );
    for (const [key, name] of [
      ["recencyScore", "Recency"],
      ["frequencyScore", "Frequency"],
      ["contributionScore", "Contribution"],
    ] as const)
      if (row[key] === lowest) row.lowestComponents.push(name);
  }
  // Do not expose the potentially large immutable evidence in list responses.
  delete (row as unknown as Record<string, unknown>).metadata;
  return row;
}
export function rfmDiagnostics(
  groups: Array<{
    recencyScore: number;
    frequencyScore: number;
    contributionScore: number;
    count: number;
  }>,
  scored: number,
): Pick<RfmWorkspace, "components" | "matrix"> {
  const components = (
    ["recencyScore", "frequencyScore", "contributionScore"] as const
  ).map((component) => {
    const distribution = Array.from({ length: 5 }, (_, i) => {
      const count = groups
        .filter((g) => g[component] === i + 1)
        .reduce((n, g) => n + g.count, 0);
      return { score: i + 1, count, percentage: percentage(count, scored) };
    });
    return {
      component,
      distribution,
      average: scored
        ? distribution.reduce((n, x) => n + x.score * x.count, 0) / scored
        : null,
      median: histogramMedian(distribution),
      lowPercentage: percentage(
        distribution[0].count + distribution[1].count,
        scored,
      ),
      highPercentage: percentage(
        distribution[3].count + distribution[4].count,
        scored,
      ),
    };
  });
  const matrix = Array.from({ length: 25 }, (_, index) => {
    const recency = Math.floor(index / 5) + 1,
      frequency = (index % 5) + 1;
    const matching = groups.filter(
      (g) => g.recencyScore === recency && g.frequencyScore === frequency,
    );
    const count = matching.reduce((n, g) => n + g.count, 0);
    return {
      recency,
      frequency,
      count,
      percentage: percentage(count, scored),
      contributions: Array.from({ length: 5 }, (_, i) =>
        matching
          .filter((g) => g.contributionScore === i + 1)
          .reduce((n, g) => n + g.count, 0),
      ),
    };
  });
  return { components, matrix };
}
