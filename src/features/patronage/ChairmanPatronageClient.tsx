"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Calculator, CheckCircle2, HandCoins, Plus, RefreshCw, ShoppingCart, Tractor, TrendingDown, UsersRound } from "lucide-react";
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

function currency(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function statusTone(status: string) {
  if (status === "Paid") return "success" as const;
  if (status === "Draft" || status === "Pending") return "warning" as const;
  return "neutral" as const;
}

export function ChairmanPatronageClient() {
  const [data, setData] = useState<PatronageOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [financialBasis, setFinancialBasis] = useState<PatronageFinancialBasis | null>(null);
  const [basisError, setBasisError] = useState("");
  const year = new Date().getFullYear();
  const [draft, setDraft] = useState({ name: `${year} Patronage Refund`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, refundPool: "", notes: "" });

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
    let active = true;
    getPatronageOverview(selectedId)
      .then((result) => {
        if (!active) return;
        setData(result);
        setSelectedId(result.selectedPeriod?.id);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load patronage records.");
      });
    return () => { active = false; };
  }, [selectedId]);

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
    setBusy("Creating period");
    try {
      const period = await createPatronagePeriod({ ...draft, refundPool: Number(draft.refundPool), notes: draft.notes || null });
      setCreateOpen(false);
      setSelectedId(period.id);
      toast.success("Patronage period created. Calculate allocations when ready.");
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : "Unable to create patronage period.");
    } finally {
      setBusy("");
    }
  }

  function applySurplusPercentage(percentage: number) {
    if (!financialBasis) return;
    const amount = Math.max(0, financialBasis.netOperatingSurplus) * (percentage / 100);
    setDraft((current) => ({ ...current, refundPool: amount.toFixed(2) }));
  }

  const period = data?.selectedPeriod;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Member benefits"
        title="Patronage"
        description="Monitor eligible member use of the cooperative and administer patronage-refund allocations separately from ordinary finance records."
        actions={<button type="button" onClick={() => { setFinancialBasis(null); setBasisError(""); setCreateOpen(true); }} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]"><Plus className="size-4" /> New period</button>}
      />

      {error ? <ErrorState message={error} onRetry={() => void load(selectedId)} /> : null}
      {!data && !error ? <LoadingSkeleton /> : null}

      {data ? (
        <>
          <section className="rounded-lg border border-[#CAD8CB] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="grid min-w-64 gap-2 text-sm font-bold text-[#294B39]">
                Patronage period
                <select className={inputClass} value={selectedId ?? ""} onChange={(event) => setSelectedId(event.target.value || undefined)}>
                  {data.periods.length === 0 ? <option value="">No periods yet</option> : null}
                  {data.periods.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}
                </select>
              </label>
              {period ? <StatusBadge tone={statusTone(period.status)}>{period.status}</StatusBadge> : null}
            </div>
          </section>

          {period ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Eligible patronage" value={currency(period.totalPatronage)} icon={HandCoins} />
                <StatCard label="Store purchases" value={currency(period.purchasePatronage)} icon={ShoppingCart} />
                <StatCard label="Completed rentals" value={currency(period.rentalPatronage)} icon={Tractor} />
                <StatCard label="Refund pool" value={currency(period.refundPool)} icon={UsersRound} />
              </div>

              <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-[#123D2A]">{period.name}</h2>
                    <p className="mt-1 text-sm text-[#5D6D63]">{period.startDate} to {period.endDate} · {period.memberCount} eligible members · {period.paidCount} paid</p>
                    <p className="mt-2 max-w-3xl text-xs leading-5 text-[#6C7A70]">Only member-linked, paid POS sales and completed, paid rentals count. Cancelled, refunded, unpaid, and non-member transactions are excluded.</p>
                  </div>
                  {period.status === "Draft" ? (
                    <div className="flex flex-wrap gap-2">
                      <button disabled={Boolean(busy)} onClick={() => void runAction("Allocations recalculated", () => recalculatePatronagePeriod(period.id))} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:opacity-50"><RefreshCw className="size-4" /> Calculate</button>
                      <button disabled={Boolean(busy) || period.memberCount === 0} onClick={() => void runAction("Patronage period finalized", () => finalizePatronagePeriod(period.id))} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43] disabled:opacity-50"><CheckCircle2 className="size-4" /> Finalize</button>
                    </div>
                  ) : null}
                </div>
              </section>

              {data.allocations.length ? (
                <DataTable>
                  <table className="min-w-[1050px] w-full text-left text-sm">
                    <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Purchases</th><th className="px-4 py-3 text-right">Rentals</th><th className="px-4 py-3 text-right">Total patronage</th><th className="px-4 py-3 text-right">Share</th><th className="px-4 py-3 text-right">Refund</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
                    <tbody className="divide-y divide-[#E5ECE5]">
                      {data.allocations.map((item) => (
                        <tr key={item.id} className="text-[#294B39]"><td className="px-4 py-3"><div className="font-bold">{item.memberName}</div><div className="text-xs text-[#6C7A70]">{item.memberCode}</div></td><td className="px-4 py-3">{item.membershipType}</td><td className="px-4 py-3 text-right"><CurrencyDisplay value={item.purchasePatronage} /></td><td className="px-4 py-3 text-right"><CurrencyDisplay value={item.rentalPatronage} /></td><td className="px-4 py-3 text-right"><CurrencyDisplay value={item.totalPatronage} /></td><td className="px-4 py-3 text-right tabular-nums">{item.patronageSharePercent.toFixed(2)}%</td><td className="px-4 py-3 text-right"><CurrencyDisplay value={item.refundAmount} /></td><td className="px-4 py-3"><StatusBadge tone={statusTone(item.paymentStatus)}>{item.paymentStatus}</StatusBadge></td><td className="px-4 py-3">{period.status !== "Draft" && item.paymentStatus === "Pending" ? <button disabled={Boolean(busy)} onClick={() => void runAction(`Refund paid for ${item.memberName}`, () => markPatronageRefundPaid(item.id))} className="rounded-md border border-[#1F6B43] px-3 py-2 text-xs font-bold text-[#1F6B43] hover:bg-[#E7F2E4] disabled:opacity-50">Mark paid</button> : <span className="text-xs text-[#6C7A70]">—</span>}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
              ) : <EmptyState icon={Calculator} title="No calculated allocations" description="Calculate this draft period to collect eligible store and rental patronage for active Associate and True Members." />}
            </>
          ) : <EmptyState icon={HandCoins} title="Set up the first patronage period" description="Create a date range and approved refund pool, then calculate member allocations from eligible cooperative transactions." />}
        </>
      ) : null}

      <FormDialog open={createOpen} onOpenChange={setCreateOpen} title="New patronage period" description="Use the cooperative ledger as the basis instead of entering a refund pool without supporting figures." contentClassName="w-[min(48rem,calc(100vw-2rem))]">
        <form className="mt-5 grid gap-4" onSubmit={submitPeriod}>
          <FormField label="Period name" required><input className={inputClass} required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Start date" required><input className={inputClass} type="date" required value={draft.startDate} onChange={(event) => { setFinancialBasis(null); setDraft({ ...draft, startDate: event.target.value, refundPool: "" }); }} /></FormField><FormField label="End date" required><input className={inputClass} type="date" required value={draft.endDate} onChange={(event) => { setFinancialBasis(null); setDraft({ ...draft, endDate: event.target.value, refundPool: "" }); }} /></FormField></div>

          <section className="rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4">
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="font-black text-[#123D2A]">Financial basis from posted records</h3><p className="mt-1 text-xs leading-5 text-[#5D6D63]">Posted POS and rental income minus all recorded cooperative expenses within the selected dates.</p></div>
              <Calculator className="size-5 shrink-0 text-[#1F6B43]" />
            </div>
            {basisError ? <div className="mt-3"><ErrorState message={basisError} /></div> : null}
            {!financialBasis && !basisError ? <p className="mt-4 text-sm font-semibold text-[#5D6D63]">Computing the ledger basis…</p> : null}
            {financialBasis ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-[#D9E2D8] bg-white p-3"><p className="text-xs font-bold uppercase text-[#6C7A70]">Operating income</p><p className="mt-1 text-lg font-black text-[#123D2A]">{currency(financialBasis.totalOperatingIncome)}</p><p className="mt-1 text-xs text-[#6C7A70]">POS {currency(financialBasis.posIncome)} · Rentals {currency(financialBasis.rentalIncome)}</p></div>
                  <div className="rounded-md border border-[#D9E2D8] bg-white p-3"><p className="flex items-center gap-1 text-xs font-bold uppercase text-[#6C7A70]"><TrendingDown className="size-3" /> Cooperative expenses</p><p className="mt-1 text-lg font-black text-[#8A3D2F]">{currency(financialBasis.totalOperatingExpenses)}</p><p className="mt-1 text-xs text-[#6C7A70]">POS {currency(financialBasis.posExpenses)} · Rentals {currency(financialBasis.rentalExpenses)} · Other {currency(financialBasis.otherExpenses)}</p></div>
                  <div className="rounded-md border border-[#9FC7A8] bg-[#E7F2E4] p-3"><p className="text-xs font-bold uppercase text-[#365F4A]">Net operating surplus</p><p className="mt-1 text-lg font-black text-[#123D2A]">{currency(financialBasis.netOperatingSurplus)}</p><p className="mt-1 text-xs text-[#5D6D63]">Includes {currency(financialBasis.adjustments)} adjustments</p></div>
                </div>
                {financialBasis.unpostedRecordCount > 0 ? <div className="flex gap-2 rounded-md border border-[#F2D89A] bg-[#FFF4D7] p-3 text-xs leading-5 text-[#765700]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{financialBasis.unpostedRecordCount} active POS/rental ledger record(s) are not posted and are excluded. Post or review them before approving the pool.</span></div> : null}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#365F4A]">Choose a planning amount from the net surplus</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{[25, 50, 75, 100].map((percentage) => <button key={percentage} type="button" disabled={financialBasis.netOperatingSurplus <= 0} onClick={() => applySurplusPercentage(percentage)} className="rounded-md border border-[#9FB7A4] bg-white px-3 py-2 text-sm font-black text-[#123D2A] hover:bg-[#E7F2E4] disabled:opacity-40"><span className="block">{percentage}%</span><span className="text-xs font-semibold text-[#5D6D63]">{currency(Math.max(0, financialBasis.netOperatingSurplus) * percentage / 100)}</span></button>)}</div>
                </div>
                <p className="text-xs leading-5 text-[#6C7A70]"><strong>Important:</strong> Net operating surplus is the maximum ledger basis, not an automatic refund entitlement. Select a lower amount when required funds, reserves, or other approved allocations still need to be retained.</p>
              </div>
            ) : null}
          </section>

          <FormField label="Proposed patronage refund pool" hint={financialBasis ? `Must not exceed the recorded net operating surplus of ${currency(Math.max(0, financialBasis.netOperatingSurplus))}. Final approval remains with the cooperative.` : "Select valid dates so the system can compute a financial basis."} required><input className={inputClass} type="number" min="0.01" max={financialBasis ? Math.max(0, financialBasis.netOperatingSurplus) : undefined} step="0.01" required value={draft.refundPool} onChange={(event) => setDraft({ ...draft, refundPool: event.target.value })} /></FormField>
          <FormField label="Notes"><textarea className="min-h-24 w-full rounded-md border border-[#CAD8CB] p-3 text-sm outline-none focus:border-[#1F6B43]" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></FormField>
          <button disabled={Boolean(busy) || !financialBasis || financialBasis.netOperatingSurplus <= 0} className="mt-2 h-11 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43] disabled:opacity-50">Create period</button>
        </form>
      </FormDialog>
    </div>
  );
}
