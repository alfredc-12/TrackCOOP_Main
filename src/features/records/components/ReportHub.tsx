"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, FileText, Search, Star, TrendingUp } from "lucide-react";
import { expressFetch } from "@/lib/express-api";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/portal/PortalPrimitives";
import type { GeneratedReportRecord, ReportDefinition, ReportFilters, ReportResult } from "../records-types";
import { REPORT_CATEGORY_LABELS } from "../record-constants";
import { apiError, fieldClass, formatDate, primaryButtonClass, RecordsSelect, secondaryButtonClass } from "./RecordsUi";

type ProgressData = { overview: ReportResult; trends: ReportResult; attention: ReportResult };
type HubTab = "overview" | "trends" | "attention" | "library";
const money = (value: unknown) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(value ?? 0));
function todayInManila() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export function ReportTrendChart({ rows }: { rows: ReportResult["rows"] }) {
  const [metric, setMetric] = useState("value0");
  const options = [{ value: "value0", label: "Posted income" }, { value: "value1", label: "Posted expenses" }, { value: "value2", label: "Net result" }, { value: "value3", label: "Paid store sales" }, { value: "value4", label: "Validated rental payments" }, { value: "value5", label: "Capital contributions" }];
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row[metric] ?? 0))));
  return <section className="min-w-0 rounded-xl border border-coop-border bg-coop-surface p-4" aria-label="Monthly progress chart">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-coop-forest">Monthly recorded activity</h3><div className="w-full sm:w-64"><RecordsSelect ariaLabel="Trend metric" value={metric} options={options} onChange={setMetric} /></div></div>
    <div className="max-h-96 space-y-3 overflow-y-auto pr-1">{rows.map((row) => <div key={String(row.period)} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3 text-xs">
      <span className="font-semibold text-coop-muted">{String(row.period)}</span>
      <div><div className="mb-1 font-semibold tabular-nums text-coop-forest">{money(row[metric])}</div><div className="h-3 overflow-hidden rounded-full bg-coop-subtle"><div role="img" aria-label={`${row.period}: ${money(row[metric])}`} className={`h-full rounded-full ${Number(row[metric]) < 0 ? "bg-coop-harvest" : "bg-coop-green"}`} style={{ width: `${Math.abs(Number(row[metric] ?? 0)) / max * 100}%` }} /></div></div>
    </div>)}</div>
    <p className="mt-4 text-xs leading-5 text-coop-muted">Bar length shows magnitude; amber indicates a negative result. Partial months follow your selected dates. No qualifying activity is shown as zero.</p>
  </section>;
}

export function ReportHub({ catalog, recent, role, onChoose }: {
  catalog: ReportDefinition[];
  recent: GeneratedReportRecord[];
  role: "chairman" | "bookkeeper";
  onChoose: (definition: ReportDefinition, filters?: ReportFilters) => void;
}) {
  const [tab, setTab] = useState<HubTab>("overview");
  const [draft, setDraft] = useState(() => { const today = todayInManila(); return { dateFrom: `${today.slice(0, 4)}-01-01`, dateTo: today }; });
  const [period, setPeriod] = useState(draft);
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [attentionArea, setAttentionArea] = useState("");
  const favoriteKey = `trackcoop:report-favorites:${role}`;
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(favoriteKey) ?? "[]");
      // Restore browser preferences only after hydration; no report data is stored here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFavorites(Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string") : []);
    } catch { /* A blocked storage area must not prevent report access. */ }
  }, [favoriteKey]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await expressFetch(`/api/reports/progress?${new URLSearchParams(period)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(await apiError(response));
        const next = await response.json() as ProgressData;
        if (!controller.signal.aborted) setData(next);
      } catch (caught) {
        if (!controller.signal.aborted) { setData(null); setError(caught instanceof Error ? caught.message : "Progress could not be loaded."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [period, retry]);
  const available = useMemo(() => catalog.filter((item) => (!category || item.category === category) && (!onlyFavorites || favorites.includes(item.key)) && `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase())), [catalog, category, favorites, onlyFavorites, search]);
  function favorite(key: string) {
    const next = favorites.includes(key) ? favorites.filter((item) => item !== key) : [...favorites, key];
    setFavorites(next); try { localStorage.setItem(favoriteKey, JSON.stringify(next)); } catch { /* Keep the current session usable. */ }
  }
  function choose(key: string, filters: ReportFilters = period) { const report = catalog.find((item) => item.key === key); if (report) onChoose(report, filters); }
  const active = data?.[tab === "trends" ? "trends" : tab === "attention" ? "attention" : "overview"];
  const attentionAreas = Array.from(new Set(data?.attention.rows.map((row) => String(row.area)) ?? []));
  const attentionLinks: Record<string, { path: string; label: string }> = {
    Payments: { path: role === "chairman" ? "payments" : "payment-validation", label: "Review payments" },
    Reconciliation: { path: "financial-ledger", label: "Open money records" },
    Stock: { path: role === "chairman" ? "inventory" : "products-inventory", label: "Open products & stock" },
    Documents: { path: "documents", label: "Open document library" },
  };
  return <section className="grid min-w-0 gap-4 rounded-2xl border border-coop-border bg-coop-surface p-4 shadow-coop-soft sm:p-5" aria-label="Cooperative reporting hub">
    <div><h2 className="flex items-center gap-2 text-lg font-bold text-coop-forest"><TrendingUp className="size-5 text-coop-green" />Cooperative performance</h2><p className="mt-1 text-sm text-coop-muted">Review results, spot issues, and choose the reports you need.</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Report views">{([{ key: "overview", label: "Overview" }, { key: "trends", label: "Progress trends" }, { key: "attention", label: "Needs attention" }, { key: "library", label: "Report library" }] as const).map((item) => <button key={item.key} type="button" aria-pressed={tab === item.key} onClick={() => setTab(item.key)} className={`min-h-11 rounded-full px-4 text-sm font-bold ${tab === item.key ? "bg-coop-forest text-white" : "bg-coop-sage text-coop-secondary"}`}>{item.label}</button>)}</div>
    {tab !== "library" ? <>
      {tab !== "attention" ? <form className="grid min-w-0 gap-3 rounded-xl bg-coop-workspace p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto_auto] xl:items-end" onSubmit={(event) => { event.preventDefault(); setPeriod({ ...draft }); }}>
        <label className="grid gap-1 text-xs font-bold text-coop-muted">Progress from<input className={fieldClass} type="date" required value={draft.dateFrom} max={draft.dateTo} onChange={(event) => setDraft({ ...draft, dateFrom: event.target.value })} /></label>
        <label className="grid gap-1 text-xs font-bold text-coop-muted">Progress to<input className={fieldClass} type="date" required value={draft.dateTo} min={draft.dateFrom} onChange={(event) => setDraft({ ...draft, dateTo: event.target.value })} /></label>
        <button className={primaryButtonClass}>Apply period</button>
        <button type="button" className={secondaryButtonClass} onClick={() => { const today = todayInManila(); const next = { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today }; setDraft(next); setPeriod(next); }}>This month</button>
        <button type="button" className={secondaryButtonClass} onClick={() => { const today = todayInManila(); const next = { dateFrom: `${today.slice(0, 4)}-01-01`, dateTo: today }; setDraft(next); setPeriod(next); }}>This year</button>
      </form> : <p className="rounded-xl bg-coop-warning-bg p-3 text-sm text-coop-warning">Current issues at generation time. Date filters do not reconstruct historical stock or pending-payment backlogs.</p>}
      {loading ? <LoadingSkeleton /> : error ? <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} /> : data ? <>
        {tab === "overview" ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.overview.rows.map((row) => <article key={String(row.metric)} className="min-w-0 rounded-xl border border-coop-border p-4">
          <h3 className="text-sm font-semibold text-coop-muted">{String(row.metric)}</h3><p className="mt-2 break-words text-xl font-bold tabular-nums text-coop-forest">{money(row.currentValue)}</p>
          <p className="mt-2 text-xs text-coop-muted">Previous: {money(row.previousValue)}</p><p className="mt-1 text-sm font-semibold text-coop-secondary">Change: {money(row.change)} · {row.changePercent === null ? "No percentage baseline" : `${Number(row.changePercent) > 0 ? "+" : ""}${row.changePercent}%`}</p>
          <p className="mt-2 text-xs text-coop-muted">{String(row.source)}</p>
        </article>)}</div> : tab === "trends" ? <ReportTrendChart rows={data.trends.rows} /> : <>
          <h3 className="flex items-center gap-2 font-bold text-coop-forest"><AlertTriangle className="size-4 text-coop-warning" />{data.attention.total} issues requiring review</h3>
          <RecordsSelect ariaLabel="Attention area" value={attentionArea} onChange={setAttentionArea} options={[{ value: "", label: "All areas" }, ...attentionAreas.map((area) => ({ value: area, label: `${area} (${data.attention.rows.filter((row) => row.area === area).length})` }))]} />
          {data.attention.rows.length ? <div className="max-h-[34rem] space-y-2 overflow-y-auto">{data.attention.rows.filter((row) => !attentionArea || row.area === attentionArea).map((row, index) => <article key={`${row.area}-${row.reference}-${index}`} className="rounded-xl border border-coop-border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold text-coop-forest">{String(row.area)} · {String(row.reference)}</p><span className="text-coop-warning">{String(row.issue)}</span></div><p className="mt-1 text-coop-body">{String(row.subject)}</p><p className="mt-1 text-xs text-coop-muted">{String(row.nextStep)}{row.amount !== null ? ` · Submitted: ${money(row.amount)}` : ""}</p>{attentionLinks[String(row.area)] ? <Link className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-coop-green underline underline-offset-4" href={`/portal/${role}/${attentionLinks[String(row.area)].path}`}>{attentionLinks[String(row.area)].label}</Link> : null}</article>)}</div> : <EmptyState icon={FileText} title="No issues found" description="No qualifying issues were found in the monitored records." />}
        </>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-coop-muted">Updated {formatDate(active?.generatedAt ?? "", true)}</p><button type="button" className={primaryButtonClass} onClick={() => choose(tab === "trends" ? "performance-trends" : tab === "attention" ? "attention-needed" : "cooperative-overview", tab === "attention" ? {} : period)}><FileText className="size-4" />Open printable report</button></div>
        <div className="space-y-1 rounded-xl bg-coop-workspace p-3 text-xs leading-5 text-coop-muted">{active?.notes?.map((note) => <p key={note}>{note}</p>)}</div>
      </> : null}
      <p className="text-xs leading-5 text-coop-muted">Target tracking is not configured: approved targets are not currently stored. This view measures recorded activity and period changes, not goal completion.</p>
    </> : <>
      <div className="flex flex-wrap gap-2" aria-label="Quick report choices">{[{ key: "cooperative-overview", label: "Monthly performance" }, { key: "payment-status", label: "Payment review" }, { key: "low-stock", label: "Stock monitoring" }, { key: "annual-financial-summary", label: "Annual summary" }].filter((item) => catalog.some((report) => report.key === item.key)).map((item) => <button key={item.key} type="button" className={secondaryButtonClass} onClick={() => { const today = todayInManila(); choose(item.key, item.key === "annual-financial-summary" ? { year: today.slice(0, 4) } : { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today }); }}>{item.label}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="relative"><Search className="absolute left-3 top-3.5 size-4 text-coop-muted" /><input className={`${fieldClass} pl-9`} aria-label="Search report library" placeholder="Search reports by name or purpose" value={search} onChange={(event) => setSearch(event.target.value)} /></label><RecordsSelect ariaLabel="Report library category" value={category} onChange={setCategory} options={[{ value: "", label: "All categories" }, ...Array.from(new Set(catalog.map((item) => item.category))).map((value) => ({ value, label: REPORT_CATEGORY_LABELS[value] }))]} /></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites((value) => !value)} className={secondaryButtonClass}><Star className="size-4" />{onlyFavorites ? "Show all reports" : "Favorites only"}</button><p className="text-xs text-coop-muted">Favorites are saved on this browser.</p></div>
      <div className="grid gap-3 lg:grid-cols-2">{available.map((report) => <article key={report.key} className="flex min-w-0 flex-col rounded-xl border border-coop-border p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-coop-green">{REPORT_CATEGORY_LABELS[report.category]}</p><h3 className="mt-1 font-bold text-coop-forest">{report.name}</h3></div><button type="button" aria-label={`Favorite ${report.name}`} aria-pressed={favorites.includes(report.key)} onClick={() => favorite(report.key)} className="grid size-11 shrink-0 place-items-center rounded-lg border border-coop-border text-coop-warning"><Star className={`size-4 ${favorites.includes(report.key) ? "fill-current" : ""}`} /></button></div><p className="my-3 flex-1 text-sm leading-6 text-coop-muted">{report.description}</p><button type="button" disabled={report.configurationRequired} className={primaryButtonClass} onClick={() => onChoose(report, {})}><BarChart3 className="size-4" />{report.configurationRequired ? "Requires approved template" : "Configure report"}</button></article>)}</div>
      {!available.length ? <p className="text-sm text-coop-muted">No reports match these filters.</p> : null}
      <h3 className="font-bold text-coop-forest">Recently generated</h3>{recent.length ? <div className="grid gap-2">{recent.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-coop-border p-3"><div><p className="font-semibold text-coop-forest">{item.title}</p><p className="mt-1 text-xs text-coop-muted">{item.reference} · {item.periodLabel ?? "All records"} · {formatDate(item.generatedAt, true)}</p></div>{catalog.some((report) => report.key === item.reportKey && !report.configurationRequired) ? <button type="button" className={secondaryButtonClass} onClick={() => choose(item.reportKey, item.filters)}>Run again</button> : null}</article>)}</div> : <p className="text-sm text-coop-muted">No generated reports are available yet.</p>}
    </>}
  </section>;
}
