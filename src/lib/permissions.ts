import type { AuthUser } from "@/features/auth/types";

export function canManageMembers(user: AuthUser) {
  return user.role === "admin" || user.role === "staff";
}
