import type { AccountStatus, RoleSlug } from "../auth/auth.types";

export type UserSummary = {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  role: RoleSlug;
  accountStatus: AccountStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
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
  password: string;
  role: RoleSlug;
  accountStatus: AccountStatus;
};

export type UpdateUserInput = {
  email?: string;
  username?: string | null;
  displayName?: string;
};
