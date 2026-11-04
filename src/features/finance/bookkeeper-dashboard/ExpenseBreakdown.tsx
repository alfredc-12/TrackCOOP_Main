"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ReceiptText } from "lucide-react";
import { ErrorState, StatusBadge } from "@/components/portal/PortalPrimitives";
import type { BookkeeperDashboard } from "./dashboard-api";
import {
  formatPercent,
  formatPeso,
  formatSignedPercent,
  parseCentavos,
} from "./dashboard-format";
import { InfoButton } from "./InfoButton";

type ExpenseBreakdownProps = {
  expenseByCategory: BookkeeperDashboard["expenseByCategory"];
  previousLabel: string;
  error?: string;
  onRetry: () => void;
};

export function ExpenseBreakdown({
  expenseByCategory,
  previousLabel,
  error,
  onRetry,
}: ExpenseBreakdownProps) {
  if (error) {
    return (
      <section aria-label="Where our money goes">
        <ErrorState message={error} onRetry={onRetry} />
      </section>
    );
  }

  if (!expenseByCategory) {
    return (
      <section aria-label="Where our money goes" className="h-96 animate-pulse rounded-xl bg-[#E7F2E4]" />
    );
  }

  const items = expenseByCategory.items;
  const totalCents = parseCentavos(expenseByCategory.total);
  const maxCents = Math.max(...items.map((item) => parseCentavos(item.amount)), 1);
  const highest = items[0] ?? null;

  return (
    <section
      aria-labelledby="expenses-heading"
      className="flex min-w-0 flex-col justify-between rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="expenses-heading" className="text-base font-black text-[#123D2A]">
                Where Our Money Goes
              </h2>
              <InfoButton label="Where Our Money Goes">
                Ranked operating expense categories for the selected period. Expense Category Share (%) = Category Expenses ÷ Total Operating Expenses × 100. Excludes share-capital refunds, dividend payouts, patronage payouts, and unposted drafts.
              </InfoButton>
            </div>
            <p className="mt-0.5 text-xs text-[#5D6D63]">
              Posted operating expenses ranked from highest to lowest, with {previousLabel.toLowerCase()} comparison.
            </p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#FFF4D7] text-[#8A6200]">
            <ReceiptText className="size-4" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between border-b border-[#EEF2EC] pb-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-[#5D6D63]">
            Operating Expense Categories
          </span>
          <span className="font-black tabular-nums text-[#123D2A]">
            Total: {formatPeso(expenseByCategory.total)}
          </span>
        </div>

        {items.length === 0 || totalCents === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-[#CAD8CB] bg-[#F7F8F3] p-6 text-center">
            <p className="text-sm font-bold text-[#123D2A]">
              No posted operating expenses in this period
            </p>
            <p className="mt-1 text-xs text-[#5D6D63]">
              Record fuel, electricity, salaries, repairs, office supplies, insurance, or other cooperative costs in Operating Expenses.
            </p>
            <Link
              href="/portal/bookkeeper/operating-expenses"
              className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#123D2A] px-3.5 text-xs font-bold text-white hover:bg-[#1F6B43]"
            >
              Open Operating Expenses
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <ol className="mt-3 grid gap-2.5">
            {items.map((item, index) => {
              const cents = parseCentavos(item.amount);
              const widthPercent = Math.max((cents / maxCents) * 100, cents > 0 ? 2 : 0);
              const isHighest = index === 0 && cents > 0;
              const increased = item.change.direction === "up";
              const decreased = item.change.direction === "down";

              return (
                <li
                  key={item.id}
                  className={`rounded-lg border p-3 ${
                    isHighest
                      ? "border-[#E6C97A] bg-[#FFFDF6]"
                      : "border-[#E2E8E2] bg-[#FAFBF8]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#123D2A]">{item.name}</span>
                      {isHighest ? (
                        <StatusBadge tone="warning">Highest expense</StatusBadge>
                      ) : null}
                    </div>
                    <span className="font-black tabular-nums text-[#123D2A]">
                      {formatPeso(item.amount)}
                    </span>
                  </div>

                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E9F0E9]" aria-hidden="true">
                    <div
                      className={`h-full rounded-full ${
                        isHighest ? "bg-[#D8A011]" : "bg-[#1F6B43]"
                      }`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5D6D63]">
                    <span>
                      Share:{" "}
                      <strong className="font-bold text-[#294B39]">
                        {formatPercent(item.sharePercent)}
                      </strong>{" "}
                      · {item.count.toLocaleString("en-PH")}{" "}
                      {item.count === 1 ? "record" : "records"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span>{previousLabel}: {formatPeso(item.previousAmount)}</span>
                      {item.change.available && item.change.percent !== null ? (
                        <strong
                          className={`inline-flex items-center font-bold ${
                            increased
                              ? "text-[#9A392A]"
                              : decreased
                                ? "text-[#1F6B43]"
                                : "text-[#5D6D63]"
                          }`}
                        >
                          {increased ? (
                            <ArrowUpRight className="size-3" aria-hidden="true" />
                          ) : decreased ? (
                            <ArrowDownRight className="size-3" aria-hidden="true" />
                          ) : null}
                          ({formatSignedPercent(item.change.percent)})
                        </strong>
                      ) : (
                        <span className="text-[#5D6D63]">(Prior period ₱0.00)</span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#CAD8CB] bg-[#F7F8F3] p-3.5 text-xs text-[#294B39]">
        <span>
          {highest && totalCents > 0 ? (
            <>
              Largest driver:{" "}
              <strong className="font-black text-[#123D2A]">{highest.name}</strong> (
              {formatPercent(highest.sharePercent)} of operating expenses).
            </>
          ) : (
            "Review or record cooperative operating expenses."
          )}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/portal/bookkeeper/operating-expenses"
            className="inline-flex items-center gap-1 font-bold text-[#1F6B43] hover:text-[#123D2A]"
          >
            Operating Expenses
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
          <Link
            href="/portal/bookkeeper/financial-categories"
            className="inline-flex items-center gap-1 font-bold text-[#1F6B43] hover:text-[#123D2A]"
          >
            Categories
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

