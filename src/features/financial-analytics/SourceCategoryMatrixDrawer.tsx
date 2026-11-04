"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  COMPARE_OPTIONS, count, downloadFinancialAnalytics, getFinancialMatrix, ledgerLink, PERIOD_OPTIONS, peso, percent, signedPeso, validateFilters,
  type FinancialFilters, type MatrixResponse, type SourceCategoryMatrix,
} from "./financial-analytics-client";
import { Metric, SelectField } from "./FinancialUi";
import { ledgerAction } from "./FinancialDrawerViews";
import styles from "./FinancialAnalytics.module.css";

const MODES = ["Total amount", "% of classification total", "% of source total", "Change from comparison", "Transaction count"] as const;
const SORTS = ["Largest amount", "Largest increase", "Largest decrease", "Category name"] as const;
type Mode = (typeof MODES)[number];
type Cell = SourceCategoryMatrix["rows"][number]["cells"][string];
const asOptions = <T extends string>(items: readonly T[]) => items.map(value => ({ value, label: value }));

export function SourceCategoryMatrixDrawer({ applied, today }: { applied: FinancialFilters; today: string }) {
  const [local, setLocal] = useState(applied);
  const [state, setState] = useState<{ data: MatrixResponse | null; error: string; loading: boolean }>({ data: null, error: "", loading: true });
  const [classification, setClassification] = useState<"Income" | "Expense">("Income");
  const [mode, setMode] = useState<Mode>("Total amount");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Largest amount");
  const [search, setSearch] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const [chosen, setChosen] = useState<{ categoryId: string; source: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const searchId = useId();
  const problem = validateFilters(local, today);

  useEffect(() => {
    if (problem) return;
    const controller = new AbortController();
    getFinancialMatrix(local, controller.signal).then(data => { if (!controller.signal.aborted) setState({ data, error: "", loading: false }); })
      .catch(error => { if (!controller.signal.aborted) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : "The comparison could not be loaded.", loading: false })); });
    return () => controller.abort();
  }, [local, problem]);

  const matrix = classification === "Income" ? state.data?.income : state.data?.expense;
  const sources = useMemo(() => (matrix?.sources ?? []).filter(source => !hidden.includes(source)), [matrix, hidden]);
  const rows = useMemo(() => {
    if (!matrix) return [];
    const needle = search.trim().toLowerCase();
    const list = matrix.rows.filter(row => !needle || row.name.toLowerCase().includes(needle));
    const byChange = (dir: 1 | -1) => (a: (typeof list)[number], b: (typeof list)[number]) => (a.change === null ? 1 : b.change === null ? -1 : (b.change - a.change) * dir);
    return [...list].sort(sort === "Largest increase" ? byChange(1) : sort === "Largest decrease" ? byChange(-1) : sort === "Category name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.total - a.total);
  }, [matrix, search, sort]);

  const value = (cell: Cell): number | null => (mode === "Total amount" ? cell.amount : mode === "% of classification total" ? cell.shareOfTotal : mode === "% of source total" ? cell.shareOfSource : mode === "Change from comparison" ? cell.change : cell.count);
  const display = (v: number | null) => (v === null ? "N/A" : mode === "Total amount" ? peso(v) : mode === "Change from comparison" ? signedPeso(v) : mode === "Transaction count" ? count(v) : percent(v));
  const max = Math.max(1, ...rows.flatMap(row => sources.map(source => Math.abs(value(row.cells[source]) ?? 0))));
  const selectedRow = chosen ? matrix?.rows.find(row => row.categoryId === chosen.categoryId) : undefined;
  const selected = selectedRow && chosen ? selectedRow.cells[chosen.source] : undefined;
  const detail = state.data;
  const comparisonOn = Boolean(detail?.comparison.enabled);

  return <>
    <div className={styles.fields}>
      <SelectField label="Reporting period" value={local.period} options={PERIOD_OPTIONS} onChange={period => { setState(s => ({ ...s, loading: true })); setLocal(l => ({ ...l, period })); }} />
      <SelectField label="Compare with" value={local.compare} options={COMPARE_OPTIONS} disabled={local.period === "all-time"} onChange={compare => { setState(s => ({ ...s, loading: true })); setLocal(l => ({ ...l, compare })); }} />
      <SelectField label="Classification" value={classification} options={asOptions(["Income", "Expense"] as const)} onChange={value => { setClassification(value); setChosen(null); }} />
      <SelectField label="Show" value={mode} options={asOptions(MODES)} onChange={setMode} />
      {local.period === "custom" && <>
        <DatePicker triggerClassName="h-11 min-h-11 rounded-md px-3 text-sm" label="Start" value={local.start} max={local.end || today} onChange={start => setLocal(l => ({ ...l, start }))} />
        <DatePicker triggerClassName="h-11 min-h-11 rounded-md px-3 text-sm" label="End" value={local.end} min={local.start} max={today} onChange={end => setLocal(l => ({ ...l, end }))} />
      </>}
      {local.compare === "custom" && local.period !== "all-time" && <>
        <DatePicker triggerClassName="h-11 min-h-11 rounded-md px-3 text-sm" label="Comparison start" value={local.compareStart} max={local.compareEnd || today} onChange={compareStart => setLocal(l => ({ ...l, compareStart }))} />
        <DatePicker triggerClassName="h-11 min-h-11 rounded-md px-3 text-sm" label="Comparison end" value={local.compareEnd} min={local.compareStart} max={today} onChange={compareEnd => setLocal(l => ({ ...l, compareEnd }))} />
      </>}
      <SelectField label="Sort categories" value={sort} options={asOptions(SORTS)} onChange={setSort} />
      <div className={styles.field}><label htmlFor={searchId}>Search categories</label><input id={searchId} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search categories" /></div>
    </div>
    {matrix && matrix.sources.length > 0 && <fieldset className="flex flex-wrap gap-x-5 gap-y-2 border-0 p-0 text-[13px]"><legend className="pb-2 text-xs font-semibold">Source modules shown</legend>
      {matrix.sources.map(source => <label key={source} className="inline-flex min-h-8 cursor-pointer items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--coop-green,#1f6b43)]" checked={!hidden.includes(source)} onChange={event => setHidden(event.target.checked ? hidden.filter(v => v !== source) : [...hidden, source])} />{source}</label>)}
    </fieldset>}
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={styles.tab} onClick={() => { setLocal(applied); setSearch(""); setHidden([]); setChosen(null); setSort("Largest amount"); setMode("Total amount"); setState(s => ({ ...s, loading: true })); }}>Reset comparison</button>
      <button type="button" className={styles.textAction} disabled={exporting || Boolean(problem) || !state.data} onClick={async () => { setExporting(true); setExportError(""); try { await downloadFinancialAnalytics(local, "matrix"); } catch (error) { setExportError(error instanceof Error ? error.message : "Export failed."); } finally { setExporting(false); } }}>{exporting ? "Preparing export…" : "Export Excel"}</button>
    </div>
    {exportError && <p role="alert" className="text-sm text-red-700">{exportError}</p>}
    {problem && <p role="alert" className={styles.errorNotice}>{problem}</p>}
    {state.error && <p role="alert" className={styles.errorNotice}>{state.error}</p>}
    {state.loading && !problem && <p role="status" className={styles.notice}>Loading comparison…</p>}
    {detail && matrix && <>
      <p className={styles.hint} aria-live="polite">{detail.periodLabel}{comparisonOn ? ` compared with ${detail.comparisonLabel}` : " · no comparison"}. {detail.comparison.note ?? ""}</p>
      <div className={styles.metricGrid}>
        <Metric label={`${classification} total`} value={peso(matrix.total)} note={matrix.reconciles ? "Reconciles to the eligible total" : "Does not reconcile"} />
        <Metric label="Comparison total" value={peso(matrix.previousTotal)} note={comparisonOn ? undefined : "No comparison"} />
        <Metric label="Categories" value={count(rows.length)} note={`${count(sources.length)} source modules`} />
      </div>
      {mode === "Change from comparison" && !comparisonOn && <p className={styles.warnNotice}>Choose a comparison to see changes; N/A means there is nothing to compare against, not zero.</p>}
      {rows.length === 0 ? <p className={styles.notice}>No {classification.toLowerCase()} records match these filters.</p> :
        <div className={styles.tableScroll} role="region" aria-label={`${classification} by category and source module`} tabIndex={0}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>{classification} by financial category and source module, showing {mode.toLowerCase()}</caption>
            <thead><tr><th scope="col" className={styles.stickyCol}>Category</th>{sources.map(source => <th scope="col" key={source} className={styles.num}>{source}</th>)}<th scope="col" className={styles.num}>Total</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.categoryId}>
              <th scope="row" className={styles.stickyCol}>{row.name}</th>
              {sources.map(source => { const cell = row.cells[source]; const v = value(cell); const active = chosen?.categoryId === row.categoryId && chosen.source === source;
                const tone = v === null || v === 0 ? undefined : `rgb(${mode === "Change from comparison" && v < 0 ? "154 57 42" : classification === "Expense" ? "183 124 19" : "31 107 67"} / ${0.08 + Math.abs(v) / max * 0.3})`;
                const label = `${row.name}, ${source}: ${peso(cell.amount)}, ${percent(cell.shareOfTotal)} of ${classification.toLowerCase()} total, ${cell.previousAmount === null ? "no comparison" : `comparison ${peso(cell.previousAmount)}, change ${signedPeso(cell.change)}`}, ${count(cell.count)} records`;
                return <td key={source} className={styles.num}><button type="button" className={styles.matrixCell} style={{ background: tone }} title={label} aria-label={label} aria-pressed={active} onClick={() => setChosen({ categoryId: row.categoryId, source })}>{display(v)}</button></td>; })}
              <td className={styles.num}><strong>{mode === "Total amount" ? peso(row.total) : mode === "% of classification total" ? percent(matrix.total > 0 ? Math.round(row.total / matrix.total * 10000) / 100 : null) : mode === "Change from comparison" ? signedPeso(row.change) : mode === "Transaction count" ? count(row.count) : "–"}</strong></td>
            </tr>)}</tbody>
            <tfoot><tr><td className={styles.stickyCol}>Source total</td>{sources.map(source => <td key={source} className={styles.num}>{mode === "Transaction count" ? count(matrix.sourceTotals[source].count) : mode === "Change from comparison" ? signedPeso(matrix.sourceTotals[source].previousAmount === null ? null : Math.round((matrix.sourceTotals[source].amount - matrix.sourceTotals[source].previousAmount!) * 100) / 100) : mode === "Total amount" ? peso(matrix.sourceTotals[source].amount) : "–"}</td>)}<td className={styles.num}>{mode === "Transaction count" ? count(rows.reduce((sum, row) => sum + row.count, 0)) : mode === "Total amount" ? peso(matrix.total) : "–"}</td></tr></tfoot>
          </table>
        </div>}
      {selected && selectedRow && chosen ? <section className={styles.panel} aria-live="polite"><div className={styles.body}>
        <h3>{selectedRow.name} · {chosen.source}</h3>
        <div className={styles.metricGrid}>
          <Metric label="Amount" value={peso(selected.amount)} note={`${percent(selected.shareOfTotal)} of ${classification.toLowerCase()} total · ${percent(selected.shareOfSource)} of ${chosen.source}`} />
          <Metric label="Comparison" value={peso(selected.previousAmount)} note={selected.change === null ? "No comparison" : `Change ${signedPeso(selected.change)}`} />
          <Metric label="Eligible records" value={count(selected.count)} />
        </div>
        {ledgerAction("View these records in Financial Ledger", ledgerLink({ filters: detail.filters }, { financialCategoryIds: selectedRow.categoryId, sourceModules: chosen.source, recordType: classification }))}
      </div></section> : <p className={styles.hint}>Select a cell to see its breakdown and open the matching ledger records. Income and expense are never combined.</p>}
    </>}
  </>;
}
