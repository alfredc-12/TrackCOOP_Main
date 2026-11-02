import type { UnifiedStatusHistoryEntry, UnifiedStatusHistorySummary, MemberSummary } from "./members/member.types";
import type { ChairmanApplicationSummary } from "./membership-applications/membership-application.types";
import type { UserSummaryCounts } from "./users/user.types";

/** Complete summary payloads for route and service test doubles. */
export function userSummaryFixture(overrides: Partial<UserSummaryCounts> = {}): UserSummaryCounts {
  return {
    total: 1,
    active: 1,
    pendingActivation: 0,
    suspendedInactive: 0,
    suspended: 0,
    inactive: 0,
    byRole: { chairman: 1, bookkeeper: 0, member: 0 },
    memberAccounts: { eligible: 0, linked: 0 },
    overallTotal: 1,
    ...overrides,
  };
}

export function memberSummaryFixture(overrides: Partial<MemberSummary> = {}): MemberSummary {
  return {
    total: 0,
    pendingApproval: 0,
    needsInformation: 0,
    rejected: 0,
    approved: 0,
    associate: 0,
    trueMember: 0,
    active: 0,
    inactive: 0,
    suspended: 0,
    approvedMembers: { total: 0, active: 0, inactive: 0, suspended: 0, terminated: 0, pendingOfficial: 0, associate: 0, trueMember: 0, unlinked: 0 },
    overallTotal: 0,
    ...overrides,
  };
}

export function applicationSummaryFixture(overrides: Partial<ChairmanApplicationSummary> = {}): ChairmanApplicationSummary {
  return {
    total: 0, submitted: 0, underReview: 0, needsInformation: 0, paymentRequired: 0, paymentConfirmed: 0,
    approved: 0, rejected: 0, withdrawn: 0, forReview: 0, paymentStage: 0, overallTotal: 0,
    ...overrides,
  };
}

export function historySummaryFixture(overrides: Partial<UnifiedStatusHistorySummary> = {}): UnifiedStatusHistorySummary {
  return { total: 0, application: 0, member: 0, account: 0, distinctSubjects: 0, overallTotal: 0, ...overrides };
}

export function historyEntryFixture(overrides: Partial<UnifiedStatusHistoryEntry> = {}): UnifiedStatusHistoryEntry {
  return {
    id: "member-1",
    sourceModule: "Member",
    subjectId: "10",
    subjectCode: "NFFAC-2026-000010",
    subjectName: "Sample Member",
    oldStatus: "Associate / Active",
    newStatus: "True Member / Active",
    reason: "Capital requirement met.",
    actor: "Chair Person",
    actorId: "1",
    changeType: "membership-type",
    changedAt: new Date("2026-07-24T00:00:00.000Z"),
    ...overrides,
  };
}
