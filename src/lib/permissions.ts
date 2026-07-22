import type { AuthUser } from "@/features/auth/types";

export function canManageMembers(user: AuthUser) {
  return user.role === "chairman";
}

export function canManageFinances(user: AuthUser) {
  return user.role === "bookkeeper";
}

export function canManageSystemSettings(user: AuthUser) {
  return user.role === "chairman";
}
