"use client";

import { env } from "@/config/env";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { requireSummaryFields } from "@/features/people-management/summary-guard";

export type AccountStatus = "Pending" | "Active" | "Suspended" | "Inactive";
export type RoleSlug = "chairman" | "bookkeeper" | "member";

export type UserSummary = {
  id: string;
  username: string | null;
  email: string;
  displayName: string;
  role: RoleSlug;
  accountStatus: AccountStatus;
  lastLoginAt: string | null;
  createdAt: string;
  linkedMemberId: string | null;
  linkedMemberCode: string | null;
  linkedMemberName: string | null;
  activeSessionCount: number;
  activationTokenExpiresAt: string | null;
};

export type UserSession = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export type UserDetail = UserSummary & {
  sessions: UserSession[];
};

/** Counts for everything matching the filters except the account-status filter. */
export type UserSummaryCounts = {
  total: number;
  active: number;
  pendingActivation: number;
  suspendedInactive: number;
  suspended: number;
  inactive: number;
  byRole: Record<RoleSlug, number>;
  /** Member-role accounts in scope and how many have a member profile. */
  memberAccounts: { eligible: number; linked: number };
  /** Accounts visible under the hidden-account policy alone. */
  overallTotal: number;
};

export type UserMemberLinkFilter = "all" | "linked" | "unlinked";
export type UserLastLoginFilter = "all" | "never" | "recent" | "inactive";

export type UserFilterQuery = {
  search?: string;
  role?: RoleSlug | "all";
  status?: AccountStatus | "all";
  /** Several statuses at once; takes precedence over `status`. */
  statuses?: AccountStatus[];
  includeHidden?: boolean;
  createdFrom?: string;
  createdTo?: string;
  memberLink?: UserMemberLinkFilter;
  lastLogin?: UserLastLoginFilter;
  lastLoginDays?: number;
};

export type UserListQuery = UserFilterQuery & {
  page?: number;
  pageSize?: number;
  sortBy?: "displayName" | "email" | "role" | "accountStatus" | "createdAt";
  sortDirection?: "asc" | "desc";
};

export type UserListResult = {
  users: UserSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  recordId: string | null;
  description: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  actionTime: string;
  actorName: string | null;
  actorEmail: string | null;
};

export type UserMutationResult = {
  user: UserSummary;
  activationUrl?: string;
  activationTokenExpiresAt?: string;
};

export type ActivationLinkResult = {
  user: UserSummary;
  activationUrl: string;
  activationTokenExpiresAt: string;
};

export type LinkableMember = {
  id: string;
  memberCode: string;
  fullName: string;
  email: string | null;
};

export type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Needs Information";
export type MembershipType = "Associate" | "True Member";
export type OfficialMemberStatus =
  | "Pending"
  | "Active"
  | "Inactive"
  | "Suspended"
  | "Terminated";

export type MemberProfile = {
  id: string;
  userId?: string | null;
  linkedUserEmail?: string | null;
  linkedUserUsername?: string | null;
  linkedUserStatus?: string | null;
  linkedUserRole?: string | null;
  memberCode: string;
  fullName: string;
  contactNumber: string | null;
  email: string | null;
  barangay: string | null;
  municipality: string;
  province: string;
  sector: string | null;
  sectors?: string[];
  membershipType: MembershipType;
  approvalStatus: ApprovalStatus;
  officialMemberStatus: OfficialMemberStatus;
  applicationDate: string | null;
  trueMemberSince: string | null;
  shareCapitalDeadline?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type ShareCapitalProgress = {
  validatedTotal: number;
  pendingTotal: number;
  validatedPayments: number;
  fullRequirement: number;
  maximumAllowed: number;
  remainingToFull: number;
  remainingAllowed: number;
  fullRequirementMet: boolean;
};

export type MemberPaymentActivity = {
  id: string;
  referenceNumber: string;
  paymentPurpose: string;
  amount: number;
  validationStatus: string;
  submittedAt: string;
};

export type MemberPosActivity = {
  id: string;
  saleNumber: string;
  saleStatus: string;
  paymentStatus: string;
  totalAmount: number;
  saleDate: string;
};

export type MemberRentalActivity = {
  id: string;
  bookingNumber: string;
  assetName: string;
  bookingStatus: string;
  paymentStatus: string;
  totalAmount: number;
  startDatetime: string;
};

export type MemberLatestIndicator = {
  id: string;
  statusLabel: string;
  totalScore: number;
  computedAt: string;
  basisSummary: string | null;
};

export type MemberStatusHistoryEntry = {
  id: string;
  memberId: string;
  oldMembershipType: MembershipType | null;
  newMembershipType: MembershipType | null;
  oldOfficialStatus: OfficialMemberStatus | null;
  newOfficialStatus: OfficialMemberStatus | null;
  reason: string | null;
  changedBy: string;
  changedAt: string;
};

export type MemberDetail = MemberProfile & {
  shareCapital: ShareCapitalProgress;
  recentPayments: MemberPaymentActivity[];
  recentPosActivity: MemberPosActivity[];
  recentRentalActivity: MemberRentalActivity[];
  latestIndicator: MemberLatestIndicator | null;
  statusHistory: MemberStatusHistoryEntry[];
};

export type MemberAccountLinkFilter = "all" | "linked" | "unlinked";

export type MemberFilterQuery = {
  search?: string;
  approvalStatus?: ApprovalStatus | "All";
  officialMemberStatus?: OfficialMemberStatus | "All";
  membershipType?: MembershipType | "All";
  barangay?: string;
  /** The primary sector, or `Unspecified`. */
  sector?: string;
  accountLink?: MemberAccountLinkFilter;
  approvedFrom?: string;
  approvedTo?: string;
};

export type MemberListQuery = MemberFilterQuery & {
  page?: number;
  pageSize?: number;
  sortBy?: "fullName" | "memberCode" | "createdAt" | "applicationDate";
  sortDirection?: "asc" | "desc";
};

export type MemberListResult = {
  members: MemberProfile[];
  total: number;
  page: number;
  pageSize: number;
};

export type MemberProfileInput = {
  userId?: string | null;
  memberCode: string;
  fullName: string;
  contactNumber?: string | null;
  email?: string | null;
  barangay?: string | null;
  municipality?: string;
  province?: string;
  sector?: string | null;
  sectors?: string[];
  membershipType?: MembershipType;
  approvalStatus?: ApprovalStatus;
  officialMemberStatus?: OfficialMemberStatus;
  applicationDate?: string | null;
  trueMemberSince?: string | null;
  shareCapitalDeadline?: string | null;
  notes?: string | null;
};

export type HistorySource = "All" | "Application" | "Member" | "Account";
export type HistoryChangeTypeFilter = "all" | "application-status" | "member-status" | "membership-type" | "account-status" | "account-role";

export type UnifiedStatusHistoryEntry = {
  id: string;
  sourceModule: "Application" | "Member" | "Account";
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  oldStatus: string | null;
  newStatus: string;
  reason: string | null;
  actor: string | null;
  actorId: string | null;
  changeType: Exclude<HistoryChangeTypeFilter, "all"> | "member-status-and-type";
  changedAt: string;
};

export type HistoryFilterQuery = {
  search?: string;
  sourceModule?: HistorySource;
  /** One exact Asia/Manila date; takes precedence over `from`/`to`. */
  date?: string;
  from?: string;
  to?: string;
  /** A user id, or `none` for events with no recorded actor. */
  actorId?: string;
  changeType?: HistoryChangeTypeFilter;
};

/** Counts are history events, not distinct people. */
export type UnifiedStatusHistorySummary = {
  total: number;
  application: number;
  member: number;
  account: number;
  distinctSubjects: number;
  overallTotal: number;
};

export type HistoryActorOptions = {
  actors: Array<{ id: string; name: string; total: number }>;
  withoutActor: number;
};

export type UnifiedStatusHistoryResult = {
  entries: UnifiedStatusHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
  message: string;
  meta: Record<string, unknown>;
};

type ApiFailure = {
  success: false;
  message: string;
  errors: Array<{ code?: string; field?: string; message: string }>;
};

async function apiRequestWithMeta<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;

  if (!response.ok || !payload?.success) {
    const failure = payload && !payload.success ? payload : null;
    throw new ApiClientError(
      failure?.message ?? "The request could not be completed",
      response.status,
      failure?.errors,
    );
  }

  return {
    data: payload.data,
    meta: payload.meta,
  };
}

/** Counts for everything matching the filters except approval status, official status and membership type. */
export type MemberSummary = {
  total: number;
  pendingApproval: number;
  needsInformation: number;
  rejected: number;
  approved: number;
  /** Counts every profile, approved or not. Prefer `approvedMembers` for membership KPIs. */
  associate: number;
  trueMember: number;
  active: number;
  inactive: number;
  suspended: number;
  approvedMembers: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    terminated: number;
    pendingOfficial: number;
    associate: number;
    trueMember: number;
    unlinked: number;
  };
  overallTotal: number;
};

export type MemberIndicatorStatus = "Active" | "Needs Monitoring" | "Inactive";

export type MemberIndicator = {
  id: string;
  memberId: string;
  memberCode: string;
  fullName: string;
  membershipType: string;
  officialMemberStatus: string;
  basisPeriodStart: string | null;
  basisPeriodEnd: string | null;
  recencyDays: number | null;
  frequencyCount: number;
  validatedShareCapital: number;
  recencyScore: number;
  frequencyScore: number;
  contributionScore: number;
  totalScore: number;
  statusLabel: MemberIndicatorStatus;
  scoringVersion: string;
  basisSummary: string | null;
  computedAt: string;
};

export type MemberIndicatorSourceCounts = {
  qualifyingParticipation: number;
  validatedShareCapitalPayments: number;
};

export type MemberIndicatorBasisSummary = {
  formulaVersion: string;
  advisoryOnly: boolean;
  officialStatusUnchanged: boolean;
  rawMetrics: {
    recencyDays: number | null;
    frequencyCount: number;
    contributionAmount: number;
    sourceCounts: MemberIndicatorSourceCounts;
  };
  basisPeriod: {
    start: string;
    end: string;
  };
  scoring: {
    method: "configured-thresholds";
    recencyScore: number;
    frequencyScore: number;
    contributionScore: number;
    totalScore: number;
    label: MemberIndicatorStatus;
    explanation: string;
  };
};

export type MemberIndicatorListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  statusLabel?: MemberIndicatorStatus | "All";
  sortBy?: "fullName" | "totalScore" | "recencyScore" | "frequencyScore" | "contributionScore" | "computedAt";
  sortDirection?: "asc" | "desc";
};

export type MemberIndicatorListResult = {
  indicators: MemberIndicator[];
  total: number;
  page: number;
  pageSize: number;
};

export type MemberIndicatorSummary = {
  totalTracked: number;
  active: number;
  needsMonitoring: number;
  inactive: number;
  averageScore: number;
  distribution: Array<{
    statusLabel: MemberIndicatorStatus;
    total: number;
    percentage: number;
  }>;
};

export type RecalculateMemberIndicatorsInput = {
  memberId?: string;
  basisPeriodStart?: string | null;
  basisPeriodEnd?: string | null;
};

export async function listUsers(search?: string) {
  const result = await listUsersPaginated({ search, pageSize: 50, sortBy: "createdAt", sortDirection: "desc" });
  return result.users;
}

/** Filter parameters shared by the user list, export and KPI summary. */
export function userFilterParams(query: UserFilterQuery, params = new URLSearchParams()) {
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.role && query.role !== "all") params.set("role", query.role);
  if (query.statuses?.length) params.set("statuses", query.statuses.join("|"));
  else if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.includeHidden) params.set("includeHidden", "true");
  if (query.createdFrom) params.set("createdFrom", query.createdFrom);
  if (query.createdTo) params.set("createdTo", query.createdTo);
  if (query.memberLink && query.memberLink !== "all") params.set("memberLink", query.memberLink);
  if (query.lastLogin && query.lastLogin !== "all") {
    params.set("lastLogin", query.lastLogin);
    if (query.lastLogin !== "never" && query.lastLoginDays) params.set("lastLoginDays", String(query.lastLoginDays));
  }
  return params;
}

export async function listUsersPaginated(query: UserListQuery = {}, options: { signal?: AbortSignal } = {}): Promise<UserListResult> {
  const params = userFilterParams(query, new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
    sortBy: query.sortBy ?? "createdAt",
    sortDirection: query.sortDirection ?? "desc",
  }));

  const result = await apiRequestWithMeta<UserSummary[]>(`/api/users?${params}`, { signal: options.signal });
  return {
    users: result.data,
    total: Number(result.meta.total ?? result.data.length),
    page: Number(result.meta.page ?? query.page ?? 1),
    pageSize: Number(result.meta.pageSize ?? query.pageSize ?? 20),
  };
}

/** KPI counts for the filtered population. The status filter is ignored: the cards are the status breakdown. */
export async function getUserSummary(filters: UserFilterQuery = {}, options: { signal?: AbortSignal } = {}) {
  const queryString = userFilterParams({ ...filters, status: undefined, statuses: undefined }).toString();
  const summary = await apiRequest<UserSummaryCounts>(`/api/users/summary${queryString ? `?${queryString}` : ""}`, { signal: options.signal });
  return requireSummaryFields(summary, ["total", "active", "pendingActivation", "suspended", "inactive", "byRole.chairman", "byRole.bookkeeper", "byRole.member", "memberAccounts.eligible", "memberAccounts.linked", "overallTotal"], "account");
}

export function getUserDetail(userId: string) {
  return apiRequest<UserDetail>(`/api/users/${userId}`);
}

export function createUser(input: {
  displayName: string;
  email: string;
  username?: string | null;
  role: RoleSlug;
  accountStatus: AccountStatus;
  password?: string;
  issueActivationLink?: boolean;
  memberId?: string;
}) {
  return apiRequest<UserMutationResult>("/api/users", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      issueActivationLink: false,
      username: input.username?.trim() || null,
      password: input.password || "Track_coop123",
      memberId: input.memberId || undefined,
    }),
  });
}

export function updateUser(userId: string, input: {
  displayName?: string;
  email?: string;
  username?: string | null;
}) {
  return apiRequest<UserSummary>(`/api/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function changeUserRole(userId: string, role: RoleSlug, reason: string) {
  return apiRequest<UserSummary>(`/api/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role, reason }),
  });
}

export function changeUserStatus(
  userId: string,
  accountStatus: AccountStatus,
  reason: string,
  selfConfirmation?: string,
) {
  return apiRequest<UserSummary>(`/api/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ accountStatus, reason, selfConfirmation }),
  });
}

export function issueActivationLink(userId: string, reason: string) {
  return apiRequest<ActivationLinkResult>(`/api/users/${userId}/activation-link`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function revokeUserSession(userId: string, sessionId: string, reason: string) {
  return apiRequest<UserDetail>(`/api/users/${userId}/sessions/${sessionId}/revoke`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function revokeAllUserSessions(userId: string, reason: string) {
  return apiRequest<UserDetail>(`/api/users/${userId}/sessions/revoke`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function deleteUser(userId: string, reason: string, selfConfirmation?: string) {
  return apiRequest<void>(`/api/users/${userId}`, {
    method: "DELETE",
    body: JSON.stringify({ reason, selfConfirmation }),
  });
}

export function resetUserPassword(userId: string, password: string, reason: string) {
  return apiRequest<void>(`/api/users/${userId}/password-reset`, {
    method: "POST",
    body: JSON.stringify({ password, reason }),
  });
}

export function exportUsersCsv(query: UserListQuery = {}): string {
  const params = userFilterParams(query, new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
    sortBy: query.sortBy ?? "createdAt",
    sortDirection: query.sortDirection ?? "desc",
  }));

  return `${env.apiUrl}/api/users/export?${params}`;
}

export function bulkUserAction(userIds: string[], action: "Suspend" | "Activate" | "Delete", reason: string) {
  return apiRequest<{ count: number }>("/api/users/bulk", {
    method: "POST",
    body: JSON.stringify({ userIds, action, reason }),
  });
}

export function getUserAuditLogs(userId: string) {
  return apiRequest<AuditLogEntry[]>(`/api/users/${userId}/audit-logs`);
}

export function listLinkableMembers(search?: string) {
  const params = new URLSearchParams({ pageSize: "50" });
  if (search?.trim()) params.set("search", search.trim());
  return apiRequest<LinkableMember[]>(`/api/users/linkable-members?${params}`);
}

export function linkUserMember(userId: string, memberId: string, reason: string) {
  return apiRequest<UserDetail>(`/api/users/${userId}/member-link`, {
    method: "POST",
    body: JSON.stringify({ memberId, reason }),
  });
}

export function unlinkUserMember(userId: string, reason: string) {
  return apiRequest<UserDetail>(`/api/users/${userId}/member-link`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });
}

export function listMembers(search?: string) {
  return listMembersPaginated({ search, pageSize: 50, sortBy: "createdAt", sortDirection: "desc" })
    .then((result) => result.members);
}

/** Filter parameters shared by the member list and its KPI summary. */
export function memberFilterParams(query: MemberFilterQuery, params = new URLSearchParams()) {
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.approvalStatus && query.approvalStatus !== "All") params.set("approvalStatus", query.approvalStatus);
  if (query.officialMemberStatus && query.officialMemberStatus !== "All") params.set("officialMemberStatus", query.officialMemberStatus);
  if (query.membershipType && query.membershipType !== "All") params.set("membershipType", query.membershipType);
  if (query.barangay?.trim()) params.set("barangay", query.barangay.trim());
  if (query.sector?.trim()) params.set("sector", query.sector.trim());
  if (query.accountLink && query.accountLink !== "all") params.set("accountLink", query.accountLink);
  if (query.approvedFrom) params.set("approvedFrom", query.approvedFrom);
  if (query.approvedTo) params.set("approvedTo", query.approvedTo);
  return params;
}

export async function listMembersPaginated(query: MemberListQuery = {}, options: { signal?: AbortSignal } = {}): Promise<MemberListResult> {
  const params = memberFilterParams(query, new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
    sortBy: query.sortBy ?? "createdAt",
    sortDirection: query.sortDirection ?? "desc",
  }));

  const result = await apiRequestWithMeta<MemberProfile[]>(`/api/members?${params}`, { signal: options.signal });
  return {
    members: result.data,
    total: Number(result.meta.total ?? result.data.length),
    page: Number(result.meta.page ?? query.page ?? 1),
    pageSize: Number(result.meta.pageSize ?? query.pageSize ?? 20),
  };
}

/** KPI counts for the filtered population. Approval, official status and type filters are ignored: the cards break them down. */
export async function getMemberSummary(filters: MemberFilterQuery = {}, options: { signal?: AbortSignal } = {}) {
  const queryString = memberFilterParams({ ...filters, approvalStatus: undefined, officialMemberStatus: undefined, membershipType: undefined }).toString();
  const summary = await apiRequest<MemberSummary>(`/api/members/summary${queryString ? `?${queryString}` : ""}`, { signal: options.signal });
  return requireSummaryFields(summary, ["total", "approved", "pendingApproval", "approvedMembers.total", "approvedMembers.active", "approvedMembers.associate", "approvedMembers.trueMember", "approvedMembers.unlinked", "overallTotal"], "member directory");
}

/** Distinct barangays recorded on member profiles, with counts. */
export function listMemberBarangays(options: { signal?: AbortSignal } = {}) {
  return apiRequest<Array<{ barangay: string; total: number }>>("/api/members/distribution/barangay", { signal: options.signal });
}

export function getMemberDetail(memberId: string) {
  return apiRequest<MemberDetail>(`/api/members/${memberId}`);
}

export function createMember(input: MemberProfileInput) {
  return apiRequest<MemberDetail>("/api/members", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMember(memberId: string, input: Partial<MemberProfileInput>) {
  return apiRequest<MemberDetail>(`/api/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateMemberStatus(
  memberId: string,
  input: {
    membershipType?: MembershipType;
    officialMemberStatus?: OfficialMemberStatus;
    reason: string;
    confirmation: string;
  },
) {
  return apiRequest<MemberDetail>(`/api/members/${memberId}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Filter parameters shared by the history table, its KPI summary and the actor options. */
export function historyFilterParams(query: HistoryFilterQuery, params = new URLSearchParams()) {
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.sourceModule) params.set("sourceModule", query.sourceModule);
  if (query.date?.trim()) params.set("date", query.date.trim());
  else {
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
  }
  if (query.actorId) params.set("actorId", query.actorId);
  if (query.changeType && query.changeType !== "all") params.set("changeType", query.changeType);
  return params;
}

export async function listUnifiedStatusHistory(query: HistoryFilterQuery & {
  page?: number;
  pageSize?: number;
} = {}, options: { signal?: AbortSignal } = {}): Promise<UnifiedStatusHistoryResult> {
  const params = historyFilterParams({ ...query, sourceModule: query.sourceModule ?? "All" }, new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
  }));

  const result = await apiRequestWithMeta<UnifiedStatusHistoryEntry[]>(`/api/members/status-history?${params}`, { signal: options.signal });
  return {
    entries: result.data,
    total: Number(result.meta.total ?? result.data.length),
    page: Number(result.meta.page ?? query.page ?? 1),
    pageSize: Number(result.meta.pageSize ?? query.pageSize ?? 20),
  };
}

/** Event counts for the filtered history. The source filter is ignored: the cards are the per-source breakdown. */
export function getUnifiedStatusHistorySummary(filters: HistoryFilterQuery = {}, options: { signal?: AbortSignal } = {}) {
  const queryString = historyFilterParams({ ...filters, sourceModule: undefined }).toString();
  return apiRequest<UnifiedStatusHistorySummary>(`/api/members/status-history/summary${queryString ? `?${queryString}` : ""}`, { signal: options.signal });
}

export function listUnifiedStatusHistoryActors(filters: HistoryFilterQuery = {}, options: { signal?: AbortSignal } = {}) {
  const queryString = historyFilterParams({ ...filters, sourceModule: undefined, actorId: undefined }).toString();
  return apiRequest<HistoryActorOptions>(`/api/members/status-history/actors${queryString ? `?${queryString}` : ""}`, { signal: options.signal });
}

export async function listMemberIndicators(query: MemberIndicatorListQuery = {}): Promise<MemberIndicatorListResult> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
    sortBy: query.sortBy ?? "computedAt",
    sortDirection: query.sortDirection ?? "desc",
  });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.statusLabel && query.statusLabel !== "All") params.set("statusLabel", query.statusLabel);

  const result = await apiRequestWithMeta<MemberIndicator[]>(`/api/member-indicators?${params}`);
  return {
    indicators: result.data,
    total: Number(result.meta.total ?? result.data.length),
    page: Number(result.meta.page ?? query.page ?? 1),
    pageSize: Number(result.meta.pageSize ?? query.pageSize ?? 20),
  };
}

export function getMemberIndicatorSummary() {
  return apiRequest<MemberIndicatorSummary>("/api/member-indicators/summary");
}

export function getMemberIndicatorHistory(memberId: string) {
  return apiRequest<MemberIndicator[]>(`/api/member-indicators/${memberId}/history`);
}

export function recalculateMemberIndicators(input: RecalculateMemberIndicatorsInput = {}) {
  return apiRequest<{ recalculated: number; basisPeriodStart: string | null; basisPeriodEnd: string | null }>("/api/member-indicators/recalculate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
