"use client";

import { Activity, Gauge, RefreshCcw, RotateCw, Search, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  getMemberIndicatorSummary,
  listMemberIndicators,
  recalculateMemberIndicators,
  type MemberIndicator,
  type MemberIndicatorSummary,
} from "@/features/chairman/people-api";

const emptySummary: MemberIndicatorSummary = {
  totalTracked: 0,
  active: 0,
  needsMonitoring: 0,
  inactive: 0,
  averageScore: 0,
};

function indicatorTone(status: MemberIndicator["statusLabel"]) {
  if (status === "Active") return "success";
  if (status === "Inactive") return "danger";
  return "warning";
}

export function MemberIndicatorsClient() {
  const [indicators, setIndicators] = useState<MemberIndicator[]>([]);
  const [summary, setSummary] = useState<MemberIndicatorSummary>(emptySummary);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState("");

  const loadIndicators = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextIndicators, nextSummary] = await Promise.all([
        listMemberIndicators(search),
        getMemberIndicatorSummary(),
      ]);
      setIndicators(nextIndicators);
      setSummary(nextSummary);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Member indicators could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadIndicators();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadIndicators]);

  async function handleRecalculate() {
    setIsRecalculating(true);
    try {
      const result = await recalculateMemberIndicators();
      toast.success(`Recalculated ${result.recalculated} member indicator(s).`);
      await loadIndicators();
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError
          ? caught.message
          : "Indicators could not be recalculated.",
      );
    } finally {
      setIsRecalculating(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="People"
        title="Member Indicators"
        description="Decision-support signals for member activity and follow-up. These do not automatically change official member status."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadIndicators()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleRecalculate()}
              disabled={isRecalculating}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCw
                className={isRecalculating ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              Recalculate
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tracked" value={String(summary.totalTracked)} icon={Gauge} />
        <StatCard label="Active" value={String(summary.active)} icon={Activity} />
        <StatCard
          label="Needs Monitoring"
          value={String(summary.needsMonitoring)}
          icon={TriangleAlert}
        />
        <StatCard
          label="Average Score"
          value={summary.averageScore.toFixed(1)}
          icon={Gauge}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full max-w-md">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
            placeholder="Search indicators"
            type="search"
          />
        </label>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7A70]">
          {indicators.length} shown
        </p>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? (
        <LoadingSkeleton />
      ) : indicators.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="No member indicators found"
          description="Run recalculation after members are present to create the first set of decision-support indicators."
        />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr>
                <th className="px-5 py-4">Member</th>
                <th className="px-5 py-4">Label</th>
                <th className="px-5 py-4">Scores</th>
                <th className="px-5 py-4">Total</th>
                <th className="px-5 py-4">Computed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {indicators.map((indicator) => (
                <tr key={indicator.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4">
                    <p className="font-bold text-[#123D2A]">{indicator.fullName}</p>
                    <p className="mt-1 text-xs text-[#6C7A70]">{indicator.memberCode}</p>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={indicatorTone(indicator.statusLabel)}>
                      {indicator.statusLabel}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 tabular-nums">
                    {indicator.recencyScore} / {indicator.frequencyScore} /{" "}
                    {indicator.contributionScore}
                  </td>
                  <td className="px-5 py-4 font-black text-[#123D2A]">
                    {indicator.totalScore}
                  </td>
                  <td className="px-5 py-4">
                    {new Date(indicator.computedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  );
}
