"use client";

import Link from "next/link";
import { ArrowRight, Coins, HandCoins, Users, WalletCards } from "lucide-react";
import { ErrorState } from "@/components/portal/PortalPrimitives";
import type { BookkeeperDashboard } from "./dashboard-api";
import { formatCentavosPeso, formatPeso, parseCentavos } from "./dashboard-format";
import { InfoButton } from "./InfoButton";

type MemberCapitalBandProps = {
  member: BookkeeperDashboard["member"];
  memberCapitalReceived: BookkeeperDashboard["memberCapitalReceived"];
  periodLabel: string;
  error?: string;
  onRetry: () => void;
};

export function MemberCapitalBand({
  member,
  memberCapitalReceived,
  periodLabel,
  error,
  onRetry,
}: MemberCapitalBandProps) {
  if (error) {
    return (
      <section aria-label="Member capital and benefits">
        <ErrorState message={error} onRetry={onRetry} />
      </section>
    );
  }

  if (!member) {
    return (
      <section aria-label="Member capital and benefits" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl bg-[#E7F2E4]" />
        ))}
      </section>
    );
  }

  const interestTotalCents =
    parseCentavos(member.interestAwaitingAction.withdrawalAmount) +
    parseCentavos(member.interestAwaitingAction.capitalizationAmount);
  const interestTotalCount =
    member.interestAwaitingAction.withdrawalCount +
    member.interestAwaitingAction.capitalizationCount;

  const cards = [
    {
      label: "Total Member Share Capital",
      scopeBadge: "Current balance · Ledger",
      value: formatPeso(member.capitalBalance),
      detail: `${member.capitalHolders.toLocaleString("en-PH")} active ${
        member.capitalHolders === 1 ? "member holds" : "members hold"
      } posted capital`,
      info: "Authoritative sum of share_capital_accounts.current_balance across all members. Member capital is equity held for members, not cooperative operating income.",
      href: "/portal/bookkeeper/share-capital",
      cta: "Open Share Capital Ledger",
      icon: WalletCards,
    },
    {
      label: "Share Capital Contributed",
      scopeBadge: `Selected period · ${periodLabel}`,
      value: formatPeso(memberCapitalReceived?.net ?? "0.00"),
      detail: memberCapitalReceived
        ? `${memberCapitalReceived.count.toLocaleString("en-PH")} posted payment ${
            memberCapitalReceived.count === 1 ? "credit" : "credits"
          } (net of reversals)`
        : "Period contribution total",
      info: "Net posted share-capital payment credits minus reversal debits recorded in the share-capital ledger during the selected period. Excludes dividend and patronage capitalization credits to avoid double-counting.",
      href: "/portal/bookkeeper/share-capital",
      cta: "Review capital contributions",
      icon: Coins,
    },
    {
      label: "Patronage Refunds Outstanding",
      scopeBadge: "Finalized · Pending payout",
      value: formatPeso(member.patronageOutstanding),
      detail: `${member.patronageAllocations.toLocaleString("en-PH")} finalized member ${
        member.patronageAllocations === 1 ? "allocation" : "allocations"
      } awaiting payout or transfer`,
      info: "Remaining unpaid balance of Chairman-finalized patronage allocations (refund_amount minus approved capital transfers) where payment_status is still Pending.",
      href: "/portal/bookkeeper/patronage",
      cta: "Open Patronage Module",
      icon: HandCoins,
    },
    {
      label: "Interest on Share Capital Awaiting Action",
      scopeBadge: "Member action queue",
      value: formatCentavosPeso(interestTotalCents),
      detail: `${interestTotalCount.toLocaleString("en-PH")} member ${
        interestTotalCount === 1 ? "request" : "requests"
      } (${member.interestAwaitingAction.withdrawalCount} withdrawal · ${member.interestAwaitingAction.capitalizationCount} add-to-capital)`,
      info: "Total amount of published Annual Interest on Share Capital allocations where members have requested withdrawal or capitalization and Bookkeeper completion is pending.",
      href: "/portal/bookkeeper/share-capital",
      cta: "Process member requests",
      icon: Users,
    },
  ] as const;

  return (
    <section
      aria-labelledby="member-capital-heading"
      className="rounded-xl border border-[#CAD8CB] bg-[#F7F8F3] p-5 shadow-[0_10px_24px_rgba(18,61,42,0.04)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="member-capital-heading" className="text-base font-black text-[#123D2A]">
            Member Capital &amp; Benefits
          </h2>
          <p className="text-xs text-[#5D6D63]">
            Member equity balances and approved benefit obligations, tracked separately from cooperative operating income and expenses.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          <Link href="/portal/bookkeeper/share-capital" className="text-[#1F6B43] hover:text-[#123D2A]">
            Share Capital →
          </Link>
          <Link href="/portal/bookkeeper/patronage" className="text-[#1F6B43] hover:text-[#123D2A]">
            Patronage →
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="flex min-w-0 flex-col justify-between rounded-xl border border-[#CAD8CB] bg-white p-4 shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center rounded-md bg-[#F7F8F3] px-2 py-0.5 text-[11px] font-bold text-[#5D6D63]">
                    {card.scopeBadge}
                  </span>
                  <div className="flex items-center gap-1">
                    <InfoButton label={card.label}>{card.info}</InfoButton>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#EEF6EC] text-[#1F6B43]">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
                <p className="mt-2.5 text-xs font-bold uppercase tracking-wider text-[#5D6D63]">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-[#123D2A]">{card.value}</p>
                <p className="mt-1.5 text-xs leading-5 text-[#5D6D63]">{card.detail}</p>
              </div>
              <Link
                href={card.href}
                className="mt-3 inline-flex items-center gap-1 border-t border-[#EEF2EC] pt-2.5 text-xs font-bold text-[#1F6B43] hover:text-[#123D2A]"
              >
                <span>{card.cta}</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

