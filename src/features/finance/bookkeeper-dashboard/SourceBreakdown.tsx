"use client";

import Link from "next/link";
import { ArrowRight, Landmark, ShieldCheck } from "lucide-react";
import { ErrorState } from "@/components/portal/PortalPrimitives";
import type { BookkeeperDashboard, SourceKey } from "./dashboard-api";
import { formatPercent, formatPeso, parseCentavos } from "./dashboard-format";
import { InfoButton } from "./InfoButton";

const SOURCE_LINKS: Record<SourceKey, { href: string; cta: string }> = {
  pos: { href: "/portal/bookkeeper/pos-sales", cta: "POS sales" },
  rental: { href: "/portal/bookkeeper/rental-transactions", cta: "Rental transactions" },
  membership: { href: "/portal/bookkeeper/members/payments", cta: "Member payments" },
  donations: { href: "/portal/bookkeeper/financial-ledger", cta: "Financial ledger" },
  other: { href: "/portal/bookkeeper/financial-ledger", cta: "Financial ledger" },
};

type SourceBreakdownProps = {
  incomeBySource: BookkeeperDashboard["incomeBySource"];
  memberCapitalReceived: BookkeeperDashboard["memberCapitalReceived"];
  sourceError?: string;
  capitalError?: string;
  onRetry: () => void;
};

export function SourceBreakdown({
  incomeBySource,
  memberCapitalReceived,
  sourceError,
  capitalError,
  onRetry,
}: SourceBreakdownProps) {
  if (sourceError && capitalError) {
    return (
      <section aria-label="Where our money comes from">
        <ErrorState message={sourceError} onRetry={onRetry} />
      </section>
    );
  }

  if (!incomeBySource && !sourceError) {
    return (
      <section aria-label="Where our money comes from" className="h-96 animate-pulse rounded-xl bg-[#E7F2E4]" />
    );
  }

  const items = incomeBySource?.items ?? [];
  const maxCents = Math.max(...items.map((item) => parseCentavos(item.amount)), 1);
  const totalCents = parseCentavos(incomeBySource?.total ?? "0.00");

  return (
    <section
      aria-labelledby="sources-heading"
      className="flex min-w-0 flex-col justify-between rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="sources-heading" className="text-base font-black text-[#123D2A]">
                Where Our Money Comes From
              </h2>
              <InfoButton label="Where Our Money Comes From">
                Separates Operating Income earned by the cooperative from Member Share-Capital Contributions. Source Share (%) = Source Operating Income ÷ Total Operating Income × 100. Member capital is equity, not operating revenue, and is never added into the operating bar total.
              </InfoButton>
            </div>
            <p className="mt-0.5 text-xs text-[#5D6D63]">
              Operating revenue earned vs. member capital contributions received (kept strictly separate).
            </p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#EEF6EC] text-[#1F6B43]">
            <Landmark className="size-4" aria-hidden="true" />
          </span>
        </div>

        {sourceError ? (
          <div className="mt-4">
            <ErrorState message={sourceError} onRetry={onRetry} />
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex items-baseline justify-between border-b border-[#EEF2EC] pb-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-[#5D6D63]">
                Operating Income Sources
              </span>
              <span className="font-black tabular-nums text-[#123D2A]">
                Total: {formatPeso(incomeBySource?.total ?? "0.00")}
              </span>
            </div>

            {totalCents === 0 ? (
              <p className="mt-3 rounded-lg bg-[#F7F8F3] p-3 text-xs text-[#5D6D63]">
                No posted operating income recorded during the selected period. All operating sources are ₱0.00.
              </p>
            ) : null}

            <ol className="mt-3 grid gap-2.5">
              {items.map((item) => {
                const cents = parseCentavos(item.amount);
                const widthPercent = totalCents > 0 ? Math.max((cents / maxCents) * 100, cents > 0 ? 2 : 0) : 0;
                const link = SOURCE_LINKS[item.key];
                return (
                  <li
                    key={item.key}
                    className="rounded-lg border border-[#E2E8E2] bg-[#FAFBF8] p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-bold text-[#123D2A]">{item.label}</span>
                      <span className="font-black tabular-nums text-[#123D2A]">
                        {formatPeso(item.amount)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E9F0E9]" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-[#1F6B43]"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5D6D63]">
                      <span>
                        Share of operating income:{" "}
                        <strong className="font-bold text-[#294B39]">
                          {formatPercent(item.sharePercent)}
                        </strong>{" "}
                        · {item.count.toLocaleString("en-PH")}{" "}
                        {item.count === 1 ? "record" : "records"}
                      </span>
                      <Link
                        href={link.href}
                        className="inline-flex items-center gap-1 font-bold text-[#1F6B43] hover:text-[#123D2A]"
                      >
                        {link.cta}
                        <ArrowRight className="size-3" aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {/* Strictly separated Member Capital Contributions block */}
      <div className="mt-5 rounded-xl border border-[#CAD8CB] bg-[#F7F8F3] p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#123D2A]">
              <ShieldCheck className="size-4 text-[#1F6B43]" aria-hidden="true" />
              Member Capital Contributions (Non-Operating Equity)
            </p>
            <p className="mt-1 text-xs leading-5 text-[#5D6D63]">
              Posted member share-capital payments during the selected period. Shown separately because member capital is a balance-sheet contribution, not operating revenue.
            </p>
          </div>
        </div>

        {capitalError ? (
          <div className="mt-3">
            <ErrorState message={capitalError} onRetry={onRetry} />
          </div>
        ) : memberCapitalReceived ? (
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3 border-t border-[#E2E8E2] pt-3">
            <div>
              <p className="text-xs font-semibold text-[#5D6D63]">Net capital contributed in period</p>
              <p className="mt-0.5 text-2xl font-black tabular-nums text-[#123D2A]">
                {formatPeso(memberCapitalReceived.net)}
              </p>
              <p className="mt-0.5 text-[11px] text-[#5D6D63]">
                Gross {formatPeso(memberCapitalReceived.gross)} across{" "}
                {memberCapitalReceived.count.toLocaleString("en-PH")} posted{" "}
                {memberCapitalReceived.count === 1 ? "credit" : "credits"}
                {parseCentavos(memberCapitalReceived.reversals) > 0
                  ? ` · Less reversals ${formatPeso(memberCapitalReceived.reversals)}`
                  : ""}
              </p>
            </div>
            <Link
              href="/portal/bookkeeper/share-capital"
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#CAD8CB] bg-white px-3 text-xs font-bold text-[#123D2A] transition hover:border-[#1F6B43] hover:bg-[#EEF6EC]"
            >
              Open Share Capital
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

