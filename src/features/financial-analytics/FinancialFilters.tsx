"use client";
import { useId, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { ReportingFilterToggle, reportingDate } from "@/components/portal/ReportingFilterToggle";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { StyledSelect } from "@/components/ui/StyledSelect";
import {
  activeChips, labelFor, COMPARE_OPTIONS, defaultFinancialFilters, PERIOD_OPTIONS, RECORD_TYPE_OPTIONS, validateFilters,
  type FinancialAnalyticsResult, type FinancialFilters,
} from "./financial-analytics-client";
import { SelectField } from "./FinancialUi";
import styles from "./FinancialAnalytics.module.css";

type Category = FinancialAnalyticsResult["options"]["categories"][number];
const SOURCE_MODULES = ["Manual", "Membership", "Payment", "Rental", "POS", "Document", "Other"] as const;
const dateInput = "h-11 min-h-11 rounded-md px-3 text-sm";

/** Category names are unique only with their type, so duplicates get a type suffix. */
export function categoryLabels(categories: Category[]) {
  const counts = new Map<string, number>();
  for (const category of categories) counts.set(category.name, (counts.get(category.name) ?? 0) + 1);
  return new Map(categories.map(category => [category.id, (counts.get(category.name) ?? 0) > 1 ? `${category.name} · ${category.type}` : category.name]));
}

export function FinancialFilterForm({ applied, summaryFilters = applied, periodLabel, expanded, onExpandedChange, today, categories, loading, onApply }: {
  applied: FinancialFilters; summaryFilters?: FinancialFilters; periodLabel?: string; expanded: boolean; onExpandedChange: (expanded: boolean) => void; today: string; categories: Category[]; loading: boolean; onApply: (filters: FinancialFilters) => void;
}) {
  const [draft, setDraft] = useState(applied);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedId = useId();
  const panelId = useId();
  const [categoryText, setCategoryText] = useState("");
  const [error, setError] = useState("");
  const labels = useMemo(() => categoryLabels(categories), [categories]);
  const byLabel = useMemo(() => new Map([...labels].map(([id, label]) => [label, id])), [labels]);
  const listId = useId();
  const update = <K extends keyof FinancialFilters>(key: K, value: FinancialFilters[K]) => setDraft(current => ({ ...current, [key]: value }));
  const apply = (next = draft) => {
    const problem = validateFilters(next, today);
    if (problem) { setError(problem); return; }
    setError(""); onApply(next);
  };
  const addCategory = () => {
    const id = byLabel.get(categoryText.trim());
    if (!id) { setError("Choose a category from the list."); return; }
    setError(""); update("categoryIds", [...new Set([...draft.categoryIds, id])]); setCategoryText("");
  };
  const chips = activeChips(summaryFilters, id => labels.get(id) ?? `#${id}`);
  const activeCount = chips.length;

  return <form className={`${styles.panel} ${styles.filters}`} onSubmit={event => { event.preventDefault(); apply(); }} aria-label="Financial analytics filters">
    <ReportingFilterToggle expanded={expanded} onToggle={() => onExpandedChange(!expanded)} controls={panelId}
      summary={periodLabel ?? (summaryFilters.period === "custom" ? `${reportingDate(summaryFilters.start)} – ${reportingDate(summaryFilters.end)}` : labelFor(PERIOD_OPTIONS, summaryFilters.period))} activeCount={activeCount} />
    <div id={panelId} hidden={!expanded} className="mt-4 border-t border-coop-card-border pt-4">
    <div className={styles.fields}>
      <SelectField label="Reporting period" value={draft.period} options={PERIOD_OPTIONS} onChange={value => update("period", value)} />
      <SelectField label="Compare with" value={draft.compare} options={COMPARE_OPTIONS} onChange={value => update("compare", value)} disabled={draft.period === "all-time"} />
      <SelectField label="Financial record type" value={draft.recordType} options={RECORD_TYPE_OPTIONS} onChange={value => update("recordType", value)} />
      <div className={styles.field}><label htmlFor={`${listId}-category`}>Financial category</label>
        <div className="flex min-w-0 gap-2"><StyledSelect searchable id={`${listId}-category`} aria-label="Financial category" className="min-w-0 flex-1" value={categoryText} options={[...labels.values()]} onChange={setCategoryText} onInputChange={setCategoryText} placeholder={categories.length ? "All categories · search to add…" : "Loading categories…"} disabled={!categories.length} />
          <Button type="button" variant="secondary" size="sm" disabled={!categoryText.trim()} onClick={addCategory}>Add</Button></div>
      </div>
      {draft.period === "custom" && <>
        <DatePicker triggerClassName={dateInput} label="Reporting start" value={draft.start} max={draft.end || today} onChange={value => update("start", value)} />
        <DatePicker triggerClassName={dateInput} label="Reporting end" value={draft.end} min={draft.start} max={today} onChange={value => update("end", value)} />
      </>}
      {draft.compare === "custom" && draft.period !== "all-time" && <>
        <DatePicker triggerClassName={dateInput} label="Comparison start" value={draft.compareStart} max={draft.compareEnd || today} onChange={value => update("compareStart", value)} />
        <DatePicker triggerClassName={dateInput} label="Comparison end" value={draft.compareEnd} min={draft.compareStart} max={today} onChange={value => update("compareEnd", value)} />
      </>}
    </div>
    {draft.categoryIds.length > 0 && <div className={styles.chips} aria-label="Selected categories">{draft.categoryIds.map(id => <button type="button" className={styles.chip} key={id} onClick={() => update("categoryIds", draft.categoryIds.filter(value => value !== id))}>{labels.get(id) ?? `#${id}`}<X className="size-3" aria-label="Remove" /></button>)}</div>}
    <div className="flex flex-wrap items-end justify-between gap-3"><fieldset className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-0 p-0 text-[13px]"><legend className="pb-2 text-xs font-semibold">Source module · all when none selected (Share Capital is reported separately)</legend>
      {SOURCE_MODULES.map(source => <label key={source} className="inline-flex min-h-8 cursor-pointer items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--coop-green,#1f6b43)]" checked={draft.sourceModules.includes(source)} onChange={event => update("sourceModules", event.target.checked ? [...draft.sourceModules, source] : draft.sourceModules.filter(value => value !== source))} />{source}</label>)}
    </fieldset><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => { const next = defaultFinancialFilters(); setDraft(next); setError(""); setCategoryText(""); onApply(next); }}>Clear all</Button><Button type="submit" size="sm" loading={loading}>Apply filters</Button></div></div>
    <button type="button" aria-expanded={advancedOpen} aria-controls={advancedId} aria-label="More filters" onClick={() => setAdvancedOpen(open => !open)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-semibold text-coop-secondary hover:text-coop-forest">More filters<ChevronDown className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button>
    <div id={advancedId} hidden={!advancedOpen}>
      <div className={`${styles.fields} mt-4`}>
        <div className={styles.field}><label htmlFor={`${listId}-min`}>Minimum record amount (₱)</label><input id={`${listId}-min`} type="number" inputMode="decimal" min="0" step="0.01" value={draft.minAmount} onChange={event => update("minAmount", event.target.value)} /></div>
        <div className={styles.field}><label htmlFor={`${listId}-max`}>Maximum record amount (₱)</label><input id={`${listId}-max`} type="number" inputMode="decimal" min="0" step="0.01" value={draft.maxAmount} onChange={event => update("maxAmount", event.target.value)} /></div>
        <div className={`${styles.field} ${styles.span2}`}><label htmlFor={`${listId}-reference`}>Record number or source reference</label><input id={`${listId}-reference`} maxLength={60} value={draft.reference} onChange={event => update("reference", event.target.value)} placeholder="e.g. FIN-2026" /></div>
      </div>
      <p className={`${styles.hint} mt-3`}>Amount, reference, category and source narrow every figure below. Posting status, record status and who recorded or approved a record are audit views: headline figures always use posted, active records, and those checks are in Financial Data Integrity.</p>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
    <span className="sr-only">{activeCount ? `${activeCount} filters applied` : "No additional filters applied"}</span>
    {chips.length > 0 && <div className={styles.chips} aria-label="Applied filters">{chips.map(chip => <button key={chip.id} type="button" className={styles.chip} aria-label={`Remove filter ${chip.label}`} onClick={() => { const next = { ...summaryFilters, ...chip.clear }; setDraft(next); apply(next); }}>{chip.label}<X className="size-3" aria-hidden="true" /></button>)}</div>}
  </form>;
}
