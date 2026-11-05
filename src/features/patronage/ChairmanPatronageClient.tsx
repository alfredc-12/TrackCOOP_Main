"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Calculator, CheckCircle2, HandCoins, Plus, RefreshCw, Tractor, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { PatronageCapitalReviewPanel } from "./PatronageCapitalReviewPanel";
import { PageHeader } from "@/components/portal/PageHeader";
import { CurrencyDisplay, DataTable, EmptyState, ErrorState, FormDialog, FormField, LoadingSkeleton, StatCard, StatusBadge } from "@/components/portal/PortalPrimitives";
import { createPatronagePeriod, finalizePatronagePeriod, getPatronageFinancialBasis, getPatronageOverview, markPatronageRefundPaid, recalculatePatronagePeriod, type PatronageOverview, type PatronageFinancialBasis } from "./patronage-api";

const policy = "Rental3PercentAnnual";
const inputClass = "coop-field min-h-11 w-full rounded-coop-control border border-coop-border bg-coop-surface px-3 text-sm text-coop-forest";
function currency(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value); }
function statusTone(status: string) { return status === "Paid" ? "success" as const : status === "Draft" || status === "Pending" ? "warning" as const : "neutral" as const; }

type PatronageManagementMode = "chairman" | "bookkeeper";
export function ChairmanPatronageClient({ mode = "chairman" }: { mode?: PatronageManagementMode }) {
  const [data, setData] = useState<PatronageOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [basis, setBasis] = useState<PatronageFinancialBasis | null>(null);
  const [basisError, setBasisError] = useState("");
  const [allocationPage, setAllocationPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const inFlight = useRef(false);
  const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Manila" }).format(new Date()));
  const [draft, setDraft] = useState({ name: `${year - 1} Patronage Refund`, startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31`, notes: "" });
  const canManage = mode === "chairman";
  const period = data?.selectedPeriod;
  const legacy = Boolean(period && period.policyVersion !== policy);
  const allocations = data?.allocations ?? [];
  const pageCount = Math.max(1, Math.ceil(allocations.length / pageSize));
  const visible = allocations.slice((allocationPage - 1) * pageSize, allocationPage * pageSize);
  const periodLabels = data?.periods.map((item) => `${item.name} — ${item.status}`) ?? [];

  const load = useCallback(async (id?: string, silent = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await getPatronageOverview(id);
      setData(result); setSelectedId(result.selectedPeriod?.id); setError("");
    } catch (caught) { if (!silent) setError(caught instanceof Error ? caught.message : "Unable to load patronage records."); }
    finally { inFlight.current = false; }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(selectedId), 0);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void load(selectedId, true); }, 15000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [load, selectedId]);
  useEffect(() => {
    if (!createOpen) return;
    let active = true;
    getPatronageFinancialBasis(draft.startDate, draft.endDate).then((result) => { if (active) { setBasis(result); setBasisError(""); } }).catch((caught: unknown) => { if (active) { setBasis(null); setBasisError(caught instanceof Error ? caught.message : "Unable to calculate eligible rentals."); } });
    return () => { active = false; };
  }, [createOpen, draft.startDate, draft.endDate]);
  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    try { await action(); toast.success(label); await load(selectedId); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "The action failed."); }
    finally { setBusy(""); }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy("Creating yearly period");
    try { const created = await createPatronagePeriod({ ...draft, notes: draft.notes || null }); setCreateOpen(false); setSelectedId(created.id); toast.success("Yearly period created. Calculate the 3% refunds next."); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to create the yearly period."); }
    finally { setBusy(""); }
  }

  return <div className="space-y-6">
    <PageHeader eyebrow="Member benefits" title="Patronage Refunds" description="Yearly 3% refund on eligible equipment rentals for True Members. January–December; POS products are excluded." actions={<div className="flex flex-wrap gap-2">{canManage && <button onClick={() => { setBasis(null); setBasisError(""); setCreateOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-coop-control bg-coop-forest px-4 text-sm font-bold text-white"><Plus className="size-4" />New yearly period</button>}<button disabled={Boolean(busy)} onClick={() => void load(selectedId)} className="inline-flex min-h-11 items-center gap-2 rounded-coop-control border border-coop-border bg-coop-surface px-4 text-sm font-bold text-coop-forest"><RefreshCw className="size-4" />Refresh</button></div>} />
    <PatronageCapitalReviewPanel canReview={mode === "bookkeeper"} onProcessed={() => void load(selectedId)} />
    {error && <ErrorState message={error} onRetry={() => void load(selectedId)} />}
    {!data && !error && <LoadingSkeleton />}
    {data && <>
      <section className="rounded-coop-panel border border-coop-border bg-coop-surface p-4"><label htmlFor="patronage-period" className="mb-2 block text-sm font-bold text-coop-forest">Patronage year / historical period</label><StyledSelect id="patronage-period" aria-label="Patronage period" value={period ? `${period.name} — ${period.status}` : "No periods yet"} disabled={!periodLabels.length} options={periodLabels} onChange={(value) => { setSelectedId(data.periods.find((item) => `${item.name} — ${item.status}` === value)?.id); setAllocationPage(1); }} /></section>
      {period ? <>
        {legacy && <div role="alert" className="flex gap-3 rounded-coop-panel border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><AlertTriangle className="mt-1 size-5 shrink-0" /><p><strong>Legacy records — review required.</strong> These amounts were created under the previous policy and have not been changed. New payouts and Share Capital transfers are blocked. A legacy period overlapping a calendar year must be reconciled before a new annual period can be created.</p></div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label={legacy ? "Historical patronage" : "Eligible equipment rentals"} value={currency(period.totalPatronage)} icon={Tractor} /><StatCard label={legacy ? "Historical refund total" : "Yearly refund total (3%)"} value={currency(period.refundPool)} icon={HandCoins} /><StatCard label="Members with allocations" value={String(period.memberCount)} icon={UsersRound} /><StatCard label="Paid allocations" value={String(period.paidCount)} icon={CheckCircle2} /></div>
        <section className="rounded-coop-panel border border-coop-border bg-coop-surface p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-coop-forest">{period.name}</h2><p className="mt-1 text-sm text-coop-secondary">{period.startDate} to {period.endDate}</p><div className="mt-2"><StatusBadge tone={statusTone(period.status)}>{period.status}</StatusBadge></div></div>{canManage && period.status === "Draft" && <div className="flex flex-wrap gap-2"><button disabled={Boolean(busy)} onClick={() => void run("Yearly refunds calculated", () => recalculatePatronagePeriod(period.id))} className="inline-flex min-h-11 items-center gap-2 rounded-coop-control border border-coop-border px-3 text-sm font-bold text-coop-forest disabled:opacity-50"><Calculator className="size-4" />Calculate 3% refunds</button><button disabled={Boolean(busy) || legacy || !allocations.length || Number(period.endDate.slice(0, 4)) >= year} onClick={() => void run("Yearly refunds finalized", () => finalizePatronagePeriod(period.id))} className="min-h-11 rounded-coop-control bg-coop-forest px-4 text-sm font-bold text-white disabled:opacity-50">Finalize yearly refunds</button></div>}</div><p className="mt-3 text-sm leading-6 text-coop-secondary">Only completed, fully paid equipment rentals that began after the True Member effective date qualify. The year is when the rental is both completed and payment is validated. Cancelled, unpaid, reversed/refunded payments, facility rentals, and POS purchases are excluded.</p>{period.status === "Draft" && <p className="mt-2 text-sm font-semibold text-coop-secondary">Review the calculations, then finalize after December 31. Finalized amounts are locked; the Bookkeeper records payouts.</p>}</section>
        {allocations.length ? <><DataTable><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-coop-sage text-xs uppercase text-coop-secondary"><tr>{['Member','Type', ...(legacy ? ['Historical POS','Historical rentals','Historical share'] : ['Eligible rentals','Refund rate']), 'Refund','Status','Action'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-coop-border">{visible.map((item) => <tr key={item.id}><td className="px-4 py-3 font-semibold text-coop-forest">{item.memberName}<span className="block text-xs font-normal text-coop-secondary">{item.memberCode}</span></td><td className="px-4 py-3">{item.membershipType}</td>{legacy && <td className="px-4 py-3"><CurrencyDisplay value={item.purchasePatronage} /></td>}<td className="px-4 py-3"><CurrencyDisplay value={item.rentalPatronage} /></td><td className="px-4 py-3">{legacy ? `${item.patronageSharePercent.toFixed(2)}%` : '3%'}</td><td className="px-4 py-3"><CurrencyDisplay value={item.refundAmount} />{(item.capitalizedAmount ?? 0) > 0 && <p className="text-xs text-coop-secondary">{currency(item.capitalizedAmount ?? 0)} added to capital</p>}</td><td className="px-4 py-3"><StatusBadge tone={statusTone(item.paymentStatus)}>{item.paymentStatus}</StatusBadge>{(item.pendingCapitalAmount ?? 0) > 0 && <p className="mt-1 text-xs text-coop-secondary">Capital transfer pending</p>}</td><td className="px-4 py-3">{!legacy && period.status !== 'Draft' && item.paymentStatus === 'Pending' && <button disabled={Boolean(busy) || item.membershipType !== 'True Member' || (item.pendingCapitalAmount ?? 0) > 0 || (item.availableRefund ?? 0) <= 0} onClick={() => { if (window.confirm(`Confirm ${currency(item.availableRefund ?? 0)} in cash was given to ${item.memberName}?`)) void run("Refund payment recorded", () => markPatronageRefundPaid(item.id)); }} className="min-h-10 rounded-coop-control border border-coop-border px-3 text-xs font-bold text-coop-green disabled:opacity-50">Mark paid</button>}</td></tr>)}</tbody></table></DataTable><div className="flex flex-wrap items-center justify-between gap-3"><div className="w-40"><StyledSelect aria-label="Rows per page" value={String(pageSize)} options={['5','10','20','50']} prefix="Rows" onChange={(value) => { setPageSize(Number(value)); setAllocationPage(1); }} /></div><span className="text-sm text-coop-secondary">Page {allocationPage} of {pageCount} · {allocations.length} members</span><div className="flex gap-2"><button disabled={allocationPage <= 1} onClick={() => setAllocationPage((value) => value - 1)} className="min-h-11 rounded-coop-control border border-coop-border px-3 text-sm disabled:opacity-40">Previous</button><button disabled={allocationPage >= pageCount} onClick={() => setAllocationPage((value) => value + 1)} className="min-h-11 rounded-coop-control border border-coop-border px-3 text-sm disabled:opacity-40">Next</button></div></div></> : <EmptyState icon={Calculator} title="No calculated refunds yet" description="The chairman calculates 3% refunds from eligible equipment rentals before finalizing the year." />}
      </> : <EmptyState icon={HandCoins} title="No patronage period yet" description="The chairman can create a January–December period for eligible True Member equipment rentals." />}
    </>}
    {canManage && <FormDialog open={createOpen} onOpenChange={setCreateOpen} title="New yearly patronage period" description="Refunds are calculated automatically at 3%." contentClassName="w-[min(42rem,calc(100vw-2rem))]"><form onSubmit={create} className="mt-4 grid gap-4"><FormField label="Calendar year" required><StyledSelect aria-label="Calendar year" value={draft.startDate.slice(0,4)} options={Array.from({ length: 8 }, (_, index) => String(year - index))} onChange={(value) => { setBasis(null); setBasisError(''); setDraft((old) => ({ ...old, name: `${value} Patronage Refund`, startDate: `${value}-01-01`, endDate: `${value}-12-31` })); }} /></FormField><p className="text-sm text-coop-secondary">Coverage: {draft.startDate} to {draft.endDate}. Only one non-overlapping period per year is allowed.</p><FormField label="Period name" required><input required minLength={3} maxLength={120} className={inputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></FormField>{basisError && <ErrorState message={basisError} />}{!basis && !basisError && <p role="status" className="text-sm text-coop-secondary">Calculating eligible rentals…</p>}{basis && <div className="grid gap-3 rounded-coop-panel border border-coop-border bg-coop-sage p-4 sm:grid-cols-2"><p className="text-sm text-coop-secondary">Eligible rentals<strong className="mt-1 block text-xl text-coop-forest">{currency(basis.eligibleMemberPatronage)}</strong><span className="block text-xs">{basis.eligibleMemberCount} eligible True Member(s)</span></p><p className="text-sm text-coop-secondary">Computed refund total · 3%<strong className="mt-1 block text-xl text-coop-forest">{currency(basis.estimatedRefund ?? 0)}</strong><span className="block text-xs">Each member’s amount is rounded to cents.</span></p></div>}<FormField label="Notes"><textarea maxLength={4000} className="min-h-24 w-full rounded-coop-control border border-coop-border p-3 text-sm" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></FormField><button disabled={Boolean(busy) || !basis || basis.eligibleMemberPatronage <= 0} className="min-h-11 rounded-coop-control bg-coop-forest px-4 text-sm font-bold text-white disabled:opacity-50">{busy === 'Creating yearly period' ? 'Creating…' : 'Create yearly period'}</button></form></FormDialog>}
  </div>;
}
export function BookkeeperPatronageClient() { return <ChairmanPatronageClient mode="bookkeeper" />; }
