"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Calculator, CheckCircle2, HandCoins, Plus, RefreshCw, Tractor, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { PatronageCapitalReviewPanel } from "./PatronageCapitalReviewPanel";
import { PaymentWorkspaceHeader, PaymentSummaryCard } from "@/components/portal/PaymentWorkspace";
import { PageHeader } from "@/components/portal/PageHeader";
import { CurrencyDisplay, DataTable, EmptyState, ErrorState, FormDialog, FormField, LoadingSkeleton, PaginationControls, StatCard, StatusBadge } from "@/components/portal/PortalPrimitives";
import { createPatronagePeriod, finalizePatronagePeriod, getPatronageFinancialBasis, getPatronageOverview, markPatronageRefundPaid, recalculatePatronagePeriod, type PatronageOverview, type PatronageFinancialBasis } from "./patronage-api";

const policy = "RentalConfiguredAnnual";
const surplusPolicy = "RentalSurplusAnnual";
const fixedPolicy = "Rental3PercentAnnual";
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
  const [draft, setDraft] = useState({ name: `${year - 1} Patronage Refund`, startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31`, netSurplus: "", statutoryReserves: "", notes: "" });
  const canManage = mode === "chairman";
  const SummaryCard = canManage ? StatCard : PaymentSummaryCard;
  const Header = canManage ? PageHeader : PaymentWorkspaceHeader;
  const period = data?.selectedPeriod;
  const legacy = Boolean(period && ![policy, fixedPolicy, surplusPolicy].includes(period.policyVersion ?? ""));
  const fixedRate = period?.policyVersion === fixedPolicy || period?.policyVersion === policy;
  const netCents = Math.round(Number(draft.netSurplus) * 100);
  const reserveCents = Math.round(Number(draft.statutoryReserves) * 100);
  const computedPool = Math.round((netCents - reserveCents) * (basis?.allocationRate ?? 30) / 100) / 100;
  const computedRate = basis?.memberRefundRate ?? 3;
  const validBasis = draft.netSurplus !== "" && draft.statutoryReserves !== "" && Number.isFinite(computedPool) && netCents > reserveCents && reserveCents >= 0 && computedPool > 0;
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
    try { const created = await createPatronagePeriod({ ...draft, netSurplus: Number(draft.netSurplus), statutoryReserves: Number(draft.statutoryReserves), refundPool: computedPool, notes: draft.notes || null }); setCreateOpen(false); setSelectedId(created.id); toast.success("Yearly period created. Calculate the proportional refunds next."); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "Unable to create the yearly period."); }
    finally { setBusy(""); }
  }

  return <div className="grid min-w-0 gap-4">
    <Header icon={HandCoins} eyebrow={canManage ? "Member benefits" : "Bookkeeper · Member benefits"} title="Patronage Refunds" description="Yearly refunds based on each member’s qualifying equipment rentals and the saved refund rate. January–December; POS products are excluded." actions={<div className="flex flex-wrap gap-2">{canManage && <button onClick={() => { setBasis(null); setBasisError(""); setCreateOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-coop-control bg-coop-forest px-4 text-sm font-bold text-white"><Plus className="size-4" />New yearly period</button>}<button disabled={Boolean(busy)} onClick={() => void load(selectedId)} className="inline-flex min-h-11 items-center gap-2 rounded-coop-control border border-coop-border bg-coop-surface px-4 text-sm font-bold text-coop-forest"><RefreshCw className="size-4" />Refresh</button></div>} />
    {period?.policyVersion === policy && period.allocatedRefund > period.refundPool && <p role="alert" className="rounded-coop-panel border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Calculated refunds exceed the allocated pool. Review funding before finalization.</p>}
    <PatronageCapitalReviewPanel canReview={mode === "bookkeeper"} onProcessed={() => void load(selectedId)} />
    {error && <ErrorState message={error} onRetry={() => void load(selectedId)} />}
    {!data && !error && <LoadingSkeleton />}
    {data && <>
      <section className="rounded-coop-panel border border-coop-border bg-coop-surface p-4"><label htmlFor="patronage-period" className="mb-2 block text-sm font-bold text-coop-forest">Patronage year / historical period</label><StyledSelect id="patronage-period" aria-label="Patronage period" value={period ? `${period.name} — ${period.status}` : "No periods yet"} disabled={!periodLabels.length} options={periodLabels} onChange={(value) => { setSelectedId(data.periods.find((item) => `${item.name} — ${item.status}` === value)?.id); setAllocationPage(1); }} /></section>
      {period ? <>
        {period.policyVersion === fixedPolicy && <p role="status" className="rounded-coop-panel border border-coop-border bg-coop-sage p-4 text-sm text-coop-secondary">This existing period retains its original fixed 3% rental policy. New periods use the configured member rental refund rate.</p>}
        {legacy && <div role="alert" className="flex gap-3 rounded-coop-panel border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><AlertTriangle className="mt-1 size-5 shrink-0" /><p><strong>Legacy records — review required.</strong> These amounts were created under the previous policy and have not been changed. New payouts and Share Capital transfers are blocked. A legacy period overlapping a calendar year must be reconciled before a new annual period can be created.</p></div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label={legacy ? "Historical patronage" : "Eligible equipment rentals"} value={currency(period.totalPatronage)} icon={Tractor} /><SummaryCard label={legacy ? "Historical refund total" : `Refund pool (${(period.refundRate ?? 0).toFixed(2)}% rate)`} value={currency(period.refundPool)} icon={HandCoins} /><SummaryCard label="Members with allocations" value={String(period.memberCount)} icon={UsersRound} /><SummaryCard label="Paid allocations" value={String(period.paidCount)} icon={CheckCircle2} /></div>
        <section className="rounded-2xl border border-coop-border bg-coop-surface p-5 shadow-coop-soft"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-coop-forest">{period.name}</h2><p className="mt-1 text-sm text-coop-secondary">{period.startDate} to {period.endDate}</p><div className="mt-2"><StatusBadge tone={statusTone(period.status)}>{period.status}</StatusBadge></div></div>{canManage && period.status === "Draft" && <div className="flex flex-wrap gap-2"><button disabled={Boolean(busy)} onClick={() => void run("Yearly refunds calculated", () => recalculatePatronagePeriod(period.id))} className="inline-flex min-h-11 items-center gap-2 rounded-coop-control border border-coop-border px-3 text-sm font-bold text-coop-forest disabled:opacity-50"><Calculator className="size-4" />Calculate refunds</button><button disabled={Boolean(busy) || legacy || !allocations.length || (period.policyVersion === policy && period.allocatedRefund > period.refundPool) || Number(period.endDate.slice(0, 4)) >= year} onClick={() => void run("Yearly refunds finalized", () => finalizePatronagePeriod(period.id))} className="min-h-11 rounded-coop-control bg-coop-forest px-4 text-sm font-bold text-white disabled:opacity-50">Finalize yearly refunds</button></div>}</div><p className="mt-3 text-sm leading-6 text-coop-secondary">Only completed, fully paid equipment rentals that began after the True Member effective date qualify. The year is when the rental is both completed and payment is validated. Cancelled, unpaid, reversed/refunded payments, facility rentals, and POS purchases are excluded.</p>{period.policyVersion === policy && <p className="mt-2 text-sm leading-6 text-coop-secondary">Saved financial basis: {currency(period.netSurplus ?? 0)} net surplus − {currency(period.statutoryReserves ?? 0)} statutory deductions, with {period.allocationRate}% allocated to refunds. Member refund = qualifying rentals × {period.refundRate}%. Unallocated pool: {currency(Math.max(0, period.refundPool - period.allocatedRefund))}.</p>}{period.status === "Draft" && <p className="mt-2 text-sm font-semibold text-coop-secondary">Review the calculations, then finalize after December 31. Finalized amounts are locked; the Bookkeeper records payouts.</p>}</section>
        {allocations.length ? <><DataTable><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-coop-sage text-xs uppercase text-coop-secondary"><tr>{['Member','Type', ...(legacy ? ['Historical POS','Historical rentals','Historical share'] : ['Eligible rentals', fixedRate ? 'Refund rate' : 'Share of rental patronage']), 'Refund','Status','Action'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-coop-border">{visible.map((item) => <tr key={item.id} className="hover:bg-coop-sage/40"><td className="px-4 py-3 font-semibold text-coop-forest">{item.memberName}<span className="block text-xs font-normal text-coop-secondary">{item.memberCode}</span></td><td className="px-4 py-3">{item.membershipType}</td>{legacy && <td className="px-4 py-3"><CurrencyDisplay value={item.purchasePatronage} /></td>}<td className="px-4 py-3"><CurrencyDisplay value={item.rentalPatronage} /></td><td className="px-4 py-3">{fixedRate ? `${(period.refundRate ?? 3).toFixed(2)}%` : `${item.patronageSharePercent.toFixed(2)}%`}</td><td className="px-4 py-3"><CurrencyDisplay value={item.refundAmount} />{(item.capitalizedAmount ?? 0) > 0 && <p className="text-xs text-coop-secondary">{currency(item.capitalizedAmount ?? 0)} added to capital</p>}</td><td className="px-4 py-3"><StatusBadge tone={statusTone(item.paymentStatus)}>{item.refundAmount === 0 ? 'No payout due' : item.paymentStatus}</StatusBadge>{(item.pendingCapitalAmount ?? 0) > 0 && <p className="mt-1 text-xs text-coop-secondary">Capital transfer pending</p>}</td><td className="px-4 py-3">{!legacy && period.status !== 'Draft' && item.paymentStatus === 'Pending' && <button disabled={Boolean(busy) || item.membershipType !== 'True Member' || (item.pendingCapitalAmount ?? 0) > 0 || (item.availableRefund ?? 0) <= 0} onClick={() => { if (window.confirm(`Confirm ${currency(item.availableRefund ?? 0)} in cash was given to ${item.memberName}?`)) void run("Refund payment recorded", () => markPatronageRefundPaid(item.id)); }} className="min-h-10 rounded-coop-control border border-coop-border px-3 text-xs font-bold text-coop-green disabled:opacity-50">Mark paid</button>}</td></tr>)}</tbody></table></DataTable><PaginationControls currentPage={allocationPage} totalPages={pageCount} totalItems={allocations.length} itemName="members" onPageChange={setAllocationPage} pageSize={pageSize} pageSizeOptions={[5, 10, 20, 50]} onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setAllocationPage(1); }} /></> : <EmptyState icon={Calculator} title="No calculated refunds yet" description="The chairman calculates refunds using the saved rental refund rate before finalizing the year." />}
      </> : <EmptyState icon={HandCoins} title="No patronage period yet" description="The chairman can create a January–December period for eligible True Member equipment rentals." />}
    </>}
    {canManage && <FormDialog open={createOpen} onOpenChange={setCreateOpen} title="New yearly patronage period" description="Record the reviewed rental business surplus and statutory deductions. Each member’s refund uses the rate saved in Settings." contentClassName="w-[min(42rem,calc(100vw-2rem))]"><form onSubmit={create} className="mt-4 grid gap-4"><FormField label="Calendar year" required><StyledSelect aria-label="Calendar year" value={draft.startDate.slice(0,4)} options={Array.from({ length: 8 }, (_, index) => String(year - index))} onChange={(value) => { setBasis(null); setBasisError(''); setDraft((old) => ({ ...old, name: `${value} Patronage Refund`, startDate: `${value}-01-01`, endDate: `${value}-12-31`, netSurplus: "", statutoryReserves: "" })); }} /></FormField><p className="text-sm text-coop-secondary">Coverage: {draft.startDate} to {draft.endDate}. Only one non-overlapping period per year is allowed.</p><FormField label="Period name" required><input required minLength={3} maxLength={120} className={inputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></FormField>{basisError && <ErrorState message={basisError} />}{!basis && !basisError && <p role="status" className="text-sm text-coop-secondary">Calculating eligible rentals…</p>}{basis && <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Reviewed rental business net surplus (PHP)" required><input aria-label="Reviewed rental business net surplus (PHP)" required type="number" min="0.01" max="999999999999.99" step="0.01" className={inputClass} value={draft.netSurplus} onChange={(event) => setDraft({ ...draft, netSurplus: event.target.value })} /></FormField>
        <FormField label="Applicable statutory funds / reserves (PHP)" required><input aria-label="Applicable statutory funds / reserves (PHP)" required type="number" min="0" max={draft.netSurplus || "999999999999.99"} step="0.01" className={inputClass} value={draft.statutoryReserves} onChange={(event) => setDraft({ ...draft, statutoryReserves: event.target.value })} /></FormField>
      </div>
      <p className="text-sm leading-6 text-coop-secondary">Use the reviewed rental business accounts, including its allocated common expenses. Enter all applicable statutory deductions, not just the Reserve Fund. The saved policy allocates {basis.allocationRate ?? 30}% of the remainder to this refund pool.</p>
      <div className="grid gap-3 rounded-coop-panel border border-coop-border bg-coop-sage p-4 sm:grid-cols-2">
        <p className="text-sm text-coop-secondary">Eligible rentals<strong className="mt-1 block text-xl text-coop-forest">{currency(basis.eligibleMemberPatronage)}</strong><span className="block text-xs">{basis.eligibleMemberCount} eligible True Member(s)</span></p>
        <p className="text-sm text-coop-secondary">Allocated refund pool<strong className="mt-1 block text-xl text-coop-forest">{validBasis ? currency(computedPool) : 'Enter financial basis'}</strong><span className="block text-xs">Member refund rate: {computedRate.toFixed(2)}%</span><span className="block text-xs">Estimated member refunds: {currency(basis.estimatedRefund ?? 0)}</span></p>
      </div>
      <p className="text-sm leading-6 text-coop-secondary">Before finalization, review the approved surplus allocation, by-laws, entitlement rules and CDA limit of twice the Interest on Share Capital rate. This form records the reviewed amounts; it does not verify those approvals.</p>
    </>}<FormField label="Notes"><textarea maxLength={4000} className="min-h-24 w-full rounded-coop-control border border-coop-border p-3 text-sm" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></FormField><button disabled={Boolean(busy) || !basis || basis.eligibleMemberPatronage <= 0 || !validBasis} className="min-h-11 rounded-coop-control bg-coop-forest px-4 text-sm font-bold text-white disabled:opacity-50">{busy === 'Creating yearly period' ? 'Creating…' : 'Create yearly period'}</button></form></FormDialog>}
  </div>;
}
export function BookkeeperPatronageClient() { return <ChairmanPatronageClient mode="bookkeeper" />; }
