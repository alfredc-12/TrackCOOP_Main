"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  Download,
  Eye,
  FileText,
  Filter,
  Gauge,
  Printer,
  RefreshCcw,
  RotateCw,
  Search,
  TriangleAlert,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
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
  getMemberIndicatorHistory,
  getMemberIndicatorSummary,
  listMemberIndicators,
  recalculateMemberIndicators,
  type MemberIndicator,
  type MemberIndicatorBasisSummary,
  type MemberIndicatorListQuery,
  type MemberIndicatorStatus,
  type MemberIndicatorSummary,
} from "@/features/chairman/people-api";

const emptySummary: MemberIndicatorSummary = {
  totalTracked: 0,
  active: 0,
  needsMonitoring: 0,
  inactive: 0,
  averageScore: 0,
  distribution: [
    { statusLabel: "Active", total: 0, percentage: 0 },
    { statusLabel: "Needs Monitoring", total: 0, percentage: 0 },
    { statusLabel: "Inactive", total: 0, percentage: 0 },
  ],
};

const statusOptions: Array<MemberIndicatorStatus | "All"> = [
  "All",
  "Active",
  "Needs Monitoring",
  "Inactive",
];
const sortOptions: Array<NonNullable<MemberIndicatorListQuery["sortBy"]>> = [
  "computedAt",
  "totalScore",
  "recencyScore",
  "frequencyScore",
  "contributionScore",
  "fullName",
];

function indicatorTone(status: MemberIndicator["statusLabel"]) {
  if (status === "Active") return "success";
  if (status === "Inactive") return "danger";
  return "warning";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not set";
}

function basisForMonths(months: number) {
  const end = new Date();
  const start = new Date(end.getTime());
  start.setMonth(start.getMonth() - months);
  return {
    basisPeriodStart: start.toISOString().slice(0, 10),
    basisPeriodEnd: end.toISOString().slice(0, 10),
  };
}

function parseBasisSummary(value: string | null): MemberIndicatorBasisSummary | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<MemberIndicatorBasisSummary>;
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.rawMetrics &&
      parsed.scoring &&
      parsed.basisPeriod
    ) {
      return parsed as MemberIndicatorBasisSummary;
    }
  } catch {
    return null;
  }
  return null;
}

function scoreLabel(sortBy: NonNullable<MemberIndicatorListQuery["sortBy"]>) {
  const labels: Record<NonNullable<MemberIndicatorListQuery["sortBy"]>, string> = {
    computedAt: "Computed date",
    totalScore: "Total score",
    recencyScore: "Recency score",
    frequencyScore: "Frequency score",
    contributionScore: "Contribution score",
    fullName: "Member name",
  };
  return labels[sortBy];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function MemberIndicatorsClient() {
  const [indicators, setIndicators] = useState<MemberIndicator[]>([]);
  const [summary, setSummary] = useState<MemberIndicatorSummary>(emptySummary);
  const [history, setHistory] = useState<MemberIndicator[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<MemberIndicator | null>(null);
  const [search, setSearch] = useState("");
  const [statusLabel, setStatusLabel] = useState<MemberIndicatorStatus | "All">("All");
  const [sortBy, setSortBy] = useState<NonNullable<MemberIndicatorListQuery["sortBy"]>>("computedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [basisMonths, setBasisMonths] = useState(12);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState("");

  const loadIndicators = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextIndicators, nextSummary] = await Promise.all([
        listMemberIndicators({
          page,
          pageSize,
          search,
          statusLabel,
          sortBy,
          sortDirection,
        }),
        getMemberIndicatorSummary(),
      ]);
      setIndicators(nextIndicators.indicators);
      setTotal(nextIndicators.total);
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
  }, [page, pageSize, search, sortBy, sortDirection, statusLabel]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadIndicators();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadIndicators]);

  async function handleRecalculate(memberId?: string) {
    setIsRecalculating(true);
    try {
      const result = await recalculateMemberIndicators({
        memberId,
        ...basisForMonths(basisMonths),
      });
      toast.success(`Recalculated ${result.recalculated} member indicator(s).`);
      await loadIndicators();
      if (selectedIndicator?.memberId) {
        setHistory(await getMemberIndicatorHistory(selectedIndicator.memberId));
      }
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

  async function openDetail(indicator: MemberIndicator) {
    setSelectedIndicator(indicator);
    setHistory([]);
    setIsHistoryLoading(true);
    try {
      setHistory(await getMemberIndicatorHistory(indicator.memberId));
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError
          ? caught.message
          : "Indicator history could not be loaded.",
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }

  function exportCsv() {
    const rows = indicators.map((indicator) => {
      const basis = parseBasisSummary(indicator.basisSummary);
      return [
        indicator.memberCode,
        indicator.fullName,
        indicator.statusLabel,
        basis?.rawMetrics.recencyDays ?? "",
        basis?.rawMetrics.frequencyCount ?? 0,
        basis?.rawMetrics.contributionAmount ?? 0,
        indicator.recencyScore,
        indicator.frequencyScore,
        indicator.contributionScore,
        indicator.totalScore,
        formatDate(indicator.computedAt),
      ];
    });
    const csv = [
      [
        "Member Code",
        "Full Name",
        "Label",
        "Recency Days",
        "Frequency",
        "Contribution",
        "Recency Score",
        "Frequency Score",
        "Contribution Score",
        "Total Score",
        "Computed",
      ],
      ...rows,
    ]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "member-indicators.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="People"
        title="Member Indicators"
        description="Decision-support signals from real member transactions and cooperative activity."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadIndicators()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-black text-[#123D2A] shadow-[0_10px_22px_rgba(18,61,42,0.06)] transition hover:bg-[#EEF2EC]"
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-black text-[#123D2A] shadow-[0_10px_22px_rgba(18,61,42,0.06)] transition hover:bg-[#EEF2EC]"
            >
              <Printer className="size-4" aria-hidden="true" />
              Print
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-black text-[#123D2A] shadow-[0_10px_22px_rgba(18,61,42,0.06)] transition hover:bg-[#EEF2EC]"
            >
              <Download className="size-4" aria-hidden="true" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => void handleRecalculate()}
              disabled={isRecalculating}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(18,61,42,0.18)] transition hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCw
                className={isRecalculating ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              Recalculate All
            </button>
          </>
        }
      />

      <div className="flex items-start gap-3 rounded-lg border border-[#F0D48A] bg-[#FFF8E7] p-4 text-sm font-semibold leading-6 text-[#765000] shadow-[0_10px_24px_rgba(138,98,0,0.06)]">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>Member indicators are descriptive decision-support signals and do not automatically change official membership status.</span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
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

      <section className="rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.06)]">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="size-4 text-[#123D2A]" aria-hidden="true" />
          <h2 className="text-base font-black text-[#123D2A]">Filters</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_13rem_13rem_12rem] lg:items-end">
          <label className="relative block">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-white pl-10 pr-4 text-sm font-semibold text-[#123D2A] outline-none transition placeholder:text-[#7B8D82] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10"
              placeholder="Search indicators"
              type="search"
            />
          </label>
          <Select
            label="Basis"
            value={String(basisMonths)}
            onChange={(value) => setBasisMonths(Number(value))}
            options={[
              ["3", "Previous 3 months"],
              ["6", "Previous 6 months"],
              ["12", "Previous 12 months"],
              ["24", "Previous 24 months"],
            ]}
          />
          <Select
            label="Label"
            value={statusLabel}
            onChange={(value) => {
              setStatusLabel(value as MemberIndicatorStatus | "All");
              setPage(1);
            }}
            options={statusOptions.map((status) => [status, status])}
          />
          <Select
            label="Sort"
            value={sortBy}
            onChange={(value) => setSortBy(value as NonNullable<MemberIndicatorListQuery["sortBy"]>)}
            options={sortOptions.map((option) => [option, scoreLabel(option)])}
          />
          <Select
            label="Order"
            value={sortDirection}
            onChange={(value) => setSortDirection(value as "asc" | "desc")}
            options={[
              ["desc", "Descending"],
              ["asc", "Ascending"],
            ]}
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-black text-[#123D2A]">
            Indicator Distribution
          </h2>
          <StatusBadge tone="neutral">{total} records</StatusBadge>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {summary.distribution.map((item) => (
            <div key={item.statusLabel} className="rounded-md border border-[#CAD8CB] bg-[#FBFCF8] p-4">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge tone={indicatorTone(item.statusLabel)}>
                  {item.statusLabel}
                </StatusBadge>
                <span className="text-xl font-black text-[#123D2A]">{item.total}</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#DDE8D8]">
                <div
                  className="h-full rounded-full bg-[#1F6B43]"
                  style={{ width: `${Math.min(100, item.percentage)}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[#6C7A70]">{item.percentage}%</p>
            </div>
          ))}
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? (
        <LoadingSkeleton />
      ) : indicators.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="No member indicators found"
          description="Run recalculation after members are present to create the first set of transaction-based indicators."
        />
      ) : (
        <DataTable>
          <table className="min-w-[68rem] divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs font-black uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr>
                <th className="px-5 py-4">Member</th>
                <th className="px-5 py-4">Indicator</th>
                <th className="px-5 py-4">Activity Metrics</th>
                <th className="px-5 py-4">Score Breakdown</th>
                <th className="px-5 py-4">Total Score</th>
                <th className="px-5 py-4">Basis Period</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {indicators.map((indicator) => {
                const basis = parseBasisSummary(indicator.basisSummary);
                return (
                  <tr key={indicator.id} className="bg-white transition hover:bg-[#F7F8F3]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#DDF4E4] text-sm font-black text-[#123D2A]">
                          {initials(indicator.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-black text-[#123D2A]">{indicator.fullName}</p>
                          <p className="mt-1 text-xs font-semibold text-[#6C7A70]">{indicator.memberCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={indicatorTone(indicator.statusLabel)}>
                        {indicator.statusLabel}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold leading-5 tabular-nums text-[#365F4A]">
                      <p><span className="font-black text-[#123D2A]">Recency:</span> {basis?.rawMetrics.recencyDays ?? "No activity"} days</p>
                      <p><span className="font-black text-[#123D2A]">Frequency:</span> {basis?.rawMetrics.frequencyCount ?? 0}</p>
                      <p><span className="font-black text-[#123D2A]">Contribution:</span> {formatCurrency(basis?.rawMetrics.contributionAmount ?? 0)}</p>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold leading-5 tabular-nums text-[#365F4A]">
                      {indicator.recencyScore} / {indicator.frequencyScore} /{" "}
                      {indicator.contributionScore}
                    </td>
                    <td className="px-5 py-4">
                      <span className="grid size-11 place-items-center rounded-md bg-[#EEF8EF] text-lg font-black text-[#123D2A]">
                        {indicator.totalScore}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold leading-5 text-[#365F4A]">
                      <p>{formatDate(indicator.basisPeriodStart)}</p>
                      <p>{formatDate(indicator.basisPeriodEnd)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void openDetail(indicator)}
                          className="inline-flex h-9 items-center gap-2 rounded-md bg-[#123D2A] px-3 text-xs font-black text-white shadow-[0_8px_16px_rgba(18,61,42,0.18)] transition hover:bg-[#1F6B43]"
                        >
                          <Eye className="size-4" aria-hidden="true" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRecalculate(indicator.memberId)}
                          disabled={isRecalculating}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-3 text-xs font-black text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RotateCw className="size-4" aria-hidden="true" />
                          Recalculate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTable>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(18,61,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-black text-[#365F4A]">
          Showing {start}-{end} of {total} indicators
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="flex size-10 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#123D2A] shadow-[0_6px_14px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC] disabled:text-[#AAB6AE] disabled:opacity-60"
            onClick={() => setPage(1)}
            aria-label="First page"
          >
            <ChevronsLeft className="size-4" />
          </button>
          <button
            type="button"
            disabled={page <= 1}
            className="flex size-10 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#123D2A] shadow-[0_6px_14px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC] disabled:text-[#AAB6AE] disabled:opacity-60"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="grid size-10 place-items-center rounded-md bg-[#123D2A] text-sm font-black text-white shadow-[0_8px_16px_rgba(18,61,42,0.18)]">
            {page}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            className="flex size-10 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#123D2A] shadow-[0_6px_14px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC] disabled:text-[#AAB6AE] disabled:opacity-60"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            className="flex size-10 items-center justify-center rounded-md border border-[#CAD8CB] bg-white p-0 text-[#123D2A] shadow-[0_6px_14px_rgba(18,61,42,0.06)] hover:bg-[#EEF2EC] disabled:text-[#AAB6AE] disabled:opacity-60"
            onClick={() => setPage(totalPages)}
            aria-label="Last page"
          >
            <ChevronsRight className="size-4" />
          </button>
          <div className="w-44 shrink-0">
            <select
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-black text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10"
            >
              <option value="5">5 per page</option>
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
            </select>
          </div>
        </div>
      </div>

      <IndicatorDetailDialog
        indicator={selectedIndicator}
        history={history}
        loading={isHistoryLoading}
        onClose={() => setSelectedIndicator(null)}
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-[#5D6D63]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function IndicatorDetailDialog({
  indicator,
  history,
  loading,
  onClose,
}: {
  indicator: MemberIndicator | null;
  history: MemberIndicator[];
  loading: boolean;
  onClose: () => void;
}) {
  const basis = parseBasisSummary(indicator?.basisSummary ?? null);
  const [activePage, setActivePage] = useState<number>(1);

  useEffect(() => {
    if (indicator) setActivePage(1);
  }, [indicator]);

  return (
    <Dialog.Root open={Boolean(indicator)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#061B11]/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] max-h-[88vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_24px_70px_rgba(18,61,42,0.22)] focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#DDF4E4] text-sm font-black text-[#123D2A]">
                {indicator ? initials(indicator.fullName) : "MI"}
              </span>
              <div className="min-w-0">
                <Dialog.Title className="truncate text-xl font-black text-[#123D2A]">
                  {indicator?.fullName ?? "Indicator Detail"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm font-semibold text-[#5D6D63]">
                  {indicator?.memberCode}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC]">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {indicator ? (
            <div className="mt-5 grid gap-4 border-t border-[#CAD8CB] pt-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {["Overview", "Sources", "History"].map((label, index) => {
                  const pageNumber = index + 1;
                  const active = activePage === pageNumber;

                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setActivePage(pageNumber)}
                      className={`flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-xs font-black transition ${
                        active
                          ? "border-[#1F6B43] bg-[#EEF8EF] text-[#123D2A]"
                          : "border-[#CAD8CB] bg-white text-[#5D6D63] hover:bg-[#EEF2EC]"
                      }`}
                    >
                      <span
                        className={`grid size-6 place-items-center rounded-full border text-[0.68rem] ${
                          active ? "border-[#123D2A] bg-[#123D2A] text-white" : "border-[#CAD8CB] bg-white"
                        }`}
                      >
                        {pageNumber}
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>

              {activePage === 1 && (
                <>
                  <section className="rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.04)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge tone={indicatorTone(indicator.statusLabel)}>
                    {indicator.statusLabel}
                  </StatusBadge>
                  <span className="grid size-12 place-items-center rounded-md bg-[#EEF8EF] text-2xl font-black text-[#123D2A]">
                    {indicator.totalScore}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric label="Recency" value={String(indicator.recencyScore)} />
                  <Metric label="Frequency" value={String(indicator.frequencyScore)} />
                  <Metric label="Contribution" value={String(indicator.contributionScore)} />
                </div>
              </section>

              <section className="rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.04)]">
                <h3 className="text-base font-black text-[#123D2A]">
                  Calculation Basis
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Metric label="Basis Start" value={formatDate(indicator.basisPeriodStart)} />
                  <Metric label="Basis End" value={formatDate(indicator.basisPeriodEnd)} />
                  <Metric label="Recency Days" value={basis?.rawMetrics.recencyDays === null ? "No activity" : String(basis?.rawMetrics.recencyDays ?? 0)} />
                  <Metric label="Frequency Count" value={String(basis?.rawMetrics.frequencyCount ?? 0)} />
                  <Metric label="Contribution" value={formatCurrency(basis?.rawMetrics.contributionAmount ?? 0)} />
                  <Metric label="Scoring Method" value={basis?.scoring.method ?? "Not recorded"} />
                </div>
                <p className="mt-4 rounded-md border border-[#E2E8E2] bg-[#FBFCF8] p-3 text-sm leading-6 text-[#5D6D63]">
                  {basis?.scoring.explanation ?? "No calculation explanation was recorded."}
                </p>
              </section>
              </>
              )}

              {activePage === 2 && (
              <section className="rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.04)]">
                <h3 className="text-base font-black text-[#123D2A]">
                  Included Sources
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Metric label="Share Capital" value={String(basis?.rawMetrics.sourceCounts.shareCapitalPayments ?? 0)} />
                  <Metric label="POS Sales" value={String(basis?.rawMetrics.sourceCounts.posSales ?? 0)} />
                  <Metric label="Rental Bookings" value={String(basis?.rawMetrics.sourceCounts.rentalBookings ?? 0)} />
                  <Metric label="Payment References" value={String(basis?.rawMetrics.sourceCounts.paymentReferences ?? 0)} />
                  <Metric label="Financial Records" value={String(basis?.rawMetrics.sourceCounts.financialRecords ?? 0)} />
                </div>
              </section>
              )}

              {activePage === 3 && (
              <section className="rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.04)]">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-[#1F6B43]" aria-hidden="true" />
                  <h3 className="text-base font-black text-[#123D2A]">
                    History
                  </h3>
                </div>
                {loading ? (
                  <p className="mt-4 text-sm text-[#5D6D63]">Loading history...</p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {history.map((entry) => (
                      <div key={entry.id} className="rounded-md border border-[#CAD8CB] bg-[#FBFCF8] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <StatusBadge tone={indicatorTone(entry.statusLabel)}>
                            {entry.statusLabel}
                          </StatusBadge>
                          <span className="text-xs font-semibold text-[#6C7A70]">
                            {formatDate(entry.computedAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-black text-[#123D2A]">
                          Total {entry.totalScore} ({entry.recencyScore} / {entry.frequencyScore} / {entry.contributionScore})
                        </p>
                      </div>
                    ))}
                    {history.length === 0 ? (
                      <p className="text-sm text-[#5D6D63]">No historical records found.</p>
                    ) : null}
                  </div>
                )}
              </section>
              )}

              <div className="mt-1 flex items-center justify-between border-t border-[#CAD8CB] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (activePage === 1) onClose();
                    else setActivePage((p) => Math.max(1, p - 1));
                  }}
                  className="h-10 rounded-md border border-[#CAD8CB] bg-white px-5 text-sm font-black text-[#123D2A] shadow-[0_8px_18px_rgba(18,61,42,0.06)] transition hover:bg-[#EEF2EC]"
                >
                  {activePage === 1 ? "Cancel" : "Previous"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activePage === 3) onClose();
                    else setActivePage((p) => Math.min(3, p + 1));
                  }}
                  className="h-10 rounded-md bg-[#123D2A] px-6 text-sm font-black text-white shadow-[0_12px_24px_rgba(18,61,42,0.18)] transition hover:bg-[#1F6B43]"
                >
                  {activePage === 3 ? "Close" : "Next"}
                </button>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#F7F8F3] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6C7A70]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#123D2A]">{value}</p>
    </div>
  );
}
