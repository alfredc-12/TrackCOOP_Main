import type {
  HistorySource,
  MemberListQuery,
  MemberSummary,
  UnifiedStatusHistorySummary,
  UserListQuery,
  UserSummaryCounts,
} from "@/features/chairman/people-api";
import type { ChairmanApplicationListQuery, ChairmanApplicationSummary } from "@/features/membership-applications/membership-application-types";
import {
  forReviewStatuses,
  paymentStageStatuses,
  restrictedStatuses,
  userStatusChoice,
  type HistoryQueryState,
} from "./people-filters";

/**
 * KPI card definitions for the four People Management views. Each builder turns a server summary into
 * plain data (value, caption, calculation notes and the filter a click applies) so the arithmetic and
 * the click behaviour can be tested without rendering.
 */

export type KpiTone = "neutral" | "good" | "warning" | "danger";

export type KpiDetail = {
  /** What the number counts. */
  definition: string;
  /** The population it is drawn from. */
  population: string;
  /** Formula, or the denominator when the card shows a percentage. */
  basis?: string;
};

export type KpiSpec<Query> = {
  key: string;
  label: string;
  /** A formatted count or percentage; "—" when it cannot be calculated. */
  value: string;
  caption: string;
  detail: KpiDetail;
  tone: KpiTone;
  selected: boolean;
  /** Merge into the query (and reset to page 1) when the card is clicked while not selected. */
  apply: Partial<Query>;
  /** Merge into the query when the card is clicked while selected. */
  clear: Partial<Query>;
  /** Smaller figures inside the card; they may apply a narrower filter of their own. */
  breakdown?: Array<{ key: string; label: string; value: string; selected?: boolean; apply?: Partial<Query>; clear?: Partial<Query> }>;
};

const numberFormat = new Intl.NumberFormat("en-PH");
export const formatCount = (value: number) => numberFormat.format(value);

/** `part / whole` as a percentage with at most one decimal, or null when there is nothing to divide by. */
export function percentOf(part: number, whole: number) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function formatPercent(part: number, whole: number) {
  const percent = percentOf(part, whole);
  return percent === null ? "—" : `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 }).format(percent)}%`;
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) => `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;

// ---------------------------------------------------------------- User accounts

const noStatus: Partial<UserListQuery> = { statuses: [], status: "all" };

export function buildUserKpis(summary: UserSummaryCounts, query: UserListQuery): Array<KpiSpec<UserListQuery>> {
  const choice = userStatusChoice(query);
  const { total } = summary;
  const empty = total === 0;
  const roles = `${formatCount(summary.byRole.chairman)} Chairman · ${formatCount(summary.byRole.bookkeeper)} Bookkeeper · ${formatCount(summary.byRole.member)} Member`;
  const population = "User accounts matching the search, role, date, link and last-login filters, under the hidden-account setting. The status filter is applied by selecting a card.";

  return [
    {
      key: "total",
      label: "Total accounts",
      value: formatCount(total),
      caption: roles,
      detail: { definition: "Every account in the current view, whatever its status.", population, basis: "COUNT of user accounts" },
      tone: "neutral",
      selected: false,
      apply: noStatus,
      clear: noStatus,
    },
    {
      key: "active",
      label: "Active accounts",
      value: formatCount(summary.active),
      caption: empty ? "No accounts in this view" : `${formatPercent(summary.active, total)} of ${plural(total, "account")}`,
      detail: { definition: "Accounts whose status is Active and can sign in.", population, basis: `Active ÷ Total accounts × 100 = ${formatCount(summary.active)} ÷ ${formatCount(total)}` },
      tone: "good",
      selected: choice === "Active",
      apply: { statuses: ["Active"], status: "all" },
      clear: noStatus,
    },
    {
      key: "pending",
      label: "Pending activation",
      value: formatCount(summary.pendingActivation),
      caption: empty ? "No accounts in this view" : `${formatPercent(summary.pendingActivation, total)} of ${plural(total, "account")}`,
      detail: { definition: "Accounts that exist but have not been activated yet (account status Pending). This is not the membership-application status.", population, basis: `Pending ÷ Total accounts × 100 = ${formatCount(summary.pendingActivation)} ÷ ${formatCount(total)}` },
      tone: "warning",
      selected: choice === "Pending",
      apply: { statuses: ["Pending"], status: "all" },
      clear: noStatus,
    },
    {
      key: "restricted",
      label: "Restricted accounts",
      value: formatCount(summary.suspendedInactive),
      caption: `${formatCount(summary.suspended)} Suspended · ${formatCount(summary.inactive)} Inactive`,
      detail: { definition: "Accounts that are Suspended or Inactive, so cannot be used to sign in.", population, basis: "Suspended + Inactive" },
      tone: summary.suspendedInactive > 0 ? "danger" : "neutral",
      selected: choice === "restricted",
      apply: { statuses: [...restrictedStatuses], status: "all" },
      clear: noStatus,
      breakdown: [
        { key: "suspended", label: "Suspended", value: formatCount(summary.suspended), selected: choice === "Suspended", apply: { statuses: ["Suspended"], status: "all" }, clear: noStatus },
        { key: "inactive", label: "Inactive", value: formatCount(summary.inactive), selected: choice === "Inactive", apply: { statuses: ["Inactive"], status: "all" }, clear: noStatus },
      ],
    },
  ];
}

/** `Member accounts linked to a profile: 3 of 4 (75%)`, or null when no member-role account is in view. */
export function memberLinkageText(summary: UserSummaryCounts) {
  const { eligible, linked } = summary.memberAccounts;
  if (eligible === 0) return null;
  return `${formatCount(linked)} of ${plural(eligible, "member account")} linked to a member profile (${formatPercent(linked, eligible)})`;
}

// ---------------------------------------------------------------- Membership applications

const noApplicationStatus: Partial<ChairmanApplicationListQuery> = { statuses: [], status: "All" };

export function buildApplicationKpis(summary: ChairmanApplicationSummary, query: ChairmanApplicationListQuery): Array<KpiSpec<ChairmanApplicationListQuery>> {
  const selected = query.statuses?.length ? query.statuses : query.status && query.status !== "All" ? [query.status] : [];
  const is = (statuses: readonly string[]) => selected.length === statuses.length && statuses.every((status) => selected.includes(status as never));
  const population = "Membership applications matching the search, type, source, barangay, submission-date and requirements filters. The status filter is applied by selecting a card.";
  const dueSelected = is(["Payment Required"]);
  const okSelected = is(["Payment Confirmed"]);

  return [
    {
      key: "total",
      label: "Total applications",
      value: formatCount(summary.total),
      caption: `${formatCount(summary.rejected)} rejected · ${formatCount(summary.withdrawn)} withdrawn`,
      detail: { definition: "Every application in the current view, including rejected and withdrawn ones.", population, basis: "COUNT of distinct applications" },
      tone: "neutral",
      selected: false,
      apply: noApplicationStatus,
      clear: noApplicationStatus,
    },
    {
      key: "review",
      label: "For review",
      value: formatCount(summary.forReview),
      caption: `${formatCount(summary.submitted)} Submitted · ${formatCount(summary.underReview)} Under Review`,
      detail: { definition: "Applications waiting for the Chairman to review them.", population, basis: "Submitted + Under Review" },
      tone: summary.forReview > 0 ? "warning" : "neutral",
      selected: is(forReviewStatuses),
      apply: { statuses: [...forReviewStatuses], status: "All" },
      clear: noApplicationStatus,
    },
    {
      key: "info",
      label: "Needs information",
      value: formatCount(summary.needsInformation),
      caption: summary.needsInformation === 0 ? "Nothing waiting on applicants" : "Waiting on the applicant",
      detail: { definition: "Applications marked Needs Information, which have unresolved information requests.", population, basis: "Status = Needs Information" },
      tone: summary.needsInformation > 0 ? "warning" : "neutral",
      selected: is(["Needs Information"]),
      apply: { statuses: ["Needs Information"], status: "All" },
      clear: noApplicationStatus,
    },
    {
      key: "payment",
      label: "Payment stage",
      value: formatCount(summary.paymentStage),
      caption: `${formatCount(summary.paymentRequired)} Required · ${formatCount(summary.paymentConfirmed)} Confirmed`,
      detail: { definition: "Applications that have passed review and are at the payment step. Payment Confirmed applications still need the final approval step.", population, basis: "Payment Required + Payment Confirmed" },
      tone: "neutral",
      selected: is(paymentStageStatuses),
      apply: { statuses: [...paymentStageStatuses], status: "All" },
      clear: noApplicationStatus,
      breakdown: [
        { key: "required", label: "Payment due", value: formatCount(summary.paymentRequired), selected: dueSelected, apply: { statuses: ["Payment Required"], status: "All" }, clear: noApplicationStatus },
        { key: "confirmed", label: "Payment OK", value: formatCount(summary.paymentConfirmed), selected: okSelected, apply: { statuses: ["Payment Confirmed"], status: "All" }, clear: noApplicationStatus },
      ],
    },
    {
      key: "approved",
      label: "Approved",
      value: formatCount(summary.approved),
      caption: query.submittedFrom || query.submittedTo ? "Approved now, among applications submitted in the period" : "Currently approved applications",
      detail: {
        definition: "Applications whose current status is Approved.",
        population: query.submittedFrom || query.submittedTo
          ? "Applications submitted within the selected submission-date range that are Approved today, not applications approved during that range."
          : population,
        basis: "Status = Approved",
      },
      tone: "good",
      selected: is(["Approved"]),
      apply: { statuses: ["Approved"], status: "All" },
      clear: noApplicationStatus,
    },
  ];
}

// ---------------------------------------------------------------- Member directory

type DirectoryScope = Pick<MemberListQuery, "approvalStatus" | "officialMemberStatus" | "membershipType">;

const approvedOnly: DirectoryScope = { approvalStatus: "Approved", officialMemberStatus: "All", membershipType: "All" };
const everyone: DirectoryScope = { approvalStatus: "All", officialMemberStatus: "All", membershipType: "All" };

function directoryScopeIs(query: DirectoryScope, scope: DirectoryScope) {
  return (query.approvalStatus ?? "All") === scope.approvalStatus
    && (query.officialMemberStatus ?? "All") === scope.officialMemberStatus
    && (query.membershipType ?? "All") === scope.membershipType;
}

export function buildDirectoryKpis(summary: MemberSummary, query: MemberListQuery): Array<KpiSpec<MemberListQuery>> {
  const approved = summary.approvedMembers;
  const population = "Approved member profiles matching the search, barangay, sector, account-link and approval-date filters. Pending and rejected profiles are not counted.";
  const otherProfiles = summary.total - approved.total;

  return [
    {
      key: "approved",
      label: "Approved members",
      value: formatCount(approved.total),
      caption: otherProfiles > 0 ? `${plural(summary.total, "profile")} in all, ${formatCount(otherProfiles)} not approved` : `${plural(summary.total, "profile")} in all`,
      detail: { definition: "Member profiles whose approval status is Approved: the established member population.", population: "All member profiles matching the search, barangay, sector, account-link and approval-date filters.", basis: "approval status = Approved" },
      tone: "neutral",
      selected: directoryScopeIs(query, approvedOnly),
      apply: approvedOnly,
      clear: everyone,
    },
    {
      key: "active",
      label: "Officially active",
      value: formatCount(approved.active),
      caption: approved.total === 0 ? "No approved members in this view" : `${formatPercent(approved.active, approved.total)} of ${plural(approved.total, "approved member")}`,
      detail: { definition: "Approved members whose official membership status is Active. This is the cooperative's official classification, not an engagement or RFM indicator.", population, basis: `Active ÷ Approved members × 100 = ${formatCount(approved.active)} ÷ ${formatCount(approved.total)}` },
      tone: "good",
      selected: directoryScopeIs(query, { ...approvedOnly, officialMemberStatus: "Active" }),
      apply: { ...approvedOnly, officialMemberStatus: "Active" },
      clear: everyone,
    },
    {
      key: "associate",
      label: "Associate members",
      value: formatCount(approved.associate),
      caption: approved.total === 0 ? "No approved members in this view" : `${formatPercent(approved.associate, approved.total)} of ${plural(approved.total, "approved member")}`,
      detail: { definition: "Approved members whose membership type is Associate.", population, basis: `Associate ÷ Approved members × 100 = ${formatCount(approved.associate)} ÷ ${formatCount(approved.total)}. Associate + True Member = Approved members.` },
      tone: "neutral",
      selected: directoryScopeIs(query, { ...approvedOnly, membershipType: "Associate" }),
      apply: { ...approvedOnly, membershipType: "Associate" },
      clear: everyone,
    },
    {
      key: "true",
      label: "True members",
      value: formatCount(approved.trueMember),
      caption: approved.total === 0 ? "No approved members in this view" : `${formatPercent(approved.trueMember, approved.total)} of ${plural(approved.total, "approved member")}`,
      detail: { definition: "Approved members whose membership type is True Member.", population, basis: `True Member ÷ Approved members × 100 = ${formatCount(approved.trueMember)} ÷ ${formatCount(approved.total)}` },
      tone: "good",
      selected: directoryScopeIs(query, { ...approvedOnly, membershipType: "True Member" }),
      apply: { ...approvedOnly, membershipType: "True Member" },
      clear: everyone,
    },
  ];
}

export type DirectorySupportStat = { key: string; label: string; value: string; apply: Partial<MemberListQuery>; selected: boolean; clear: Partial<MemberListQuery> };

/** The smaller counts under the directory cards. Each one narrows the list when clicked. */
export function buildDirectorySupportStats(summary: MemberSummary, query: MemberListQuery): DirectorySupportStat[] {
  const approved = summary.approvedMembers;
  const at = (scope: Partial<MemberListQuery>) => Object.entries(scope).every(([key, value]) => (query as Record<string, unknown>)[key] === value);
  return [
    { key: "pending", label: "Pending approval", value: formatCount(summary.pendingApproval), apply: { ...everyone, approvalStatus: "Pending" }, selected: at({ approvalStatus: "Pending" }), clear: everyone },
    { key: "inactive", label: "Officially inactive", value: formatCount(approved.inactive), apply: { ...approvedOnly, officialMemberStatus: "Inactive" }, selected: at({ approvalStatus: "Approved", officialMemberStatus: "Inactive" }), clear: everyone },
    { key: "suspended", label: "Suspended", value: formatCount(approved.suspended), apply: { ...approvedOnly, officialMemberStatus: "Suspended" }, selected: at({ approvalStatus: "Approved", officialMemberStatus: "Suspended" }), clear: everyone },
    { key: "terminated", label: "Terminated", value: formatCount(approved.terminated), apply: { ...approvedOnly, officialMemberStatus: "Terminated" }, selected: at({ approvalStatus: "Approved", officialMemberStatus: "Terminated" }), clear: everyone },
    { key: "unlinked", label: "No user account", value: formatCount(approved.unlinked), apply: { ...approvedOnly, accountLink: "unlinked" }, selected: query.accountLink === "unlinked" && at({ approvalStatus: "Approved" }), clear: { ...everyone, accountLink: "all" } },
  ];
}

// ---------------------------------------------------------------- Status history

const noSource: Partial<HistoryQueryState> = { sourceModule: "All" };
const source = (sourceModule: HistorySource): Partial<HistoryQueryState> => ({ sourceModule });

export function buildHistoryKpis(summary: UnifiedStatusHistorySummary, query: HistoryQueryState): Array<KpiSpec<HistoryQueryState>> {
  const population = "Status-history events matching the search, date, change-type and actor filters. Events are counted, not people.";
  const events = (count: number) => (count === 1 ? "1 event" : `${formatCount(count)} events`);

  return [
    {
      key: "total",
      label: "Total status changes",
      value: formatCount(summary.total),
      caption: `${events(summary.total)} across ${plural(summary.distinctSubjects, "record")}`,
      detail: { definition: "Every recorded change to an application, a member profile or a linked account.", population, basis: "COUNT of history events (a record changed twice counts twice)" },
      tone: "neutral",
      selected: false,
      apply: noSource,
      clear: noSource,
    },
    {
      key: "application",
      label: "Application changes",
      value: formatCount(summary.application),
      caption: summary.total === 0 ? "No events in this view" : `${formatPercent(summary.application, summary.total)} of ${events(summary.total)}`,
      detail: { definition: "Status changes on membership applications, such as Submitted to Under Review.", population, basis: "Source: membership application status history" },
      tone: "neutral",
      selected: query.sourceModule === "Application",
      apply: source("Application"),
      clear: noSource,
    },
    {
      key: "member",
      label: "Member changes",
      value: formatCount(summary.member),
      caption: summary.total === 0 ? "No events in this view" : `${formatPercent(summary.member, summary.total)} of ${events(summary.total)}`,
      detail: { definition: "Changes to a member's official status or membership type.", population, basis: "Source: member status history" },
      tone: "neutral",
      selected: query.sourceModule === "Member",
      apply: source("Member"),
      clear: noSource,
    },
    {
      key: "account",
      label: "Linked account changes",
      value: formatCount(summary.account),
      caption: summary.total === 0 ? "No events in this view" : `${formatPercent(summary.account, summary.total)} of ${events(summary.total)}`,
      detail: { definition: "Account status and role changes for user accounts that are linked to a member profile. Accounts with no member link are not included.", population, basis: "Source: audit log (user status and role changes) joined to linked members" },
      tone: "neutral",
      selected: query.sourceModule === "Account",
      apply: source("Account"),
      clear: noSource,
    },
  ];
}
