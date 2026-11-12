"use client";

import { useCallback, useEffect, useState } from "react";
import { HandCoins, Calculator, CalendarDays, WalletCards } from "lucide-react";
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
      <PageHeader eyebrow="My cooperative activity" title="My Patronage" description="Your yearly refund based on qualifying equipment rentals and the saved member refund rate. For True Members only; POS products are excluded." />
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

          <p role="status" className="rounded-coop-panel border border-coop-border bg-coop-sage p-4 text-sm leading-6 text-coop-secondary">{data.member.eligibilityMessage || "Only equipment rentals after becoming a True Member qualify. Associate Members and POS purchases do not earn a refund."}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Eligible equipment rentals" value={currency(data.currentYear.totalPatronage)} icon={HandCoins} />
            <StatCard label={data.currentYear.estimateAvailable ? `Year-to-date estimate · ${(data.currentYear.refundRate ?? 0).toFixed(2)}%` : "Year-to-date refund estimate"} value={data.currentYear.estimateAvailable ? currency(data.currentYear.estimatedRefund ?? 0) : "Awaiting financial basis"} icon={Calculator} />
            <StatCard label="True Member effective date" value={data.member.trueMemberSince || (data.member.membershipType === "Associate" ? "Not eligible" : "Ask the office")} icon={CalendarDays} />
            <StatCard label="Approved refunds awaiting payout" value={currency(data.refunds.pendingTotal)} icon={WalletCards} />
          </div>

          <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
            <h2 className="text-lg font-black text-[#123D2A]">How your patronage works</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#5D6D63]">The refund is computed once per calendar year, January 1–December 31, from an allocated pool funded by the reviewed rental business net surplus after statutory deductions. For new periods, your refund is your qualifying rental total multiplied by the member refund rate saved for that year. Existing periods retain their original calculation. Only rentals that start on or after your True Member effective date qualify. A rental counts in the year it is both completed and fully paid with validated payment. Cancelled bookings, unpaid amounts, refunded or reversed payments, facility rentals, and Coop Store/POS purchases are excluded. An estimate is shown only after the cooperative records an annual financial basis; it becomes available after the year ends and the cooperative finalizes the allocations.</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-[#EEF2EC] px-3 py-1.5 font-bold text-[#365F4A]">Allocated refunds: {currency(data.refunds.allocatedTotal)}</span><span className="rounded-full bg-[#E3F7E7] px-3 py-1.5 font-bold text-[#1F6B43]">Received as cash: {currency(data.refunds.paidTotal)}</span><span className="rounded-full bg-[#EEF2EC] px-3 py-1.5 font-bold text-[#365F4A]">Added to Share Capital: {currency(data.refunds.capitalizedTotal ?? 0)}</span></div>
          </section>

          {data.history.some((item) => !["Rental3PercentAnnual", "RentalSurplusAnnual", "RentalConfiguredAnnual"].includes(item.policyVersion ?? "")) && <p role="status" className="rounded-coop-panel border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Historical allocations below used the previous policy. Their original amounts and paid status are preserved. Any remaining legacy refund needs cooperative review before payout or transfer.</p>}
          {data.history.length ? (
            <DataTable>
              <table className="min-w-[780px] w-full text-left text-sm">
                <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-4 py-3">Period</th><th className="px-4 py-3">Coverage</th><th className="px-4 py-3 text-right">Eligible rentals / historical use</th><th className="px-4 py-3 text-right">Your refund</th><th className="px-4 py-3">Payment status</th></tr></thead>
                <tbody className="divide-y divide-[#E5ECE5]">{data.history.map((item) => <tr key={item.periodId}><td className="px-4 py-3 font-bold text-[#123D2A]">{item.periodName}{!["Rental3PercentAnnual", "RentalSurplusAnnual", "RentalConfiguredAnnual"].includes(item.policyVersion ?? "") && <span className="mt-1 block text-xs font-normal text-amber-800">Legacy policy — review required</span>}</td><td className="px-4 py-3 text-[#5D6D63]">{item.startDate} to {item.endDate}</td><td className="px-4 py-3 text-right"><CurrencyDisplay value={item.totalPatronage} /></td><td className="px-4 py-3 text-right"><CurrencyDisplay value={item.refundAmount} />{(item.capitalizedAmount ?? 0) > 0 ? <p className="mt-1 text-xs text-[#1F6B43]">{currency(item.capitalizedAmount ?? 0)} added to Share Capital</p> : null}{(item.pendingCapitalAmount ?? 0) > 0 ? <p className="mt-1 text-xs text-amber-700">{currency(item.pendingCapitalAmount ?? 0)} awaiting approval</p> : null}</td><td className="px-4 py-3"><StatusBadge tone={item.paymentStatus === "Paid" ? "success" : "warning"}>{item.refundAmount === 0 ? "No payout due" : item.paymentStatus === "Paid" && (item.capitalizedAmount ?? 0) >= item.refundAmount ? "Added to Share Capital" : item.paymentStatus}</StatusBadge></td></tr>)}</tbody>
              </table>
            </DataTable>
          ) : <EmptyState icon={WalletCards} title="No finalized refund yet" description="Your year-to-date rental refund is an estimate. Refunds appear after the calendar year ends and the cooperative finalizes that year." />}
        </>
      ) : null}
    </div>
  );
}
