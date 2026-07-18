import { getAuthenticatedUser } from "@/features/auth/service";

export function getCurrentUser() {
  return getAuthenticatedUser();
}
