import type { AuthContext } from "../auth/auth.types";

export type AuthorizedUser = AuthContext["user"] & {
  numericId: number;
};

export function authorizedUserFromAuth(auth: AuthContext): AuthorizedUser {
  const numericId = Number(auth.user.id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("Authenticated user is not linked to a valid account.");
  }
  return {
    ...auth.user,
    numericId,
  };
}
