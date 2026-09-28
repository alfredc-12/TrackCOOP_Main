import assert from "node:assert/strict";
import test from "node:test";
import { calculateMemberIndicator, scoreMinimum, scoreRecency } from "./member-indicator.scoring";

const thresholds = {
  recencyDays: [{ max: 30, score: 5 }, { max: 90, score: 4 }, { max: 180, score: 3 }, { max: 365, score: 2 }],
  frequencyCount: [{ min: 12, score: 5 }, { min: 6, score: 4 }, { min: 3, score: 3 }, { min: 1, score: 2 }],
  contributionAmount: [{ min: 15000, score: 5 }, { min: 3000, score: 4 }, { min: 1500, score: 3 }, { min: 0.01, score: 2 }],
};
const labels = { activeMin: 12, needsMonitoringMin: 7 };

test("RFM-inspired scoring observes the exact recency boundaries", () => {
  assert.deepEqual([30, 31, 90, 91, 180, 181, 365, 366, null].map((value) => scoreRecency(value, thresholds.recencyDays)), [5, 4, 4, 3, 3, 2, 2, 1, 1]);
});

test("RFM-inspired scoring observes frequency and contribution milestones", () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 11, 12].map((value) => scoreMinimum(value, thresholds.frequencyCount)), [1, 2, 2, 3, 3, 4, 4, 5]);
  assert.deepEqual([0, 1499.99, 1500, 3000, 15000].map((value) => scoreMinimum(value, thresholds.contributionAmount)), [1, 2, 3, 4, 5]);
});

test("RFM-inspired labels use configured totals and the inactivity safeguard", () => {
  assert.equal(calculateMemberIndicator({ recencyDays: 181, frequencyCount: 1, validatedShareCapital: 0, thresholds, labels }).statusLabel, "Inactive");
  assert.equal(calculateMemberIndicator({ recencyDays: 91, frequencyCount: 3, validatedShareCapital: 1500, thresholds, labels }).statusLabel, "Needs Monitoring");
  assert.equal(calculateMemberIndicator({ recencyDays: 30, frequencyCount: 12, validatedShareCapital: 15000, thresholds, labels }).statusLabel, "Active");
  const inactive = calculateMemberIndicator({ recencyDays: null, frequencyCount: 0, validatedShareCapital: 15000, thresholds, labels });
  assert.equal(inactive.statusLabel, "Inactive");
  assert.equal(inactive.inactiveForNoRecentParticipation, true);
});
