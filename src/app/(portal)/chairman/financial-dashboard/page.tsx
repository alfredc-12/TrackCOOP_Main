import { Suspense } from "react";
import { connection } from "next/server";
import { FinancialAnalyticsClient } from "@/features/financial-analytics/FinancialAnalyticsClient";

function cooperativeToday() {
  return new Date(new Date().getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export default async function ChairmanFinancialDashboardPage() {
  await connection();
  return <Suspense fallback={<p role="status">Loading financial analytics…</p>}><FinancialAnalyticsClient today={cooperativeToday()} /></Suspense>;
}
