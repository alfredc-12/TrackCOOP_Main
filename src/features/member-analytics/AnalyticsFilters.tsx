"use client";
import { useId, useState } from "react";
import { ChevronDown, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { AnalyticsSelectField } from "./AnalyticsSelectField";
import { defaultAnalyticsFilters, labels, sectors, stages, type AnalyticsFilters as Filters } from "./analytics-client";
import styles from "./MemberAnalytics.module.css";

function shiftMonth(date: string, months: number) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10);
}
export function AnalyticsFilterForm({ applied, today, barangays, loading, onApply }: { applied: Filters; today: string; barangays: string[]; loading: boolean; onApply: (filters: Filters) => void }) {
  const [draft, setDraft] = useState(applied);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedId = useId();
  const [barangay, setBarangay] = useState("");
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("Custom range");
  const listId = useId();
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setDraft(d => ({ ...d, [key]: value }));
  const preset = (value: string) => {
    setPeriod(value);
    let start = draft.start, end = today;
    const year = Number(today.slice(0, 4));
    if (value === "This month") start = `${today.slice(0, 7)}-01`;
    if (value === "Last month") { start = shiftMonth(today, -1); end = new Date(Date.parse(`${shiftMonth(today, 0)}T00:00:00Z`) - 86400000).toISOString().slice(0, 10); }
    if (value === "Last 3 months") start = shiftMonth(today, -2);
    if (value === "Last 6 months") start = shiftMonth(today, -5);
    if (value === "This year") start = `${year}-01-01`;
    if (value === "Last year") { start = `${year - 1}-01-01`; end = `${year - 1}-12-31`; }
    if (value !== "Custom range") setDraft(d => ({ ...d, start, end, asOf: today }));
  };
  const apply = (next = draft) => {
    if (!next.start || !next.end || !next.asOf || next.start > next.end || next.end > next.asOf || next.asOf > today) { setError("Choose a reporting start before its end, ending on or before the as-of date. Future dates are unavailable."); return; }
    setError(""); onApply(next);
  };
  const chips = Object.entries(applied).filter(([k, v]) => !["start", "end", "asOf"].includes(k) && (Array.isArray(v) ? v.length : v)).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map(v => ({ key: key as keyof Filters, value: v })));
  return <form className={`${styles.panel} ${styles.filters}`} onSubmit={e => { e.preventDefault(); apply(); }} aria-label="Member analytics filters">
    <div className="mb-4 flex items-center gap-2"><h2 className="flex items-center gap-2 text-base font-semibold"><Filter className="size-4" aria-hidden="true" />Reporting filters</h2><button type="button" aria-expanded={advancedOpen} aria-controls={advancedId} aria-label="More filters" onClick={() => setAdvancedOpen(open => !open)} className="grid size-10 place-items-center rounded-md text-coop-forest hover:bg-coop-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-coop-green"><ChevronDown className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button></div>
    <div className={styles.fields}>
      <AnalyticsSelectField label="Reporting period" value={period} options={["This month", "Last month", "Last 3 months", "Last 6 months", "This year", "Last year", "Custom range"]} onChange={preset} />
      <DatePicker triggerClassName="h-11 min-h-11 rounded-md px-3 text-sm" label="Reporting start" value={draft.start} max={draft.end || today} onChange={v => update("start", v)} />
      <DatePicker triggerClassName="h-11 min-h-11 rounded-md px-3 text-sm" label="Reporting end" value={draft.end} min={draft.start} max={draft.asOf || today} onChange={v => update("end", v)} />
      <DatePicker triggerClassName="h-11 min-h-11 rounded-md px-3 text-sm" label="As-of date" value={draft.asOf} min={draft.end} max={today} onChange={v => update("asOf", v)} />
      <AnalyticsSelectField label="Membership type" value={draft.membershipType} allLabel="All membership types" options={["Associate", "True Member"]} onChange={v => update("membershipType", v)} />
      <AnalyticsSelectField label="RFM engagement" value={draft.engagement} allLabel="All engagement labels" options={labels} onChange={v => update("engagement", v)} />
      <div className={`${styles.field} ${styles.location}`}><label htmlFor={`${listId}-search`}>Barangays</label><div className="flex min-w-0 gap-2"><StyledSelect searchable id={`${listId}-search`} aria-label="Barangays" className="min-w-0 flex-1" value={barangay} options={barangays} onChange={setBarangay} onInputChange={setBarangay} placeholder="All barangays · search to add…" /><Button type="button" variant="secondary" size="sm" disabled={!barangay.trim()} onClick={() => { update("barangays", [...new Set([...draft.barangays, barangay.trim()])]); setBarangay(""); }}>Add</Button></div></div>
    </div>
    {draft.barangays.length > 0 && <div className={styles.chips}>{draft.barangays.map(b => <button type="button" className={styles.chip} key={b} onClick={() => update("barangays", draft.barangays.filter(v => v !== b))}>{b}<X className="size-3" aria-label="Remove" /></button>)}</div>}
    <div className="flex flex-wrap items-end justify-between gap-3"><fieldset className={styles.sectors}><legend className="pt-4 text-xs font-semibold">Primary sectors · select any</legend>{sectors.map(s => <label key={s}><input type="checkbox" checked={draft.sectors.includes(s)} onChange={e => update("sectors", e.target.checked ? [...draft.sectors, s] : draft.sectors.filter(v => v !== s))} />{s === "High-value crops (gulayan)" ? "High-Value Crops" : s}</label>)}</fieldset><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => { const next = defaultAnalyticsFilters(today); setDraft(next); apply(next); }}>Clear filters</Button><Button type="submit" size="sm" loading={loading}>Apply filters</Button></div></div>
    <div id={advancedId} hidden={!advancedOpen}><div className={`${styles.fields} mt-4`}>
      <AnalyticsSelectField label="Official membership status" value={draft.officialStatus} allLabel="All official statuses" options={["Pending", "Active", "Inactive", "Suspended", "Terminated"]} onChange={v => update("officialStatus", v)} />
      <AnalyticsSelectField label="Share-capital stage" value={draft.capitalStage} allLabel="All capital stages" options={stages} onChange={v => update("capitalStage", v)} />
      <AnalyticsSelectField label="Application source" value={draft.source} allLabel="All sources" options={["Public Website", "Chairman Entry", "Imported Paper Form"]} onChange={v => update("source", v)} />
    </div></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {chips.length > 0 && <div className={styles.chips} aria-label="Applied filters">{chips.map(c => <button key={`${c.key}:${c.value}`} type="button" className={styles.chip} aria-label={`Remove ${c.value} filter`} onClick={() => { const next = { ...applied }; if (c.key === "barangays" || c.key === "sectors") next[c.key] = next[c.key].filter(v => v !== c.value); else next[c.key] = ""; setDraft(next); apply(next); }}>{c.value}<X className="size-3" aria-hidden="true" /></button>)}</div>}
  </form>;
}
