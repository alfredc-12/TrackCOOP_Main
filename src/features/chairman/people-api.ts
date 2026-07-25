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
  createdAt: string;
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
  recencyScore: number;
  frequencyScore: number;
  contributionScore: number;
  totalScore: number;
  statusLabel: MemberIndicatorStatus;
  basisSummary: string | null;
  computedAt: string;
};

export type MemberIndicatorSummary = {
  totalTracked: number;
  active: number;
  needsMonitoring: number;
  inactive: number;
  averageScore: number;
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
  const params = new URLSearchParams({
    pageSize: "50",
    sortBy: "createdAt",
    sortDirection: "desc",
  });
  if (search?.trim()) params.set("search", search.trim());
  return apiRequest<MemberProfile[]>(`/api/members?${params}`);
}

export function getMemberSummary() {
  return apiRequest<MemberSummary>("/api/members/summary");
}

export function listMemberIndicators(search?: string) {
  const params = new URLSearchParams({
    pageSize: "50",
    sortBy: "computedAt",
    sortDirection: "desc",
  });
  if (search?.trim()) params.set("search", search.trim());
  return apiRequest<MemberIndicator[]>(`/api/member-indicators?${params}`);
}

export function getMemberIndicatorSummary() {
  return apiRequest<MemberIndicatorSummary>("/api/member-indicators/summary");
}

export function recalculateMemberIndicators() {
  return apiRequest<{ recalculated: number }>("/api/member-indicators/recalculate", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
