"use client";

import Link from "next/link";
import { Banknote, CircleAlert, Clock3, Landmark, ReceiptText, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/portal/PageHeader";
import { ErrorState, LoadingSkeleton, StatCard } from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import { getFinancialSummary, getPaymentReferenceSummary, type FinancialSummary, type PaymentReferenceSummary } from "./finance-api";

const emptyPayments: PaymentReferenceSummary = { total: 0, pendingTotal: 0, pendingManual: 0, needsClarification: 0, validatedToday: 0, validatedTotal: 0, paymongoTestPayments: 0, rejected: 0, reversed: 0, validatedAmount: 0 };
const emptyFinance: FinancialSummary = { incomeTotal: 0, expenseTotal: 0, adjustmentTotal: 0, netTotal: 0, activeRecords: 0, voidedRecords: 0 };
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(value);

export function BookkeeperFinancialDashboardView() {
  const [payments, setPayments] = useState(emptyPayments);
  const [finance, setFinance] = useState(emptyFinance);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [paymentSummary, financeSummary] = await Promise.all([getPaymentReferenceSummary(), getFinancialSummary()]);
      setPayments(paymentSummary); setFinance(financeSummary);
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "The bookkeeper financial dashboard could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  // The dashboard intentionally refreshes server-backed data on mount and every 30 seconds.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, [load]);

  return <div className="grid gap-6">
    <PageHeader eyebrow="Finance" title="Financial Dashboard" description="A clear view of posted money, payment validation, and the bookkeeper's daily actions." actions={<button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] shadow-sm transition hover:border-[#1F6B43] hover:bg-[#F2FAF3] disabled:opacity-60"><RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>} />
    {error ? <ErrorState message={error} onRetry={() => void load()} /> : loading ? <LoadingSkeleton /> : <div className="flex flex-col gap-6 [&>div:last-child]:order-7">
      <div className="order-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending payments" value={String(payments.pendingTotal)} icon={Clock3} />
        <StatCard label="Needs clarification" value={String(payments.needsClarification)} icon={CircleAlert} />
        <StatCard label="Approved today" value={String(payments.validatedToday)} icon={ReceiptText} />
        <StatCard label="Total approved amount" value={money(payments.validatedAmount)} icon={Banknote} />
      </div>
      <div className="order-4 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-[#123D2A]">Financial snapshot</h2><p className="mt-1 text-sm text-[#5D6D63]">Recorded totals handled by the bookkeeper.</p></div><Landmark className="size-5 text-[#1F6B43]" /></div>
          <div className="mt-6 grid grid-cols-3 items-end gap-5 rounded-xl bg-[#F7F8F3] px-4 pt-4" style={{ height: 220 }}>
            {[{ label: "Income", value: finance.incomeTotal, color: "bg-[#1F6B43]" }, { label: "Expenses", value: finance.expenseTotal, color: "bg-[#D8A011]" }, { label: "Net", value: finance.netTotal, color: "bg-[#123D2A]" }].map((bar) => {
              const max = Math.max(finance.incomeTotal, finance.expenseTotal, finance.netTotal, 1);
              const height = Math.max(8, (bar.value / max) * 170);
              return <div key={bar.label} className="flex h-full flex-col items-center justify-end gap-2"><span className="text-xs font-bold text-[#365F4A]">{money(bar.value)}</span><div className={`w-full max-w-20 rounded-t-lg ${bar.color}`} style={{ height }} /><span className="text-xs font-bold text-[#5D6D63]">{bar.label}</span></div>;
            })}
          </div>
        </section>
        <section className="rounded-2xl border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-[#123D2A]">Payment validation pipeline</h2><p className="mt-1 text-sm text-[#5D6D63]">Status of payments that need bookkeeper review.</p></div><ReceiptText className="size-5 text-[#1F6B43]" /></div>
          <div className="mt-6 space-y-5 rounded-xl bg-[#F7F8F3] p-4">
            {[{ label: "Pending / Payment to check", value: payments.pendingTotal, color: "bg-[#D8A011]" }, { label: "Needs correction", value: payments.needsClarification, color: "bg-[#C56B25]" }, { label: "Approved", value: payments.validatedTotal, color: "bg-[#1F6B43]" }, { label: "Rejected", value: payments.rejected, color: "bg-[#B94A48]" }, { label: "Reversed", value: payments.reversed, color: "bg-[#7C5AA6]" }].map((row) => { const max = Math.max(payments.pendingTotal, payments.needsClarification, payments.validatedTotal, payments.rejected, payments.reversed, 1); return <div key={row.label}><div className="mb-1 flex justify-between text-sm font-bold text-[#365F4A]"><span>{row.label}</span><span>{row.value}</span></div><div className="h-3 overflow-hidden rounded-full bg-[#EEF2EC]"><div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(row.value ? 4 : 0, (row.value / max) * 100)}%` }} /></div></div>; })}
          </div>
        </section>
      </div>
      <div className="order-2 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#CAD8CB] bg-white p-6 shadow-[0_10px_24px_rgba(18,61,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(18,61,42,0.09)]"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Income recorded</p><p className="mt-2 text-3xl font-black text-[#123D2A]">{money(finance.incomeTotal)}</p><p className="mt-2 text-xs font-semibold text-[#6C7A70]">Total posted income</p></div>
        <div className="rounded-2xl border border-[#CAD8CB] bg-white p-6 shadow-[0_10px_24px_rgba(18,61,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(18,61,42,0.09)]"><p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">Expenses recorded</p><p className="mt-2 text-3xl font-black text-[#123D2A]">{money(finance.expenseTotal)}</p><p className="mt-2 text-xs font-semibold text-[#6C6D70]">Total posted expenses</p></div>
        <div className="rounded-2xl border border-[#B7D7BD] bg-[#F2FAF3] p-6 shadow-[0_10px_24px_rgba(18,61,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(18,61,42,0.09)]"><p className="text-xs font-bold uppercase tracking-wide text-[#1F6B43]">Net total</p><p className="mt-2 text-3xl font-black text-[#1F6B43]">{money(finance.netTotal)}</p><p className="mt-2 text-xs font-semibold text-[#365F4A]">Income less expenses</p></div>
      </div>
      <section className="order-3 rounded-2xl border border-[#CAD8CB] bg-white p-6 shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-[#123D2A]">Bookkeeper action center</h2><p className="mt-1 text-sm text-[#5D6D63]">Quick access to the records you review and update every day.</p></div><ReceiptText className="size-5 text-[#1F6B43]" /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[{ href: "/portal/bookkeeper/payment-validation", title: "Validate payments", detail: `${payments.total} pending references` }, { href: "/portal/bookkeeper/operating-expenses", title: "Operating expenses", detail: "Record costs for patronage basis" }, { href: "/portal/bookkeeper/financial-ledger", title: "Open money records", detail: `${finance.activeRecords} active records` }, { href: "/portal/bookkeeper/documents", title: "Receipts & documents", detail: "Review supporting files" }, { href: "/portal/bookkeeper/reports", title: "Generate reports", detail: `${finance.voidedRecords} voided records` }].map((action) => <Link key={action.href} href={action.href} className="rounded-xl border border-[#E2E8E2] bg-[#F7F8F3] p-4 transition hover:border-[#8FB79A] hover:bg-[#EEF8F0]"><p className="font-black text-[#123D2A]">{action.title}</p><p className="mt-1 text-sm text-[#5D6D63]">{action.detail}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1F6B43]">Open <span aria-hidden="true">→</span></span></Link>)}
        </div>
      </section>
    </div>}
  </div>;
}
