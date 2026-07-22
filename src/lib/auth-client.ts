import type { AuthUser, LoginInput } from "@/features/auth/types";
import { apiRequest } from "./api-client";

type OptionalSessionResponse = {
  user: AuthUser | null;
};

export function login(input: LoginInput) {
  return apiRequest<AuthUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout() {
  return apiRequest<null>("/api/auth/logout", { method: "POST" });
}

export function getAuthenticatedUser() {
  return apiRequest<AuthUser>("/api/auth/me", { cache: "no-store" });
}

export async function getOptionalAuthenticatedUser() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as OptionalSessionResponse;
  return payload.user;
}
