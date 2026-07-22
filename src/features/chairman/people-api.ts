"use client";

import { apiRequest } from "@/lib/api-client";

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

export function listUsers(search?: string) {
  const params = new URLSearchParams({
    pageSize: "50",
    sortBy: "createdAt",
    sortDirection: "desc",
  });
  if (search?.trim()) params.set("search", search.trim());
  return apiRequest<UserSummary[]>(`/api/users?${params}`);
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
