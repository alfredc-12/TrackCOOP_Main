"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  count, getFinancialMatrix, getFinancialPeriod, integrityLedgerLink, ledgerLink, peso, percent, signedPercent, signedPeso, toneColors,
  type FinancialAnalyticsResult, type FinancialFilters, type MatrixResponse, type PeriodDetail, type ShareRow, type TableCell,
} from "./financial-analytics-client";
import { ChartData, FinancialTable, Metric, Signal } from "./FinancialUi";
import styles from "./FinancialAnalytics.module.css";

type Data = FinancialAnalyticsResult;
const money = (value: number | null): TableCell => ({ sort: value, node: peso(value) });
const signed = (value: number | null): TableCell => ({ sort: value, node: signedPeso(value) });
const pct = (value: number | null): TableCell => ({ sort: value, node: percent(value) });
const spct = (value: number | null): TableCell => ({ sort: value, node: signedPercent(value) });
export const ledgerAction = (label: string, href: string) => <Link className={styles.textAction} href={href}>{label}<ArrowUpRight className="size-4" aria-hidden="true" /></Link>;
const Formula = ({ children }: { children: ReactNode }) => <p className={styles.notice}>{children}</p>;

function shareTable(label: string, nameHeading: string, rows: ShareRow[], hasComparison: boolean, total: number) {
  const headings = [nameHeading, "Amount", "Share", "Records", ...(hasComparison ? ["Comparison", "Change", "Change %"] : [])];
  return <FinancialTable label={label} searchable headings={headings} numeric={headings.map((_, index) => index).slice(1)}
    rows={rows.map(row => [{ sort: row.name, node: <>{row.name}{row.isNew && <span className={styles.badge}>New</span>}{row.amount === 0 && (row.previousAmount ?? 0) > 0 && <span className={styles.badge}>None this period</span>}</> }, money(row.amount), pct(row.share), row.recordCount, ...(hasComparison ? [money(row.previousAmount), signed(row.change), spct(row.changePct)] : [])])}
    footer={["Total", money(total), pct(total > 0 ? 100 : null), rows.reduce((sum, row) => sum + row.recordCount, 0), ...(hasComparison ? ["", "", ""] : [])]} />;
}

export function IncomeView({ data }: { data: Data }) {
  const o = data.overview; const has = data.comparison.enabled && o.previous !== null;
  const c = data.incomeSources.concentration;
  return <>
    <div className={styles.metricGrid}>
      <Metric label="Recorded operating income" value={peso(o.income)} note={`${count(o.incomeCount)} eligible records`} />
      <Metric label="Comparison period" value={peso(o.previous?.income)} note={data.comparisonLabel ?? "No comparison"} />
      <Metric label="Change" value={signedPeso(o.incomeChange)} note={signedPercent(o.incomeChangePct)} />
      <Metric label="Largest source share" value={percent(c.topShare)} note={c.topName ?? "No income recorded"} />
    </div>
    <Formula>Operating income = sum of eligible posted Income records dated {data.periodLabel}. Share-capital movements and unposted, voided, corrected or reversed records are excluded. Percentage change = (current − comparison) ÷ comparison × 100, N/A when the comparison is zero.</Formula>
    <section><h3>Income by source module</h3>{shareTable("Income by source", "Source", data.incomeSources.rows, has, data.incomeSources.total)}</section>
    <section><h3>Income by financial category</h3>{shareTable("Income by category", "Category", data.incomeCategories.rows, has, data.incomeCategories.total)}</section>
    <section><h3>Income by period</h3><FinancialTable label="Income by period" headings={["Period", "Income", "Comparison", "Change"]} numeric={[1, 2, 3]} rows={data.performanceTrend.points.map(p => [p.label, money(p.income), money(p.previous?.income ?? null), signed(p.change?.income ?? null)])} /></section>
    {ledgerAction("View income records in Financial Ledger", ledgerLink(data, { recordType: "Income" }))}
  </>;
}

export function ExpenseView({ data }: { data: Data }) {
  const e = data.expenseCategories; const o = data.overview; const has = data.comparison.enabled && o.previous !== null;
  const withChange = e.rows.filter(row => row.change !== null);
  const increases = [...withChange].filter(row => (row.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0)).slice(0, 3);
  const decreases = [...withChange].filter(row => (row.change ?? 0) < 0).sort((a, b) => (a.change ?? 0) - (b.change ?? 0)).slice(0, 3);
  const totalChange = o.expenseChange;
  const headings = ["Category", "Amount", "Share", "Records", "Average", ...(has ? ["Comparison", "Change", "Change %", "Share of expense change"] : [])];
  return <>
    <div className={styles.metricGrid}>
      <Metric label="Recorded operating expenses" value={peso(o.expenses)} note={`${count(e.count)} records · average ${peso(e.averageAmount)}`} />
      <Metric label="Comparison period" value={peso(o.previous?.expenses)} note={data.comparisonLabel ?? "No comparison"} />
      <Metric label="Change" value={signedPeso(o.expenseChange)} note={signedPercent(o.expenseChangePct)} />
      <Metric label="Largest category" value={percent(e.concentration.top1)} note={o.largestExpenseCategory?.name ?? "No expenses recorded"} />
      <Metric label="Top 3 categories" value={percent(e.concentration.top3)} note={e.concentration.top3 === null ? "Fewer than four categories" : "of recorded expenses"} />
      <Metric label="Top 5 categories" value={percent(e.concentration.top5)} note={e.concentration.top5 === null ? "Fewer than six categories" : "of recorded expenses"} />
    </div>
    <Formula>Operating expenses = sum of eligible posted Expense records dated {data.periodLabel}. Expense category share = category expenses ÷ total operating expenses × 100. A rise in expenses is not automatically unfavorable; this view describes the records and does not set budgets or limits.</Formula>
    <section><h3>Expense categories</h3>
      <FinancialTable label="Expense categories" searchable headings={headings} numeric={headings.map((_, index) => index).slice(1)}
        rows={e.rows.map(row => [{ sort: row.name, node: <>{row.name}{row.isNew && <span className={styles.badge}>New</span>}{row.amount === 0 && (row.previousAmount ?? 0) > 0 && <span className={styles.badge}>None this period</span>}</> }, money(row.amount), pct(row.share), row.recordCount, money(row.recordCount ? row.amount / row.recordCount : null), ...(has ? [money(row.previousAmount), signed(row.change), spct(row.changePct), pct(totalChange ? (row.change ?? 0) / totalChange * 100 : null)] : [])])}
        footer={["Total", money(e.total), pct(e.total > 0 ? 100 : null), e.count, money(e.averageAmount), ...(has ? ["", "", "", ""] : [])]} /></section>
    {has && <section className={styles.twoColumns}>
      <div><h3>Largest increases</h3>{increases.length ? increases.map(row => <p key={row.key} className="py-1 text-sm">{row.name}: <strong>{signedPeso(row.change)}</strong> ({signedPercent(row.changePct)})</p>) : <p className={styles.hint}>No expense category increased.</p>}</div>
      <div><h3>Largest decreases</h3>{decreases.length ? decreases.map(row => <p key={row.key} className="py-1 text-sm">{row.name}: <strong>{signedPeso(row.change)}</strong> ({signedPercent(row.changePct)})</p>) : <p className={styles.hint}>No expense category decreased.</p>}</div>
    </section>}
    <section><h3>Expenses by period</h3><FinancialTable label="Expenses by period" headings={["Period", "Expenses", "Comparison", "Change"]} numeric={[1, 2, 3]} rows={data.performanceTrend.points.map(p => [p.label, money(p.expenses), money(p.previous?.expenses ?? null), signed(p.change?.expenses ?? null)])} /></section>
    {ledgerAction("View expense records in Financial Ledger", ledgerLink(data, { recordType: "Expense" }))}
  </>;
}

type Step = { name: string; range: [number, number]; value: number; kind: "total" | "up" | "down" };
export function BridgeView({ data }: { data: Data }) {
  const b = data.netSurplusBridge;
  if (!b.available) return <p className={styles.notice}>{b.reason}</p>;
  const shown = b.drivers.slice(0, 8); const others = b.drivers.slice(8);
  const steps: Step[] = [{ name: "Comparison period", range: [Math.min(0, b.previousNet), Math.max(0, b.previousNet)], value: b.previousNet, kind: "total" }];
  let running = b.previousNet;
  const rounded = (value: number) => Math.round(value * 100) / 100;
  for (const driver of [...shown, ...(others.length ? [{ name: `${others.length} other categories`, effect: others.reduce((sum, d) => sum + Math.round(d.effect * 100), 0) / 100 }] : [])]) {
    const next = rounded(running + driver.effect);
    steps.push({ name: driver.name, range: [Math.min(running, next), Math.max(running, next)], value: driver.effect, kind: driver.effect >= 0 ? "up" : "down" });
    running = next;
  }
  steps.push({ name: "This period", range: [Math.min(0, b.currentNet), Math.max(0, b.currentNet)], value: b.currentNet, kind: "total" });
  const colors = { total: "#123d2a", up: "#1f6b43", down: "#b77c13" };
  const sum = rounded(b.previousNet + b.drivers.reduce((total, d) => total + Math.round(d.effect * 100), 0) / 100);
  return <>
    <div className={styles.metricGrid}>
      <Metric label="Comparison net surplus" value={peso(b.previousNet)} note={data.comparisonLabel} />
      <Metric label="Income change" value={signedPeso(b.incomeChange)} />
      <Metric label="Expense change" value={signedPeso(b.expenseChange)} note="An increase lowers the surplus" />
      <Metric label="This period net surplus" value={peso(b.currentNet)} note={data.periodLabel} />
      <Metric label="Total change" value={signedPeso(b.totalChange)} />
    </div>
    <Formula>ΔNet surplus = ΔIncome − ΔExpenses, split by category. Income increases and expense decreases raise the surplus; income decreases and expense increases lower it. {peso(b.previousNet)} + {signedPeso(rounded(sum - b.previousNet))} = {peso(sum)}, equal to this period&apos;s {peso(b.currentNet)}. This shows which categories moved the figure, not why the cooperative earned or spent differently.</Formula>
    <div className={styles.chart} role="img" aria-label={`Net surplus bridge from ${peso(b.previousNet)} to ${peso(b.currentNet)} across ${steps.length - 2} category drivers`}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={steps} margin={{ top: 10, right: 12, left: 0, bottom: 40 }}>
        <CartesianGrid vertical={false} stroke="#e7ece6" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={70} /><YAxis tick={{ fontSize: 11 }} tickFormatter={value => `₱${Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}k` : value}`} width={56} />
        <ReferenceLine y={0} stroke="#5d6d63" />
        <Tooltip formatter={(_, __, item) => [item.payload.kind === "total" ? peso(item.payload.value) : signedPeso(item.payload.value), item.payload.name]} />
        <Bar isAnimationActive={false} dataKey="range">{steps.map(step => <Cell key={step.name} fill={colors[step.kind]} />)}</Bar>
      </BarChart></ResponsiveContainer>
    </div>
    <FinancialTable label="Net surplus drivers" searchable headings={["Category", "Type", "This period", "Comparison", "Effect on net surplus", "Share of change", "Status"]} numeric={[2, 3, 4, 5]}
      rows={b.drivers.map(d => [d.name, d.type, money(d.current), money(d.previous), { sort: d.effect, node: <strong style={{ color: d.effect >= 0 ? toneColors.good : toneColors.warning }}>{signedPeso(d.effect)}</strong> }, pct(d.share), d.status === "new" ? "New this period" : d.status === "discontinued" ? "None this period" : "Continuing"])}
      footer={["Total change", "", "", "", signed(b.totalChange), pct(b.totalChange === 0 ? null : 100), ""]} />
    {ledgerAction("Open this period in Financial Ledger", ledgerLink(data))}
  </>;
}

function useMatrix(applied: FinancialFilters, enabled: boolean) {
  const [state, setState] = useState<{ data: MatrixResponse | null; error: string; loading: boolean }>({ data: null, error: "", loading: enabled });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    getFinancialMatrix(applied, controller.signal).then(data => { if (!controller.signal.aborted) setState({ data, error: "", loading: false }); })
      .catch(error => { if (!controller.signal.aborted) setState({ data: null, error: error instanceof Error ? error.message : "Breakdown could not be loaded.", loading: false }); });
    return () => controller.abort();
  }, [applied, enabled]);
  return state;
}

/** Source or category detail. `value` is `source:<module>`, `income-category:<id>` or `expense-category:<id>`; empty means the overview. */
export function ContributionView({ data, applied, value }: { data: Data; applied: FinancialFilters; value?: string }) {
  const separator = (value ?? "").indexOf(":");
  const kind = separator < 0 ? "" : (value ?? "").slice(0, separator);
  const key = separator < 0 ? "" : (value ?? "").slice(separator + 1);
  const isSource = kind === "source"; const isExpense = kind === "expense-category";
  const matrixState = useMatrix(applied, Boolean(value));
  const rows = isSource ? data.incomeSources.rows : isExpense ? data.expenseCategories.rows : data.incomeCategories.rows;
  const row = value ? rows.find(candidate => candidate.key === key) : undefined;
  const points = data.performanceTrend.points; const has = data.comparison.enabled && data.overview.previous !== null;
  const c = data.incomeSources.concentration;

  if (!value) {
    const ranked = [...data.incomeSources.rows].filter(r => r.amount > 0 || (r.previousAmount ?? 0) > 0);
    const previousRank = new Map([...ranked].sort((a, b) => (b.previousAmount ?? 0) - (a.previousAmount ?? 0)).map((r, index) => [r.key, index + 1]));
    const currentRank = new Map([...ranked].sort((a, b) => b.amount - a.amount).map((r, index) => [r.key, index + 1]));
    return <>
      <div className={styles.metricGrid}>
        <Metric label="Contributing sources" value={count(c.contributors)} />
        <Metric label="Largest source" value={percent(c.topShare)} note={c.topName ?? "None"} />
        <Metric label="Top two sources" value={percent(c.topTwoShare)} note={c.topTwoShare === null ? "Needs more than two sources" : undefined} />
        <Metric label="Top three sources" value={percent(c.topThreeShare)} note={c.topThreeShare === null ? "Needs more than three sources" : undefined} />
      </div>
      <Formula>Largest source share = highest source income ÷ total recorded operating income × 100. Concentration is described, not rated: it is not a risk score and does not predict sustainability.</Formula>
      <section><h3>Income sources</h3>{shareTable("Income sources", "Source", data.incomeSources.rows, has, data.incomeSources.total)}</section>
      {has && <section><h3>Change in source ranking</h3><FinancialTable label="Source ranking" headings={["Source", "Rank this period", "Rank in comparison", "Movement"]} numeric={[1, 2]} rows={ranked.map(r => { const now = currentRank.get(r.key)!; const before = previousRank.get(r.key)!; return [r.name, now, before, before === now ? "No change" : before > now ? `Up ${before - now}` : `Down ${now - before}`]; })} /></section>}
      <section><h3>Source concentration over time</h3><FinancialTable label="Source concentration by period" headings={["Period", "Largest source", "Share of that period", "Sources with income"]} numeric={[2, 3]}
        rows={points.map((p, index) => { const per = data.incomeSources.rows.map(r => ({ name: r.name, value: r.series[index] ?? 0 })).filter(r => r.value > 0).sort((a, b) => b.value - a.value); const total = per.reduce((sum, r) => sum + r.value, 0); return [p.label, per[0]?.name ?? "No income", pct(per[0] ? Math.round(per[0].value / total * 10000) / 100 : null), per.length]; })} /></section>
      <p className={styles.hint}>Open a source from the Income sources panel to see the categories recorded under it, or use Compare Sources &amp; Categories for the full source × category matrix.</p>
      {ledgerAction("View income records in Financial Ledger", ledgerLink(data, { recordType: "Income" }))}
    </>;
  }

  if (!row) return <p className={styles.notice}>This item is not present for the current filters.</p>;
  const total = isExpense ? data.expenseCategories.total : data.incomeSources.total;
  const matrix = isExpense ? matrixState.data?.expense : matrixState.data?.income;
  const related = matrix && (isSource
    ? matrix.rows.map(r => ({ name: r.name, cell: r.cells[key] })).filter(r => r.cell && r.cell.amount !== 0)
    : matrix.rows.filter(r => r.categoryId === key).flatMap(r => matrix.sources.map(s => ({ name: s, cell: r.cells[s] }))).filter(r => r.cell && r.cell.amount !== 0));
  const ledgerExtra: Record<string, string> = isSource ? { sourceModules: key, recordType: "Income" } : { financialCategoryIds: key, recordType: isExpense ? "Expense" : "Income" };
  return <>
    <div className={styles.metricGrid}>
      <Metric label={isSource ? "Recorded income from this source" : isExpense ? "Recorded expenses in this category" : "Recorded income in this category"} value={peso(row.amount)} note={`${percent(row.share)} of ${peso(total)}`} />
      <Metric label="Comparison period" value={peso(row.previousAmount)} note={row.isNew ? "New this period" : data.comparisonLabel ?? "No comparison"} />
      <Metric label="Change" value={signedPeso(row.change)} note={signedPercent(row.changePct)} />
      <Metric label="Eligible records" value={count(row.recordCount)} note={row.recordCount ? `average ${peso(row.amount / row.recordCount)}` : undefined} />
    </div>
    <Formula>{isSource ? "Source share" : "Category share"} = {row.name} ÷ total eligible {isExpense ? "expenses" : "income"} × 100 for the same filters.</Formula>
    <section><h3>History by period</h3>
      <FinancialTable label={`${row.name} by period`} headings={["Period", "Amount"]} numeric={[1]} rows={points.map((p, index) => [p.label, money(row.series[index] ?? 0)])} />
    </section>
    <section><h3>{isSource ? "Categories recorded under this source" : "Source modules recording this category"}</h3>
      {matrixState.loading ? <p className={styles.notice} role="status">Loading breakdown…</p> : matrixState.error ? <p className={styles.errorNotice} role="alert">{matrixState.error}</p> :
        <FinancialTable label="Related breakdown" headings={[isSource ? "Category" : "Source module", "Amount", "Records", "Comparison", "Change"]} numeric={[1, 2, 3, 4]} rows={(related ?? []).map(r => [r.name, money(r.cell.amount), r.cell.count, money(r.cell.previousAmount), signed(r.cell.change)])} />}
    </section>
    {ledgerAction(`View ${row.name} records in Financial Ledger`, ledgerLink(data, ledgerExtra))}
  </>;
}

export function PeriodView({ data, applied, window }: { data: Data; applied: FinancialFilters; window?: { from: string; to: string; label: string } }) {
  const [state, setState] = useState<{ detail: PeriodDetail | null; error: string }>({ detail: null, error: "" });
  useEffect(() => {
    if (!window) return;
    const controller = new AbortController();
    getFinancialPeriod(applied, window.from, window.to, controller.signal).then(detail => { if (!controller.signal.aborted) setState({ detail, error: "" }); })
      .catch(error => { if (!controller.signal.aborted) setState({ detail: null, error: error instanceof Error ? error.message : "Period detail could not be loaded." }); });
    return () => controller.abort();
  }, [applied, window]);
  if (!window) return <p className={styles.notice}>Choose a period on the chart.</p>;
  const { detail, error } = state;
  if (error) return <p className={styles.errorNotice} role="alert">{error}</p>;
  if (!detail) return <p className={styles.notice} role="status">Loading {window.label}…</p>;
  const point = data.performanceTrend.points.find(p => p.from === window.from && p.to === window.to);
  return <>
    <div className={styles.metricGrid}>
      <Metric label="Income" value={peso(detail.income)} note={detail.previous ? `Preceding equal period ${peso(detail.previous.income)}` : "No earlier ledger coverage"} />
      <Metric label="Expenses" value={peso(detail.expenses)} note={detail.previous ? `Preceding equal period ${peso(detail.previous.expenses)}` : undefined} />
      <Metric label="Net surplus" value={peso(detail.net)} note={detail.previous ? `Preceding equal period ${peso(detail.previous.net)}` : undefined} />
      <Metric label="Eligible records" value={count(detail.recordCount)} note={point?.previous ? `Chart comparison bucket: net ${peso(point.previous.net)}` : undefined} />
    </div>
    <Formula>Records are summarized by record date using the same eligibility rule as every other figure. The “preceding equal period” is the same number of days directly before {window.from}.</Formula>
    <section><h3>Income by category</h3><FinancialTable label="Period income categories" headings={["Category", "Amount", "Records"]} numeric={[1, 2]} rows={detail.incomeCategories.map(c => [c.name, money(c.amount), c.count])} /></section>
    <section><h3>Expenses by category</h3><FinancialTable label="Period expense categories" headings={["Category", "Amount", "Records"]} numeric={[1, 2]} rows={detail.expenseCategories.map(c => [c.name, money(c.amount), c.count])} /></section>
    <section><h3>Source modules</h3><FinancialTable label="Period source modules" headings={["Source module", "Income", "Expenses"]} numeric={[1, 2]} rows={detail.sources.map(s => [s.source, money(s.income), money(s.expenses)])} /></section>
    <section><h3>By date</h3><FinancialTable label="Period by date" headings={["Date", "Income", "Expenses", "Net", "Records"]} numeric={[1, 2, 3, 4]} pageSize={31} rows={detail.daily.map(d => [d.date, money(d.income), money(d.expenses), signed(d.net), d.count])} /></section>
    {ledgerAction("View these records in Financial Ledger", ledgerLink(data, {}, { from: window.from, to: window.to }))}
  </>;
}

export function SeasonalityView({ data }: { data: Data }) {
  const s = data.seasonalPatterns; const [metric, setMetric] = useState<"income" | "expenses" | "net">("net");
  const years = [...new Set(s.grid.map(g => g.year))];
  const max = Math.max(1, ...s.grid.map(g => Math.abs(g[metric])));
  const chart = s.months.map(m => ({ name: m.name.slice(0, 3), income: m.incomeAverage ?? 0, expenses: m.expenseAverage ?? 0 }));
  return <>
    <p className={s.established ? styles.notice : styles.warnNotice}>{s.statement}</p>
    <div className={styles.metricGrid}>
      <Metric label="Complete months" value={count(s.completeMonths)} note={s.firstFullMonth ? `${s.firstFullMonth} to ${s.lastFullMonth}` : "None yet"} />
      <Metric label="Calendar years observed" value={count(s.yearsObserved)} note={`${s.minimumYears} needed per month`} />
      {s.established && <Metric label="Strongest income month" value={s.strongest.income?.name ?? "N/A"} note={`avg ${peso(s.strongest.income?.incomeAverage)}`} />}
      {s.established && <Metric label="Highest expense month" value={s.strongest.expense?.name ?? "N/A"} note={`avg ${peso(s.strongest.expense?.expenseAverage)}`} />}
      {s.established && <Metric label="Strongest net month" value={s.strongest.net?.name ?? "N/A"} note={`avg ${peso(s.strongest.net?.netAverage)}`} />}
      {s.established && <Metric label="Weakest net month" value={s.weakest.net?.name ?? "N/A"} note={`avg ${peso(s.weakest.net?.netAverage)}`} />}
    </div>
    <Formula>Historical month average = sum of that calendar month&apos;s values across complete years ÷ number of complete observations. Only complete calendar months are used and the reporting period does not apply. This describes recorded ledger timing; it is not attributed to agricultural seasons and is not a forecast.</Formula>
    <section><h3>{s.established ? "Average by month of year" : "Monthly trend (not yet seasonal)"}</h3>
      <div className={styles.chart} role="img" aria-label="Average monthly income and expenses by calendar month"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 10, right: 8, left: 0, bottom: 5 }}><CartesianGrid vertical={false} stroke="#e7ece6" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={value => `₱${Math.round(value / 1000)}k`} /><Tooltip formatter={value => peso(Number(value))} /><Bar isAnimationActive={false} dataKey="income" name="Average income" fill="#1f6b43" radius={[3, 3, 0, 0]} /><Bar isAnimationActive={false} dataKey="expenses" name="Average expenses" fill="#b77c13" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <FinancialTable label="Month of year" headings={["Month", "Years", "Income average", "Income median", "Expense average", "Expense median", "Net average", "Highest net", "Lowest net"]} numeric={[1, 2, 3, 4, 5, 6, 7, 8]}
        rows={s.months.map(m => [{ sort: m.month, node: m.name }, m.observations, money(m.incomeAverage), money(m.incomeMedian), money(m.expenseAverage), money(m.expenseMedian), signed(m.netAverage), m.highNet ? `${peso(m.highNet.value)} (${m.highNet.year})` : "N/A", m.lowNet ? `${peso(m.lowNet.value)} (${m.lowNet.year})` : "N/A"])} pageSize={12} />
    </section>
    <section><h3>Year-over-year heatmap</h3>
      <div className={styles.toggleRow} role="group" aria-label="Heatmap measure">{(["net", "income", "expenses"] as const).map(m => <button type="button" key={m} className={styles.tab} aria-pressed={metric === m} onClick={() => setMetric(m)}>{m === "net" ? "Net surplus" : m === "income" ? "Income" : "Expenses"}</button>)}</div>
      {years.length ? <div className={styles.tableScroll} role="region" aria-label="Monthly heatmap" tabIndex={0}><div className={styles.heatmap}>
        <span />{["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((m, i) => <span key={i} className={styles.heatHead} aria-hidden="true">{m}</span>)}
        {years.map(year => [<span key={year} className={styles.heatHead}>{year}</span>, ...Array.from({ length: 12 }, (_, i) => { const cell = s.grid.find(g => g.year === year && g.month === i + 1); const v = cell?.[metric]; const base = metric === "expenses" ? "183 124 19" : v !== undefined && v < 0 ? "154 57 42" : "31 107 67";
          return <span key={`${year}-${i}`} className={styles.heatCell} data-partial={cell ? !cell.complete : undefined} title={cell ? `${s.months[i].name} ${year}: ${peso(cell[metric])}${cell.complete ? "" : " (incomplete month)"}` : `${s.months[i].name} ${year}: no records`} style={{ background: cell ? `rgb(${base} / ${0.1 + Math.abs(cell[metric]) / max * 0.55})` : undefined }}>{cell ? Math.round(cell[metric] / 1000) : "–"}</span>; })])}
      </div></div> : <p className={styles.notice}>No monthly records yet.</p>}
      <p className={styles.hint}>Values are thousands of pesos. A dashed outline marks an incomplete month, which is excluded from averages. “–” means no records.</p>
    </section>
    <section><h3>Net surplus by month and year</h3><FinancialTable label="Year over year" headings={["Month", ...years.map(String)]} numeric={years.map((_, i) => i + 1)} rows={s.months.map(m => [m.name, ...years.map(year => { const cell = s.grid.find(g => g.year === year && g.month === m.month); return cell ? { sort: cell.net, node: `${signedPeso(cell.net)}${cell.complete ? "" : " *"}` } : null; })])} pageSize={12} /><p className={styles.hint}>* incomplete month.</p></section>
  </>;
}

export function IntegrityView({ data, value }: { data: Data; value?: string }) {
  const r = data.recordIntegrity;
  return <>
    <div className={styles.metricGrid}>
      <Metric label="Posted operating records" value={count(r.postedCount)} note={`${data.periodLabel}`} />
      <Metric label="Last refreshed" value={new Date(r.refreshedAt).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })} note={new Date(r.refreshedAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })} />
    </div>
    <Formula>These checks describe how complete the ledger is. A record that needs review does not mean money is missing; it means the ledger and a related record do not yet agree or are incomplete. Nothing here changes records. Checks use the reporting period only, not the category, source or amount filters.</Formula>
    {r.issues.map(issue => {
      const href = integrityLedgerLink(issue);
      return <details key={issue.code} open={issue.code === value || undefined} className={styles.panel}>
        <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
          <span>{issue.title}</span>
          <span className="flex items-center gap-2">{issue.available ? <><Signal tone={issue.count > 0 && issue.label !== "Informational" ? "warning" : "neutral"} label={issue.label} /><strong>{count(issue.count)}</strong></> : <Signal tone="neutral" label="Not checked" />}</span>
        </summary>
        <div className="space-y-3 border-t border-coop-border px-4 py-4 text-sm">
          <p><strong>Rule:</strong> {issue.rule}</p>
          <p><strong>Date range:</strong> {issue.dateRange.from} to {issue.dateRange.to}{issue.amount !== null ? <> · <strong>Amount:</strong> {peso(issue.amount)}</> : null}{issue.modules.length ? <> · <strong>Related:</strong> {issue.modules.join(", ")}</> : null}</p>
          {issue.limitation && <p className={styles.hint}>{issue.limitation}</p>}
          {issue.references.length > 0 && <FinancialTable label={`${issue.title} references`} searchable headings={["Reference", "Date", "Amount", "Module"]} numeric={[2]} rows={issue.references.map(ref => [ref.reference, ref.date, money(ref.amount), ref.module])} pageSize={10} />}
          {issue.truncated && <p className={styles.hint}>Showing the 25 most recent references. Open the ledger for the complete list.</p>}
          {href && ledgerAction(issue.link!.label, href)}
        </div>
      </details>;
    })}
    <section><h3>Operational reconciliation</h3>
      <FinancialTable label="Operational reconciliation" headings={["Module", "Operational basis", "Operational", "Posted in ledger", "Difference"]} numeric={[2, 3, 4]}
        rows={r.reconciliation.map(row => [row.module, row.operationalLabel, row.available ? money(row.operationalAmount) : "Not available", money(row.postedAmount), row.available ? signed(row.difference) : "N/A"])} />
      {r.reconciliation.map(row => <p key={row.module} className={styles.hint}><strong>{row.module}:</strong> {row.caveat}</p>)}
    </section>
  </>;
}

export function OperationalView({ data, value }: { data: Data; value?: string }) {
  const op = data.operationalSources.find(item => item.module === value);
  const recon = data.recordIntegrity.reconciliation.find(item => item.module === value);
  if (!op) return <p className={styles.notice}>No source selected.</p>;
  return <>
    <div className={styles.metricGrid}>
      <Metric label={`Posted ${op.module} income`} value={peso(op.income)} note={`${count(op.recordCount)} ledger records`} />
      <Metric label="Share of recorded income" value={percent(op.share)} />
      <Metric label="Comparison period" value={peso(op.previousIncome)} note={data.comparisonLabel ?? "No comparison"} />
      <Metric label="Change" value={signedPeso(op.change)} />
    </div>
    <Formula>This is the income posted to the Financial Ledger with source module {op.module}. It is the same money already inside Recorded Operating Income and is never added to it again. Operational {op.module} tables are used only to reconcile.</Formula>
    <section><h3>Ledger categories</h3><FinancialTable label="Categories" headings={["Category", "Amount"]} numeric={[1]} rows={op.categories.map(c => [c.name, money(c.amount)])} /></section>
    {recon && <section><h3>Reconciliation</h3><div className={styles.metricGrid}><Metric label={recon.operationalLabel} value={recon.available ? peso(recon.operationalAmount) : "Not available"} note={recon.operationalCount === null ? undefined : `${count(recon.operationalCount)} records`} /><Metric label="Posted in ledger" value={peso(recon.postedAmount)} note={`${count(recon.postedCount)} records`} /><Metric label="Difference" value={recon.available ? signedPeso(recon.difference) : "N/A"} /></div><p className={styles.hint}>{recon.caveat}</p></section>}
    <div className="flex flex-wrap gap-4">{ledgerAction(`View ${op.module} records in Financial Ledger`, ledgerLink(data, { sourceModules: op.module, recordType: "Income" }))}{ledgerAction(`Open ${op.module === "POS" ? "POS" : "Rentals"}`, op.link)}</div>
  </>;
}

export function MethodologyView({ data }: { data: Data }) {
  const m = data.metadata;
  return <>
    <FinancialTable label="Metric definitions" headings={["Metric", "Definition"]} rows={m.definitions.map(d => [d.metric, d.definition])} pageSize={20} />
    <section><h3>Source of truth</h3><p className="text-sm leading-6">Headline totals come only from the Financial Ledger (financial records). POS, Rental and payment tables are used for source reconciliation and are never added to headline totals. Share capital comes from the share-capital ledger and is kept separate from operating results.</p></section>
    <section><h3>Limitations</h3><ul className="space-y-3 text-sm leading-6">{m.limitations.map(l => <li key={l.code}>{l.message}</li>)}</ul></section>
    <section><h3>How observations are chosen</h3><FinancialTable label="Observation rules" headings={["Observation", "Rule"]} rows={m.insightRules.map(r => [r.id, r.rule])} />
      <p className={styles.hint}>Thresholds: {Object.entries(m.thresholds).map(([k, v]) => `${k} = ${v}`).join(" · ")}. Observations describe records; they claim neither statistical significance nor cause.</p></section>
    <p className="text-xs text-coop-muted">Generated {m.generatedAt}. All dates use Asia/Manila.</p>
  </>;
}

export function ChartAlternative({ data, onOpen }: { data: Data; onOpen: (point: Data["performanceTrend"]["points"][number]) => void }) {
  return <ChartData label="financial performance" summary="Income, expenses and net surplus for each period shown in the chart. Use Details to open a period." headings={["Period", "Income", "Expenses", "Net surplus", "Records", "Details"]}
    rows={data.performanceTrend.points.map(p => [p.label, money(p.income), money(p.expenses), signed(p.net), p.recordCount, { sort: null, node: <button type="button" className={styles.textAction} aria-label={`Open details for ${p.label}`} onClick={() => onOpen(p)}>Details</button> }])} />;
}
