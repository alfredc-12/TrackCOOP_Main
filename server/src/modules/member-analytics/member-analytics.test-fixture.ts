import type { AnalyticsFilters, AnalyticsSources } from "./member-analytics.types";
export const fixtureFilters: AnalyticsFilters = { start: "2026-01-01", end: "2026-10-31", asOf: "2026-11-02", barangays: [], sectors: [], membershipType: "", engagement: "", officialStatus: "", capitalStage: "", source: "" };
export function analyticsFixture(): AnalyticsSources {
  const members = [
    { id: "1", barangay: "Aga", sector: "Rice", membershipType: "True Member", approvedAt: "2025-03-01T01:00:00Z" },
    { id: "2", barangay: "Aga", sector: "Corn", membershipType: "True Member", approvedAt: "2026-01-10T01:00:00Z" },
    { id: "3", barangay: "Wawa", sector: "Fishery", membershipType: "Associate", approvedAt: "2026-02-10T01:00:00Z" },
    { id: "4", barangay: "Barangay 1", sector: "Livestock", membershipType: "Associate", approvedAt: "2026-10-10T01:00:00Z" },
    { id: "5", barangay: "Munting Indang", sector: "High-value crops (gulayan)", membershipType: "True Member", approvedAt: "2026-03-10T01:00:00Z" },
    { id: "6", barangay: "Aga", sector: "Rice", membershipType: "Associate", approvedAt: null, approvalStatus: "Pending" },
    { id: "7", barangay: "Aga", sector: "Rice", membershipType: "Associate", approvedAt: null },
  ].map(m => ({ approvalStatus: "Approved", officialStatus: "Active", deadline: m.id === "3" ? "2026-03-10" : null, ...m }));
  const capital = [
    { id: "1", memberId: "1", amount: 4000, date: "2025-03-02", direction: "Credit" },
    { id: "2", memberId: "2", amount: 1500, date: "2026-01-11", direction: "Credit" },
    { id: "3", memberId: "2", amount: 1500, date: "2026-02-01", direction: "Credit" },
    { id: "4", memberId: "3", amount: 1500, date: "2026-02-11", direction: "Credit" },
    { id: "5", memberId: "5", amount: 4000, date: "2026-03-11", direction: "Credit" },
    { id: "6", memberId: "5", amount: 1000, date: "2026-03-15", direction: "Debit" },
  ].map(e => ({ ...e, source: "share_capital_payment", sourceId: e.id, type: e.direction === "Credit" ? "Additional Capital Contribution" : "Reversal" }));
  return { members, capital,
    accounts: [{ memberId: "1", balance: 4000 }, { memberId: "2", balance: 3000 }, { memberId: "3", balance: 1500 }, { memberId: "5", balance: 3000 }],
    capitalPayments: capital.filter(e => e.direction === "Credit").map(e => ({ id: e.id, memberId: e.memberId, date: e.date })),
    statusHistory: [],
    applications: [{ id: "a3", memberId: "3", source: "Public Website", requestedType: "True Member", status: "Approved", barangay: "Wawa", sector: "Fishery", submittedAt: "2026-02-01T01:00:00Z" }],
    applicationHistory: [{ id: "a3", status: "Under Review", at: "2026-02-02T01:00:00Z" }, { id: "a3", status: "Approved", at: "2026-02-10T01:00:00Z" }],
    participation: [{ memberId: "2", date: "2026-01-25", activityId: "A" }, { memberId: "2", date: "2026-02-25", activityId: "B" }],
    indicators: [
      { id: "1", memberId: "1", label: "Needs Monitoring", computedAt: "2025-12-30T01:00:00Z", start: "2024-12-30", end: "2025-12-30" },
      { id: "2", memberId: "1", label: "Active", computedAt: "2026-10-30T01:00:00Z", start: "2025-10-30", end: "2026-10-30" },
      { id: "3", memberId: "3", label: "Inactive", computedAt: "2026-10-30T01:00:00Z", start: "2025-10-30", end: "2026-10-30" },
    ].map(i => ({ ...i, label: i.label as "Active" | "Needs Monitoring" | "Inactive", score: i.label === "Active" ? 13 : 6, recencyScore: 4, frequencyScore: 4, contributionScore: 5, version: "TRACKCOOP_RFM_V1", fingerprint: "test-settings" })),
    referrals: [{ id: "r1", referrerId: "1", memberId: "3", applicationId: "a3", status: "Successful", createdAt: "2026-02-01T01:00:00Z", qualifiedAt: "2026-02-10T01:00:00Z" }],
    validatedApplications: ["a3"], settings: { target: 3000, maximum: 15000, participationStatuses: ["Participated"] },
    capabilities: Object.fromEntries(["member_profiles", "membership_applications", "member_status_history", "member_status_indicators", "cooperative_activities", "member_activity_participation", "share_capital_transactions", "share_capital_accounts", "share_capital_payments", "member_referrals"].map(t => [t, true])),
  };
}
