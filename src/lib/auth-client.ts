import type { AuthUser, LoginInput } from "@/features/auth/types";
import { ApiClientError, apiRequest } from "./api-client";

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
  try {
    return await apiRequest<AuthUser>("/api/auth/me", { cache: "no-store" });
  } catch (error) {
    if (error instanceof ApiClientError) {
      return null;
    }
    return null;
  }
}
