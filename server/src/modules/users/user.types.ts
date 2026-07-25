import type { AccountStatus, RoleSlug, SessionSummary } from "../auth/auth.types";

export type UserSummary = {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  role: RoleSlug;
  accountStatus: AccountStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  linkedMemberId: string | null;
  linkedMemberCode: string | null;
  linkedMemberName: string | null;
  activeSessionCount: number;
  activationTokenExpiresAt: Date | null;
};

export type UserDetail = UserSummary & {
  sessions: SessionSummary[];
};

export type RoleSummary = {
  id: string;
  name: string;
  slug: RoleSlug;
  description: string | null;
};

export type UserListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  role?: RoleSlug;
  status?: AccountStatus;
  sortBy: "displayName" | "email" | "role" | "accountStatus" | "createdAt";
  sortDirection: "asc" | "desc";
};

export type UserSummaryCounts = {
  total: number;
  active: number;
  pendingActivation: number;
  suspendedInactive: number;
};

export type UserListResult = {
  users: UserSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateUserInput = {
  email: string;
  username?: string | null;
  displayName: string;
  password?: string;
  role: RoleSlug;
  accountStatus: AccountStatus;
  issueActivationLink?: boolean;
};

export type UpdateUserInput = {
  email?: string;
  username?: string | null;
  displayName?: string;
};

export type UpdateUserStatusInput = {
  accountStatus: AccountStatus;
  reason: string;
  selfConfirmation?: string;
};

export type UpdateUserRoleInput = {
  role: RoleSlug;
  reason: string;
};

export type ActivationLinkResult = {
  user: UserSummary;
  activationUrl: string;
  activationTokenExpiresAt: Date;
};

export type UserMutationResult = {
  user: UserSummary;
  activationUrl?: string;
  activationTokenExpiresAt?: Date;
};

export type LinkableMember = {
  id: string;
  memberCode: string;
  fullName: string;
  email: string | null;
};
