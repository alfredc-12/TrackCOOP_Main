import { Suspense } from "react";
import { connection } from "next/server";
import { MemberAnalyticsClient } from "@/features/member-analytics/MemberAnalyticsClient";

function cooperativeToday() {
  return new Date(new Date().getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export default async function ChairmanDashboardPage() {
  await connection();
  const today = cooperativeToday();
  return <Suspense fallback={<p role="status">Loading member analytics…</p>}><MemberAnalyticsClient today={today} /></Suspense>;
}
