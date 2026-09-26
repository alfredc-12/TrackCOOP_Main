"use client";

import { useCallback, useEffect, useState } from "react";
import { HandCoins, ShoppingCart, Tractor, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { CurrencyDisplay, DataTable, EmptyState, ErrorState, LoadingSkeleton, StatCard, StatusBadge } from "@/components/portal/PortalPrimitives";
import { getMemberPatronage, type MemberPatronageSummary } from "./patronage-api";

function currency(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

export function MemberPatronageClient() {
  const [data, setData] = useState<MemberPatronageSummary | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await getMemberPatronage());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your patronage status.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    getMemberPatronage()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load your patronage status.");
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="My cooperative activity" title="My Patronage" description="See how your eligible paid purchases and completed rentals contribute to your cooperative patronage and any approved patronage refund." />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!data && !error ? <LoadingSkeleton /> : null}
      {data ? (
        <>
          <section className="rounded-lg border border-[#CAD8CB] bg-[linear-gradient(135deg,#123D2A,#1F6B43)] p-5 text-white shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#DCEB9A]">{data.member.membershipType}</p><h2 className="mt-2 text-2xl font-black">{data.member.name}</h2><p className="mt-1 text-sm text-white/75">Member code {data.member.code}</p></div>
              <div className="rounded-lg bg-white/10 px-4 py-3 text-sm"><span className="block text-white/70">Current year</span><span className="font-black">{data.currentYear.startDate} to {data.currentYear.endDate}</span></div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total eligible patronage" value={currency(data.currentYear.totalPatronage)} icon={HandCoins} />
            <StatCard label="Paid store purchases" value={currency(data.currentYear.purchasePatronage)} icon={ShoppingCart} />
            <StatCard label="Completed paid rentals" value={currency(data.currentYear.rentalPatronage)} icon={Tractor} />
            <StatCard label="Pending approved refunds" value={currency(data.refunds.pendingTotal)} icon={WalletCards} />
          </div>

          <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
            <h2 className="text-lg font-black text-[#123D2A]">How your patronage works</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#5D6D63]">Your patronage grows from member-linked store purchases after payment and rentals after both completion and payment. Patronage is not cash owed by itself. A refund appears only after the cooperative creates an approved refund pool, calculates each member&apos;s proportional share, and finalizes the period.</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-[#EEF2EC] px-3 py-1.5 font-bold text-[#365F4A]">Allocated refunds: {currency(data.refunds.allocatedTotal)}</span><span className="rounded-full bg-[#E3F7E7] px-3 py-1.5 font-bold text-[#1F6B43]">Paid refunds: {currency(data.refunds.paidTotal)}</span></div>
          </section>

          {data.history.length ? (
            <DataTable>
              <table className="min-w-[780px] w-full text-left text-sm">
                <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-4 py-3">Period</th><th className="px-4 py-3">Coverage</th><th className="px-4 py-3 text-right">Your patronage</th><th className="px-4 py-3 text-right">Your refund</th><th className="px-4 py-3">Payment status</th></tr></thead>
                <tbody className="divide-y divide-[#E5ECE5]">{data.history.map((item) => <tr key={item.periodId}><td className="px-4 py-3 font-bold text-[#123D2A]">{item.periodName}</td><td className="px-4 py-3 text-[#5D6D63]">{item.startDate} to {item.endDate}</td><td className="px-4 py-3 text-right"><CurrencyDisplay value={item.totalPatronage} /></td><td className="px-4 py-3 text-right"><CurrencyDisplay value={item.refundAmount} /></td><td className="px-4 py-3"><StatusBadge tone={item.paymentStatus === "Paid" ? "success" : "warning"}>{item.paymentStatus}</StatusBadge></td></tr>)}</tbody>
              </table>
            </DataTable>
          ) : <EmptyState icon={WalletCards} title="No finalized refund yet" description="Your current eligible patronage is already shown above. Refund history will appear after the cooperative finalizes a patronage period." />}
        </>
      ) : null}
    </div>
  );
}
