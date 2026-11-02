import assert from "node:assert/strict";
import test from "node:test";
import type { MemberSummary, UnifiedStatusHistorySummary, UserSummaryCounts } from "@/features/chairman/people-api";
import type { ChairmanApplicationSummary } from "@/features/membership-applications/membership-application-types";
import {
  buildApplicationKpis,
  buildDirectoryKpis,
  buildDirectorySupportStats,
  buildHistoryKpis,
  buildUserKpis,
  formatPercent,
  memberLinkageText,
  percentOf,
} from "./people-kpis";
import { defaultApplicationQuery, defaultHistoryQuery, defaultMemberQuery, defaultUserQuery } from "./people-filters";

const userSummary: UserSummaryCounts = {
  total: 8, active: 4, pendingActivation: 2, suspendedInactive: 2, suspended: 1, inactive: 1,
  byRole: { chairman: 1, bookkeeper: 1, member: 6 }, memberAccounts: { eligible: 6, linked: 5 }, overallTotal: 20,
};

const applicationSummary: ChairmanApplicationSummary = {
  total: 20, submitted: 3, underReview: 4, needsInformation: 2, paymentRequired: 3, paymentConfirmed: 2,
  approved: 4, rejected: 1, withdrawn: 1, forReview: 7, paymentStage: 5, overallTotal: 40,
};

const memberSummary: MemberSummary = {
  total: 12, pendingApproval: 2, needsInformation: 0, rejected: 1, approved: 9, associate: 8, trueMember: 4, active: 7, inactive: 2, suspended: 1,
  approvedMembers: { total: 9, active: 6, inactive: 2, suspended: 1, terminated: 0, pendingOfficial: 0, associate: 5, trueMember: 4, unlinked: 3 },
  overallTotal: 30,
};

const historySummary: UnifiedStatusHistorySummary = { total: 10, application: 5, member: 3, account: 2, distinctSubjects: 7, overallTotal: 50 };

const byKey = <T extends { key: string }>(cards: T[], key: string) => cards.find((card) => card.key === key)!;

test("percentages divide by the stated population and never by zero", () => {
  assert.equal(percentOf(1, 3), 33.3);
  assert.equal(percentOf(2, 3), 66.7);
  assert.equal(percentOf(0, 0), null);
  assert.equal(formatPercent(5, 0), "—");
  assert.equal(formatPercent(6, 9), "66.7%");
  assert.equal(formatPercent(4, 4), "100%");
});

test("account KPIs report actual counts, percentages, role and restricted breakdowns", () => {
  const cards = buildUserKpis(userSummary, defaultUserQuery);
  assert.deepEqual(cards.map((card) => card.value), ["8", "4", "2", "2"]);
  assert.equal(byKey(cards, "total").caption, "1 Chairman · 1 Bookkeeper · 6 Member");
  assert.equal(byKey(cards, "active").caption, "50% of 8 accounts");
  assert.equal(byKey(cards, "pending").caption, "25% of 8 accounts");
  assert.equal(byKey(cards, "restricted").caption, "1 Suspended · 1 Inactive");
  assert.deepEqual(byKey(cards, "restricted").apply, { statuses: ["Suspended", "Inactive"], status: "all" });
  assert.match(byKey(cards, "pending").detail.definition, /not the membership-application status/);
  assert.equal(cards.some((card) => card.selected), false);
});

test("account KPI selection follows the active status filter and clears it", () => {
  const restricted = buildUserKpis(userSummary, { ...defaultUserQuery, statuses: ["Inactive", "Suspended"] });
  assert.deepEqual(restricted.filter((card) => card.selected).map((card) => card.key), ["restricted"]);
  const suspendedOnly = buildUserKpis(userSummary, { ...defaultUserQuery, statuses: ["Suspended"] });
  assert.deepEqual(suspendedOnly.filter((card) => card.selected).map((card) => card.key), [], "a single sub-status is a breakdown selection");
  assert.equal(byKey(suspendedOnly, "restricted").breakdown?.find((part) => part.key === "suspended")?.selected, true);
  assert.deepEqual(byKey(restricted, "restricted").clear, { statuses: [], status: "all" });
});

test("an empty account view shows a dash rather than 0%", () => {
  const empty = buildUserKpis({ ...userSummary, total: 0, active: 0, pendingActivation: 0, suspendedInactive: 0, suspended: 0, inactive: 0, byRole: { chairman: 0, bookkeeper: 0, member: 0 }, memberAccounts: { eligible: 0, linked: 0 } }, defaultUserQuery);
  assert.equal(byKey(empty, "active").caption, "No accounts in this view");
  assert.equal(memberLinkageText({ ...userSummary, memberAccounts: { eligible: 0, linked: 0 } }), null);
  assert.equal(memberLinkageText(userSummary), "5 of 6 member accounts linked to a member profile (83.3%)");
});

test("application KPIs group statuses and expose the payment sub-stages", () => {
  const cards = buildApplicationKpis(applicationSummary, defaultApplicationQuery);
  assert.deepEqual(cards.map((card) => card.value), ["20", "7", "2", "5", "4"]);
  assert.equal(byKey(cards, "review").caption, "3 Submitted · 4 Under Review");
  assert.deepEqual(byKey(cards, "review").apply, { statuses: ["Submitted", "Under Review"], status: "All" });
  assert.equal(byKey(cards, "payment").caption, "3 Required · 2 Confirmed");
  assert.deepEqual(byKey(cards, "payment").breakdown?.map((part) => [part.label, part.value]), [["Payment due", "3"], ["Payment OK", "2"]]);
  assert.deepEqual(byKey(cards, "payment").breakdown?.[1].apply, { statuses: ["Payment Confirmed"], status: "All" });
  assert.equal(byKey(cards, "total").caption, "1 rejected · 1 withdrawn", "rejected and withdrawn stay in the total");
});

test("application KPIs name the approved metric precisely when a submission period is set", () => {
  const unscoped = byKey(buildApplicationKpis(applicationSummary, defaultApplicationQuery), "approved");
  assert.equal(unscoped.caption, "Currently approved applications");
  const scoped = byKey(buildApplicationKpis(applicationSummary, { ...defaultApplicationQuery, submittedFrom: "2026-04-01" }), "approved");
  assert.match(scoped.detail.population, /not applications approved during that range/);
  assert.match(scoped.caption, /submitted in the period/);
});

test("application KPI selection reflects the status filter", () => {
  const selected = (statuses: string[]) => buildApplicationKpis(applicationSummary, { ...defaultApplicationQuery, statuses: statuses as never }).filter((card) => card.selected).map((card) => card.key);
  assert.deepEqual(selected(["Submitted", "Under Review"]), ["review"]);
  assert.deepEqual(selected(["Needs Information"]), ["info"]);
  assert.deepEqual(selected(["Payment Required", "Payment Confirmed"]), ["payment"]);
  assert.deepEqual(selected(["Approved"]), ["approved"]);
  assert.deepEqual(selected([]), []);
});

test("directory KPIs use approved-only denominators that add up", () => {
  const cards = buildDirectoryKpis(memberSummary, defaultMemberQuery);
  assert.deepEqual(cards.map((card) => card.value), ["9", "6", "5", "4"]);
  assert.equal(Number(byKey(cards, "associate").value) + Number(byKey(cards, "true").value), Number(byKey(cards, "approved").value));
  assert.equal(byKey(cards, "active").caption, "66.7% of 9 approved members");
  assert.equal(byKey(cards, "associate").caption, "55.6% of 9 approved members");
  assert.equal(byKey(cards, "approved").caption, "12 profiles in all, 3 not approved");
  assert.match(byKey(cards, "active").detail.definition, /not an engagement or RFM indicator/);
});

test("directory KPI clicks scope the list to approved members and can be cleared", () => {
  const cards = buildDirectoryKpis(memberSummary, defaultMemberQuery);
  assert.deepEqual(byKey(cards, "true").apply, { approvalStatus: "Approved", officialMemberStatus: "All", membershipType: "True Member" });
  assert.deepEqual(byKey(cards, "true").clear, { approvalStatus: "All", officialMemberStatus: "All", membershipType: "All" });
  const active = buildDirectoryKpis(memberSummary, { ...defaultMemberQuery, ...byKey(cards, "active").apply });
  assert.deepEqual(active.filter((card) => card.selected).map((card) => card.key), ["active"]);
  const approved = buildDirectoryKpis(memberSummary, { ...defaultMemberQuery, ...byKey(cards, "approved").apply });
  assert.deepEqual(approved.filter((card) => card.selected).map((card) => card.key), ["approved"]);
});

test("directory supporting counts narrow the list and flag unlinked approved members", () => {
  const stats = buildDirectorySupportStats(memberSummary, defaultMemberQuery);
  assert.deepEqual(stats.map((stat) => [stat.key, stat.value]), [["pending", "2"], ["inactive", "2"], ["suspended", "1"], ["terminated", "0"], ["unlinked", "3"]]);
  assert.deepEqual(stats.find((stat) => stat.key === "unlinked")!.apply, { approvalStatus: "Approved", officialMemberStatus: "All", membershipType: "All", accountLink: "unlinked" });
  const withFilter = buildDirectorySupportStats(memberSummary, { ...defaultMemberQuery, approvalStatus: "Approved", accountLink: "unlinked" });
  assert.equal(withFilter.find((stat) => stat.key === "unlinked")!.selected, true);
});

test("history KPIs count events per source and describe the account scope honestly", () => {
  const cards = buildHistoryKpis(historySummary, defaultHistoryQuery);
  assert.deepEqual(cards.map((card) => card.value), ["10", "5", "3", "2"]);
  assert.equal(byKey(cards, "total").caption, "10 events across 7 records");
  assert.equal(byKey(cards, "application").caption, "50% of 10 events");
  assert.match(byKey(cards, "account").detail.definition, /linked to a member profile/);
  assert.match(byKey(cards, "account").label, /Linked account/);
  assert.deepEqual(byKey(cards, "member").apply, { sourceModule: "Member" });
  const selected = buildHistoryKpis(historySummary, { ...defaultHistoryQuery, sourceModule: "Account" });
  assert.deepEqual(selected.filter((card) => card.selected).map((card) => card.key), ["account"]);
  assert.equal(buildHistoryKpis({ ...historySummary, total: 1, application: 1, distinctSubjects: 1 }, defaultHistoryQuery)[0].caption, "1 event across 1 record");
});
