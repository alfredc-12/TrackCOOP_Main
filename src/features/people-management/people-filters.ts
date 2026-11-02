import type {
  AccountStatus,
  ApprovalStatus,
  HistoryChangeTypeFilter,
  HistorySource,
  MemberAccountLinkFilter,
  MemberListQuery,
  MembershipType,
  OfficialMemberStatus,
  RoleSlug,
  UserLastLoginFilter,
  UserListQuery,
  UserMemberLinkFilter,
} from "@/features/chairman/people-api";
import type {
  ChairmanApplicationListQuery,
  MembershipApplicationSource,
  MembershipApplicationStatus,
  RequestedMembershipType,
  RequirementCompletionFilter,
} from "@/features/membership-applications/membership-application-types";

/**
 * Filter state, URL (de)serialisation and removable-chip descriptions for the four People Management
 * views. Everything here is pure so the behaviour can be tested without rendering.
 */

export type FilterChip<Query> = {
  key: string;
  /** Human label, e.g. "Role: Member". */
  label: string;
  /** Resets just this filter; merge it into the query and go back to page 1. */
  clear: Partial<Query>;
};

export const DEFAULT_LAST_LOGIN_DAYS = 30;
export const UNSPECIFIED = "Unspecified";

// ---------------------------------------------------------------- dates (Asia/Manila)

const DAY_MS = 86_400_000;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !isoDate.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Today's calendar date in Asia/Manila, whatever the browser's own timezone is. */
export function manilaToday(now = new Date()) {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function formatIsoDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** `May 1, 2026 – May 31, 2026`, or an open-ended phrase when only one side is set. */
export function describeDateRange(from?: string, to?: string) {
  if (from && to) return from === to ? formatIsoDate(from) : `${formatIsoDate(from)} – ${formatIsoDate(to)}`;
  if (from) return `from ${formatIsoDate(from)}`;
  if (to) return `up to ${formatIsoDate(to)}`;
  return "";
}

/** Rejects a range that ends before it starts. Returns a message, or null when the range is usable. */
export function validateDateRange(from?: string, to?: string) {
  if (from && !isValidIsoDate(from)) return "Enter a valid start date.";
  if (to && !isValidIsoDate(to)) return "Enter a valid end date.";
  if (from && to && to < from) return "The end date must be on or after the start date.";
  return null;
}

// ---------------------------------------------------------------- generic helpers

const sameSet = <T extends string>(first: readonly T[] | undefined, second: readonly T[]) =>
  (first?.length ?? 0) === second.length && second.every((item) => first?.includes(item));

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function pickList<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  return Array.from(new Set((value ?? "").split(/[|,]/).filter((item): item is T => allowed.includes(item as T))));
}

function setParam(params: URLSearchParams, key: string, value: string | number | boolean | null | undefined) {
  if (value === undefined || value === null || value === "" || value === false) return;
  params.set(key, String(value));
}

function dateParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  return isValidIsoDate(value) ? value : undefined;
}

/** Ordered `a ≤ b` pair; drops a start date that comes after the end date instead of showing an empty list. */
function orderedRange(from?: string, to?: string) {
  return from && to && to < from ? { from: undefined, to: undefined } : { from, to };
}

// ---------------------------------------------------------------- User accounts

export const accountStatusList: AccountStatus[] = ["Pending", "Active", "Suspended", "Inactive"];
export const roleList: RoleSlug[] = ["chairman", "bookkeeper", "member"];
export const restrictedStatuses: AccountStatus[] = ["Suspended", "Inactive"];
export const userSortFields = ["displayName", "email", "role", "accountStatus", "createdAt"] as const;

export const roleLabels: Record<RoleSlug, string> = { chairman: "Chairman", bookkeeper: "Bookkeeper", member: "Member" };

export type UserStatusChoice = "all" | "Active" | "Pending" | "Suspended" | "Inactive" | "restricted";

export const userStatusChoices: Array<{ value: UserStatusChoice; label: string; statuses: AccountStatus[] }> = [
  { value: "all", label: "All statuses", statuses: [] },
  { value: "Active", label: "Active", statuses: ["Active"] },
  { value: "Pending", label: "Pending activation", statuses: ["Pending"] },
  { value: "restricted", label: "Restricted", statuses: restrictedStatuses },
  { value: "Suspended", label: "Suspended", statuses: ["Suspended"] },
  { value: "Inactive", label: "Inactive", statuses: ["Inactive"] },
];

export function userStatusChoice(query: Pick<UserListQuery, "statuses" | "status">): UserStatusChoice | "custom" {
  const statuses = query.statuses?.length ? query.statuses : query.status && query.status !== "all" ? [query.status] : [];
  return userStatusChoices.find((choice) => sameSet(statuses, choice.statuses))?.value ?? "custom";
}

export const userLastLoginChoices: Array<{ value: UserLastLoginFilter; label: string }> = [
  { value: "all", label: "Any last login" },
  { value: "recent", label: "Logged in recently" },
  { value: "inactive", label: "Not seen in the period" },
  { value: "never", label: "Never logged in" },
];

export const userMemberLinkChoices: Array<{ value: UserMemberLinkFilter; label: string }> = [
  { value: "all", label: "Any member link" },
  { value: "linked", label: "Linked to a member" },
  { value: "unlinked", label: "Member account, not linked" },
];

export const lastLoginPeriodChoices = [7, 30, 60, 90, 180, 365] as const;

export const defaultUserQuery: UserListQuery = {
  page: 1,
  pageSize: 5,
  search: "",
  role: "all",
  statuses: [],
  includeHidden: false,
  createdFrom: undefined,
  createdTo: undefined,
  memberLink: "all",
  lastLogin: "all",
  lastLoginDays: DEFAULT_LAST_LOGIN_DAYS,
  sortBy: "createdAt",
  sortDirection: "desc",
};

export function userQueryFromParams(params: URLSearchParams): Partial<UserListQuery> {
  const days = Number(params.get("days"));
  const range = orderedRange(dateParam(params, "from"), dateParam(params, "to"));
  const sortBy = pick(params.get("sort"), userSortFields);
  return {
    search: params.get("q")?.slice(0, 190) ?? "",
    role: pick(params.get("role"), roleList) ?? "all",
    statuses: pickList(params.get("status"), accountStatusList),
    includeHidden: params.get("hidden") === "1",
    createdFrom: range.from,
    createdTo: range.to,
    memberLink: pick(params.get("link"), ["linked", "unlinked"] as const) ?? "all",
    lastLogin: pick(params.get("login"), ["never", "recent", "inactive"] as const) ?? "all",
    lastLoginDays: Number.isInteger(days) && days >= 1 && days <= 3650 ? days : DEFAULT_LAST_LOGIN_DAYS,
    ...(sortBy ? { sortBy } : {}),
    sortDirection: params.get("dir") === "asc" ? "asc" : "desc",
  };
}

export function userQueryToParams(query: UserListQuery, params = new URLSearchParams()) {
  setParam(params, "q", query.search?.trim());
  setParam(params, "role", query.role !== "all" ? query.role : null);
  setParam(params, "status", query.statuses?.length ? query.statuses.join("|") : null);
  setParam(params, "hidden", query.includeHidden ? "1" : null);
  setParam(params, "from", query.createdFrom);
  setParam(params, "to", query.createdTo);
  setParam(params, "link", query.memberLink !== "all" ? query.memberLink : null);
  setParam(params, "login", query.lastLogin !== "all" ? query.lastLogin : null);
  setParam(params, "days", query.lastLogin !== "all" && query.lastLogin !== "never" && query.lastLoginDays !== DEFAULT_LAST_LOGIN_DAYS ? query.lastLoginDays : null);
  setParam(params, "sort", query.sortBy !== defaultUserQuery.sortBy ? query.sortBy : null);
  setParam(params, "dir", query.sortDirection !== defaultUserQuery.sortDirection ? query.sortDirection : null);
  return params;
}

export function userChips(query: UserListQuery): Array<FilterChip<UserListQuery>> {
  const chips: Array<FilterChip<UserListQuery>> = [];
  if (query.search?.trim()) chips.push({ key: "search", label: `Search: “${query.search.trim()}”`, clear: { search: "" } });
  if (query.role && query.role !== "all") chips.push({ key: "role", label: `Role: ${roleLabels[query.role]}`, clear: { role: "all" } });
  const status = userStatusChoice(query);
  if (status !== "all") {
    const label = status === "custom" ? (query.statuses ?? []).join(" or ") : userStatusChoices.find((choice) => choice.value === status)?.label;
    chips.push({ key: "status", label: `Status: ${label}`, clear: { statuses: [], status: "all" } });
  }
  if (query.createdFrom || query.createdTo) chips.push({ key: "created", label: `Created ${describeDateRange(query.createdFrom, query.createdTo)}`, clear: { createdFrom: undefined, createdTo: undefined } });
  if (query.memberLink && query.memberLink !== "all") chips.push({ key: "link", label: userMemberLinkChoices.find((choice) => choice.value === query.memberLink)?.label ?? "", clear: { memberLink: "all" } });
  if (query.lastLogin && query.lastLogin !== "all") {
    const days = query.lastLoginDays ?? DEFAULT_LAST_LOGIN_DAYS;
    const label = query.lastLogin === "never" ? "Never logged in" : query.lastLogin === "recent" ? `Logged in within ${days} days` : `Last login more than ${days} days ago`;
    chips.push({ key: "login", label, clear: { lastLogin: "all", lastLoginDays: DEFAULT_LAST_LOGIN_DAYS } });
  }
  if (query.includeHidden) chips.push({ key: "hidden", label: "Including hidden accounts", clear: { includeHidden: false } });
  return chips;
}

/** Which "More filters" are in use, to open the panel and badge its button. */
export function userMoreFilterCount(query: UserListQuery) {
  return [query.createdFrom || query.createdTo, query.memberLink !== "all", query.lastLogin !== "all"].filter(Boolean).length;
}

// ---------------------------------------------------------------- Membership applications

export const applicationStatusList: MembershipApplicationStatus[] = [
  "Submitted", "Under Review", "Needs Information", "Payment Required", "Payment Confirmed", "Approved", "Rejected", "Withdrawn",
];
export const forReviewStatuses: MembershipApplicationStatus[] = ["Submitted", "Under Review"];
export const paymentStageStatuses: MembershipApplicationStatus[] = ["Payment Required", "Payment Confirmed"];

export type ApplicationStatusChoice = { value: string; label: string; statuses: MembershipApplicationStatus[] };

/** Groups first, then individual statuses. `Payment Required` / `Payment Confirmed` are shown as the Payment Due / Payment OK cards. */
export const applicationStatusChoices: ApplicationStatusChoice[] = [
  { value: "all", label: "All statuses", statuses: [] },
  { value: "group:review", label: "For review", statuses: forReviewStatuses },
  { value: "group:payment", label: "Payment stage", statuses: paymentStageStatuses },
  ...applicationStatusList.map((status) => ({ value: status, label: status, statuses: [status] })),
];

export function applicationStatusChoice(query: Pick<ChairmanApplicationListQuery, "statuses" | "status">) {
  const statuses = query.statuses?.length ? query.statuses : query.status && query.status !== "All" ? [query.status] : [];
  return applicationStatusChoices.find((choice) => sameSet(statuses, choice.statuses)) ?? null;
}

export const requirementCompletionChoices: Array<{ value: RequirementCompletionFilter; label: string }> = [
  { value: "All", label: "All requirements" },
  { value: "complete", label: "Requirements complete" },
  { value: "incomplete", label: "Requirements incomplete" },
];

export const applicationSortFields = ["submittedAt", "fullName", "applicationStatus", "requestedMembershipType"] as const;
const applicationTypes: RequestedMembershipType[] = ["Associate", "True Member"];
const applicationSources: MembershipApplicationSource[] = ["Public Website", "Chairman Entry", "Imported Paper Form"];

export const defaultApplicationQuery: ChairmanApplicationListQuery = {
  page: 1,
  pageSize: 10,
  search: "",
  status: "All",
  statuses: [],
  requestedMembershipType: "All",
  applicationSource: "All",
  barangay: undefined,
  submittedFrom: undefined,
  submittedTo: undefined,
  requirementCompletion: "All",
  sortBy: "submittedAt",
  sortDirection: "desc",
};

export function applicationQueryFromParams(params: URLSearchParams): Partial<ChairmanApplicationListQuery> {
  const range = orderedRange(dateParam(params, "from"), dateParam(params, "to"));
  const sortBy = pick(params.get("sort"), applicationSortFields);
  return {
    search: params.get("q")?.slice(0, 120) ?? "",
    status: "All",
    statuses: pickList(params.get("status"), applicationStatusList),
    requestedMembershipType: pick(params.get("type"), applicationTypes) ?? "All",
    applicationSource: pick(params.get("source"), applicationSources) ?? "All",
    barangay: params.get("barangay")?.slice(0, 120) || undefined,
    submittedFrom: range.from,
    submittedTo: range.to,
    requirementCompletion: pick(params.get("req"), ["complete", "incomplete"] as const) ?? "All",
    ...(sortBy ? { sortBy } : {}),
    sortDirection: params.get("dir") === "asc" ? "asc" : "desc",
  };
}

export function applicationQueryToParams(query: ChairmanApplicationListQuery, params = new URLSearchParams()) {
  setParam(params, "q", query.search?.trim());
  setParam(params, "status", query.statuses?.length ? query.statuses.join("|") : null);
  setParam(params, "type", query.requestedMembershipType !== "All" ? query.requestedMembershipType : null);
  setParam(params, "source", query.applicationSource !== "All" ? query.applicationSource : null);
  setParam(params, "barangay", query.barangay);
  setParam(params, "from", query.submittedFrom);
  setParam(params, "to", query.submittedTo);
  setParam(params, "req", query.requirementCompletion !== "All" ? query.requirementCompletion : null);
  setParam(params, "sort", query.sortBy !== defaultApplicationQuery.sortBy ? query.sortBy : null);
  setParam(params, "dir", query.sortDirection !== defaultApplicationQuery.sortDirection ? query.sortDirection : null);
  return params;
}

export function applicationChips(query: ChairmanApplicationListQuery): Array<FilterChip<ChairmanApplicationListQuery>> {
  const chips: Array<FilterChip<ChairmanApplicationListQuery>> = [];
  if (query.search?.trim()) chips.push({ key: "search", label: `Search: “${query.search.trim()}”`, clear: { search: "" } });
  const choice = applicationStatusChoice(query);
  if (!choice || choice.value !== "all") {
    const label = choice?.label ?? (query.statuses ?? []).join(" or ");
    chips.push({ key: "status", label: `Status: ${label}`, clear: { statuses: [], status: "All" } });
  }
  if (query.requestedMembershipType && query.requestedMembershipType !== "All") chips.push({ key: "type", label: `Type: ${query.requestedMembershipType}`, clear: { requestedMembershipType: "All" } });
  if (query.applicationSource && query.applicationSource !== "All") chips.push({ key: "source", label: `Source: ${query.applicationSource}`, clear: { applicationSource: "All" } });
  if (query.barangay) chips.push({ key: "barangay", label: `Barangay: ${query.barangay}`, clear: { barangay: undefined } });
  if (query.submittedFrom || query.submittedTo) chips.push({ key: "submitted", label: `Submitted ${describeDateRange(query.submittedFrom, query.submittedTo)}`, clear: { submittedFrom: undefined, submittedTo: undefined } });
  if (query.requirementCompletion && query.requirementCompletion !== "All") chips.push({ key: "req", label: requirementCompletionChoices.find((entry) => entry.value === query.requirementCompletion)?.label ?? "", clear: { requirementCompletion: "All" } });
  return chips;
}

export function applicationMoreFilterCount(query: ChairmanApplicationListQuery) {
  return [query.barangay, query.submittedFrom || query.submittedTo, query.requirementCompletion !== "All"].filter(Boolean).length;
}

// ---------------------------------------------------------------- Member directory

export const approvalStatusList: ApprovalStatus[] = ["Pending", "Approved", "Rejected", "Needs Information"];
export const officialStatusList: OfficialMemberStatus[] = ["Pending", "Active", "Inactive", "Suspended", "Terminated"];
export const membershipTypeList: MembershipType[] = ["Associate", "True Member"];
export const sectorList = ["Rice", "Corn", "Fishery", "Livestock", "High-value crops (gulayan)"] as const;
export const memberSortFields = ["fullName", "memberCode", "createdAt", "applicationDate"] as const;

export const memberAccountLinkChoices: Array<{ value: MemberAccountLinkFilter; label: string }> = [
  { value: "all", label: "Any user account" },
  { value: "linked", label: "Has a linked user account" },
  { value: "unlinked", label: "No linked user account" },
];

export const defaultMemberQuery: MemberListQuery = {
  page: 1,
  pageSize: 10,
  search: "",
  approvalStatus: "All",
  officialMemberStatus: "All",
  membershipType: "All",
  barangay: undefined,
  sector: undefined,
  accountLink: "all",
  approvedFrom: undefined,
  approvedTo: undefined,
  sortBy: "createdAt",
  sortDirection: "desc",
};

export function memberQueryFromParams(params: URLSearchParams): Partial<MemberListQuery> {
  const range = orderedRange(dateParam(params, "from"), dateParam(params, "to"));
  const sortBy = pick(params.get("sort"), memberSortFields);
  return {
    search: params.get("q")?.slice(0, 190) ?? "",
    approvalStatus: pick(params.get("approval"), approvalStatusList) ?? "All",
    officialMemberStatus: pick(params.get("official"), officialStatusList) ?? "All",
    membershipType: pick(params.get("type"), membershipTypeList) ?? "All",
    barangay: params.get("barangay")?.slice(0, 120) || undefined,
    sector: params.get("sector")?.slice(0, 100) || undefined,
    accountLink: pick(params.get("account"), ["linked", "unlinked"] as const) ?? "all",
    approvedFrom: range.from,
    approvedTo: range.to,
    ...(sortBy ? { sortBy } : {}),
    sortDirection: params.get("dir") === "asc" ? "asc" : "desc",
  };
}

export function memberQueryToParams(query: MemberListQuery, params = new URLSearchParams()) {
  setParam(params, "q", query.search?.trim());
  setParam(params, "approval", query.approvalStatus !== "All" ? query.approvalStatus : null);
  setParam(params, "official", query.officialMemberStatus !== "All" ? query.officialMemberStatus : null);
  setParam(params, "type", query.membershipType !== "All" ? query.membershipType : null);
  setParam(params, "barangay", query.barangay);
  setParam(params, "sector", query.sector);
  setParam(params, "account", query.accountLink !== "all" ? query.accountLink : null);
  setParam(params, "from", query.approvedFrom);
  setParam(params, "to", query.approvedTo);
  setParam(params, "sort", query.sortBy !== defaultMemberQuery.sortBy ? query.sortBy : null);
  setParam(params, "dir", query.sortDirection !== defaultMemberQuery.sortDirection ? query.sortDirection : null);
  return params;
}

export function memberChips(query: MemberListQuery): Array<FilterChip<MemberListQuery>> {
  const chips: Array<FilterChip<MemberListQuery>> = [];
  if (query.search?.trim()) chips.push({ key: "search", label: `Search: “${query.search.trim()}”`, clear: { search: "" } });
  if (query.approvalStatus && query.approvalStatus !== "All") chips.push({ key: "approval", label: `Approval: ${query.approvalStatus}`, clear: { approvalStatus: "All" } });
  if (query.officialMemberStatus && query.officialMemberStatus !== "All") chips.push({ key: "official", label: `Official status: ${query.officialMemberStatus}`, clear: { officialMemberStatus: "All" } });
  if (query.membershipType && query.membershipType !== "All") chips.push({ key: "type", label: `Type: ${query.membershipType}`, clear: { membershipType: "All" } });
  if (query.barangay) chips.push({ key: "barangay", label: `Barangay: ${query.barangay}`, clear: { barangay: undefined } });
  if (query.sector) chips.push({ key: "sector", label: `Sector: ${query.sector}`, clear: { sector: undefined } });
  if (query.accountLink && query.accountLink !== "all") chips.push({ key: "account", label: memberAccountLinkChoices.find((choice) => choice.value === query.accountLink)?.label ?? "", clear: { accountLink: "all" } });
  if (query.approvedFrom || query.approvedTo) chips.push({ key: "approved", label: `Approved ${describeDateRange(query.approvedFrom, query.approvedTo)}`, clear: { approvedFrom: undefined, approvedTo: undefined } });
  return chips;
}

export function memberMoreFilterCount(query: MemberListQuery) {
  return [query.approvalStatus !== "All", query.sector, query.accountLink !== "all", query.approvedFrom || query.approvedTo].filter(Boolean).length;
}

// ---------------------------------------------------------------- Status history

export type HistoryRangePreset = "all" | "today" | "7d" | "30d" | "month" | "custom" | "date";

export const historyRangeChoices: Array<{ value: HistoryRangePreset; label: string }> = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom date range" },
  { value: "date", label: "One exact date" },
];

export const historySources: HistorySource[] = ["All", "Application", "Member", "Account"];

export const historyChangeTypeChoices: Array<{ value: HistoryChangeTypeFilter; label: string }> = [
  { value: "all", label: "All change types" },
  { value: "application-status", label: "Application status" },
  { value: "member-status", label: "Official member status" },
  { value: "membership-type", label: "Membership type" },
  { value: "account-status", label: "Linked account status" },
  { value: "account-role", label: "Linked account role" },
];

export type HistoryQueryState = {
  page: number;
  pageSize: number;
  search: string;
  sourceModule: HistorySource;
  range: HistoryRangePreset;
  /** Exact date when `range` is `date`; also what the legacy single-date filter carried. */
  date: string;
  from: string;
  to: string;
  /** A user id, `none` for events with no recorded actor, or "" for anyone. */
  actorId: string;
  changeType: HistoryChangeTypeFilter;
};

export const defaultHistoryQuery: HistoryQueryState = {
  page: 1,
  pageSize: 10,
  search: "",
  sourceModule: "All",
  range: "all",
  date: "",
  from: "",
  to: "",
  actorId: "",
  changeType: "all",
};

/** Resolves a range choice into inclusive Manila dates relative to `today`. */
export function resolveHistoryRange(query: Pick<HistoryQueryState, "range" | "date" | "from" | "to">, today = manilaToday()): { from?: string; to?: string; date?: string } {
  switch (query.range) {
    case "today": return { from: today, to: today };
    case "7d": return { from: addDays(today, -6), to: today };
    case "30d": return { from: addDays(today, -29), to: today };
    case "month": return { from: `${today.slice(0, 7)}-01`, to: today };
    case "date": return query.date ? { date: query.date } : {};
    case "custom": {
      const range = orderedRange(isValidIsoDate(query.from) ? query.from : undefined, isValidIsoDate(query.to) ? query.to : undefined);
      return { from: range.from, to: range.to };
    }
    default: return {};
  }
}

export function historyQueryFromParams(params: URLSearchParams): Partial<HistoryQueryState> {
  const range = pick(params.get("range"), ["today", "7d", "30d", "month", "custom", "date"] as const) ?? "all";
  const from = dateParam(params, "from");
  const to = dateParam(params, "to");
  const date = dateParam(params, "date");
  const actorId = params.get("actor");
  return {
    search: params.get("q")?.slice(0, 190) ?? "",
    sourceModule: pick(params.get("source"), historySources) ?? "All",
    range: range === "date" && !date ? "all" : range,
    date: date ?? "",
    from: from ?? "",
    to: from && to && to < from ? "" : to ?? "",
    actorId: actorId === "none" || /^\d+$/.test(actorId ?? "") ? actorId ?? "" : "",
    changeType: pick(params.get("change"), historyChangeTypeChoices.map((choice) => choice.value)) ?? "all",
  };
}

export function historyQueryToParams(query: HistoryQueryState, params = new URLSearchParams()) {
  setParam(params, "q", query.search.trim());
  setParam(params, "source", query.sourceModule !== "All" ? query.sourceModule : null);
  setParam(params, "range", query.range !== "all" ? query.range : null);
  setParam(params, "date", query.range === "date" ? query.date : null);
  setParam(params, "from", query.range === "custom" ? query.from : null);
  setParam(params, "to", query.range === "custom" ? query.to : null);
  setParam(params, "actor", query.actorId);
  setParam(params, "change", query.changeType !== "all" ? query.changeType : null);
  return params;
}

export function historyChips(query: HistoryQueryState, actorName?: (id: string) => string | undefined): Array<FilterChip<HistoryQueryState>> {
  const chips: Array<FilterChip<HistoryQueryState>> = [];
  if (query.search.trim()) chips.push({ key: "search", label: `Search: “${query.search.trim()}”`, clear: { search: "" } });
  if (query.sourceModule !== "All") chips.push({ key: "source", label: `Source: ${query.sourceModule}`, clear: { sourceModule: "All" } });
  if (query.range !== "all") {
    const label = query.range === "custom"
      ? describeDateRange(query.from || undefined, query.to || undefined) || "Custom range"
      : query.range === "date"
        ? query.date ? formatIsoDate(query.date) : "One exact date"
        : historyRangeChoices.find((choice) => choice.value === query.range)?.label ?? "";
    chips.push({ key: "range", label: `Date: ${label}`, clear: { range: "all", date: "", from: "", to: "" } });
  }
  if (query.changeType !== "all") chips.push({ key: "change", label: `Change: ${historyChangeTypeChoices.find((choice) => choice.value === query.changeType)?.label}`, clear: { changeType: "all" } });
  if (query.actorId) chips.push({ key: "actor", label: `Changed by: ${query.actorId === "none" ? "No recorded actor" : actorName?.(query.actorId) ?? `User ${query.actorId}`}`, clear: { actorId: "" } });
  return chips;
}

export function historyMoreFilterCount(query: HistoryQueryState) {
  return [query.changeType !== "all", query.actorId].filter(Boolean).length;
}

/** Client-side validation message for the custom date range, or null. */
export function historyRangeError(query: Pick<HistoryQueryState, "range" | "from" | "to">) {
  return query.range === "custom" ? validateDateRange(query.from || undefined, query.to || undefined) : null;
}

/** The API filter set for a history query (without paging). */
export function historyApiFilters(query: HistoryQueryState, today = manilaToday()) {
  const range = resolveHistoryRange(query, today);
  return {
    search: query.search,
    sourceModule: query.sourceModule,
    date: range.date,
    from: range.from,
    to: range.to,
    actorId: query.actorId || undefined,
    changeType: query.changeType,
  };
}

// ---------------------------------------------------------------- shared URL plumbing

/** Keeps other params (such as `tab`) untouched and replaces only this view's keys. */
export function mergeViewParams(current: URLSearchParams, viewKeys: readonly string[], next: URLSearchParams, prefix: string) {
  const merged = new URLSearchParams(current);
  for (const key of viewKeys) merged.delete(`${prefix}${key}`);
  next.forEach((value, key) => merged.set(`${prefix}${key}`, value));
  return merged;
}

/** The params of one view, with its prefix stripped. */
export function viewParams(source: URLSearchParams, prefix: string) {
  const own = new URLSearchParams();
  source.forEach((value, key) => {
    if (key.startsWith(prefix)) own.set(key.slice(prefix.length), value);
  });
  return own;
}

export const viewParamKeys = {
  users: ["q", "role", "status", "hidden", "from", "to", "link", "login", "days", "sort", "dir"],
  applications: ["q", "status", "type", "source", "barangay", "from", "to", "req", "sort", "dir"],
  directory: ["q", "approval", "official", "type", "barangay", "sector", "account", "from", "to", "sort", "dir"],
  history: ["q", "source", "range", "date", "from", "to", "actor", "change"],
} as const;
