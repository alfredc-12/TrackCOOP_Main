import assert from "node:assert/strict";
import test from "node:test";
import type { RfmMemberRow } from "../../../server/src/modules/member-indicators/member-indicator.workspace-types";
import { chartableRfmHistory, compareRfmSnapshots } from "./rfm-history";
const observation = (overrides: Partial<RfmMemberRow>): RfmMemberRow => ({
  memberId: "10",
  memberCode: "M10",
  fullName: "Test member",
  membershipType: "Associate",
  officialMemberStatus: "Active",
  barangay: "Rice village",
  sector: "Rice",
  indicatorId: "100",
  basisStart: "2025-01-31",
  basisEnd: "2026-01-31",
  recencyDays: 10,
  frequencyCount: 12,
  validatedShareCapital: 3000,
  recencyScore: 5,
  frequencyScore: 5,
  contributionScore: 4,
  totalScore: 14,
  classification: "Active",
  scoringVersion: "TRACKCOOP_RFM_V1",
  computedAt: "2026-02-01T00:00:00Z",
  computedBy: "1",
  configurationFingerprint: "same",
  evidenceAvailable: true,
  lastParticipation: "2026-01-21",
  quality: "Historical",
  calculationAgeDays: 1,
  basisAgeDays: 1,
  lowestComponents: ["Contribution"],
  ...overrides,
});
test("history comparison requires distinct chronological basis dates and preserved compatible configurations", () => {
  const first = observation({
    basisEnd: "2025-12-31",
    totalScore: 12,
    frequencyScore: 3,
  });
  const next = observation({});
  const comparison = compareRfmSnapshots(first, next);
  assert.equal(comparison.comparable, true);
  if (comparison.comparable) {
    assert.equal(comparison.total, 2);
    assert.equal(comparison.frequency, 2);
  }
  assert.equal(compareRfmSnapshots(next, first).comparable, false);
  assert.equal(
    compareRfmSnapshots(first, { ...next, configurationFingerprint: null })
      .comparable,
    false,
  );
  assert.equal(
    compareRfmSnapshots(first, { ...next, configurationFingerprint: "changed" })
      .comparable,
    false,
  );
  assert.equal(
    compareRfmSnapshots(first, { ...next, basisEnd: first.basisEnd })
      .comparable,
    false,
  );
});
test("chart history orders actual basis dates and deduplicates calculations without inventing missing months", () => {
  const result = chartableRfmHistory([
    observation({ indicatorId: "99" }),
    observation({ indicatorId: "100" }),
    observation({
      basisEnd: "2025-09-30",
      indicatorId: "101",
      computedAt: "2026-03-01T00:00:00Z",
    }),
  ]);
  assert.deepEqual(
    result.rows.map((r) => r.basisEnd),
    ["2025-09-30", "2026-01-31"],
  );
  assert.equal(result.rows[1].indicatorId, "100");
  assert.equal(result.comparable, true);
  assert.equal(
    chartableRfmHistory([
      observation({}),
      observation({
        basisEnd: "2025-09-30",
        configurationFingerprint: "different",
      }),
    ]).comparable,
    false,
  );
});
