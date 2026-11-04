"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import { AttentionCards } from "./AttentionCards";
import {
  getBookkeeperDashboard,
  type BookkeeperDashboard,
  type DashboardQueryInput,
} from "./dashboard-api";
import { ExpenseBreakdown } from "./ExpenseBreakdown";
import { MemberCapitalBand } from "./MemberCapitalBand";
import { OverviewCards } from "./OverviewCards";
import { PeriodFilter } from "./PeriodFilter";
import { RecentActivityTable } from "./RecentActivityTable";
import { SourceBreakdown } from "./SourceBreakdown";
import { TrendChart } from "./TrendChart";

export function BookkeeperFinancialDashboard() {
  const [query, setQuery] = useState<DashboardQueryInput>({ period: "month" });
  const [revision, setRevision] = useState(0);
  const requestKey = `${query.period}:${query.start ?? ""}:${query.end ?? ""}:${revision}`;
  const [result, setResult] = useState<{
    key: string;
    data: BookkeeperDashboard | null;
    error: string;
  }>({ key: "", data: null, error: "" });

  const refresh = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getBookkeeperDashboard(query, { signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data: next, error: "" });
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setResult((current) => ({
          key: requestKey,
          data: current.data,
          error:
            caught instanceof ApiClientError
              ? caught.message
              : "The Bookkeeper Financial Dashboard could not be loaded.",
        }));
      });

    return () => controller.abort();
  }, [query, requestKey]);

  const loading = result.key !== requestKey;
  const topLevelError = result.key === requestKey ? result.error : "";
  const data = result.data;
  const scope = data?.scope ?? null;
  const errors = data?.errors ?? {};

  return (
    <div className="grid min-w-0 gap-6">
      <PeriodFilter
        query={query}
        scope={scope}
        generatedAt={data?.generatedAt ?? null}
        loading={loading}
        onChange={setQuery}
        onRefresh={refresh}
      />

      {topLevelError ? (
        <ErrorState message={topLevelError} onRetry={refresh} />
      ) : (
        <>
          <AttentionCards
            attention={data?.attention ?? null}
            error={errors.attention}
            onRetry={refresh}
          />

          <OverviewCards
            overview={data?.overview ?? null}
            scope={scope}
            error={errors.overview}
            onRetry={refresh}
          />

          <TrendChart
            trend={data?.trend ?? null}
            error={errors.trend}
            onRetry={refresh}
          />

          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <SourceBreakdown
              incomeBySource={data?.incomeBySource ?? null}
              memberCapitalReceived={data?.memberCapitalReceived ?? null}
              sourceError={errors.incomeBySource}
              capitalError={errors.memberCapitalReceived}
              onRetry={refresh}
            />
            <ExpenseBreakdown
              expenseByCategory={data?.expenseByCategory ?? null}
              previousLabel={scope?.previousLabel ?? "Previous period"}
              error={errors.expenseByCategory}
              onRetry={refresh}
            />
          </div>

          <MemberCapitalBand
            member={data?.member ?? null}
            memberCapitalReceived={data?.memberCapitalReceived ?? null}
            periodLabel={scope?.label ?? "Selected period"}
            error={errors.member}
            onRetry={refresh}
          />

          <RecentActivityTable
            recent={data?.recent ?? null}
            periodLabel={scope?.label ?? "Selected period"}
            error={errors.recent}
            onRetry={refresh}
          />
        </>
      )}
    </div>
  );
}
