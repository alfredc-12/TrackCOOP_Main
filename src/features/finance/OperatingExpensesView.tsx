"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Download, FileText, Plus, ReceiptText, RefreshCcw, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { CurrencyDisplay, DataTable, ErrorState, LoadingSkeleton, StatCard, StatusBadge } from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  createOperatingExpense,
  getOperatingExpenseReport,
  listOperatingExpenses,
  operatingExpenseTypes,
  type OperatingExpenseSummary,
  type OperatingExpenseType,
} from "./finance-api";

const inputClass = "h-11 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20";

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function yearRange() {
  const year = new Date().getFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ExpenseTypeSelect({ value, onChange }: { value: OperatingExpenseType; onChange: (value: OperatingExpenseType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Select expense type"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-[#CAD8CB] bg-white px-3 text-left text-sm font-bold text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
      >
        <span className="truncate">{value}</span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div role="listbox" className="absolute z-40 mt-2 w-full overflow-hidden rounded-md border border-[#CAD8CB] bg-white p-1 shadow-[0_14px_30px_rgba(18,61,42,0.18)]">
          {operatingExpenseTypes.map((type) => (
            <button
              key={type}
              type="button"
              role="option"
              aria-selected={type === value}
              onClick={() => {
                onChange(type);
                setOpen(false);
              }}
              className={`w-full rounded px-3 py-2.5 text-left text-sm ${type === value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F2FAF3]"}`}
            >
              {type}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OperatingExpensesView() {
  const [summary, setSummary] = useState<OperatingExpenseSummary | null>(null);
  const [filters, setFilters] = useState(yearRange);
  const [form, setForm] = useState({
    expenseType: "Salaries" as OperatingExpenseType,
    otherDescription: "",
    amount: "",
    expenseDate: localDate(),
    remarks: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");
  const refreshInFlight = useRef(false);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) {
      setIsLoading(true);
      setError("");
    }
    try {
      setSummary(await listOperatingExpenses(filters));
      setError("");
    } catch (caught) {
      if (!silent) {
        setError(caught instanceof ApiClientError ? caught.message : "Operating expenses could not be loaded.");
      }
    } finally {
      refreshInFlight.current = false;
      if (!silent) setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const topExpense = useMemo(() => {
    const totals = summary?.byType ?? [];
    return totals.reduce((top, item) => item.total > top.total ? item : top, { expenseType: "Other" as OperatingExpenseType, total: 0, count: 0 });
  }, [summary]);

  async function submitExpense(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid expense amount.");
      return;
    }
    if (form.expenseType === "Other" && !form.otherDescription.trim()) {
      toast.error("Please specify the other expense type.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createOperatingExpense({
        expenseType: form.expenseType,
        otherDescription: form.expenseType === "Other" ? form.otherDescription.trim() : null,
        amount,
        expenseDate: form.expenseDate,
        remarks: form.remarks.trim() || null,
      });
      toast.success("Operating expense recorded and posted.");
      setForm((current) => ({ ...current, otherDescription: "", amount: "", remarks: "" }));
      await load();
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Operating expense could not be recorded.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function downloadReport() {
    setIsDownloading(true);
    try {
      const { blob, fileName } = await getOperatingExpenseReport(filters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Operating expenses document downloaded.");
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Operating expenses document could not be downloaded.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <section className="space-y-5 rounded-lg border border-[#CAD8CB] bg-[#FBFCF8] p-4 shadow-[0_10px_24px_rgba(18,61,42,0.06)] sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#D8A011]">Finance</p>
          <h2 className="mt-2 text-2xl font-black text-[#123D2A]">Operating Expenses</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5D6D63]">Record cooperative operating costs and download the posted expense document for the selected period.</p>
        </div>
        <div className="rounded-lg border border-[#D9E2D8] bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[11rem_11rem_auto_auto] xl:items-end">
            <label className="grid gap-1 text-xs font-bold uppercase text-[#5D6D63]">
              From
              <input className={inputClass} type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-[#5D6D63]">
              To
              <input className={inputClass} type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} />
            </label>
            <button type="button" onClick={() => void load()} disabled={isLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:opacity-60">
              <RefreshCcw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button type="button" onClick={() => void downloadReport()} disabled={isDownloading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43] disabled:opacity-60">
              <Download className="size-4" />
              {isDownloading ? "Downloading..." : "Download PDF"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Operating Total" value={money(summary?.total ?? 0)} icon={TrendingDown} />
        <StatCard label="Expense Records" value={String(summary?.count ?? 0)} icon={ReceiptText} />
        <div className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6C7A70]">Largest Type</p>
              <p className="mt-1 break-words text-xl font-black leading-tight text-[#123D2A]">{topExpense.total > 0 ? topExpense.expenseType : "None"}</p>
              <p className="mt-1 text-xs font-bold text-[#5D6D63]">{topExpense.total > 0 ? money(topExpense.total) : money(0)}</p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#EEF2EC] text-[#1F6B43]">
              <FileText className="size-5" aria-hidden="true" />
            </span>
          </div>
        </div>
        <StatCard label="Patronage Basis" value="Posted" icon={CalendarDays} />
      </div>

      <form onSubmit={submitExpense} className="rounded-lg border border-[#CAD8CB] bg-white p-4">
        <div className={`grid gap-3 ${form.expenseType === "Other" ? "xl:grid-cols-[1.05fr_1.05fr_0.82fr_0.82fr_1.2fr_auto]" : "xl:grid-cols-[1.1fr_0.8fr_0.8fr_1.3fr_auto]"} xl:items-end`}>
          <label className="grid gap-2 text-sm font-bold text-[#294B39]">
            Expense type
            <ExpenseTypeSelect value={form.expenseType} onChange={(expenseType) => setForm((current) => ({ ...current, expenseType }))} />
          </label>
          {form.expenseType === "Other" ? (
            <label className="grid gap-2 text-sm font-bold text-[#294B39]">
              Please specify
              <input className={inputClass} required value={form.otherDescription} onChange={(event) => setForm((current) => ({ ...current, otherDescription: event.target.value }))} placeholder="Example: Permit renewal" />
            </label>
          ) : null}
          <label className="grid gap-2 text-sm font-bold text-[#294B39]">
            Date
            <input className={inputClass} required type="date" value={form.expenseDate} onChange={(event) => setForm((current) => ({ ...current, expenseDate: event.target.value }))} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#294B39]">
            Amount
            <input className={inputClass} required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#294B39]">
            Notes
            <input className={inputClass} value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} placeholder="Optional" />
          </label>
          <button type="submit" disabled={isSubmitting} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-black text-white hover:bg-[#1F6B43] disabled:opacity-60">
            <Plus className="size-4" />
            {isSubmitting ? "Saving..." : "Add"}
          </button>
        </div>
      </form>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {isLoading ? <LoadingSkeleton /> : (
        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <DataTable>
            <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
              <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
                <tr><th className="px-5 py-4 text-left">Type</th><th className="px-5 py-4 text-center">Records</th><th className="px-5 py-4 text-center">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                {(summary?.byType ?? []).map((item) => (
                  <tr key={item.expenseType} className="hover:bg-[#F7F8F3]">
                    <td className="px-5 py-4 font-bold text-[#123D2A]">{item.expenseType}</td>
                    <td className="px-5 py-4 text-center">{item.count}</td>
                    <td className="px-5 py-4 text-center"><CurrencyDisplay value={item.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>

          <DataTable>
            <table className="min-w-[720px] divide-y divide-[#E2E8E2] text-left text-sm">
              <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
                <tr><th className="px-5 py-4 text-left">Record</th><th className="px-5 py-4 text-left">Expense</th><th className="px-5 py-4 text-center">Amount</th><th className="px-5 py-4 text-center">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                {(summary?.items ?? []).slice(0, 10).map((item) => (
                  <tr key={item.id} className="hover:bg-[#F7F8F3]">
                    <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{item.recordNumber}</p><p className="mt-1 text-xs text-[#6C7A70]">{formatDate(item.expenseDate)}</p></td>
                    <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{item.expenseType}</p><p className="mt-1 line-clamp-1 text-xs text-[#6C7A70]">{item.remarks ?? item.categoryName}</p></td>
                    <td className="px-5 py-4 text-center"><CurrencyDisplay value={item.amount} /></td>
                    <td className="px-5 py-4 text-center"><StatusBadge tone="success">Posted</StatusBadge></td>
                  </tr>
                ))}
                {summary?.items.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm font-semibold text-[#6C7A70]">No operating expenses for this period.</td></tr>
                ) : null}
              </tbody>
            </table>
          </DataTable>
        </div>
      )}
    </section>
  );
}
