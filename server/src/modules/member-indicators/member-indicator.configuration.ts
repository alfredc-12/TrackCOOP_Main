import { createHash } from "node:crypto";
import type { IndicatorLabelThresholds, IndicatorThresholds } from "./member-indicator.scoring";

// Persist evidence of the settings that actually produced a result; this does not rescore it.
export function memberIndicatorConfigurationFingerprint(input: {
  formulaVersion: string;
  thresholds: IndicatorThresholds;
  labels: IndicatorLabelThresholds;
  qualifyingParticipationStatuses: string[];
}) {
  return createHash("sha256").update(JSON.stringify({
    formulaVersion: input.formulaVersion,
    recency: input.thresholds.recencyDays,
    frequency: input.thresholds.frequencyCount,
    contribution: input.thresholds.contributionAmount,
    activeMin: input.labels.activeMin,
    needsMonitoringMin: input.labels.needsMonitoringMin,
    qualifyingParticipationStatuses: [...new Set(input.qualifyingParticipationStatuses)].sort(),
    inactivitySafeguard: "zero-frequency-and-no-participation-within-365-days",
  })).digest("hex");
}
