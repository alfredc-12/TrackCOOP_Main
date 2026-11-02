import type { RfmMemberRow } from "../../../server/src/modules/member-indicators/member-indicator.workspace-types";

export function compareRfmSnapshots(
  previous: RfmMemberRow,
  next: RfmMemberRow,
) {
  if (previous.totalScore === null || next.totalScore === null)
    return {
      comparable: false as const,
      reason: "Both observations must contain valid scores.",
    };
  if (
    !previous.basisEnd ||
    !next.basisEnd ||
    previous.basisEnd >= next.basisEnd
  )
    return {
      comparable: false as const,
      reason:
        "Choose an earlier and a later basis period. Recalculations for one period are separate observations, not consecutive months.",
    };
  if (
    previous.scoringVersion !== next.scoringVersion ||
    !previous.configurationFingerprint ||
    previous.configurationFingerprint !== next.configurationFingerprint
  )
    return {
      comparable: false as const,
      reason:
        "The formula or preserved threshold configuration differs or is unavailable. These observations are not directly comparable.",
    };
  return {
    comparable: true as const,
    total: next.totalScore - previous.totalScore,
    recency: next.recencyScore! - previous.recencyScore!,
    frequency: next.frequencyScore! - previous.frequencyScore!,
    contribution: next.contributionScore! - previous.contributionScore!,
    transition: `${previous.classification} → ${next.classification}`,
  };
}
export function chartableRfmHistory(rows: RfmMemberRow[]) {
  const byBasis = new Map<string, RfmMemberRow>();
  for (const row of rows) {
    if (!row.basisEnd || row.totalScore === null) continue;
    const existing = byBasis.get(row.basisEnd);
    if (
      !existing ||
      (row.computedAt ?? "") > (existing.computedAt ?? "") ||
      (row.computedAt === existing.computedAt &&
        BigInt(row.indicatorId ?? "0") > BigInt(existing.indicatorId ?? "0"))
    )
      byBasis.set(row.basisEnd, row);
  }
  const result = [...byBasis.values()].sort((a, b) =>
    a.basisEnd!.localeCompare(b.basisEnd!),
  );
  const comparable =
    result.length > 1 &&
    result.every(
      (row) =>
        row.configurationFingerprint &&
        row.configurationFingerprint === result[0].configurationFingerprint &&
        row.scoringVersion === result[0].scoringVersion,
    );
  return { rows: result, comparable };
}
