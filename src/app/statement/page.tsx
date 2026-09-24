import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/config/env";
import { getServerAuthUser } from "@/lib/auth-server";
import StatementPrintView from "./statement-print-view";

type StatementResponse = {
  member: Record<string, unknown>;
  deposits: Array<Record<string, unknown>>;
  purchases: Array<Record<string, unknown>>;
};

export default async function StatementPage() {
  const user = await getServerAuthUser();
  if (!user || user.role !== "member") {
    redirect("/login");
  }

  const cookieName = process.env.SESSION_COOKIE_NAME ?? "trackcoop_session";
  const token = (await cookies()).get(cookieName)?.value;
  const response = await fetch(`${env.apiUrl}/api/members/me/statement`, {
    cache: "no-store",
    headers: token
      ? {
          cookie: `${cookieName}=${encodeURIComponent(token)}`,
        }
      : undefined,
  });

  if (response.status === 401 || response.status === 403) {
    redirect("/login");
  }

  if (response.status === 404) {
    return <div className="p-10 text-center">Member profile not found.</div>;
  }

  if (!response.ok) {
    return <div className="p-10 text-center">Statement could not be loaded.</div>;
  }

  const statement = (await response.json()) as StatementResponse;

  return (
    <StatementPrintView
      member={statement.member}
      deposits={statement.deposits}
      purchases={statement.purchases}
    />
  );
}
