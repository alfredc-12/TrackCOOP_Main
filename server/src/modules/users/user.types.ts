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

/** Filters shared by the list, export and KPI summary. */
export type UserFilters = {
  search?: string;
  role?: RoleSlug;
  status?: AccountStatus;
  /** Takes precedence over `status` when both are given. */
  statuses?: AccountStatus[];
  includeHidden?: boolean;
  /** Inclusive Asia/Manila calendar dates (YYYY-MM-DD) for the account creation date. */
  createdFrom?: string;
  createdTo?: string;
  /** `unlinked` = a member-role account with no member profile. */
  memberLink?: "linked" | "unlinked";
  /** `inactive` = has logged in before, but not within `lastLoginDays`; it never includes "never logged in". */
  lastLogin?: "never" | "recent" | "inactive";
  lastLoginDays?: number;
};

export type UserListQuery = UserFilters & {
  page: number;
  pageSize: number;
  sortBy: "displayName" | "email" | "role" | "accountStatus" | "createdAt";
  sortDirection: "asc" | "desc";
};

/**
 * Counts for the population matching every filter except the account-status filter, so the status cards
 * keep showing the distribution that the status filter selects from.
 */
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
  /** Accounts visible under the hidden-account policy alone, ignoring every other filter. */
  overallTotal: number;
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
