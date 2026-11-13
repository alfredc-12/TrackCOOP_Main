"use client";

import Link from "next/link";
import { CalendarRange, FileSpreadsheet, FileText, RefreshCcw, WalletCards } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/portal/PageHeader";
import { DatePicker } from "@/components/ui/DatePicker";
import { StyledSelect } from "@/components/ui/StyledSelect";
import type { BookkeeperDashboard, DashboardPeriodKey, DashboardQueryInput } from "./dashboard-api";
import { formatManilaDateRange, formatManilaTimestamp } from "./dashboard-format";

const PERIOD_OPTIONS: Array<{ key: DashboardPeriodKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom Date Range" },
];

const PERIOD_LABELS = PERIOD_OPTIONS.map((option) => option.label);
const KEY_BY_LABEL = new Map(PERIOD_OPTIONS.map((option) => [option.label, option.key]));
const LABEL_BY_KEY = new Map(PERIOD_OPTIONS.map((option) => [option.key, option.label]));

const REPORT_SHORTCUTS = [
  { href: "/portal/bookkeeper/reports", label: "Generate financial reports", icon: FileSpreadsheet },
  { href: "/portal/bookkeeper/operating-expenses", label: "Operating expenses", icon: FileText },
  { href: "/portal/bookkeeper/financial-ledger", label: "Financial ledger", icon: WalletCards },
] as const;

function currentManilaDate(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}

type PeriodFilterProps = {
  query: DashboardQueryInput;
  scope: BookkeeperDashboard["scope"] | null;
  generatedAt: string | null;
  loading: boolean;
  onChange: (next: DashboardQueryInput) => void;
  onRefresh: () => void;
};

export function PeriodFilter({
  query,
  scope,
  generatedAt,
  loading,
  onChange,
  onRefresh,
}: PeriodFilterProps) {
  const [fallbackToday] = useState(currentManilaDate);
  const today = scope?.today ?? fallbackToday;
  const [draftStart, setDraftStart] = useState(query.start ?? scope?.start ?? `${today.slice(0, 7)}-01`);
  const [draftEnd, setDraftEnd] = useState(query.end ?? scope?.end ?? today);
  const [customError, setCustomError] = useState("");

  const selectPeriod = (nextKey: DashboardPeriodKey) => {
    setCustomError("");
    if (nextKey === "custom") {
      const start = draftStart || scope?.start || `${today.slice(0, 7)}-01`;
      const end = draftEnd || scope?.end || today;
      setDraftStart(start);
      setDraftEnd(end);
      onChange({ period: "custom", start, end });
      return;
    }
    onChange({ period: nextKey });
  };

  const applyCustomRange = () => {
    if (!draftStart || !draftEnd) {
      setCustomError("Choose both start and end dates.");
      return;
    }
    if (draftStart > draftEnd) {
      setCustomError("Start date must be on or before the end date.");
      return;
    }
    if (draftEnd > today) {
      setCustomError("Future reporting dates are unavailable.");
      return;
    }
    setCustomError("");
    onChange({ period: "custom", start: draftStart, end: draftEnd });
  };

  const selectedLabel = LABEL_BY_KEY.get(query.period) ?? "This Month";

  return (
    <section aria-label="Dashboard header and reporting filters" className="grid min-w-0 gap-4">
      <PageHeader
        title="Financial Dashboard"
        description="Monitor cooperative income, expenses, payment activity, and financial performance."
      />

      <nav
        aria-label="Financial dashboard shortcuts"
        className="grid w-full min-w-0 gap-2.5 sm:grid-cols-2 xl:flex xl:flex-nowrap xl:items-center xl:justify-end"
      >
        {REPORT_SHORTCUTS.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] px-3.5 text-xs font-bold text-[#123D2A] transition hover:border-[#1F6B43] hover:bg-[#EEF6EC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43] xl:w-auto"
            >
              <Icon className="size-4 text-[#1F6B43]" aria-hidden="true" />
              <span>{shortcut.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#1F6B43] bg-[#123D2A] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43] disabled:cursor-wait disabled:opacity-60 xl:w-auto"
        >
          <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          <span>{loading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </nav>

      <div className="rounded-xl border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick reporting period">
            <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5D6D63]">
              <CalendarRange className="size-4 text-[#1F6B43]" aria-hidden="true" />
              Period
            </span>
            {PERIOD_OPTIONS.map((option) => {
              const active = query.period === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectPeriod(option.key)}
                  className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43] ${
                    active
                      ? "border-[#123D2A] bg-[#123D2A] text-white"
                      : "border-[#CAD8CB] bg-[#F7F8F3] text-[#123D2A] hover:border-[#1F6B43] hover:bg-[#EEF6EC]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="w-full sm:w-64 lg:w-60">
            <StyledSelect
              aria-label="Reporting period selector"
              prefix="Reporting period"
              value={selectedLabel}
              options={PERIOD_LABELS}
              onChange={(label) => {
                const key = KEY_BY_LABEL.get(label);
                if (key) selectPeriod(key);
              }}
            />
          </div>
        </div>

        {query.period === "custom" ? (
          <div className="mt-3 grid gap-3 border-t border-[#E2E8E2] pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <DatePicker
              label="Start date (Asia/Manila)"
              value={draftStart}
              max={today}
              onChange={setDraftStart}
            />
            <DatePicker
              label="End date (Asia/Manila)"
              value={draftEnd}
              min={draftStart || undefined}
              max={today}
              onChange={setDraftEnd}
            />
            <button
              type="button"
              onClick={applyCustomRange}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#1F6B43] px-4 text-sm font-bold text-white transition hover:bg-[#123D2A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]"
            >
              Apply range
            </button>
            {customError ? (
              <p role="alert" className="text-xs font-semibold text-[#9A392A] sm:col-span-3">
                {customError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2EC] pt-3 text-xs text-[#5D6D63]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              <strong className="font-bold text-[#123D2A]">Selected period:</strong>{" "}
              {scope ? `${formatManilaDateRange(scope.start, scope.end)} (${scope.timezone})` : "Loading period..."}
            </span>
            {scope ? (
              <span>
                <strong className="font-bold text-[#123D2A]">Comparison:</strong>{" "}
                {scope.previousLabel} ({formatManilaDateRange(scope.previousStart, scope.previousEnd)})
              </span>
            ) : null}
          </div>
          <span>
            <strong className="font-bold text-[#123D2A]">Last updated:</strong>{" "}
            {formatManilaTimestamp(generatedAt)}
          </span>
        </div>
      </div>
    </section>
  );
}
