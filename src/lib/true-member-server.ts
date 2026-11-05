import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/config/env";

export async function requireServerTrueMember() {
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "trackcoop_session";
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) redirect("/login");
  const response = await fetch(`${env.apiUrl}/api/members/me/true-membership`, {
    cache: "no-store", headers: { cookie: `${cookieName}=${encodeURIComponent(token)}` },
  });
  if (response.status === 401) redirect("/login");
  if (!response.ok || (await response.json()).membershipType !== "True Member") {
    redirect("/portal/member/dashboard");
  }
}
