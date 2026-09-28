"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Calculator, CheckCircle2, ChevronDown, HandCoins, Plus, RefreshCw, ShoppingCart, Tractor, TrendingDown, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { CurrencyDisplay, DataTable, EmptyState, ErrorState, FormDialog, FormField, LoadingSkeleton, StatCard, StatusBadge } from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  createPatronagePeriod,
  finalizePatronagePeriod,
  getPatronageFinancialBasis,
  getPatronageOverview,
  markPatronageRefundPaid,
  recalculatePatronagePeriod,
  type PatronageOverview,
  type PatronageFinancialBasis,
} from "./patronage-api";

const inputClass = "h-11 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20";
const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function currency(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function statusTone(status: string) {
  if (status === "Paid") return "success" as const;
  if (status === "Draft" || status === "Pending") return "warning" as const;
  return "neutral" as const;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function firstDayOfMonth(year: number, month: number) {
  return `${year}-${pad2(month)}-01`;
}

function lastDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function dateParts(date: string) {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

function PatronageSelect({ value, options, onChange, label, placeholder, openUp = false }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; label: string; placeholder?: string; openUp?: boolean }) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? placeholder ?? value;
  return (
    <div className="relative">
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-left text-sm font-bold text-[#123D2A] outline-none transition hover:border-[#8FB79A] focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20">
        <span className="truncate">{selectedLabel}</span><ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? <div role="listbox" aria-label={`${label} options`} className={`absolute z-30 w-full rounded-md border border-[#CAD8CB] bg-white p-1 shadow-[0_12px_28px_rgba(18,61,42,0.16)] ${openUp ? "bottom-full mb-2" : "mt-2"}`}>
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center rounded px-3 py-3 text-left text-sm transition ${option.value === value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F2FAF3]"}`}>{option.label}</button>)}
      </div> : null}
    </div>
  );
}

type PatronageManagementMode = "chairman" | "bookkeeper";

export function ChairmanPatronageClient({ mode = "chairman" }: { mode?: PatronageManagementMode }) {
  const [data, setData] = useState<PatronageOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [financialBasis, setFinancialBasis] = useState<PatronageFinancialBasis | null>(null);
  const [basisError, setBasisError] = useState("");
  const [allocationPage, setAllocationPage] = useState(1);
  const [allocationPageSize, setAllocationPageSize] = useState(5);
  const year = new Date().getFullYear();
  const [draft, setDraft] = useState({ name: `${year} Patronage Refund`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, refundPool: "", notes: "" });
  const yearOptions = Array.from({ length: 8 }, (_, index) => year - 5 + index);
  const startParts = dateParts(draft.startDate);
  const endParts = dateParts(draft.endDate);
  const dateRangeInvalid = draft.endDate < draft.startDate;
  const normalizedDraftName = draft.name.trim().toLowerCase();
  const duplicatePeriodName = Boolean(
    normalizedDraftName && data?.periods.some((item) => item.name.trim().toLowerCase() === normalizedDraftName),
  );
  const draftRefundPool = Number(draft.refundPool);
  const fairRefundLimit = financialBasis
    ? Math.max(0, Math.min(financialBasis.netOperatingSurplus, financialBasis.eligibleMemberPatronage))
    : 0;
  const refundPoolTooHigh = Boolean(financialBasis && draftRefundPool > fairRefundLimit);

  const load = useCallback(async (periodId?: string) => {
    try {
      const result = await getPatronageOverview(periodId);
      setData(result);
      setSelectedId(result.selectedPeriod?.id);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load patronage records.");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(selectedId), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load, selectedId]);

  useEffect(() => {
    if (!createOpen || !draft.startDate || !draft.endDate || draft.endDate < draft.startDate) return;
    let active = true;
    getPatronageFinancialBasis(draft.startDate, draft.endDate)
      .then((result) => {
        if (!active) return;
        setFinancialBasis(result);
        setBasisError("");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setFinancialBasis(null);
        setBasisError(loadError instanceof Error ? loadError.message : "Unable to compute the ledger basis.");
      });
    return () => { active = false; };
  }, [createOpen, draft.startDate, draft.endDate]);

  async function runAction(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    try {
      await action();
      toast.success(label);
      await load(selectedId);
    } catch (actionError) {
      toast.error(actionError instanceof ApiClientError ? actionError.message : "The patronage action failed.");
    } finally {
      setBusy("");
    }
  }

  async function submitPeriod(event: React.FormEvent) {
    event.preventDefault();
    if (duplicatePeriodName) {
      toast.error("This patronage period name is already used.");
      return;
    }
    if (dateRangeInvalid) {
      toast.error("End month must be after the start month.");
      return;
    }
    setBusy("Creating period");
    try {
      const period = await createPatronagePeriod({ ...draft, refundPool: Number(draft.refundPool), notes: draft.notes || null });
      setCreateOpen(false);
      setSelectedId(period.id);
      toast.success("Patronage period created. Calculate allocations when ready.");
    } catch (createError) {
      if (createError instanceof ApiClientError) {
        toast.error(createError.errors.find((item) => item.field === "name")?.message ?? createError.message);
      } else {
        toast.error(createError instanceof Error ? createError.message : "Unable to create patronage period.");
      }
    } finally {
      setBusy("");
    }
  }

  function applySurplusPercentage(percentage: number) {
    if (!financialBasis) return;
    const amount = fairRefundLimit * (percentage / 100);
    setDraft((current) => ({ ...current, refundPool: amount.toFixed(2) }));
  }

  function updatePeriodRange(part: "startMonth" | "startYear" | "endMonth" | "endYear", value: number) {
    setFinancialBasis(null);
    setBasisError("");
    setDraft((current) => {
      const currentStart = dateParts(current.startDate);
      const currentEnd = dateParts(current.endDate);
      const nextStartYear = part === "startYear" ? value : currentStart.year;
      const nextStartMonth = part === "startMonth" ? value : currentStart.month;
      const nextEndYear = part === "endYear" ? value : currentEnd.year;
      const nextEndMonth = part === "endMonth" ? value : currentEnd.month;

      return {
        ...current,
        startDate: firstDayOfMonth(nextStartYear, nextStartMonth),
        endDate: lastDayOfMonth(nextEndYear, nextEndMonth),
        refundPool: "",
      };
    });
  }

  const period = data?.selectedPeriod;
  const canManagePeriods = mode === "chairman";
  const paidRefundTotal = data?.allocations
    .filter((item) => item.paymentStatus === "Paid")
    .reduce((sum, item) => sum + item.refundAmount, 0) ?? 0;
  const pendingRefundTotal = data?.allocations
    .filter((item) => item.paymentStatus === "Pending")
    .reduce((sum, item) => sum + item.refundAmount, 0) ?? 0;
  const allocationCount = data?.allocations.length ?? 0;
  const allocationPageCount = Math.max(1, Math.ceil(allocationCount / allocationPageSize));
  const visibleAllocations = data?.allocations.slice((allocationPage - 1) * allocationPageSize, allocationPage * allocationPageSize) ?? [];
  const canRecordRefundPayments = period?.status !== "Draft" && data?.allocations.some((item) => item.paymentStatus === "Pending");
  const hasCalculatedAllocations = Boolean(period && data?.allocations.length);
  const canFinalizePeriod = Boolean(period && period.status === "Draft" && hasCalculatedAllocations && period.totalPatronage > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Member benefits"
        title="Patronage"
        description={mode === "bookkeeper"
          ? "See each member's paid cooperative use, patronage percentage, refund amount, and payment status."
          : "Monitor eligible member use of the cooperative and administer patronage-refund allocations separately from ordinary finance records."}
        actions={<div className="flex flex-wrap items-center gap-2">{canManagePeriods ? <button type="button" onClick={() => { setFinancialBasis(null); setBasisError(""); setCreateOpen(true); }} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]"><Plus className="size-4" /> New period</button> : null}<button type="button" disabled={Boolean(busy)} onClick={() => void load(selectedId)} className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:opacity-50"><RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /> Refresh</button></div>}
      />

      {error ? <ErrorState message={error} onRetry={() => void load(selectedId)} /> : null}
      {!data && !error ? <LoadingSkeleton /> : null}

      {data ? (
        <>
          <section className="rounded-lg border border-[#CAD8CB] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <label className="grid min-w-64 gap-2 text-sm font-bold text-[#294B39]">
                  Patronage period
                  <PatronageSelect value={selectedId ?? ""} placeholder="No periods yet" label="Patronage period" options={data.periods.map((item) => ({ value: item.id, label: `${item.name} - ${item.status}` }))} onChange={(value) => { setSelectedId(value || undefined); setAllocationPage(1); }} />
                </label>
              </div>
              {period ? <StatusBadge tone={statusTone(period.status)}>{period.status}</StatusBadge> : null}
            </div>
          </section>

          {period ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {mode === "bookkeeper" ? (
                  <>
                    <StatCard label="Member cooperative use" value={currency(period.totalPatronage)} icon={HandCoins} />
                    <StatCard label="Refund pool" value={currency(period.refundPool)} icon={UsersRound} />
                    <StatCard label="Refunds paid" value={currency(paidRefundTotal)} icon={CheckCircle2} />
                    <StatCard label="Refunds to pay" value={currency(pendingRefundTotal)} icon={HandCoins} />
                  </>
                ) : (
                  <>
                    <StatCard label="Eligible patronage" value={currency(period.totalPatronage)} icon={HandCoins} />
                    <StatCard label="Store purchases" value={currency(period.purchasePatronage)} icon={ShoppingCart} />
                    <StatCard label="Completed rentals" value={currency(period.rentalPatronage)} icon={Tractor} />
                    <StatCard label="Refund pool" value={currency(period.refundPool)} icon={UsersRound} />
                  </>
                )}
              </div>

              <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-[#123D2A]">{period.name}</h2>
                    <p className="mt-1 text-sm text-[#5D6D63]">{period.startDate} to {period.endDate} - {period.memberCount} member share(s) - {period.paidCount} paid</p>
                    <p className="mt-2 max-w-3xl text-xs leading-5 text-[#6C7A70]">Patronage is shared only to active members with paid store purchases or completed paid rentals inside this period. Non-member, unpaid, cancelled, and refunded transactions are not included.</p>
                    {canManagePeriods && period.status === "Draft" && !hasCalculatedAllocations ? (
                      <div className="mt-3 flex gap-2 rounded-md border border-[#F2D89A] bg-[#FFF4D7] p-3 text-xs leading-5 text-[#765700]">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <span>Not ready to finalize. Click Calculate shares after choosing a period with paid member purchases or rentals. If there is no member usage, create a different period.</span>
                      </div>
                    ) : null}
                    {canManagePeriods && canFinalizePeriod ? (
                      <div className="mt-3 rounded-md border border-[#B9D8BE] bg-[#E7F2E4] p-3 text-xs font-bold text-[#1F6B43]">Shares are calculated. Review the member list, then finalize when correct.</div>
                    ) : null}
                    {mode === "bookkeeper" && period.status === "Draft" ? <p className="mt-2 text-xs font-bold text-[#8A6500]">The chairman is still preparing this period. Refunds can be recorded only after it is finalized.</p> : null}
                  </div>
                  {canManagePeriods && period.status === "Draft" ? (
                    <div className="flex flex-wrap gap-2">
                      <button disabled={Boolean(busy)} onClick={() => void runAction("Member shares calculated", () => recalculatePatronagePeriod(period.id))} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:opacity-50"><RefreshCw className={`size-4 ${busy === "Member shares calculated" ? "animate-spin" : ""}`} /> {busy === "Member shares calculated" ? "Calculating..." : "Calculate shares"}</button>
                      <button disabled={Boolean(busy) || !canFinalizePeriod} onClick={() => void runAction("Patronage period finalized", () => finalizePatronagePeriod(period.id))} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43] disabled:opacity-50"><CheckCircle2 className="size-4" /> {busy === "Patronage period finalized" ? "Finalizing..." : "Finalize"}</button>
                    </div>
                  ) : null}
                </div>
              </section>

              {data.allocations.length ? (
                <>
                <DataTable>
                  <table className={`${canRecordRefundPayments ? "min-w-[1050px]" : "min-w-[930px]"} w-full text-left text-sm`}>
                    <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-4 py-3 text-left">Member</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-center">Purchases</th><th className="px-4 py-3 text-center">Rentals</th><th className="px-4 py-3 text-center">Total patronage</th><th className="px-4 py-3 text-center">Share</th><th className="px-4 py-3 text-center">Refund</th><th className="px-4 py-3 text-center">Status</th>{canRecordRefundPayments ? <th className="px-4 py-3 text-center">Action</th> : null}</tr></thead>
                    <tbody className="divide-y divide-[#E5ECE5]">
                      {visibleAllocations.map((item) => (
                        <tr key={item.id} className="text-[#294B39]"><td className="px-4 py-3"><div className="font-bold">{item.memberName}</div><div className="text-xs text-[#6C7A70]">{item.memberCode}</div></td><td className="px-4 py-3">{item.membershipType}</td><td className="px-4 py-3 text-center"><CurrencyDisplay value={item.purchasePatronage} /></td><td className="px-4 py-3 text-center"><CurrencyDisplay value={item.rentalPatronage} /></td><td className="px-4 py-3 text-center"><CurrencyDisplay value={item.totalPatronage} /></td><td className="px-4 py-3 text-center tabular-nums">{item.patronageSharePercent.toFixed(2)}%</td><td className="px-4 py-3 text-center"><CurrencyDisplay value={item.refundAmount} /></td><td className="px-4 py-3 text-center"><StatusBadge tone={statusTone(item.paymentStatus)}>{item.paymentStatus}</StatusBadge></td>{canRecordRefundPayments ? <td className="px-4 py-3 text-center">{item.paymentStatus === "Pending" ? <button disabled={Boolean(busy)} onClick={() => {
                          if (!window.confirm(`Confirm that ${currency(item.refundAmount)} was given to ${item.memberName}?`)) return;
                          void runAction(`Refund paid for ${item.memberName}`, () => markPatronageRefundPaid(item.id));
                        }} className="rounded-md border border-[#1F6B43] px-3 py-2 text-xs font-bold text-[#1F6B43] hover:bg-[#E7F2E4] disabled:opacity-50">{busy === `Refund paid for ${item.memberName}` ? "Saving..." : "Mark paid"}</button> : null}</td> : null}</tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5ECE5] px-4 py-4 text-sm">
                    <div className="flex items-center gap-3 font-semibold text-[#6C7A70]">
                      <span>Showing {allocationCount ? (allocationPage - 1) * allocationPageSize + 1 : 0}–{Math.min(allocationPage * allocationPageSize, allocationCount)} of {allocationCount} members</span>
                      <div className="w-32"><PatronageSelect value={String(allocationPageSize)} label="Rows per page" openUp options={[5, 10, 20, 50].map((size) => ({ value: String(size), label: `${size} per page` }))} onChange={(value) => { setAllocationPageSize(Number(value)); setAllocationPage(1); }} /></div>
                    </div>
                    <div className="flex gap-2"><button type="button" disabled={allocationPage <= 1} onClick={() => setAllocationPage((current) => Math.max(1, current - 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Previous</button><button type="button" disabled={allocationPage >= allocationPageCount} onClick={() => setAllocationPage((current) => Math.min(allocationPageCount, current + 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Next</button></div>
                  </div>
                </>
              ) : <EmptyState icon={Calculator} title="No member shares yet" description={canManagePeriods ? "Calculate shares after confirming this period has paid member purchases or completed paid rentals." : "The chairman has not calculated the member allocations for this period yet."} />}
            </>
          ) : <EmptyState icon={HandCoins} title={canManagePeriods ? "Set up the first patronage period" : "No patronage period yet"} description={canManagePeriods ? "Create a date range and approved refund pool, then calculate member allocations from eligible cooperative transactions." : "The chairman must create and approve a patronage period before member allocations appear here."} />}
        </>
      ) : null}

      {canManagePeriods ? <FormDialog open={createOpen} onOpenChange={setCreateOpen} title="New patronage period" description="Use the cooperative ledger as the basis instead of entering a refund pool without supporting figures." contentClassName="w-[min(48rem,calc(100vw-2rem))]">
        <form className="mt-5 grid gap-4" onSubmit={submitPeriod}>
          <FormField label="Period name" required><input className={`${inputClass} ${duplicatePeriodName ? "border-[#E7B8A8] bg-[#FFF8F6]" : ""}`} required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />{duplicatePeriodName ? <p className="mt-2 text-xs font-bold text-[#9A392A]">This period name is already used. Please enter a different name.</p> : null}</FormField>
          <section className="grid gap-3 rounded-md border border-[#CAD8CB] bg-[#FBFCF8] p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-bold text-[#294B39]">Start period</p>
                <div className="mt-2 grid grid-cols-[1.25fr_0.75fr] gap-2">
                  <select className={inputClass} aria-label="Start month" value={startParts.month} onChange={(event) => updatePeriodRange("startMonth", Number(event.target.value))}>
                    {monthOptions.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                  </select>
                  <select className={inputClass} aria-label="Start year" value={startParts.year} onChange={(event) => updatePeriodRange("startYear", Number(event.target.value))}>
                    {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-[#294B39]">End period</p>
                <div className="mt-2 grid grid-cols-[1.25fr_0.75fr] gap-2">
                  <select className={inputClass} aria-label="End month" value={endParts.month} onChange={(event) => updatePeriodRange("endMonth", Number(event.target.value))}>
                    {monthOptions.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                  </select>
                  <select className={inputClass} aria-label="End year" value={endParts.year} onChange={(event) => updatePeriodRange("endYear", Number(event.target.value))}>
                    {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <p className="text-xs font-semibold text-[#5D6D63]">The system will use {draft.startDate} to {draft.endDate}.</p>
            {dateRangeInvalid ? <p className="rounded-md border border-[#F2D89A] bg-[#FFF4D7] px-3 py-2 text-xs font-bold text-[#765700]">End period must be the same as or after the start period.</p> : null}
          </section>

          <section className="rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4">
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="font-black text-[#123D2A]">Financial basis from posted records</h3><p className="mt-1 text-xs leading-5 text-[#5D6D63]">Posted surplus decides the maximum pool. Paid member purchases and rentals decide who receives a share.</p></div>
              <Calculator className="size-5 shrink-0 text-[#1F6B43]" />
            </div>
            {basisError ? <div className="mt-3"><ErrorState message={basisError} /></div> : null}
            {!dateRangeInvalid && !financialBasis && !basisError ? <p className="mt-4 text-sm font-semibold text-[#5D6D63]">Computing the ledger basis...</p> : null}
            {financialBasis ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border border-[#D9E2D8] bg-white p-3"><p className="text-xs font-bold uppercase text-[#6C7A70]">Operating income</p><p className="mt-1 text-lg font-black text-[#123D2A]">{currency(financialBasis.totalOperatingIncome)}</p><p className="mt-1 text-xs text-[#6C7A70]">POS {currency(financialBasis.posIncome)} - Rentals {currency(financialBasis.rentalIncome)}</p></div>
                  <div className="rounded-md border border-[#D9E2D8] bg-white p-3"><p className="flex items-center gap-1 text-xs font-bold uppercase text-[#6C7A70]"><TrendingDown className="size-3" /> Cooperative expenses</p><p className="mt-1 text-lg font-black text-[#8A3D2F]">{currency(financialBasis.totalOperatingExpenses)}</p><p className="mt-1 text-xs text-[#6C7A70]">POS {currency(financialBasis.posExpenses)} - Rentals {currency(financialBasis.rentalExpenses)} - Other {currency(financialBasis.otherExpenses)}</p></div>
                  <div className="rounded-md border border-[#9FC7A8] bg-[#E7F2E4] p-3"><p className="text-xs font-bold uppercase text-[#365F4A]">Net operating surplus</p><p className="mt-1 text-lg font-black text-[#123D2A]">{currency(financialBasis.netOperatingSurplus)}</p><p className="mt-1 text-xs text-[#5D6D63]">Includes {currency(financialBasis.adjustments)} adjustments</p></div>
                  <div className="rounded-md border border-[#9FC7A8] bg-white p-3"><p className="text-xs font-bold uppercase text-[#365F4A]">Member use limit</p><p className="mt-1 text-lg font-black text-[#123D2A]">{currency(financialBasis.eligibleMemberPatronage)}</p><p className="mt-1 text-xs text-[#5D6D63]">{financialBasis.eligibleMemberCount} member(s) with paid use</p></div>
                </div>
                {financialBasis.eligibleMemberPatronage <= 0 ? <div className="flex gap-2 rounded-md border border-[#F2D89A] bg-[#FFF4D7] p-3 text-xs leading-5 text-[#765700]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>No paid member purchases or completed paid rentals were found. Choose a period with member usage before creating patronage.</span></div> : null}
                {financialBasis.unpostedRecordCount > 0 ? <div className="flex gap-2 rounded-md border border-[#F2D89A] bg-[#FFF4D7] p-3 text-xs leading-5 text-[#765700]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{financialBasis.unpostedRecordCount} active POS/rental ledger record(s) are not posted and are excluded. Post or review them before approving the pool.</span></div> : null}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#365F4A]">Choose a fair refund pool</p>
                  <p className="mt-1 text-xs text-[#6C7A70]">Maximum allowed: {currency(fairRefundLimit)}. It uses the lower amount between coop surplus and member paid use.</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{[25, 50, 75, 100].map((percentage) => <button key={percentage} type="button" disabled={fairRefundLimit <= 0} onClick={() => applySurplusPercentage(percentage)} className="rounded-md border border-[#9FB7A4] bg-white px-3 py-2 text-sm font-black text-[#123D2A] hover:bg-[#E7F2E4] disabled:opacity-40"><span className="block">{percentage}%</span><span className="text-xs font-semibold text-[#5D6D63]">{currency(fairRefundLimit * percentage / 100)}</span></button>)}</div>
                </div>
                <p className="text-xs leading-5 text-[#6C7A70]"><strong>Important:</strong> The refund pool cannot be more than actual member use. Example: a member with only PHP 2.00 patronage cannot receive thousands from that PHP 2.00.</p>
              </div>
            ) : null}
          </section>

          <FormField label="Proposed patronage refund pool" hint={financialBasis ? `Must not exceed ${currency(fairRefundLimit)} based on surplus and member paid use.` : "Select valid dates so the system can compute a financial basis."} required><input className={`${inputClass} ${refundPoolTooHigh ? "border-[#E7B8A8] bg-[#FFF8F6]" : ""}`} type="number" min="0.01" max={financialBasis ? fairRefundLimit : undefined} step="0.01" required value={draft.refundPool} onChange={(event) => setDraft({ ...draft, refundPool: event.target.value })} />{refundPoolTooHigh ? <p className="mt-2 text-xs font-bold text-[#9A392A]">This is higher than the fair limit for this period.</p> : null}</FormField>
          <FormField label="Notes"><textarea className="min-h-24 w-full rounded-md border border-[#CAD8CB] p-3 text-sm outline-none focus:border-[#1F6B43]" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></FormField>
          <button disabled={Boolean(busy) || duplicatePeriodName || dateRangeInvalid || !financialBasis || fairRefundLimit <= 0 || refundPoolTooHigh || !Number.isFinite(draftRefundPool) || draftRefundPool <= 0} className="mt-2 h-11 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43] disabled:opacity-50">Create period</button>
        </form>
      </FormDialog> : null}
    </div>
  );
}

export function BookkeeperPatronageClient() {
  return <ChairmanPatronageClient mode="bookkeeper" />;
}
