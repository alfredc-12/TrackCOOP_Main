"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight, Banknote, CalendarRange, Download, GitCompareArrows, Info, Landmark, Layers, Lightbulb, Percent, RefreshCw, Scale, Search,
  ShieldCheck, TrendingDown, TrendingUp, type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  changeTone, count, downloadFinancialAnalytics, filtersFromParams, filtersToParams, getFinancialAnalytics, GRANULARITY_OPTIONS, ledgerLink, ledgerSearchLink,
  peso, pesoCompact, percent, signedPeso, signedPercent, toneColors, type FinancialAnalyticsResult, type FinancialFilters, type ShareRow, type Tone, type TrendPoint,
} from "./financial-analytics-client";
import { FinancialFilterForm } from "./FinancialFilters";
import { FinancialDrawer, type FinancialOverlay } from "./FinancialDrawer";
import { ChartAlternative } from "./FinancialDrawerViews";
import { Signal, toneIcons } from "./FinancialUi";
import styles from "./FinancialAnalytics.module.css";

type Data = FinancialAnalyticsResult;
const SERIES = { income: { label: "Income", color: "#1f6b43" }, expenses: { label: "Expenses", color: "#b77c13" }, net: { label: "Net surplus", color: "#123d2a" } } as const;
type SeriesKey = keyof typeof SERIES;

function Panel({ title, description, action, children, icon: Icon, tone = "neutral" }: { title: string; description: string; action?: ReactNode; children: ReactNode; icon?: LucideIcon; tone?: Tone }) {
  return <section className={styles.panel}><header className={styles.panelHeader}><div className={styles.panelHeading}>{Icon && <span className={styles.sectionIcon} data-tone={tone}><Icon aria-hidden="true" className="size-5" /></span>}<div><h2>{title}</h2><p>{description}</p></div></div>{action}</header><div className={styles.body}>{children}</div></section>;
}

function RankList({ rows, color, label, onSelect, showChange = true }: { rows: ShareRow[]; color: string; label: string; onSelect: (row: ShareRow, element: HTMLElement) => void; showChange?: boolean }) {
  const max = Math.max(1, ...rows.map(row => row.amount));
  return <div className={styles.rankList} role="list" aria-label={label}>{rows.map(row => <button type="button" role="listitem" key={row.key} className={styles.rankRow} onClick={event => onSelect(row, event.currentTarget)} title={`${row.name}: ${peso(row.amount)}, ${percent(row.share)} of total, ${count(row.recordCount)} records`}>
    <span className={styles.rankName}>{row.name}{row.isNew && <span className={styles.badge}>New</span>}</span>
    <span className={styles.rankTrack} aria-hidden="true"><span style={{ width: `${Math.max(2, row.amount / max * 100)}%`, background: color }} /></span>
    <span className={styles.rankValue}><strong>{pesoCompact(row.amount)}</strong><small>{percent(row.share)}{showChange && row.changePct !== null ? ` · ${signedPercent(row.changePct)}` : ""}</small></span>
  </button>)}</div>;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrendPoint }> }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const change = point.change;
  return <div className={styles.tooltip} role="status"><strong>{point.from === point.to ? point.from : `${point.from} to ${point.to}`}</strong>
    <dl><dt>Income</dt><dd>{peso(point.income)}</dd><dt>Expenses</dt><dd>{peso(point.expenses)}</dd><dt>Net surplus</dt><dd>{peso(point.net)}</dd><dt>Eligible records</dt><dd>{count(point.recordCount)}</dd></dl>
    {change ? <dl><dt>{point.changeBasis === "comparison" ? "vs comparison period" : "vs preceding period"}</dt><dd />
      <dt>Income</dt><dd>{signedPeso(change.income)} ({signedPercent(change.incomePct)})</dd><dt>Expenses</dt><dd>{signedPeso(change.expenses)} ({signedPercent(change.expensesPct)})</dd><dt>Net surplus</dt><dd>{signedPeso(change.net)} ({signedPercent(change.netPct)})</dd></dl> : <p className="mt-1 text-coop-muted">No earlier period to compare.</p>}
    <p className="mt-1 text-coop-muted">Select to open details.</p></div>;
}

export function FinancialAnalyticsClient({ today }: { today: string }) {
  const params = useSearchParams();
  const router = useRouter(); const pathname = usePathname();
  const key = params.toString();
  const applied = useMemo(() => filtersFromParams(new URLSearchParams(key)), [key]);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pendingFilterApply = useRef(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [overlay, setOverlay] = useState<FinancialOverlay>(null);
  const [exporting, setExporting] = useState(false);
  const [visible, setVisible] = useState<SeriesKey[]>(["income", "expenses", "net"]);
  const [ledgerTerm, setLedgerTerm] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getFinancialAnalytics(applied, controller.signal)
      .then(report => { if (!controller.signal.aborted) { setData(report); setError(""); setLoadedAt(new Date()); if (pendingFilterApply.current) { setFiltersOpen(false); pendingFilterApply.current = false; } } })
      .catch(reason => { if (!controller.signal.aborted) { pendingFilterApply.current = false; setError(reason instanceof Error ? reason.message : "Financial analytics could not be loaded."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [applied, refresh]);

  const push = (next: FinancialFilters) => {
    pendingFilterApply.current = true; setLoading(true);
    const query = filtersToParams(next).toString();
    if (query === filtersToParams(applied).toString()) setRefresh(value => value + 1);
    else router.push(`${pathname}?${query}`, { scroll: false });
  };
  const reload = () => { setLoading(true); setRefresh(value => value + 1); };
  const open = (kind: Exclude<FinancialOverlay, null>["kind"], element: HTMLElement | null, value?: string, window?: { from: string; to: string; label: string }) => { returnFocus.current = element; setOverlay({ kind, value, window }); };
  const openFromChart = (kind: Exclude<FinancialOverlay, null>["kind"], value?: string, window?: { from: string; to: string; label: string }) => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setOverlay({ kind, value, window }); };
  const stale = Boolean(error && data);
  const scopeAll = data ? data.overview.scope === "all" : true;

  const action = (label: string, kind: Exclude<FinancialOverlay, null>["kind"], value?: string, accessibleLabel?: string) =>
    <button type="button" aria-label={accessibleLabel ?? `${label}`} className={styles.textAction} onClick={event => open(kind, event.currentTarget, value)}>{label}<ArrowUpRight className="size-4" aria-hidden="true" /></button>;
  const exportReport = async () => { setExporting(true); try { await downloadFinancialAnalytics(applied); } catch (reason) { setError(reason instanceof Error ? reason.message : "Export failed."); } finally { setExporting(false); } };

  const kpis = data ? (() => {
    const o = data.overview; const noComparison = o.previous === null;
    const sentence = (change: number | null, pctValue: number | null, noun: string) => change === null ? (o.comparisonUnavailableReason ?? "No comparison selected") : change === 0 ? `No change in ${noun}` : `${change > 0 ? "Up" : "Down"} ${peso(Math.abs(change))}${pctValue === null ? " (% N/A)" : ` (${signedPercent(pctValue)})`}`;
    return [
      { id: "income", title: "Recorded operating income", value: peso(o.income), kind: "income" as const, icon: TrendingUp, tone: changeTone(o.incomeChange, "income"), signal: sentence(o.incomeChange, o.incomeChangePct, "income"), note: `Comparison ${peso(o.previous?.income)} · ${count(o.incomeCount)} records`, hint: "Operating income = sum of eligible posted Income records, excluding share-capital movements. Open for the breakdown.", scoped: o.scope !== "Expense" },
      { id: "expenses", title: "Recorded operating expenses", value: peso(o.expenses), kind: "expense" as const, icon: TrendingDown, tone: "neutral" as Tone, signal: sentence(o.expenseChange, o.expenseChangePct, "expenses"), note: o.largestExpenseCategory ? `Largest: ${o.largestExpenseCategory.name} (${percent(o.largestExpenseCategory.share)}) · comparison ${peso(o.previous?.expenses)}` : `Comparison ${peso(o.previous?.expenses)}`, hint: "Operating expenses = sum of eligible posted Expense records. A rise is not automatically unfavorable. Open for the drivers.", scoped: o.scope !== "Income" },
      { id: "net", title: "Recorded net surplus (indicative)", value: o.net === null ? "N/A" : o.net < 0 ? `${peso(o.net)} deficit` : peso(o.net), kind: "bridge" as const, icon: Scale, tone: (o.net === null ? "neutral" : o.net < 0 ? "danger" : "good") as Tone, signal: o.net === null ? "Needs income and expenses together" : noComparison ? (o.comparisonUnavailableReason ?? "No comparison selected") : `${o.netChange === 0 ? "No change" : `${(o.netChange ?? 0) > 0 ? "Up" : "Down"} ${peso(Math.abs(o.netChange ?? 0))}`}${o.netChangePct === null ? " (% N/A)" : ` (${signedPercent(o.netChangePct)})`}`, note: `Comparison ${peso(o.previous?.net)} · not an audited or distributable surplus`, hint: "Net surplus = recorded income − recorded expenses. Open to see which categories explain the change.", scoped: true },
      { id: "margin", title: "Recorded surplus margin", value: percent(o.margin), kind: "period" as const, icon: Percent, tone: (o.margin === null ? "neutral" : o.margin < 0 ? "danger" : "neutral") as Tone, signal: o.margin === null ? (!scopeAll ? "Needs income and expenses together" : o.income === 0 ? "N/A: no income recorded" : "N/A") : o.marginChangePoints === null ? (noComparison ? "No comparison" : "Comparison margin N/A") : `${o.marginChangePoints === 0 ? "No change" : `${o.marginChangePoints > 0 ? "Up" : "Down"} ${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(Math.abs(o.marginChangePoints))} points`}`, note: `Comparison ${percent(o.previous?.margin)} · not an audited profitability ratio`, hint: "Margin = net surplus ÷ income × 100, only when income is above zero. Open for the period's full breakdown.", scoped: true },
    ];
  })() : [];

  const chartPoints = data?.performanceTrend.points ?? [];
  const chartData = chartPoints.map(point => ({ ...point, previousNet: point.previous?.net ?? null }));
  const hasComparison = Boolean(data?.comparison.enabled && data.overview.previous);
  const toggle = (series: SeriesKey) => setVisible(current => (current.includes(series) ? (current.length > 1 ? current.filter(item => item !== series) : current) : [...current, series]));
  const openPeriod = (point: TrendPoint) => openFromChart("period", point.key, { from: point.from, to: point.to, label: point.label });

  return <div className={styles.dashboard}>
    <PageHeader eyebrow="Chairman · Financial analytics" title="Financial analytics" description="Recorded income, expenses and surplus from the Financial Ledger, with comparisons, drivers and record-integrity checks. Read-only and descriptive."
      actions={<><Button variant="secondary" size="sm" disabled={loading} onClick={reload}><RefreshCw className="size-4" aria-hidden="true" />Refresh</Button>
        <Button variant="secondary" size="sm" disabled={!data || loading} onClick={event => open("matrix", event.currentTarget)}><GitCompareArrows className="size-4" aria-hidden="true" />Compare sources &amp; categories</Button>
        <Button variant="secondary" size="sm" disabled={!data || loading} loading={exporting} onClick={() => void exportReport()}><Download className="size-4" aria-hidden="true" />Export Excel</Button></>} />
    <form className="flex flex-wrap items-end gap-3" role="search" aria-label="Open Ledger Search" onSubmit={event => { event.preventDefault(); if (ledgerTerm.trim()) router.push(ledgerSearchLink(ledgerTerm)); }}>
      <div className={`${styles.field} min-w-[220px] flex-1`}><label htmlFor="ledger-search">Look up a ledger record</label><input id="ledger-search" type="search" value={ledgerTerm} maxLength={190} onChange={event => setLedgerTerm(event.target.value)} placeholder="Record number, category or note" /></div>
      <Button type="submit" variant="secondary" size="md" disabled={!ledgerTerm.trim()}><Search className="size-4" aria-hidden="true" />Open Ledger Search</Button>
    </form>
    <FinancialFilterForm key={key} applied={applied} expanded={filtersOpen} onExpandedChange={setFiltersOpen} periodLabel={data?.periodLabel}
      summaryFilters={data ? { ...data.filters, compareStart: data.filters.compareStart ?? "", compareEnd: data.filters.compareEnd ?? "", minAmount: data.filters.minAmount === null ? "" : String(data.filters.minAmount), maxAmount: data.filters.maxAmount === null ? "" : String(data.filters.maxAmount) } : applied} today={today} categories={data?.options.categories ?? []} loading={loading} onApply={push} />

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{stale ? `Refresh failed: ${error} Showing the results loaded at ${loadedAt?.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })}. They may be out of date.` : error}</p><Button variant="secondary" size="sm" onClick={reload}>Retry analytics</Button></div>}
    {loading && <p role="status" className={styles.notice}>{data ? "Updating analytics…" : "Loading financial analytics…"}</p>}

    {data && <div style={{ opacity: loading ? 0.6 : 1 }} className={styles.dashboard} aria-busy={loading}>
      <div className={styles.contextBar} aria-live="polite">
        <p><strong>{count(data.overview.recordCount)} eligible records</strong> · {data.periodLabel}{data.comparison.enabled ? ` · compared with ${data.comparisonLabel} (${data.comparison.label.toLowerCase()})` : " · no comparison"} · Asia/Manila</p>
        <button type="button" className={styles.textAction} onClick={event => open("methodology", event.currentTarget)}><Info className="size-4" aria-hidden="true" />Definitions &amp; limits</button>
      </div>
      {(data.comparison.note || data.overview.comparisonUnavailableReason) && <p className={styles.warnNotice}>{data.overview.comparisonUnavailableReason ?? data.comparison.note}</p>}
      {data.overview.state === "no-records" && <p className={styles.notice}>No eligible financial records match these filters. Figures show ₱0.00 because nothing qualifies, not because data is missing. Only posted, active Income and Expense records count. Widen the filters or check Financial Data Integrity for unposted records.</p>}
      {data.overview.state === "no-income" && <p className={styles.notice}>No income was recorded in this period, so the surplus margin is N/A rather than 0%.</p>}
      {data.overview.state === "no-expenses" && <p className={styles.notice}>No expenses were recorded in this period.</p>}
      {!scopeAll && <p className={styles.notice}>Record type is limited to {data.overview.scope}. Net surplus, margin and the surplus bridge need both income and expenses and are shown as N/A.</p>}

      <section className={styles.kpis} aria-label="Financial performance KPIs">{kpis.map(kpi => { const Icon = kpi.icon; const scoped = kpi.scoped;
        return <button type="button" key={kpi.id} className={`${styles.panel} ${styles.kpi}`} data-tone={kpi.tone} title={kpi.hint} onClick={event => open(kpi.kind, event.currentTarget, undefined, kpi.id === "margin" ? { from: data.filters.start, to: data.filters.end, label: data.periodLabel } : undefined)}>
          <span className={styles.kpiHeading}><span className={styles.kpiLabel}>{kpi.title}</span><span className={styles.kpiIcon}><Icon aria-hidden="true" className="size-4" /></span></span>
          <strong>{scoped ? kpi.value : "Not in selected type"}</strong>
          {scoped && <Signal tone={kpi.tone} label={kpi.signal} />}
          <small className={styles.kpiNote}>{scoped ? kpi.note : "This measure is outside the selected record type."}</small>
        </button>; })}</section>

      <section className={`${styles.panel} ${styles.capitalStrip}`} aria-label="Share capital information, separate from operating results">
        <div className={styles.panelHeading}><span className={styles.sectionIcon} data-tone="neutral"><Landmark aria-hidden="true" className="size-5" /></span><div><h2 className="text-base font-bold text-coop-forest">Share capital</h2><p className="text-xs text-coop-muted">Separate from operating income, surplus and margin</p></div></div>
        {data.capitalContext.available ? <dl className="m-0 flex flex-1 flex-wrap gap-x-8 gap-y-3">
          <div><dt>Total capital balance</dt><dd>{peso(data.capitalContext.totalBalance)}</dd></div>
          <div><dt>Added in period</dt><dd>{peso(data.capitalContext.addedInPeriod)}</dd></div>
          <div><dt>Member contributions</dt><dd>{peso(data.capitalContext.memberContributions)}</dd></div>
          <div><dt>Interest additions</dt><dd>{peso(data.capitalContext.interestAdditions)}</dd></div>
        </dl> : <p className="flex-1 text-sm text-coop-muted">The share-capital ledger is not available in this database, so capital figures cannot be shown. This does not affect operating figures.</p>}
        <Link className={styles.textAction} href="/portal/chairman/share-capital">Share Capital Management<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
      </section>

      <div className={styles.heroGrid}>
        <Panel icon={CalendarRange} title="Financial performance" description={`Income, expenses and net surplus by ${data.performanceTrend.granularity === "daily" ? "day" : data.performanceTrend.granularity.replace("ly", "")}${data.performanceTrend.granularity === "yearly" ? "" : ""}. Select a period for details.`} action={action("Period details", "period", undefined)}>
          <div className={styles.toggleRow}>
            <div role="group" aria-label="Detail level" className="flex flex-wrap gap-2">{GRANULARITY_OPTIONS.map(option => <button type="button" key={option.value} className={styles.tab} aria-pressed={applied.granularity === option.value} onClick={() => push({ ...applied, granularity: option.value })}>{option.label}</button>)}</div>
          </div>
          <div className={styles.toggleRow} role="group" aria-label="Chart series">
            {(Object.keys(SERIES) as SeriesKey[]).map(series => { const disabled = (series === "net" && !scopeAll) || (series === "income" && data.overview.scope === "Expense") || (series === "expenses" && data.overview.scope === "Income");
              return <button type="button" key={series} className={styles.seriesToggle} aria-pressed={visible.includes(series) && !disabled} disabled={disabled} onClick={() => toggle(series)}><i style={{ background: SERIES[series].color }} />{SERIES[series].label}</button>; })}
            <button type="button" className={styles.tab} onClick={() => setVisible(["income", "expenses", "net"])}>All series</button>
          </div>
          {data.performanceTrend.note && <p className={styles.hint}>{data.performanceTrend.note}</p>}
          {chartData.length === 0 ? <p className={styles.notice}>No ledger coverage in this period yet, so there is nothing to chart.</p> :
            <div className={styles.chart} role="img" aria-label={`Income, expenses and net surplus for ${chartData.length} periods from ${chartData[0].label} to ${chartData[chartData.length - 1].label}. A table alternative follows the chart.`}>
              <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 5 }} onClick={state => { const index = Number(state?.activeTooltipIndex); if (Number.isInteger(index) && chartPoints[index]) openPeriod(chartPoints[index]); }}>
                <CartesianGrid vertical={false} stroke="#e7ece6" /><XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} /><YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={value => `₱${Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}k` : value}`} />
                <ReferenceLine y={0} stroke="#5d6d63" /><Tooltip content={<TrendTooltip />} cursor={{ fill: "rgb(31 107 67 / .06)" }} />
                {visible.includes("income") && data.overview.scope !== "Expense" && <Bar isAnimationActive={false} dataKey="income" name="Income" fill={SERIES.income.color} radius={[3, 3, 0, 0]} cursor="pointer" />}
                {visible.includes("expenses") && data.overview.scope !== "Income" && <Bar isAnimationActive={false} dataKey="expenses" name="Expenses" fill={SERIES.expenses.color} radius={[3, 3, 0, 0]} cursor="pointer" />}
                {visible.includes("net") && scopeAll && <Line isAnimationActive={false} dataKey="net" name="Net surplus" stroke={SERIES.net.color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />}
                {visible.includes("net") && scopeAll && hasComparison && <Line isAnimationActive={false} dataKey="previousNet" name="Comparison net surplus" stroke="#5d6d63" strokeDasharray="5 4" dot={false} connectNulls={false} />}
              </ComposedChart></ResponsiveContainer>
            </div>}
          <div className={styles.chartFooter}><span className="text-coop-muted">Weekly periods run Monday to Sunday · {hasComparison ? "Dashed line is the comparison period's net surplus" : "No comparison line"}</span><Link className={styles.textAction} href={ledgerLink(data)}>View records<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
          <ChartAlternative data={data} onOpen={openPeriod} />
        </Panel>

        <Panel icon={Scale} tone={scopeAll && data.netSurplusBridge.available && data.netSurplusBridge.totalChange < 0 ? "danger" : "good"} title="What changed?" description="Categories that moved net surplus the most" action={action("Open bridge", "bridge")}>
          {data.netSurplusBridge.available ? <>
            <p className="mb-3 text-sm">Net surplus moved <strong>{signedPeso(data.netSurplusBridge.totalChange)}</strong> from {peso(data.netSurplusBridge.previousNet)} to {peso(data.netSurplusBridge.currentNet)}.</p>
            {(() => { const drivers = data.netSurplusBridge.drivers; const up = drivers.filter(d => d.effect > 0).slice(0, 2); const down = drivers.filter(d => d.effect < 0).slice(0, 2);
              const item = (d: (typeof drivers)[number]) => <button type="button" key={d.key} className={styles.changeItem} data-direction={d.effect > 0 ? "up" : "down"} onClick={event => open("bridge", event.currentTarget)}><span>{d.name}<small className="block text-coop-muted">{d.type === "Income" ? "Income" : "Expense"} · {d.status === "new" ? "new this period" : d.status === "discontinued" ? "none this period" : "continuing"}</small></span><strong>{signedPeso(d.effect)}</strong></button>;
              return <div className={styles.changeList}>
                <h3 className="text-sm font-bold">Raised the surplus</h3>{up.length ? up.map(item) : <p className={styles.hint}>No category raised it.</p>}
                <h3 className="mt-2 text-sm font-bold">Lowered the surplus</h3>{down.length ? down.map(item) : <p className={styles.hint}>No category lowered it.</p>}
              </div>; })()}
            <p className={`${styles.hint} mt-3`}>Describes which categories moved numerically; it does not explain why.</p>
          </> : <p className={styles.notice}>{data.netSurplusBridge.reason}</p>}
        </Panel>
      </div>

      <div className={styles.twoColumns}>
        <Panel icon={Banknote} tone="good" title="Income sources" description="Source modules ranked by recorded operating income" action={<span className="flex flex-wrap gap-3">{action("Details", "sources")}{action("Compare sources & categories", "matrix")}</span>}>
          {data.incomeSources.rows.some(row => row.amount > 0) ? <>
            <RankList label="Income by source module" color={SERIES.income.color} rows={data.incomeSources.rows.filter(row => row.amount > 0)} onSelect={(row, el) => open("sources", el, `source:${row.key}`)} />
            {data.incomeSources.concentration.topShare !== null && <p className={styles.notice}>{data.incomeSources.concentration.contributors === 1 ? `Only ${data.incomeSources.concentration.topName} recorded income, accounting for 100% of recorded operating income in this period.` : `${data.incomeSources.concentration.topName} accounts for ${percent(data.incomeSources.concentration.topShare)} of recorded operating income in this period.`}{data.incomeSources.concentration.topTwoShare !== null ? ` The top two sources account for ${percent(data.incomeSources.concentration.topTwoShare)}.` : ""} <span className="text-coop-muted">Descriptive only, not a risk rating.</span></p>}
          </> : <p className={styles.notice}>No income was recorded for these filters.</p>}
        </Panel>
        <Panel icon={Layers} title="Financial categories" description="Largest income categories and their share of income" action={action("Details", "category")}>
          {(() => { const rows = data.incomeCategories.rows.filter(row => row.amount > 0); const top = rows.slice(0, 6); const rest = rows.slice(6);
            if (!rows.length) return <p className={styles.notice}>No income was recorded for these filters.</p>;
            const others: ShareRow | null = rest.length ? { key: "others", name: `Others (${rest.length})`, amount: Math.round(rest.reduce((sum, row) => sum + row.amount * 100, 0)) / 100, share: Math.round(rest.reduce((sum, row) => sum + (row.share ?? 0), 0) * 100) / 100, recordCount: rest.reduce((sum, row) => sum + row.recordCount, 0), previousAmount: null, change: null, changePct: null, isNew: false, series: [] } : null;
            return <><RankList label="Income by financial category" color="#4d8f5b" rows={others ? [...top, others] : top} onSelect={(row, el) => open("category", el, row.key === "others" ? undefined : `income-category:${row.key}`)} />
              {others && <p className={styles.hint}>“Others” combines the {rest.length} smallest categories: {rest.map(row => row.name).join(", ")}. Open Details for every category.</p>}</>; })()}
        </Panel>
      </div>

      <div className={styles.twoColumns}>
        <Panel icon={TrendingDown} title="Expense drivers" description="Expense categories ranked by recorded amount" action={action("Details", "expense")}>
          {data.expenseCategories.rows.some(row => row.amount > 0) ? <>
            <div className={styles.scrollList} role="region" aria-label="Expense categories, scrollable list" tabIndex={0}><RankList label="Expenses by category" color={SERIES.expenses.color} rows={data.expenseCategories.rows.filter(row => row.amount > 0)} onSelect={(row, el) => open("category", el, `expense-category:${row.key}`)} /></div>
            <div className={styles.summary}><p>Top category <strong>{percent(data.expenseCategories.concentration.top1)}</strong></p><p>Top three <strong>{percent(data.expenseCategories.concentration.top3)}</strong></p><p>Average record <strong>{peso(data.expenseCategories.averageAmount)}</strong></p></div>
          </> : <p className={styles.notice}>No expenses were recorded for these filters.</p>}
        </Panel>
        <Panel icon={CalendarRange} title="Historical patterns" description={data.seasonalPatterns.established ? "Average net surplus by calendar month across complete years" : "Monthly net surplus from recorded history"} action={action("Details", "seasonality")}>
          {(() => { const s = data.seasonalPatterns;
            const series = s.established ? s.months.map(m => ({ name: m.name.slice(0, 3), net: m.netAverage ?? 0 })) : s.grid.slice(-12).map(g => ({ name: `${String(g.month).padStart(2, "0")}/${String(g.year).slice(2)}`, net: g.net }));
            return <>{series.length ? <div className={`${styles.chart} ${styles.compactChart}`} role="img" aria-label={s.established ? "Average net surplus by calendar month" : "Net surplus by recent month"}><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 5 }}><CartesianGrid vertical={false} stroke="#e7ece6" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} /><YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={value => `₱${Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}k` : value}`} /><ReferenceLine y={0} stroke="#5d6d63" /><Tooltip formatter={value => peso(Number(value))} /><Bar isAnimationActive={false} dataKey="net" name={s.established ? "Average net surplus" : "Net surplus"} radius={[3, 3, 0, 0]}>{series.map((entry, index) => <Cell key={index} fill={entry.net < 0 ? toneColors.danger : "#1f6b43"} />)}</Bar></BarChart></ResponsiveContainer></div> : null}
              <p className={s.established ? styles.compactNote : styles.warnNotice}>{s.statement}</p></>; })()}
        </Panel>
      </div>

      <Panel icon={Landmark} title="Operational sources in the ledger" description="POS and Rental income already inside the headline figures; shown for context and reconciliation, never added again">
        <div className={styles.twoColumns}>{data.operationalSources.map(source => { const recon = data.recordIntegrity.reconciliation.find(row => row.module === source.module);
          return <div key={source.module} className="space-y-2 rounded-lg border border-coop-border p-4">
            <h3 className="text-base font-bold text-coop-forest">{source.module === "POS" ? "POS contribution" : "Rental contribution"}</h3>
            <p className="text-2xl font-bold tabular-nums text-coop-forest">{peso(source.income)}</p>
            <p className="text-sm">{percent(source.share)} of recorded income · {count(source.recordCount)} ledger records · {source.previousIncome === null ? "no comparison" : `${signedPeso(source.change)} vs comparison`}</p>
            {recon && <p className={styles.hint}>{recon.available ? `Operational ${peso(recon.operationalAmount)} vs ledger ${peso(recon.postedAmount)} (${signedPeso(recon.difference)}).` : "Reconciliation unavailable for this source."}</p>}
            <div className="flex flex-wrap gap-4">{action("Details", "operational", source.module, `${source.module} contribution details`)}<Link className={styles.textAction} href={source.link}>Open {source.module === "POS" ? "POS" : "Rentals"}<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
          </div>; })}</div>
      </Panel>

      <Panel icon={ShieldCheck} tone={data.recordIntegrity.issues.some(issue => issue.available && issue.count > 0 && issue.label !== "Informational") ? "warning" : "good"} title="Financial data integrity" description="How complete the records behind these figures are · read-only checks for the reporting period" action={action("All checks", "integrity")}>
        <div className={styles.integrityGrid}>{[...data.recordIntegrity.issues].sort((a, b) => Number(b.available && b.count > 0 && b.label !== "Informational") - Number(a.available && a.count > 0 && a.label !== "Informational")).map(issue => {
          const review = issue.available && issue.count > 0 && issue.label !== "Informational"; const Icon = toneIcons[!issue.available ? "neutral" : review ? "warning" : "good"];
          return <button type="button" key={issue.code} className={styles.integrityCard} onClick={event => open("integrity", event.currentTarget, issue.code)}>
            <span className="flex items-center gap-2"><Icon aria-hidden="true" className="size-4" />{issue.title}</span>
            <strong>{issue.available ? count(issue.count) : "–"}</strong>
            <span className="text-xs text-coop-muted">{issue.available ? issue.label : "Not checked: source unavailable"}</span>
          </button>; })}</div>
        <p className={`${styles.hint} mt-3`}>{count(data.recordIntegrity.postedCount)} posted operating records in this period. Last refreshed {new Date(data.recordIntegrity.refreshedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}. A flagged record means the ledger needs review, not that money is missing.</p>
      </Panel>

      <Panel icon={Lightbulb} tone="warning" title="Financial analytics insights" description="Rule-based observations from the figures above · no predictions or recommendations" action={action("How these are chosen", "methodology")}>
        {data.insights.length === 0 ? <p className={styles.notice}>No observations meet the reporting rules for this selection. The figures above remain available; nothing is inferred from insufficient change or history.</p> :
          data.insights.map(insight => { const tone: Tone = insight.priority >= 90 ? "warning" : "good"; const Icon = toneIcons[tone]; const drill = insight.drill;
            const drillKind = drill.kind === "ledger" ? null : drill.kind; const drillValue = drill.kind === "integrity" ? drill.code : undefined;
            return <article className={styles.insight} key={insight.id}>
              <div className={styles.insightHeading}><span className={styles.insightIcon} data-tone={tone}><Icon aria-hidden="true" className="size-4" /></span><div className="min-w-0">
                <h3>{insight.title}</h3><p className={styles.insightValue}>{insight.value}</p>
                <p className="text-coop-muted">{insight.period}{insight.comparisonPeriod ? ` vs ${insight.comparisonPeriod}` : ""}{insight.subject ? ` · ${insight.subject}` : ""}</p>
                <p>{insight.explanation}</p>{insight.caveat && <p className="text-coop-muted">{insight.caveat}</p>}
              </div></div>
              {drill.kind === "ledger" ? <Link className={styles.textAction} href={ledgerLink(data, drill.query)}>View records<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
                : <button type="button" className={styles.textAction} onClick={event => open(drillKind ?? "bridge", event.currentTarget, drillValue)}>Review<ArrowUpRight className="size-4" aria-hidden="true" /></button>}
            </article>; })}
      </Panel>

      <p className="text-xs leading-6 text-coop-muted">Updated {new Date(data.metadata.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} · Headline figures come only from posted, active entries in the Financial Ledger. Indicative operational analytics, not audited statements or official CDA financial reports.</p>
      {overlay && <FinancialDrawer key={`${overlay.kind}:${overlay.value ?? ""}:${overlay.window?.from ?? ""}`} overlay={overlay} data={data} applied={applied} today={today} onClose={() => setOverlay(null)} returnFocus={returnFocus} />}
    </div>}
  </div>;
}
