export const roleSlugs = ["chairman", "bookkeeper", "member"] as const;

export type RoleSlug = (typeof roleSlugs)[number];
export type AccountStatus = "Pending" | "Active" | "Suspended" | "Inactive";

export type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  role: RoleSlug;
};

export type LoginAccount = AuthUser & {
  passwordHash: string;
  accountStatus: AccountStatus;
  failedLoginCount: number;
  lockedUntil: Date | null;
  roleIsActive: boolean;
};

export type AuthContext = {
  user: AuthUser;
  sessionId: string;
  tokenHash: string;
};

export type SessionSummary = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
};

export type LoginRequest = {
  identifier: string;
  password: string;
};

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type LoginResult = {
  user: AuthUser;
  rawToken: string;
  expiresAt: Date;
};

export function isRoleSlug(value: string): value is RoleSlug {
  return roleSlugs.includes(value as RoleSlug);
}
