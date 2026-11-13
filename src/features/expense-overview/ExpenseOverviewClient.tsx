"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeft, ArrowUpRight, Banknote, ChevronDown, FileDown, FileSpreadsheet, GitCompareArrows, Landmark, ListChecks, Receipt, ShieldAlert,
  Sparkles, Tags, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { FilterPanel, FilterSelect, KpiCard, MoreFilters, ResultSummary, SearchableFilterSelect, SearchField, DateRangeFilter } from "@/features/people-management/PeopleFilterUi";
import { replaceUrlParams } from "@/features/people-management/people-hooks";
import type { KpiSpec } from "@/features/people-management/people-kpis";
import { RankedBars, TrendChart } from "./ExpenseCharts";
import {
  CategoryDrawer, DriversDrawer, IntegrityDrawer, LoadError, Loading, MatrixDrawer, PeriodDrawer, RecordDrawer, TotalDrawer, ledgerHref,
} from "./ExpenseDrawerViews";
import { ExpenseDrawer } from "./ExpenseDrawer";
import { MultiPicker } from "./ExpenseMultiPicker";
import { ExpenseRecordsTable } from "./ExpenseRecordsTable";
import {
  buildChips, classOptions, compareOptions, count, defaultQuery, downloadExpenseReport, errorMessage, filterParams, getExpenseCategories,
  getExpenseDrivers, getExpenseInsights, getExpenseIntegrity, getExpenseOptions, getExpenseRecords, getExpenseSources, getExpenseSummary, getExpenseTrends,
  moreFilterCount, paramsFromQuery, peso, percentText, periodOptions, queryFromParams, recordParams, saveBlob, shortDate, signedPeso,
  type ExpenseUiQuery, type ExportKind,
} from "./expense-client";
import { useExpenseData } from "./expense-hooks";

type Drawer =
  | { side: "right"; kind: "total" }
  | { side: "right"; kind: "drivers" }
  | { side: "right"; kind: "category"; id: string; name: string }
  | { side: "right"; kind: "period"; key: string }
  | { side: "right"; kind: "record"; id: string }
  | { side: "right"; kind: "integrity" }
  | { side: "left"; kind: "matrix" };

const card = "rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.05)] sm:p-5";
const ghostButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-bold text-[#123D2A] outline-none transition hover:bg-[#EEF2EC] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white outline-none transition hover:bg-[#1F6B43] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const fieldInput = "h-11 w-full rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-semibold text-[#123D2A] outline-none placeholder:font-normal placeholder:text-[#7D8C82] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/10";

const drawerTitle = (drawer: Drawer, bucketLabel?: string) => {
  switch (drawer.kind) {
    case "total": return "Total posted expenses";
    case "drivers": return "What changed in expenses";
    case "category": return drawer.name;
    case "period": return bucketLabel ?? "Period details";
    case "record": return "Expense record";
    case "integrity": return "Data integrity";
    case "matrix": return "Compare expenses";
  }
};

const exportItems: Array<{ kind: ExportKind; format: "xlsx" | "pdf"; label: string }> = [
  { kind: "summary", format: "pdf", label: "Operating expense summary (PDF)" },
  { kind: "summary", format: "xlsx", label: "Operating expense summary (Excel)" },
  { kind: "records", format: "xlsx", label: "Expense records (Excel)" },
  { kind: "records", format: "pdf", label: "Expense records (PDF)" },
  { kind: "categories", format: "xlsx", label: "Category expense breakdown (Excel)" },
  { kind: "comparison", format: "xlsx", label: "Period comparison (Excel)" },
  { kind: "sources", format: "xlsx", label: "Source module breakdown (Excel)" },
  { kind: "integrity", format: "pdf", label: "Expense integrity summary (PDF)" },
];

export function ExpenseOverviewClient() {
  const [query, setQuery] = useState<ExpenseUiQuery>(defaultQuery);
  const [draft, setDraft] = useState<ExpenseUiQuery>(defaultQuery);
  const [ready, setReady] = useState(false);
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [back, setBack] = useState<Drawer | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");

  // Read the address bar once after hydration so a shared link restores the same view.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = queryFromParams(new URLSearchParams(window.location.search));
      setQuery(restored);
      setDraft(restored);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    replaceUrlParams(() => paramsFromQuery(query));
  }, [ready, query]);

  const apply = useCallback((patch: Partial<ExpenseUiQuery>) => {
    const next = { ...query, ...patch };
    setQuery(next);
    setDraft((current) => ({ ...current, ...patch, search: next.search }));
  }, [query]);

  const key = filterParams(query).toString();
  const recordsKey = recordParams(query).toString();
  const summary = useExpenseData(`summary|${key}`, (signal) => getExpenseSummary(query, { signal }), ready);
  const trend = useExpenseData(`trend|${key}`, (signal) => getExpenseTrends(query, { signal }), ready);
  const categories = useExpenseData(`categories|${key}`, (signal) => getExpenseCategories(query, { signal }), ready);
  const sources = useExpenseData(`sources|${key}`, (signal) => getExpenseSources(query, { signal }), ready);
  const drivers = useExpenseData(`drivers|${key}`, (signal) => getExpenseDrivers(query, { signal }), ready);
  const integrity = useExpenseData(`integrity|${key}`, (signal) => getExpenseIntegrity(query, { signal }), ready);
  const insights = useExpenseData(`insights|${key}`, (signal) => getExpenseInsights(query, { signal }), ready);
  const records = useExpenseData(`records|${recordsKey}`, (signal) => getExpenseRecords(query, { signal }), ready);
  const options = useExpenseData("options", (signal) => getExpenseOptions({ signal }), ready);

  const names = useMemo(() => ({
    categories: options.data?.categories ?? [],
    recordedBy: options.data?.recordedBy ?? [],
    postedBy: options.data?.postedBy ?? [],
    seasons: options.data?.seasons ?? [],
  }), [options.data]);
  const chips = useMemo(() => buildChips(query, names), [query, names]);

  const scrollToTable = () => {
    window.setTimeout(() => document.getElementById("expense-records")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 60);
  };
  const showRecords = (patch: Partial<ExpenseUiQuery>) => {
    apply({ view: "posted", ...patch, page: 1 });
    setDrawer(null);
    setBack(null);
    scrollToTable();
  };
  const open = (next: Drawer) => { setBack(null); setDrawer(next); };
  const openFromDrawer = (next: Drawer) => { setBack(drawer); setDrawer(next); };
  const close = () => { setDrawer(null); setBack(null); };

  const reset = () => {
    setQuery({ ...defaultQuery, pageSize: query.pageSize });
    setDraft({ ...defaultQuery, pageSize: query.pageSize });
  };

  // ---- draft filters
  const draftInvalid = draft.period === "custom" && (!draft.startDate || !draft.endDate || draft.startDate > draft.endDate);
  const dirty = filterParams({ ...draft, search: query.search }).toString() !== filterParams(query).toString();
  const amountError = draft.amountMin && draft.amountMax && Number(draft.amountMin) > Number(draft.amountMax) ? "The maximum cannot be below the minimum." : null;
  const submitDraft = () => {
    const { period, startDate, endDate, compare, categoryIds, sourceModules, classes, amountMin, amountMax, recordedBy, postedBy, seasonId } = draft;
    apply({ period, startDate: period === "custom" ? startDate : undefined, endDate: period === "custom" ? endDate : undefined, compare, categoryIds, sourceModules, classes: classes.length ? classes : [...defaultQuery.classes], amountMin: amountMin || undefined, amountMax: amountMax || undefined, recordedBy, postedBy, seasonId, page: 1 });
  };
  const patchDraft = (patch: Partial<ExpenseUiQuery>) => setDraft((current) => ({ ...current, ...patch }));

  // ---- export
  const runExport = async (kind: ExportKind, format: "xlsx" | "pdf") => {
    setExporting(`${kind}-${format}`);
    setExportError("");
    try {
      const file = await downloadExpenseReport(query, kind, format);
      saveBlob(file.blob, file.filename);
    } catch (error) {
      setExportError(errorMessage(error, "The report could not be created."));
    } finally {
      setExporting(null);
    }
  };

  // ---- KPI cards
  const data = summary.data;
  const classNoun = query.classes.length === 1 && query.classes[0] === "operating" ? "operating expenses" : "expenses";
  const periodText = data ? `${shortDate(data.period.effective.startDate)} to ${shortDate(data.period.effective.endDate)}` : "";
  const hasComparison = Boolean(data?.period.previous);
  const comparisonText = data?.period.previous ? `${shortDate(data.period.previous.startDate)} to ${shortDate(data.period.previous.endDate)}` : "";
  const specs: Array<{ spec: KpiSpec<ExpenseUiQuery>; icon: typeof Wallet; hint: string; onClick: () => void }> = data ? [
    {
      icon: Wallet,
      hint: "Select to see the breakdown.",
      onClick: () => open({ side: "right", kind: "total" }),
      spec: {
        key: "total",
        label: `Total posted ${classNoun}`,
        value: peso(data.totals.amount),
        caption: `${count(data.totals.records)} ${data.totals.records === 1 ? "record" : "records"} · ${periodText}${data.period.effective.partial ? ` (${data.period.effective.days} of ${data.period.effective.periodDays} days)` : ""}`,
        tone: "neutral",
        selected: false,
        apply: {},
        clear: {},
        detail: {
          definition: `The sum of expense records classified as ${classNoun === "expenses" ? "the selected classifications" : "operating"} whose expense date falls in the period.`,
          population: "Active expense records with a posting approver, from every source module (manual, rental, POS and others). Voided, corrected, reversed and unposted records are left out, as are capital purchases and money paid out that is not an expense.",
          basis: "SUM(amount) over distinct posted expense records, using cents so no rounding drift enters the total.",
        },
      },
    },
    {
      icon: data.change.amount !== null && data.change.amount < 0 ? TrendingDown : TrendingUp,
      hint: "Select to see which categories changed.",
      onClick: () => open({ side: "right", kind: "drivers" }),
      spec: {
        key: "change",
        label: "Expense change",
        value: data.change.amount === null ? "—" : signedPeso(data.change.amount),
        caption: data.change.basis === "no_comparison"
          ? (data.period.comparisonNote ?? "No comparison selected")
          : data.change.basis === "no_previous_base"
            ? "Percentage N/A: no spending in the comparison period"
            : `${percentText(data.change.percent, true)} against ${comparisonText}`,
        tone: "neutral",
        selected: false,
        apply: {},
        clear: {},
        detail: {
          definition: "Current period expenses minus the comparison period's expenses, in pesos and as a percentage of the comparison period.",
          population: "The same posted expense records as the total. An unfinished period is compared with the same number of elapsed days of the earlier period, so a part-month is never set against a whole month.",
          basis: "Change = Current − Previous. Change % = (Current − Previous) ÷ Previous × 100, shown only when Previous is above zero. A rise or fall is a fact about recorded spending, not a verdict on it.",
        },
      },
    },
    {
      icon: Receipt,
      hint: "Select to list these records in the table.",
      onClick: () => showRecords({}),
      spec: {
        key: "records",
        label: "Expense records",
        value: count(data.totals.records),
        caption: data.totals.averageAmount === null ? "Average per record: N/A" : `Average ${peso(data.totals.averageAmount)} per record`,
        tone: "neutral",
        selected: false,
        apply: {},
        clear: {},
        detail: {
          definition: "The number of posted expense records behind the total.",
          population: "Distinct posted expense records, the same set as the total, so joins can never inflate the count.",
          basis: "Average = Total ÷ Records. It is the average amount of one record, not average monthly spending.",
        },
      },
    },
    {
      icon: Tags,
      hint: "Select to see this category's details.",
      onClick: () => (data.largestCategory ? open({ side: "right", kind: "category", id: data.largestCategory.categoryId, name: data.largestCategory.name }) : undefined),
      spec: {
        key: "largest",
        label: "Largest expense category",
        value: data.largestCategory ? data.largestCategory.name : "No data",
        caption: data.largestCategory ? `${peso(data.largestCategory.amount)} · ${data.largestCategory.share === null ? "N/A" : `${data.largestCategory.share}%`} of posted ${classNoun}` : "No posted expenses in this period",
        tone: "neutral",
        selected: false,
        apply: {},
        clear: {},
        detail: {
          definition: "The category with the highest posted total in the period, and its share of the headline total.",
          population: "Posted expense records grouped by category ID, so two categories that share a name are never merged.",
          basis: "Share = Category total ÷ Total posted expenses × 100, shown only when the total is above zero.",
        },
      },
    },
  ] : [];

  const secondary = data ? [
    { key: "unposted", label: "Unposted", value: data.secondary.unposted, hint: "Not in any posted total", onClick: () => showRecords({ view: "unposted" }), tone: "bg-[#FFF4D6] text-[#8A5A00]", icon: ShieldAlert },
    { key: "voided", label: "Voided", value: data.secondary.voided, hint: "Kept for audit", onClick: () => showRecords({ view: "voided" }), tone: "bg-[#EEF2EC] text-[#52675A]", icon: ListChecks },
    { key: "corrected", label: "Corrected or reversed", value: data.secondary.correctedOrReversed, hint: "Superseded originals", onClick: () => showRecords({ view: "corrected" }), tone: "bg-[#EAF1F8] text-[#2D5A85]", icon: ListChecks },
    { key: "classification", label: "Needs classification", value: data.secondary.needsClassification, hint: "Not counted as operating", onClick: () => showRecords({ view: "posted", classes: ["unclassified"] }), tone: "bg-[#FFF4D6] text-[#8A5A00]", icon: Tags },
  ] : [];

  const bucket = drawer?.kind === "period" ? trend.data?.buckets.find((item) => item.key === drawer.key) : undefined;
  const categoryBars = (categories.data?.items ?? []).map((item) => ({ key: item.categoryId, label: item.name, amount: item.amount, records: item.records, share: item.share, previous: item.previousAmount }));
  const sourceBars = (sources.data?.items ?? []).map((item) => ({ key: item.sourceModule, label: item.sourceModule, amount: item.amount, records: item.records, share: item.share, previous: item.previousAmount }));
  const anyPartialFailure = [summary, trend, categories, sources].find((item) => item.error);
  const filtered = chips.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Chairman · Finance"
        title="Financial Overview"
        description="What the cooperative recorded as expenses, which categories account for them, how they changed and what needs checking. Read-only: recording and posting stay with the Bookkeeper."
        actions={(
          <>
            <button type="button" onClick={() => open({ side: "left", kind: "matrix" })} className={ghostButton}><GitCompareArrows className="size-4" aria-hidden="true" />Compare expenses</button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" disabled={Boolean(exporting)} className={primaryButton}><FileDown className="size-4" aria-hidden="true" />{exporting ? "Preparing…" : "Export"}<ChevronDown className="size-4" aria-hidden="true" /></button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-[70] w-72 rounded-xl border border-[#D4E5D8] bg-white p-1.5 shadow-[0_14px_30px_rgba(18,61,42,0.18)]">
                  <DropdownMenu.Label className="px-3 py-2 text-xs font-semibold text-[#5D6D63]">Uses the period and filters on this page</DropdownMenu.Label>
                  {exportItems.map((item) => (
                    <DropdownMenu.Item key={`${item.kind}-${item.format}`} onSelect={() => void runExport(item.kind, item.format)} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[#123D2A] outline-none data-[highlighted]:bg-[#EAF3E8]">
                      {item.format === "xlsx" ? <FileSpreadsheet className="size-4 shrink-0" aria-hidden="true" /> : <FileDown className="size-4 shrink-0" aria-hidden="true" />}
                      {item.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </>
        )}
      />

      {exportError ? <div role="alert" className="rounded-md border border-[#E6B9B3] bg-[#FDF3F1] p-3 text-sm font-semibold text-[#8A2A20]">{exportError}</div> : null}

      <p className="flex items-start gap-2 rounded-md bg-[#F4F8F2] px-3 py-2 text-xs leading-5 text-[#365F4A]">
        <Banknote className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>These are expenses as recorded in the ledger. The system does not yet store when or how an expense was paid, so no cash-outflow figure is shown. Income and net surplus are in <Link href="/portal/chairman/financial-dashboard" className="font-bold underline underline-offset-4">Financial Analytics</Link>; original entries and corrections are in the <Link href={ledgerHref} className="font-bold underline underline-offset-4">Financial Ledger</Link>.</span>
      </p>

      <FilterPanel chips={chips} onRemoveChip={(chip) => apply(chip.clear)} onClearAll={reset}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterSelect label="Period" value={draft.period} onChange={(period) => patchDraft({ period })} options={periodOptions} />
          <FilterSelect label="Compare" value={draft.compare} onChange={(compare) => patchDraft({ compare })} options={compareOptions} />
          <MultiPicker label="Category" allLabel="All categories" searchable value={draft.categoryIds} onChange={(categoryIds) => patchDraft({ categoryIds })} options={names.categories.map((item) => ({ value: item.id, label: item.name, hint: item.isActive ? undefined : "Inactive category" }))} />
          <MultiPicker label="Source" allLabel="All sources" value={draft.sourceModules} onChange={(sourceModules) => patchDraft({ sourceModules })} options={(options.data?.sourceModules ?? []).map((item) => ({ value: item.value, label: item.value, hint: `${count(item.records)} expense ${item.records === 1 ? "record" : "records"}` }))} />
          <div className="sm:col-span-2 xl:col-span-4"><SearchField value={query.search} onCommit={(search) => apply({ search, page: 1 })} placeholder="Search record number, category or description" label="Search expense records" /></div>
        </div>
        {draft.period === "custom" ? (
          <DateRangeFilter label="Custom range" from={draft.startDate} to={draft.endDate} onChange={(range) => patchDraft({ startDate: range.from, endDate: range.to })} error={draftInvalid ? "Choose a start and an end date, with the start on or before the end." : null} />
        ) : null}
        <MoreFilters activeCount={moreFilterCount(draft)}>
          <MultiPicker label="Classification" allLabel="Operating expenses" value={draft.classes} onChange={(next) => patchDraft({ classes: next.length ? (next as ExpenseUiQuery["classes"]) : ["operating"] })} options={classOptions.map((item) => ({ value: item.value, label: item.label, hint: classCount(options.data?.classes, item.value) }))} />
          <div className="grid gap-1">
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs font-semibold text-[#5D6D63]">Amount from<input inputMode="decimal" value={draft.amountMin ?? ""} onChange={(event) => patchDraft({ amountMin: event.target.value.replace(/[^\d.]/g, "") || undefined })} placeholder="0.00" className={fieldInput} /></label>
              <label className="grid gap-1 text-xs font-semibold text-[#5D6D63]">Amount up to<input inputMode="decimal" value={draft.amountMax ?? ""} onChange={(event) => patchDraft({ amountMax: event.target.value.replace(/[^\d.]/g, "") || undefined })} placeholder="No limit" className={fieldInput} /></label>
            </div>
            {amountError ? <p role="alert" className="text-xs font-semibold text-[#A13226]">{amountError}</p> : null}
          </div>
          <SearchableFilterSelect label="Recorded by" value={draft.recordedBy ?? ""} allLabel="Anyone" options={names.recordedBy.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => patchDraft({ recordedBy: value || undefined })} />
          <SearchableFilterSelect label="Posted by" value={draft.postedBy ?? ""} allLabel="Anyone" options={names.postedBy.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => patchDraft({ postedBy: value || undefined })} />
          {options.data?.capabilities.seasons ? <SearchableFilterSelect label="Season" value={draft.seasonId ?? ""} allLabel="Any season" options={names.seasons.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => patchDraft({ seasonId: value || undefined })} /> : null}
        </MoreFilters>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={submitDraft} disabled={!dirty || draftInvalid || Boolean(amountError)} className={primaryButton}>Apply filters</button>
          <button type="button" onClick={reset} className={ghostButton}>Reset</button>
          {dirty ? <span role="status" className="text-xs font-semibold text-[#8A5A00]">Changes are not applied yet.</span> : null}
        </div>
      </FilterPanel>

      {anyPartialFailure ? <LoadError message={anyPartialFailure.error ?? ""} onRetry={() => { summary.retry(); trend.retry(); categories.retry(); sources.retry(); }} /> : null}

      <section aria-label="Key figures" aria-busy={summary.loading || undefined} className="grid gap-3">
        {data ? (
          <p className="text-xs text-[#5D6D63]">
            {data.period.label}: {periodText}.{data.period.effective.partial ? ` The period is still in progress, so only the ${data.period.effective.days} days that have passed are counted.` : ""}{data.period.previous ? ` Compared with ${comparisonText}.` : data.period.comparisonNote ? ` ${data.period.comparisonNote}` : ""}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data ? specs.map((item) => <KpiCard key={item.spec.key} spec={item.spec} icon={item.icon} hint={item.hint} onSelect={item.onClick} />) : (
            ["total", "change", "records", "largest"].map((placeholder) => (
              <KpiCard key={placeholder} spec={{ key: placeholder, label: "Loading", value: "…", caption: summary.error ?? "Loading…", tone: "neutral", selected: false, apply: {}, clear: {}, detail: { definition: "", population: "" } }} icon={Wallet} loading={!summary.error} />
            ))
          )}
        </div>
        {summary.error ? <LoadError message={summary.error} onRetry={summary.retry} /> : null}
        {data ? (
          <ul aria-label="Records outside the posted totals" className="flex flex-wrap gap-2">
            {secondary.map((item) => (
              <li key={item.key}>
                <button type="button" onClick={item.onClick} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#CAD8CB] bg-white px-3 text-xs font-semibold text-[#365F4A] outline-none transition hover:bg-[#EEF2EC] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40">
                  <span className={`grid size-6 place-items-center rounded-full ${item.tone}`}><item.icon className="size-3.5" aria-hidden="true" /></span>
                  {item.label}
                  <span className="font-black text-[#123D2A]">{count(item.value.records)}</span>
                  {item.value.records > 0 ? <span className="text-[#5D6D63]">· {peso(item.value.amount)}</span> : null}
                  <span className="sr-only">. {item.hint}. Select to list them.</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => open({ side: "right", kind: "integrity" })} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#CAD8CB] bg-white px-3 text-xs font-semibold text-[#365F4A] outline-none transition hover:bg-[#EEF2EC] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40">
                <ShieldAlert className="size-4" aria-hidden="true" />Data integrity
                <span className="font-black text-[#123D2A]">{integrity.data ? (integrity.data.reviewCount ? `${integrity.data.reviewCount} to review` : "No issues") : "…"}</span>
              </button>
            </li>
          </ul>
        ) : null}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <section className={card} aria-labelledby="trend-heading">
          <h2 id="trend-heading" className="text-base font-black text-[#123D2A]">Expense trend</h2>
          <p className="mb-3 text-xs text-[#5D6D63]">Posted {classNoun} per {trend.data?.granularity ?? "period"}{hasComparison ? ", with the comparison period dashed" : ""}.</p>
          {trend.error ? <LoadError message={trend.error} onRetry={trend.retry} /> : trend.loading ? <Loading label="Loading trend…" /> : trend.data && trend.data.buckets.length && trend.data.records > 0 ? (
            <TrendChart trend={trend.data} hasComparison={hasComparison} onOpenBucket={(bucketKey) => open({ side: "right", kind: "period", key: bucketKey })} />
          ) : <p className="rounded-md bg-[#F4F8F2] p-6 text-center text-sm text-[#365F4A]">No posted expenses in this period.</p>}
        </section>

        <section className={card} aria-labelledby="category-heading">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="category-heading" className="text-base font-black text-[#123D2A]">Where expenses are concentrated</h2>
              <p className="mb-3 text-xs text-[#5D6D63]">Categories ranked by posted amount. Select a bar for details, or the filter button to list its records.</p>
            </div>
          </div>
          {categories.error ? <LoadError message={categories.error} onRetry={categories.retry} /> : categories.loading ? <Loading /> : (
            <RankedBars items={categoryBars} limit={8} selectedKeys={query.categoryIds} emptyText="No posted expenses in this period." onOpen={(item) => open({ side: "right", kind: "category", id: item.key, name: item.label })} onFilter={(item) => showRecords({ categoryIds: query.categoryIds.includes(item.key) ? query.categoryIds.filter((value) => value !== item.key) : [...query.categoryIds, item.key] })} />
          )}
          {categoryBars.length > 8 ? <button type="button" onClick={() => open({ side: "right", kind: "total" })} className="mt-2 min-h-11 text-sm font-bold text-[#123D2A] underline underline-offset-4">All {categoryBars.length} categories</button> : null}
        </section>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className={card} aria-labelledby="drivers-heading">
          <h2 id="drivers-heading" className="text-base font-black text-[#123D2A]">What changed in expenses?</h2>
          {drivers.error ? <LoadError message={drivers.error} onRetry={drivers.retry} /> : drivers.loading ? <Loading /> : !drivers.data?.available ? (
            <p className="mt-2 rounded-md bg-[#F4F8F2] p-4 text-sm text-[#365F4A]">{drivers.data?.unavailableReason ?? "No comparison available."}</p>
          ) : (
            <>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <div><dt className="text-xs font-semibold text-[#5D6D63]">Overall difference</dt><dd className="text-lg font-black text-[#123D2A]">{signedPeso(drivers.data.totalChange)}</dd></div>
                <div><dt className="text-xs font-semibold text-[#5D6D63]">Largest increase</dt><dd className="text-sm font-bold text-[#123D2A]">{drivers.data.largestIncrease ? `${drivers.data.largestIncrease.name} ${signedPeso(drivers.data.largestIncrease.change)}` : "None"}</dd></div>
                <div><dt className="text-xs font-semibold text-[#5D6D63]">Largest decrease</dt><dd className="text-sm font-bold text-[#123D2A]">{drivers.data.largestDecrease ? `${drivers.data.largestDecrease.name} ${signedPeso(drivers.data.largestDecrease.change)}` : "None"}</dd></div>
              </dl>
              <button type="button" onClick={() => open({ side: "right", kind: "drivers" })} className={`${ghostButton} mt-4`}>See every category<ArrowUpRight className="size-4" aria-hidden="true" /></button>
            </>
          )}
        </section>

        <section className={card} aria-labelledby="source-heading">
          <h2 id="source-heading" className="text-base font-black text-[#123D2A]">Spending by source module</h2>
          <p className="mb-3 text-xs text-[#5D6D63]">Which part of the system recorded the expense. The mark shows the comparison period.</p>
          {sources.error ? <LoadError message={sources.error} onRetry={sources.retry} /> : sources.loading ? <Loading /> : (
            <RankedBars items={sourceBars} selectedKeys={query.sourceModules} emptyText="No posted expenses in this period." onOpen={(item) => showRecords({ sourceModules: [item.key] })} />
          )}
        </section>
      </div>

      <section id="expense-records" className={card} aria-labelledby="records-heading" tabIndex={-1}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="records-heading" className="text-base font-black text-[#123D2A]">Expense records</h2>
            <ResultSummary total={records.data?.total ?? 0} noun="expense records" filtered={filtered || query.view !== "posted"} loading={records.loading && !records.data} />
          </div>
          <Link href={ledgerHref} className={ghostButton}><Landmark className="size-4" aria-hidden="true" />Financial Ledger</Link>
        </div>
        <ExpenseRecordsTable data={records.data} loading={records.loading} error={records.error} onRetry={records.retry} query={query} onChange={apply} onOpen={(id) => open({ side: "right", kind: "record", id })} />
      </section>

      <section className={card} aria-labelledby="insights-heading">
          <h2 id="insights-heading" className="flex items-center gap-2 text-base font-black text-[#123D2A]"><Sparkles className="size-4" aria-hidden="true" />Observations</h2>
          <p className="mb-3 text-xs text-[#5D6D63]">Plain statements drawn from the figures above. They describe recorded spending; they do not explain or judge it.</p>
          {insights.error ? <LoadError message={insights.error} onRetry={insights.retry} /> : insights.loading ? <Loading /> : insights.data && insights.data.length ? (
            <ul className="grid gap-3 lg:grid-cols-2">
              {insights.data.map((item) => (
                <li key={item.id} className="rounded-md border border-[#E1E8E2] p-3">
                  <p className="text-sm font-bold text-[#123D2A]">{item.text}</p>
                  <p className="mt-1 text-xs leading-5 text-[#5D6D63]">{item.basis}</p>
                  {item.drill ? (
                    <button
                      type="button"
                      onClick={() => {
                        const drill = item.drill!;
                        if (drill.panel === "drivers") open({ side: "right", kind: "drivers" });
                        else if (drill.panel === "integrity") open({ side: "right", kind: "integrity" });
                        else if (drill.categoryId && !drill.view) open({ side: "right", kind: "category", id: drill.categoryId, name: categoryBars.find((entry) => entry.key === drill.categoryId)?.label ?? names.categories.find((entry) => entry.id === drill.categoryId)?.name ?? "Category" });
                        else showRecords({ ...(drill.view ? { view: drill.view } : {}), ...(drill.classes ? { classes: drill.classes } : {}) });
                      }}
                      className="mt-1 min-h-11 text-sm font-bold text-[#123D2A] underline underline-offset-4"
                    >
                      Look closer
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : <p className="rounded-md bg-[#F4F8F2] p-4 text-sm text-[#365F4A]">Nothing to report for this period.</p>}
      </section>

      {drawer ? (
        <ExpenseDrawer
          open
          onClose={close}
          side={drawer.side}
          wide={drawer.kind === "matrix"}
          title={drawerTitle(drawer, bucket?.label)}
          description={drawer.kind === "total" && data ? `${data.period.label}: ${periodText}` : undefined}
        >
          {back ? (
            <button type="button" onClick={() => { setDrawer(back); setBack(null); }} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#123D2A] underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />Back to {drawerTitle(back, undefined).toLowerCase()}</button>
          ) : null}
          {drawer.kind === "total" ? (data ? <TotalDrawer summary={data} categories={categories.data} sources={sources.data} onShowRecords={() => showRecords({})} onOpenCategory={(id, name) => openFromDrawer({ side: "right", kind: "category", id, name })} onOpenIntegrity={() => openFromDrawer({ side: "right", kind: "integrity" })} /> : <Loading />) : null}
          {drawer.kind === "drivers" ? <DriversDrawer drivers={drivers.data} onOpenCategory={(id, name) => openFromDrawer({ side: "right", kind: "category", id, name })} /> : null}
          {drawer.kind === "category" ? <CategoryDrawer query={query} categoryId={drawer.id} name={drawer.name} onShowRecords={() => showRecords({ categoryIds: [drawer.id] })} onOpenRecord={(id) => openFromDrawer({ side: "right", kind: "record", id })} /> : null}
          {drawer.kind === "period" ? (bucket ? <PeriodDrawer query={query} bucket={bucket} onShowRecords={() => showRecords({ period: "custom", startDate: bucket.startDate, endDate: bucket.endDate, compare: "none" })} onOpenRecord={(id) => openFromDrawer({ side: "right", kind: "record", id })} onOpenCategory={(id, name) => openFromDrawer({ side: "right", kind: "category", id, name })} /> : <Loading />) : null}
          {drawer.kind === "record" ? <RecordDrawer id={drawer.id} /> : null}
          {drawer.kind === "integrity" ? <IntegrityDrawer integrity={integrity.data} onDrill={(drill) => showRecords({ ...(drill.view ? { view: drill.view } : {}), ...(drill.classes ? { classes: drill.classes } : {}) })} /> : null}
          {drawer.kind === "matrix" ? <MatrixDrawer query={query} sourceModules={options.data?.sourceModules.map((item) => item.value) ?? []} onPick={(categoryId, sourceModule) => showRecords({ categoryIds: [categoryId], sourceModules: [sourceModule] })} /> : null}
        </ExpenseDrawer>
      ) : null}
    </div>
  );
}

function classCount(classes: Array<{ value: string; records: number }> | undefined, value: string) {
  const found = classes?.find((item) => item.value === value);
  return found ? `${count(found.records)} posted ${found.records === 1 ? "record" : "records"} overall` : undefined;
}
