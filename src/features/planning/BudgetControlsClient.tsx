"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Plus, RefreshCcw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { ErrorState, LoadingSkeleton, StatCard, StatusBadge } from "@/components/portal/PortalPrimitives";
import { DatePicker } from "@/components/ui/DatePicker";
import { ApiClientError } from "@/lib/api-client";
import { listFinancialCategories, type FinancialCategory } from "@/features/finance/finance-api";
import { listSeasons, type Season } from "./planning-api";
import { createBudget, getBudgetSummary, listBudgets, updateBudgetStatus, type Budget, type BudgetInput, type BudgetSummary } from "./planning-api";

const inputClass = "h-11 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20";
type DraftLine = { financialCategoryId: string; seasonId: string; limitAmount: string; warningPercentage: string; hardLimit: boolean };
type DraftLineErrors = Partial<Record<"financialCategoryId" | "limitAmount" | "warningPercentage", string>>;
type BudgetFormErrors = Partial<Record<"budgetName" | "coverageStart" | "coverageEnd" | "lines", string>>;

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

function statusTone(status: Budget["budgetStatus"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "Approved") return "success";
  if (status === "Closed") return "neutral";
  if (status === "Pending Approval") return "warning";
  return "neutral";
}

function BudgetSelect({ value, onChange, options, placeholder, label, error }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; placeholder: string; label: string; error?: string }) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  function chooseOption(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div ref={selectRef} className="relative min-w-0">
      <span className={`mb-2 block text-sm font-bold ${error ? "text-[#B42318]" : "text-[#294B39]"}`}>{label}</span>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`${inputClass} flex items-center justify-between gap-3 text-left font-normal ${error ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`}>
        <span className={`truncate ${selectedOption ? "text-[#123D2A]" : "text-[#6C7A70]"}`}>{selectedOption?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-[#123D2A] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div role="listbox" aria-label={placeholder} className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-md border border-[#CAD8CB] bg-white p-1 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">
        {options.map((option) => {
          const isSelected = option.value === value;
          return <button key={option.value || "empty"} type="button" role="option" aria-selected={isSelected} onClick={() => chooseOption(option.value)} className={`flex min-h-10 w-full items-center rounded px-3 text-left text-sm transition ${isSelected ? "bg-[#E8F3E9] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F3F8F2]"}`}>{option.label}</button>;
        })}
      </div> : null}
      {error ? <p className="mt-1 text-xs font-semibold text-[#B42318]">{error}</p> : null}
    </div>
  );
}

export function BudgetControlsClient({ canManageBudgets = true }: { canManageBudgets?: boolean }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<BudgetInput>({ budgetName: "", coverageStart: `${new Date().getFullYear()}-01-01`, coverageEnd: `${new Date().getFullYear()}-12-31`, notes: "", lines: [] });
  const [formErrors, setFormErrors] = useState<BudgetFormErrors>({});
  const [draftLine, setDraftLine] = useState<DraftLine>({ financialCategoryId: "", seasonId: "", limitAmount: "", warningPercentage: "80", hardLimit: true });
  const [draftLineErrors, setDraftLineErrors] = useState<DraftLineErrors>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextBudgets, nextSummary, nextCategories, nextSeasons] = await Promise.all([
        listBudgets(),
        getBudgetSummary(),
        listFinancialCategories(),
        listSeasons(),
      ]);
      setBudgets(nextBudgets);
      setSummary(nextSummary);
      setCategories(nextCategories.filter((category) => category.categoryType !== "Income" && category.isActive));
      setSeasons(nextSeasons);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Budget controls could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const availableCategories = useMemo(() => categories.filter((category) => !form.lines.some((line) => line.financialCategoryId === category.id && !line.seasonId)), [categories, form.lines]);

  function updateDraftLineText(field: "financialCategoryId" | "seasonId" | "limitAmount" | "warningPercentage", value: string) {
    setDraftLine((current) => ({ ...current, [field]: value }));
    if (field !== "seasonId") setDraftLineErrors((current) => ({ ...current, [field]: undefined }));
  }

  function addLine() {
    const amount = Number(draftLine.limitAmount);
    const warningPercentage = Number(draftLine.warningPercentage);
    const nextErrors: DraftLineErrors = {};
    if (!draftLine.financialCategoryId) nextErrors.financialCategoryId = "Select an expense category.";
    if (!draftLine.limitAmount.trim() || !Number.isFinite(amount) || amount <= 0) nextErrors.limitAmount = "Enter an approved limit greater than 0.";
    if (!Number.isFinite(warningPercentage) || warningPercentage < 1 || warningPercentage > 100) nextErrors.warningPercentage = "Enter a warning threshold from 1 to 100.";
    setDraftLineErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Complete the highlighted budget line fields.");
      return;
    }
    const line = {
      financialCategoryId: draftLine.financialCategoryId,
      seasonId: draftLine.seasonId || null,
      limitAmount: amount,
      warningPercentage,
      hardLimit: draftLine.hardLimit,
    };
    if (form.lines.some((item) => item.financialCategoryId === line.financialCategoryId && (item.seasonId ?? null) === line.seasonId)) {
      toast.error("That category and season already has a budget line.");
      return;
    }
    setForm((current) => ({ ...current, lines: [...current.lines, line] }));
    setFormErrors((current) => ({ ...current, lines: undefined }));
    setDraftLine({ financialCategoryId: "", seasonId: "", limitAmount: "", warningPercentage: "80", hardLimit: true });
    setDraftLineErrors({});
  }

  async function saveBudget(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: BudgetFormErrors = {};
    if (!form.budgetName.trim()) nextErrors.budgetName = "Budget name is required.";
    if (!form.coverageStart) nextErrors.coverageStart = "Coverage start is required.";
    if (!form.coverageEnd) nextErrors.coverageEnd = "Coverage end is required.";
    if (form.lines.length === 0) {
      nextErrors.lines = "Add at least one budget line before saving.";
      setDraftLineErrors({
        financialCategoryId: "Select an expense category.",
        limitAmount: "Enter an approved limit greater than 0.",
      });
    }
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Complete the highlighted fields before saving.");
      return;
    }
    setSaving(true);
    try {
      await createBudget({ ...form, budgetName: form.budgetName.trim(), notes: form.notes?.trim() || null });
      toast.success("Budget draft created.");
      setOpen(false);
      setForm({ budgetName: "", coverageStart: `${new Date().getFullYear()}-01-01`, coverageEnd: `${new Date().getFullYear()}-12-31`, notes: "", lines: [] });
      setFormErrors({});
      setDraftLineErrors({});
      await load();
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Budget could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function transition(id: string, action: "submit" | "approve" | "close") {
    try {
      await updateBudgetStatus(id, action);
      toast.success(action === "approve" ? "Budget approved." : action === "submit" ? "Budget submitted for approval." : "Budget closed.");
      await load();
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Budget status could not be updated.");
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Finance"
        title="Budget Controls"
        description="Set approved spending limits and see which expense categories need attention before they exceed the cooperative budget."
        actions={<div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{canManageBudgets ? <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43] sm:flex-none"><Plus className="size-4" />Create budget</button> : null}<button type="button" onClick={() => void load()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC] sm:flex-none"><RefreshCcw className="size-4" />Refresh</button></div>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Approved budget" value={money(summary?.totalLimit ?? 0)} icon={ShieldCheck} className="h-[7.5rem]" valueClassName="whitespace-nowrap text-xl tracking-tight" />
        <StatCard label="Spent" value={money(summary?.totalSpent ?? 0)} icon={CheckCircle2} className="h-[7.5rem]" valueClassName="whitespace-nowrap text-xl tracking-tight" />
        <StatCard label="Remaining" value={money(summary?.totalRemaining ?? 0)} icon={ShieldCheck} className="h-[7.5rem]" valueClassName="whitespace-nowrap text-xl tracking-tight" />
        <StatCard label="Warnings / exceeded" value={`${summary?.warningCount ?? 0} / ${summary?.exceededCount ?? 0}`} icon={AlertTriangle} className="h-[7.5rem]" valueClassName="whitespace-nowrap text-xl tracking-tight" />
      </div>
      {summary?.unbudgetedExpenseTotal ? <div role="status" className="flex items-start gap-3 rounded-lg border border-amber-200 bg-[#FFF8E7] p-4 text-[#8A4B00]"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#FFE9B0]"><AlertTriangle className="size-5" /></span><div className="min-w-0"><p className="font-black">Unbudgeted expenses need coverage</p><p className="mt-1 text-sm leading-6">{money(summary.unbudgetedExpenseTotal)} in active expenses is not assigned to an approved budget line yet.</p></div></div> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading ? <LoadingSkeleton /> : <div className="grid gap-4">{budgets.length === 0 ? <div className="grid min-h-[18rem] place-items-center rounded-lg border border-dashed border-[#B9DCC1] bg-white p-8 text-center"><div className="max-w-md"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#E8F3E9] text-[#1F6B43]"><ShieldCheck className="size-6" /></span><h2 className="mt-4 text-lg font-black text-[#123D2A]">No budgets created yet</h2><p className="mt-2 text-sm leading-6 text-[#6C7A70]">Create a draft budget with approved limits to start monitoring expenses and receive warnings before a limit is reached.</p>{canManageBudgets ? <button type="button" onClick={() => setOpen(true)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]"><Plus className="size-4" />Create first budget</button> : null}</div></div> : budgets.map((budget) => <article key={budget.id} className="rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.06)]"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-[#123D2A]">{budget.budgetName}</h2><StatusBadge tone={statusTone(budget.budgetStatus)}>{budget.budgetStatus}</StatusBadge></div><p className="mt-1 text-sm text-[#5D6D63]">{budget.coverageStart} to {budget.coverageEnd} <span aria-hidden="true">•</span> {money(budget.totalSpent)} of {money(budget.totalLimit)} used</p></div><div className="flex flex-wrap gap-2">{budget.budgetStatus === "Draft" ? <button type="button" onClick={() => void transition(budget.id, "submit")} className="min-h-10 rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A] hover:bg-[#EEF2EC]">Submit for approval</button> : null}{budget.budgetStatus === "Pending Approval" ? <button type="button" onClick={() => void transition(budget.id, "approve")} className="min-h-10 rounded-md bg-[#123D2A] px-3 text-xs font-bold text-white hover:bg-[#1F6B43]">Approve</button> : null}{budget.budgetStatus === "Approved" ? <button type="button" onClick={() => void transition(budget.id, "close")} className="min-h-10 rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A] hover:bg-[#EEF2EC]">Close budget</button> : null}</div></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{budget.lines.map((line) => <div key={line.id} className="rounded-lg border border-[#DDE8DD] bg-[#F7FAF5] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold text-[#123D2A]">{line.categoryName}</p><p className="mt-1 text-xs text-[#6C7A70]">{line.seasonName ?? "All seasons"}</p></div>{line.exceeded ? <StatusBadge tone="danger">Exceeded</StatusBadge> : line.warning ? <StatusBadge tone="warning">Warning</StatusBadge> : <StatusBadge tone="success">Within limit</StatusBadge>}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E2E9E2]"><div className={`h-full rounded-full ${line.exceeded ? "bg-red-500" : line.warning ? "bg-amber-500" : "bg-[#1F6B43]"}`} style={{ width: `${Math.min(100, Math.max(0, line.utilizationPercentage))}%` }} /></div><div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold text-[#5D6D63]"><span>{money(line.spentAmount)} spent</span><span className="font-black text-[#123D2A]">{Math.round(line.utilizationPercentage)}%</span></div></div>)}</div></article>)}</div>}
      {open ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#061B11]/45 p-4 backdrop-blur-sm"><form noValidate onSubmit={saveBudget} className="max-h-[calc(100vh-2rem)] w-[min(48rem,100%)] overflow-y-auto rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#1F6B43]">Finance</p><h2 className="mt-1 text-2xl font-black text-[#123D2A]">Create budget</h2><p className="mt-1 text-sm text-[#5D6D63]">Drafts must be submitted and approved before they can block expenses.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close create budget" className="grid size-9 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A]"><X className="size-4" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={`grid gap-2 text-sm font-bold ${formErrors.budgetName ? "text-[#B42318]" : "text-[#294B39]"} sm:col-span-2`}>Budget name<input value={form.budgetName} onChange={(event) => { setForm((current) => ({ ...current, budgetName: event.target.value })); setFormErrors((current) => ({ ...current, budgetName: undefined })); }} className={`${inputClass} ${formErrors.budgetName ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} placeholder="2026 Cooperative Operating Budget" />{formErrors.budgetName ? <p className="text-xs font-semibold text-[#B42318]">{formErrors.budgetName}</p> : null}</label><DatePicker label="Coverage start" value={form.coverageStart} onChange={(value) => setForm((current) => ({ ...current, coverageStart: value }))} min="2000-01-01" max="2100-12-31" triggerClassName="h-11 rounded-md px-3 text-sm" /><DatePicker label="Coverage end" value={form.coverageEnd} onChange={(value) => setForm((current) => ({ ...current, coverageEnd: value }))} min="2000-01-01" max="2100-12-31" triggerClassName="h-11 rounded-md px-3 text-sm" /><label className="grid gap-2 text-sm font-bold text-[#294B39] sm:col-span-2">Notes<textarea value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-20 rounded-md border border-[#CAD8CB] p-3 text-sm" /></label></div><div className="mt-5 rounded-lg border border-[#DDE8DD] bg-[#F7FAF5] p-4"><h3 className="font-black text-[#123D2A]">Budget lines</h3><p className="mt-1 text-xs text-[#6C7A70]">Set a limit per expense category and optionally apply it to a season.</p>{formErrors.lines ? <p className="mt-2 text-xs font-semibold text-[#B42318]">{formErrors.lines}</p> : null}<div className="mt-3 grid gap-3 md:grid-cols-2"><BudgetSelect label="Expense category" error={draftLineErrors.financialCategoryId} value={draftLine.financialCategoryId} onChange={(value) => updateDraftLineText("financialCategoryId", value)} placeholder="Select expense category" options={[{ value: "", label: "Select expense category" }, ...availableCategories.map((category) => ({ value: category.id, label: category.categoryName }))]} /><BudgetSelect label="Season" value={draftLine.seasonId} onChange={(value) => updateDraftLineText("seasonId", value)} placeholder="All seasons" options={[{ value: "", label: "All seasons" }, ...seasons.map((season) => ({ value: season.id, label: `${season.seasonName} ${season.seasonYear}` }))]} /><label className={`grid gap-2 text-sm font-bold ${draftLineErrors.limitAmount ? "text-[#B42318]" : "text-[#294B39]"}`}>Approved limit<input type="number" min="0" step="0.01" value={draftLine.limitAmount} onChange={(event) => updateDraftLineText("limitAmount", event.target.value)} className={`${inputClass} ${draftLineErrors.limitAmount ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} placeholder="Enter approved amount" />{draftLineErrors.limitAmount ? <p className="text-xs font-semibold text-[#B42318]">{draftLineErrors.limitAmount}</p> : null}</label><label className={`grid gap-2 text-sm font-bold ${draftLineErrors.warningPercentage ? "text-[#B42318]" : "text-[#294B39]"}`}>Warning threshold (%)<input type="number" min="1" max="100" value={draftLine.warningPercentage} onChange={(event) => updateDraftLineText("warningPercentage", event.target.value)} className={`${inputClass} ${draftLineErrors.warningPercentage ? "!border-[#D92D20] !bg-[#FFF6F5] focus:!border-[#D92D20]" : ""}`} placeholder="e.g. 80" />{draftLineErrors.warningPercentage ? <p className="text-xs font-semibold text-[#B42318]">{draftLineErrors.warningPercentage}</p> : null}</label></div><label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#294B39]"><input type="checkbox" checked={draftLine.hardLimit} onChange={(event) => setDraftLine((current) => ({ ...current, hardLimit: event.target.checked }))} className="size-4 accent-[#1F6B43]" />Block expenses after the approved limit</label><button type="button" onClick={addLine} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A] hover:bg-white"><Plus className="size-4" />Add line</button><div className="mt-4 grid gap-2">{form.lines.map((line, index) => <div key={`${line.financialCategoryId}-${line.seasonId ?? "all"}`} className="flex items-center justify-between gap-3 rounded-md border border-[#DDE8DD] bg-white px-3 py-2 text-sm"><span className="font-semibold text-[#294B39]">{categories.find((category) => category.id === line.financialCategoryId)?.categoryName ?? "Category"} <span aria-hidden="true">•</span> {line.seasonId ? seasons.find((season) => season.id === line.seasonId)?.seasonName : "All seasons"}</span><span className="flex items-center gap-2"><strong>{money(line.limitAmount)}</strong><button type="button" onClick={() => setForm((current) => ({ ...current, lines: current.lines.filter((_, itemIndex) => itemIndex !== index) }))} aria-label="Remove budget line" className="text-[#9A392A]"><X className="size-4" /></button></span></div>)}</div></div><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#294B39]">Cancel</button><button type="submit" disabled={saving} className="min-h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Save draft"}</button></div></form></div> : null}
    </div>
  );
}
