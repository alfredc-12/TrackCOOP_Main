import assert from "node:assert/strict";
import test from "node:test";
import { memberIndicatorConfigurationFingerprint } from "./member-indicator.configuration";
import { calculateMemberIndicator } from "./member-indicator.scoring";

test("configuration fingerprint is stable for equivalent status sets and changes with effective thresholds, labels or version", () => {
  const config = { formulaVersion: "V1", thresholds: { recencyDays: [{ max: 30, score: 5 }], frequencyCount: [{ min: 1, score: 2 }], contributionAmount: [{ min: 3000, score: 4 }] }, labels: { activeMin: 12, needsMonitoringMin: 7 }, qualifyingParticipationStatuses: ["Participated", "Attended"] };
  const first = memberIndicatorConfigurationFingerprint(config);
  assert.equal(first, memberIndicatorConfigurationFingerprint({ ...config, qualifyingParticipationStatuses: ["Attended", "Participated", "Participated"] }));
  assert.notEqual(first, memberIndicatorConfigurationFingerprint({ ...config, labels: { ...config.labels, activeMin: 11 } }));
  assert.notEqual(first, memberIndicatorConfigurationFingerprint({ ...config, formulaVersion: "V2" }));
  assert.notEqual(first, memberIndicatorConfigurationFingerprint({ ...config, thresholds: { ...config.thresholds, contributionAmount: [{ min: 1500, score: 4 }] } }));
  const score = calculateMemberIndicator({ recencyDays: null, frequencyCount: 0, validatedShareCapital: 3000, thresholds: config.thresholds, labels: config.labels });
  assert.equal(score.inactiveForNoRecentParticipation, true); assert.equal(score.statusLabel, "Inactive");
});
