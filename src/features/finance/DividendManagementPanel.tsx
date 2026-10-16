// @ts-nocheck
"use client";
// This legacy alias is not mounted; the preview-enabled panel is the active implementation.

import { useCallback, useEffect, useRef, useState } from "react";
import { HandCoins, Plus, RefreshCcw, Send, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { CurrencyDisplay, DataTable, EmptyState, ErrorState, StatusBadge } from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  completeDividendWithdrawal,
  createDividendDeclaration,
  listDividendDeclarations,
  listDividendWithdrawalRequests,
  publishDividendDeclaration,
  type DividendDeclaration,
  type DividendWithdrawalRequest,
} from "./finance-api";

type DialogState =
  | { kind: "create" }
  | { kind: "publish"; declaration: DividendDeclaration }
  | { kind: "withdrawal"; withdrawal: DividendWithdrawalRequest }
  | null;

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function message(error: unknown) {
  return error instanceof ApiClientError ? error.message : "The dividend action could not be completed.";
}

export function DividendManagementPanel({ role }: { role: "chairman" | "bookkeeper" }) {
  const [declarations, setDeclarations] = useState<DividendDeclaration[]>([]);
  const [withdrawals, setWithdrawals] = useState<DividendWithdrawalRequest[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  const [form, setForm] = useState({ name: "", coverageStart: "", coverageEnd: "", availableDate: "", netSurplus: "", statutoryReserves: "", interestAllocationRate: "", notes: "" });
  const [payout, setPayout] = useState({ referenceNumber: "", notes: "" });

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      if (role === "chairman") setDeclarations(await listDividendDeclarations());
      else setWithdrawals(await listDividendWithdrawalRequests());
      setError("");
    } catch (caught) {
      if (!silent) setError(message(caught));
    } finally {
      inFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !dialog) void load({ silent: true });
    }, 15_000);
    return () => { window.clearTimeout(firstLoad); window.clearInterval(timer); };
  }, [dialog, load]);

  function closeDialog() {
    if (busy) return;
    setDialog(null);
    setError("");
  }

  async function submitCreate() {
    const netSurplus = Number(form.netSurplus);
    const statutoryReserves = Number(form.statutoryReserves);
    const interestAllocationRate = Number(form.interestAllocationRate);
    if (!form.name.trim() || !form.coverageStart || !form.coverageEnd || !form.availableDate || !Number.isFinite(netSurplus) || netSurplus < 0 || !Number.isFinite(statutoryReserves) || statutoryReserves < 0 || statutoryReserves > netSurplus || !Number.isFinite(interestAllocationRate) || interestAllocationRate < 0 || interestAllocationRate > 70) {
      setError("Complete all required fields and enter valid surplus, reserve, and allocation values.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createDividendDeclaration({
        name: form.name.trim(),
        coverageStart: form.coverageStart,
        coverageEnd: form.coverageEnd,
        availableAt: `${form.availableDate}T00:00:00+08:00`,
        netSurplus,
        statutoryReserves,
        interestAllocationRate,
        notes: form.notes.trim() || null,
      });
      toast.success("Dividend declaration created. Review it before publishing.");
      setForm({ name: "", coverageStart: "", coverageEnd: "", availableDate: "", netSurplus: "", statutoryReserves: "", interestAllocationRate: "", notes: "" });
      setDialog(null);
      await load({ silent: true });
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }

  async function submitPublish(declaration: DividendDeclaration) {
    setBusy(true);
    setError("");
    try {
      await publishDividendDeclaration(declaration.id);
      toast.success("Dividend published and made available to members.");
      setDialog(null);
      await load({ silent: true });
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }

  async function submitWithdrawal(withdrawal: DividendWithdrawalRequest) {
    if (payout.referenceNumber.trim().length < 2) {
      setError("Enter the official payout reference number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await completeDividendWithdrawal(withdrawal.id, { referenceNumber: payout.referenceNumber.trim(), notes: payout.notes.trim() || null });
      toast.success("Dividend withdrawal completed and recorded in the financial ledger.");
      setPayout({ referenceNumber: "", notes: "" });
      setDialog(null);
      await load({ silent: true });
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-xl border border-[#CAD8CB] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#E2E8E2] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Dividends</p><h2 className="mt-1 text-xl font-black text-[#123D2A]">{role === "chairman" ? "Dividend declarations" : "Dividend withdrawals"}</h2><p className="mt-1 text-sm text-[#5D6D63]">{role === "chairman" ? "Calculate dividends from each active member's current Share Capital balance." : "Process member payout requests without changing their Share Capital balance."}</p></div>
        <div className="flex gap-2">
          <button type="button" disabled={loading} onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-[#CAD8CB] px-3 py-2 text-sm font-bold text-[#123D2A] disabled:opacity-50"><RefreshCcw className="size-4" /> Refresh</button>
          {role === "chairman" ? <button type="button" disabled={Boolean(dialog)} onClick={() => { setError(""); setDialog({ kind: "create" }); }} className="inline-flex items-center gap-2 rounded-md bg-[#123D2A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1F6B43] disabled:opacity-50"><Plus className="size-4" /> New declaration</button> : null}
        </div>
      </div>
      {error && !dialog ? <div className="p-5"><ErrorState message={error} onRetry={() => void load()} /></div> : null}
      {role === "chairman" ? (
        declarations.length ? <DataTable><table className="min-w-[940px] w-full text-left text-sm"><thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-4 py-3">Declaration</th><th className="px-4 py-3">Coverage</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Declared total</th><th className="px-4 py-3 text-center">Members</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#E5ECE5]">{declarations.map((item) => <tr key={item.id}><td className="px-4 py-4"><p className="font-bold text-[#123D2A]">{item.name}</p><p className="mt-1 text-xs text-[#6C7A70]">{item.calculationMethod}</p></td><td className="px-4 py-4">{date(item.coverageStart)} – {date(item.coverageEnd)}</td><td className="px-4 py-4 text-right font-bold">{item.dividendRate ?? 0}%</td><td className="px-4 py-4 text-right"><CurrencyDisplay value={item.totalDeclaredAmount} /></td><td className="px-4 py-4 text-center">{item.memberCount}</td><td className="px-4 py-4"><StatusBadge tone={item.status === "Published" ? "success" : "warning"}>{item.status}</StatusBadge></td><td className="px-4 py-4 text-right">{item.status === "Draft" || item.status === "Approved" ? <button type="button" disabled={Boolean(dialog)} onClick={() => { setError(""); setDialog({ kind: "publish", declaration: item }); }} className="inline-flex items-center gap-2 rounded-md bg-[#123D2A] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Send className="size-3.5" /> Publish</button> : <span className="text-xs text-[#6C7A70]">{item.capitalizedCount} capitalized · {item.withdrawnCount} withdrawn</span>}</td></tr>)}</tbody></table></DataTable> : !loading && !error ? <div className="p-5"><EmptyState icon={HandCoins} title="No dividend declaration yet" description="Create a draft to calculate allocations from current member Share Capital balances." /></div> : null
      ) : withdrawals.length ? <DataTable><table className="min-w-[860px] w-full text-left text-sm"><thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#365F4A]"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Declaration</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#E5ECE5]">{withdrawals.map((item) => <tr key={item.id}><td className="px-4 py-4"><p className="font-bold text-[#123D2A]">{item.memberName}</p><p className="text-xs text-[#6C7A70]">{item.memberCode}</p></td><td className="px-4 py-4">{item.declarationName}</td><td className="px-4 py-4">{item.decidedAt ? date(item.decidedAt) : "—"}</td><td className="px-4 py-4 text-right"><CurrencyDisplay value={item.amount} /></td><td className="px-4 py-4"><StatusBadge tone="warning">{item.status}</StatusBadge></td><td className="px-4 py-4 text-right"><button type="button" disabled={Boolean(dialog)} onClick={() => { setError(""); setPayout({ referenceNumber: "", notes: "" }); setDialog({ kind: "withdrawal", withdrawal: item }); }} className="rounded-md bg-[#123D2A] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Record payout</button></td></tr>)}</tbody></table></DataTable> : !loading && !error ? <div className="p-5"><EmptyState icon={WalletCards} title="No withdrawal requests" description="Member dividend withdrawal requests will appear here automatically." /></div> : null}

      {dialog ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F6B43]">Dividend workflow</p><h3 className="mt-1 text-xl font-black text-[#123D2A]">{dialog.kind === "create" ? "New dividend declaration" : dialog.kind === "publish" ? "Publish dividend declaration?" : "Complete dividend withdrawal"}</h3></div><button type="button" disabled={busy} onClick={closeDialog} className="rounded-md border border-[#CAD8CB] p-2" aria-label="Close"><X className="size-4" /></button></div>
        {dialog.kind === "create" ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 text-sm font-bold text-[#294B39]">Declaration name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" /></label><label className="text-sm font-bold text-[#294B39]">Coverage start<input type="date" value={form.coverageStart} onChange={(event) => setForm((current) => ({ ...current, coverageStart: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" /></label><label className="text-sm font-bold text-[#294B39]">Coverage end<input type="date" value={form.coverageEnd} onChange={(event) => setForm((current) => ({ ...current, coverageEnd: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" /></label><label className="text-sm font-bold text-[#294B39]">Distribution date<input type="date" value={form.availableDate} onChange={(event) => setForm((current) => ({ ...current, availableDate: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" /></label><label className="text-sm font-bold text-[#294B39]">Dividend rate (%)<input type="number" min="0.000001" max="70" step="0.01" value={form.dividendRate} onChange={(event) => setForm((current) => ({ ...current, dividendRate: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" /></label><label className="sm:col-span-2 text-sm font-bold text-[#294B39]">Notes<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1 min-h-24 w-full rounded-md border border-[#CAD8CB] p-3 font-normal" /></label></div> : dialog.kind === "publish" ? <div className="mt-5 space-y-4"><div className="rounded-xl bg-[#F4F7F2] p-4"><p className="font-black text-[#123D2A]">{dialog.declaration.name}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><p><span className="block text-[#6C7A70]">Members</span><strong>{dialog.declaration.memberCount}</strong></p><p><span className="block text-[#6C7A70]">Total dividend</span><strong>{money(dialog.declaration.totalDeclaredAmount)}</strong></p></div></div><p className="text-sm leading-6 text-[#42594B]">Publishing makes every allocation available for the member to withdraw or add to Share Capital. This declaration can no longer be silently edited.</p></div> : <div className="mt-5 space-y-4"><div className="rounded-xl bg-[#F4F7F2] p-4"><p className="font-black text-[#123D2A]">{dialog.withdrawal.memberName}</p><p className="mt-1 text-2xl font-black text-[#123D2A]">{money(dialog.withdrawal.amount)}</p></div><label className="block text-sm font-bold text-[#294B39]">Official payout reference<input value={payout.referenceNumber} onChange={(event) => setPayout((current) => ({ ...current, referenceNumber: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-[#CAD8CB] px-3 font-normal" /></label><label className="block text-sm font-bold text-[#294B39]">Processing notes<textarea value={payout.notes} onChange={(event) => setPayout((current) => ({ ...current, notes: event.target.value }))} className="mt-1 min-h-20 w-full rounded-md border border-[#CAD8CB] p-3 font-normal" /></label></div>}
        {error ? <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}<div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={closeDialog} className="rounded-md border border-[#CAD8CB] px-4 py-2.5 font-bold text-[#123D2A] disabled:opacity-50">Cancel</button><button type="button" disabled={busy} onClick={() => void (dialog.kind === "create" ? submitCreate() : dialog.kind === "publish" ? submitPublish(dialog.declaration) : submitWithdrawal(dialog.withdrawal))} className="rounded-md bg-[#123D2A] px-4 py-2.5 font-bold text-white disabled:opacity-50">{busy ? "Processing…" : dialog.kind === "create" ? "Create draft" : dialog.kind === "publish" ? "Publish dividends" : "Complete payout"}</button></div></div></div> : null}
    </section>
  );
}
