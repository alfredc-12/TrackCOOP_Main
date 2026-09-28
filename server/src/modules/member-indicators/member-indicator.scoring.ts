import type { MemberIndicatorStatus } from "./member-indicator.types";

export type IndicatorThresholds = {
  recencyDays: Array<{ max: number; score: number }>;
  frequencyCount: Array<{ min: number; score: number }>;
  contributionAmount: Array<{ min: number; score: number }>;
};

export type IndicatorLabelThresholds = {
  activeMin: number;
  needsMonitoringMin: number;
};

export function scoreRecency(recencyDays: number | null, thresholds: IndicatorThresholds["recencyDays"]) {
  if (recencyDays === null) return 1;
  return thresholds.find((threshold) => recencyDays <= threshold.max)?.score ?? 1;
}

export function scoreMinimum(value: number, thresholds: Array<{ min: number; score: number }>) {
  return thresholds.find((threshold) => value >= threshold.min)?.score ?? 1;
}

export function calculateMemberIndicator(input: {
  recencyDays: number | null;
  frequencyCount: number;
  validatedShareCapital: number;
  thresholds: IndicatorThresholds;
  labels: IndicatorLabelThresholds;
}) {
  const recencyScore = scoreRecency(input.recencyDays, input.thresholds.recencyDays);
  const frequencyScore = scoreMinimum(input.frequencyCount, input.thresholds.frequencyCount);
  const contributionScore = scoreMinimum(
    input.validatedShareCapital,
    input.thresholds.contributionAmount,
  );
  const totalScore = recencyScore + frequencyScore + contributionScore;
  const inactiveForNoRecentParticipation = input.frequencyCount === 0
    && (input.recencyDays === null || input.recencyDays > 365);
  const statusLabel: MemberIndicatorStatus = inactiveForNoRecentParticipation
    ? "Inactive"
    : totalScore >= input.labels.activeMin
      ? "Active"
      : totalScore >= input.labels.needsMonitoringMin
        ? "Needs Monitoring"
        : "Inactive";

  return {
    recencyScore,
    frequencyScore,
    contributionScore,
    totalScore,
    statusLabel,
    inactiveForNoRecentParticipation,
  };
}
