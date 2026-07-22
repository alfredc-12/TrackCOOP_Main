import { cookies } from "next/headers";
import { env } from "@/config/env";
import type { AuthUser } from "@/features/auth/types";

type AuthResponse = {
  success: true;
  data: AuthUser;
};

export async function getServerAuthUser() {
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "trackcoop_session";
  const token = (await cookies()).get(cookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${env.apiUrl}/api/auth/me`, {
      cache: "no-store",
      headers: {
        cookie: `${cookieName}=${encodeURIComponent(token)}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AuthResponse;
    return payload.success ? payload.data : null;
  } catch {
    return null;
  }
}
