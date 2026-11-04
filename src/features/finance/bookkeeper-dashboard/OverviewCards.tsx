"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Landmark,
  Minus,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { ErrorState, StatusBadge } from "@/components/portal/PortalPrimitives";
import type { BookkeeperDashboard, DashboardOverview } from "./dashboard-api";
import {
  describeSurplusChange,
  formatManilaDateRange,
  formatPeso,
  parseCentavos,
} from "./dashboard-format";
import { InfoButton } from "./InfoButton";

type OverviewCardsProps = {
  overview: DashboardOverview | null;
  scope: BookkeeperDashboard["scope"] | null;
  error?: string;
  onRetry: () => void;
};

export function OverviewCards({ overview, scope, error, onRetry }: OverviewCardsProps) {
  if (error) {
    return (
      <section aria-label="Main financial overview">
        <ErrorState message={error} onRetry={onRetry} />
      </section>
    );
  }

  if (!overview || !scope) {
    return (
      <section aria-label="Main financial overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-40 animate-pulse rounded-xl bg-[#E7F2E4]" />
        ))}
      </section>
    );
  }

  const netCents = parseCentavos(overview.net);
  const netTone = netCents > 0 ? "surplus" : netCents < 0 ? "deficit" : "breakeven";
  const changeSummary = describeSurplusChange(
    overview.change,
    overview.net,
    overview.previous.net,
    overview.previous.label,
  );

  const periodRangeText = formatManilaDateRange(scope.start, scope.end);

  return (
    <section aria-labelledby="overview-heading" className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="overview-heading" className="text-base font-black text-[#123D2A]">
            Operating Financial Overview
          </h2>
          <p className="text-xs text-[#5D6D63]">
            Posted, approved, active operating records for {scope.label.toLowerCase()} ({periodRangeText}). Share capital and adjustments are excluded from operating totals.
          </p>
        </div>
        <Link
          href="/portal/bookkeeper/financial-ledger"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#1F6B43] hover:text-[#123D2A]"
        >
          Open Financial Ledger
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Card A — Operating Income */}
        <article className="flex min-w-0 flex-col justify-between rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D63]">
                Operating Income
              </span>
              <div className="flex items-center gap-1">
                <InfoButton label="Operating Income">
                  Sum of posted, approved, active Income records during the selected period. Excludes member share-capital contributions, superseded/reversed records, duplicate postings, and PayMongo test-mode transactions.
                </InfoButton>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#EEF6EC] text-[#1F6B43]">
                  <Landmark className="size-4" aria-hidden="true" />
                </span>
              </div>
            </div>
            <p className="mt-2 text-3xl font-black tabular-nums text-[#123D2A]">
              {formatPeso(overview.income)}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#294B39]">
              {overview.incomeCount.toLocaleString("en-PH")} posted{" "}
              {overview.incomeCount === 1 ? "record" : "records"}
            </p>
          </div>
          <p className="mt-3 border-t border-[#EEF2EC] pt-2.5 text-xs text-[#5D6D63]">
            {overview.previous.label}:{" "}
            <strong className="font-bold tabular-nums text-[#123D2A]">
              {formatPeso(overview.previous.income)}
            </strong>
          </p>
        </article>

        {/* Card B — Operating Expenses */}
        <article className="flex min-w-0 flex-col justify-between rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D63]">
                Operating Expenses
              </span>
              <div className="flex items-center gap-1">
                <InfoButton label="Operating Expenses">
                  Sum of posted, approved, active Expense records during the selected period. Excludes share-capital refunds, dividend/patronage payouts, and unposted drafts.
                </InfoButton>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#FFF4D7] text-[#8A6200]">
                  <ReceiptText className="size-4" aria-hidden="true" />
                </span>
              </div>
            </div>
            <p className="mt-2 text-3xl font-black tabular-nums text-[#123D2A]">
              {formatPeso(overview.expenses)}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#294B39]">
              {overview.expenseCount.toLocaleString("en-PH")} posted{" "}
              {overview.expenseCount === 1 ? "record" : "records"}
            </p>
          </div>
          <p className="mt-3 border-t border-[#EEF2EC] pt-2.5 text-xs text-[#5D6D63]">
            {overview.previous.label}:{" "}
            <strong className="font-bold tabular-nums text-[#123D2A]">
              {formatPeso(overview.previous.expenses)}
            </strong>
          </p>
        </article>

        {/* Card C — Net Operating Surplus (visually dominant) */}
        <article
          className={`flex min-w-0 flex-col justify-between rounded-xl border-2 p-5 shadow-[0_12px_28px_rgba(18,61,42,0.08)] md:col-span-2 xl:col-span-1 ${
            netTone === "deficit"
              ? "border-[#D9826C] bg-[#FFF8F5]"
              : netTone === "surplus"
                ? "border-[#1F6B43] bg-[#F2FAF3]"
                : "border-[#CAD8CB] bg-[#F7F8F3]"
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#123D2A]">
                  Net Operating Surplus
                </span>
                <StatusBadge
                  tone={
                    netTone === "deficit"
                      ? "danger"
                      : netTone === "surplus"
                        ? "success"
                        : "neutral"
                  }
                >
                  {netTone === "deficit"
                    ? "Operating Deficit"
                    : netTone === "surplus"
                      ? "Operating Surplus"
                      : "Break-even"}
                </StatusBadge>
              </div>
              <div className="flex items-center gap-1">
                <InfoButton label="Net Operating Surplus">
                  Formula: Operating Income minus Operating Expenses. Adjustments and reversal entries are disclosed separately and are never netted into operating surplus. Not equivalent to cash on hand, bank balance, or distributable surplus.
                </InfoButton>
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                    netTone === "deficit"
                      ? "bg-[#FFE6E0] text-[#9A392A]"
                      : "bg-[#123D2A] text-[#D8A011]"
                  }`}
                >
                  <Banknote className="size-4" aria-hidden="true" />
                </span>
              </div>
            </div>
            <p
              className={`mt-2 text-3xl font-black tabular-nums ${
                netTone === "deficit" ? "text-[#9A392A]" : "text-[#123D2A]"
              }`}
            >
              {formatPeso(overview.net)}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-[#294B39]">
              Operating Income − Operating Expenses (not cash or bank balance)
            </p>
          </div>
          <p className="mt-3 border-t border-[#D9E5DA] pt-2.5 text-xs text-[#365F4A]">
            Adjustments (disclosed separately):{" "}
            <strong className="font-bold tabular-nums text-[#123D2A]">
              {formatPeso(overview.adjustments.total)}
            </strong>{" "}
            ({overview.adjustments.count}{" "}
            {overview.adjustments.count === 1 ? "entry" : "entries"}
            {overview.adjustments.reversalCount > 0
              ? `, incl. ${overview.adjustments.reversalCount} payment ${
                  overview.adjustments.reversalCount === 1 ? "reversal" : "reversals"
                }`
              : ""}
            )
          </p>
        </article>

        {/* Card D — Financial Performance Change */}
        <article className="flex min-w-0 flex-col justify-between rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5D6D63]">
                Surplus Performance Change
              </span>
              <div className="flex items-center gap-1">
                <InfoButton label="Surplus Performance Change">
                  Compares Net Operating Surplus against the equivalent preceding period using ((Current − Previous) / |Previous|) × 100. When the previous period is ₱0.00, percentage change is shown as Not available to avoid misleading figures.
                </InfoButton>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#EEF6EC] text-[#1F6B43]">
                  <TrendingUp className="size-4" aria-hidden="true" />
                </span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <p
                className={`text-3xl font-black tabular-nums ${
                  !changeSummary.available
                    ? "text-[#5D6D63]"
                    : changeSummary.tone === "positive"
                      ? "text-[#1F6B43]"
                      : changeSummary.tone === "negative"
                        ? "text-[#9A392A]"
                        : "text-[#123D2A]"
                }`}
              >
                {changeSummary.headline}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#294B39]">
                {changeSummary.tone === "positive" ? (
                  <ArrowUpRight className="size-4 text-[#1F6B43]" aria-hidden="true" />
                ) : changeSummary.tone === "negative" ? (
                  <ArrowDownRight className="size-4 text-[#9A392A]" aria-hidden="true" />
                ) : (
                  <Minus className="size-4 text-[#5D6D63]" aria-hidden="true" />
                )}
                {changeSummary.directionLabel}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-[#5D6D63]">{changeSummary.detail}</p>
          </div>
          <p className="mt-3 border-t border-[#EEF2EC] pt-2.5 text-xs text-[#5D6D63]">
            Compared window:{" "}
            <strong className="font-bold text-[#123D2A]">
              {formatManilaDateRange(overview.previous.start, overview.previous.end)}
            </strong>
          </p>
        </article>
      </div>
    </section>
  );
}

