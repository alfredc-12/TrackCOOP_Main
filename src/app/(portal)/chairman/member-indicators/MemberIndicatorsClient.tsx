"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  Download,
  Eye,
  FileText,
  Gauge,
  Printer,
  RefreshCcw,
  RotateCw,
  Search,
  TriangleAlert,
  X,
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
  const [pageSize] = useState(20);
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

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="People"
        title="Member Indicators"
        description="Decision-support signals from real member transactions and cooperative activity."
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
              onClick={() => window.print()}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
            >
              <Printer className="size-4" aria-hidden="true" />
              Print
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
            >
              <Download className="size-4" aria-hidden="true" />
              CSV
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
              Recalculate All
            </button>
          </>
        }
      />

      <div className="rounded-lg border border-[#F0D48A] bg-[#FFF8E7] p-4 text-sm font-semibold text-[#765000]">
        Member indicators are descriptive decision-support signals and do not automatically change official membership status.
      </div>

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

      <section className="rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.06)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto_auto_auto_auto] lg:items-center">
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
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
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

      <section className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#123D2A]">
            Status Distribution
          </h2>
          <span className="text-xs font-semibold text-[#6C7A70]">{total} latest records</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {summary.distribution.map((item) => (
            <div key={item.statusLabel} className="rounded-md border border-[#E2E8E2] p-4">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge tone={indicatorTone(item.statusLabel)}>
                  {item.statusLabel}
                </StatusBadge>
                <span className="text-sm font-black text-[#123D2A]">{item.total}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEF2EC]">
                <div
                  className="h-full rounded-full bg-[#1F6B43]"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-[#6C7A70]">{item.percentage}%</p>
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
          <table className="min-w-[72rem] divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr>
                <th className="px-5 py-4">Member</th>
                <th className="px-5 py-4">Label</th>
                <th className="px-5 py-4">Raw Metrics</th>
                <th className="px-5 py-4">Scores</th>
                <th className="px-5 py-4">Total</th>
                <th className="px-5 py-4">Basis</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {indicators.map((indicator) => {
                const basis = parseBasisSummary(indicator.basisSummary);
                return (
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
                    <td className="px-5 py-4 text-xs tabular-nums">
                      <p>Recency: {basis?.rawMetrics.recencyDays ?? "No activity"} days</p>
                      <p>Frequency: {basis?.rawMetrics.frequencyCount ?? 0}</p>
                      <p>Contribution: {formatCurrency(basis?.rawMetrics.contributionAmount ?? 0)}</p>
                    </td>
                    <td className="px-5 py-4 tabular-nums">
                      {indicator.recencyScore} / {indicator.frequencyScore} /{" "}
                      {indicator.contributionScore}
                    </td>
                    <td className="px-5 py-4 font-black text-[#123D2A]">
                      {indicator.totalScore}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <p>{formatDate(indicator.basisPeriodStart)}</p>
                      <p>{formatDate(indicator.basisPeriodEnd)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void openDetail(indicator)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-3 text-xs font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
                        >
                          <Eye className="size-4" aria-hidden="true" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRecalculate(indicator.memberId)}
                          disabled={isRecalculating}
                          className="inline-flex h-9 items-center gap-2 rounded-md bg-[#123D2A] px-3 text-xs font-bold text-white transition hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:opacity-60"
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4">
        <p className="text-sm font-semibold text-[#5D6D63]">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="h-10 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="h-10 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
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
    <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-[#5D6D63]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
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

  return (
    <Dialog.Root open={Boolean(indicator)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#061B11]/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed right-0 top-0 z-[60] h-screen w-[min(42rem,100vw)] overflow-y-auto border-l border-[#CAD8CB] bg-white p-6 shadow-[0_24px_70px_rgba(18,61,42,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-black text-[#123D2A]">
                {indicator?.fullName ?? "Indicator Detail"}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-[#5D6D63]">
                {indicator?.memberCode}
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC]">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {indicator ? (
            <div className="mt-6 grid gap-5">
              <section className="rounded-lg border border-[#CAD8CB] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge tone={indicatorTone(indicator.statusLabel)}>
                    {indicator.statusLabel}
                  </StatusBadge>
                  <span className="text-2xl font-black text-[#123D2A]">
                    {indicator.totalScore}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric label="Recency" value={String(indicator.recencyScore)} />
                  <Metric label="Frequency" value={String(indicator.frequencyScore)} />
                  <Metric label="Contribution" value={String(indicator.contributionScore)} />
                </div>
              </section>

              <section className="rounded-lg border border-[#CAD8CB] p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#123D2A]">
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
                <p className="mt-4 text-sm leading-6 text-[#5D6D63]">
                  {basis?.scoring.explanation ?? "No calculation explanation was recorded."}
                </p>
              </section>

              <section className="rounded-lg border border-[#CAD8CB] p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#123D2A]">
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

              <section className="rounded-lg border border-[#CAD8CB] p-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-[#1F6B43]" aria-hidden="true" />
                  <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#123D2A]">
                    History
                  </h3>
                </div>
                {loading ? (
                  <p className="mt-4 text-sm text-[#5D6D63]">Loading history...</p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {history.map((entry) => (
                      <div key={entry.id} className="rounded-md border border-[#E2E8E2] p-3">
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
