"use client";

import { env } from "@/config/env";
import { apiRequest, ApiClientError } from "@/lib/api-client";

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

export type UserSummaryCounts = {
  total: number;
  active: number;
  pendingActivation: number;
  suspendedInactive: number;
};

export type UserListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: RoleSlug | "all";
  status?: AccountStatus | "all";
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

export type MemberListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  approvalStatus?: ApprovalStatus | "All";
  officialMemberStatus?: OfficialMemberStatus | "All";
  membershipType?: MembershipType | "All";
  barangay?: string;
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
  membershipType?: MembershipType;
  approvalStatus?: ApprovalStatus;
  officialMemberStatus?: OfficialMemberStatus;
  applicationDate?: string | null;
  trueMemberSince?: string | null;
  shareCapitalDeadline?: string | null;
  notes?: string | null;
};

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
  changedAt: string;
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

export type MemberSummary = {
  total: number;
  pendingApproval: number;
  approved: number;
  associate: number;
  trueMember: number;
  active: number;
  inactive: number;
  suspended: number;
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
  recencyScore: number;
  frequencyScore: number;
  contributionScore: number;
  totalScore: number;
  statusLabel: MemberIndicatorStatus;
  basisSummary: string | null;
  computedAt: string;
};

export type MemberIndicatorSourceCounts = {
  shareCapitalPayments: number;
  posSales: number;
  rentalBookings: number;
  paymentReferences: number;
  financialRecords: number;
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
    method: "quintile-rank" | "fallback-thresholds";
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

export async function listUsersPaginated(query: UserListQuery = {}): Promise<UserListResult> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
    sortBy: query.sortBy ?? "createdAt",
    sortDirection: query.sortDirection ?? "desc",
  });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.role && query.role !== "all") params.set("role", query.role);
  if (query.status && query.status !== "all") params.set("status", query.status);

  const result = await apiRequestWithMeta<UserSummary[]>(`/api/users?${params}`);
  return {
    users: result.data,
    total: Number(result.meta.total ?? result.data.length),
    page: Number(result.meta.page ?? query.page ?? 1),
    pageSize: Number(result.meta.pageSize ?? query.pageSize ?? 20),
  };
}

export function getUserSummary() {
  return apiRequest<UserSummaryCounts>("/api/users/summary");
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
}) {
  return apiRequest<UserMutationResult>("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
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
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
    sortBy: query.sortBy ?? "createdAt",
    sortDirection: query.sortDirection ?? "desc",
  });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.role && query.role !== "all") params.set("role", query.role);
  if (query.status && query.status !== "all") params.set("status", query.status);

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

export async function listMembersPaginated(query: MemberListQuery = {}): Promise<MemberListResult> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
    sortBy: query.sortBy ?? "createdAt",
    sortDirection: query.sortDirection ?? "desc",
  });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.approvalStatus && query.approvalStatus !== "All") params.set("approvalStatus", query.approvalStatus);
  if (query.officialMemberStatus && query.officialMemberStatus !== "All") params.set("officialMemberStatus", query.officialMemberStatus);
  if (query.membershipType && query.membershipType !== "All") params.set("membershipType", query.membershipType);
  if (query.barangay?.trim()) params.set("barangay", query.barangay.trim());

  const result = await apiRequestWithMeta<MemberProfile[]>(`/api/members?${params}`);
  return {
    members: result.data,
    total: Number(result.meta.total ?? result.data.length),
    page: Number(result.meta.page ?? query.page ?? 1),
    pageSize: Number(result.meta.pageSize ?? query.pageSize ?? 20),
  };
}

export function getMemberSummary() {
  return apiRequest<MemberSummary>("/api/members/summary");
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

export async function listUnifiedStatusHistory(query: {
  search?: string;
  sourceModule?: "All" | "Application" | "Member" | "Account";
  page?: number;
  pageSize?: number;
} = {}): Promise<UnifiedStatusHistoryResult> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
    sourceModule: query.sourceModule ?? "All",
  });
  if (query.search?.trim()) params.set("search", query.search.trim());

  const result = await apiRequestWithMeta<UnifiedStatusHistoryEntry[]>(`/api/members/status-history?${params}`);
  return {
    entries: result.data,
    total: Number(result.meta.total ?? result.data.length),
    page: Number(result.meta.page ?? query.page ?? 1),
    pageSize: Number(result.meta.pageSize ?? query.pageSize ?? 20),
  };
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
