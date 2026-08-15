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
  includeHidden?: boolean;
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
  memberId?: string;
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

export type BulkUserActionInput = {
  userIds: string[];
  action: "Suspend" | "Activate" | "Delete";
  reason: string;
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
  actionTime: Date;
  actorName: string | null;
  actorEmail: string | null;
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
