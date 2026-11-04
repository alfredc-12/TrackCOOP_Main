"use client";
import { useId, useState, type ReactNode } from "react";
import { CircleCheck, CircleHelp, Clock3, TriangleAlert } from "lucide-react";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { compareCells, sortKey, type TableCell, type Tone } from "./financial-analytics-client";
import styles from "./FinancialAnalytics.module.css";

export const toneIcons = { good: CircleCheck, warning: Clock3, danger: TriangleAlert, neutral: CircleHelp };

export function Signal({ tone, label }: { tone: Tone; label: string }) {
  const Icon = toneIcons[tone];
  return <span className={styles.signalBadge} data-tone={tone}><Icon aria-hidden="true" className="size-3.5 shrink-0" />{label}</span>;
}

/** Labels are what people read; the underlying API value is returned unchanged. */
export function SelectField<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; disabled?: boolean;
}) {
  const id = useId();
  const current = options.find(option => option.value === value)?.label ?? options[0]?.label ?? "";
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <StyledSelect id={id} aria-label={label} disabled={disabled} value={current} options={options.map(option => option.label)} onChange={next => { const match = options.find(option => option.label === next); if (match) onChange(match.value); }} />
  </div>;
}

export function Metric({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

const cellText = (cell: TableCell) => (cell !== null && typeof cell === "object" ? cell.node : cell === null ? "N/A" : cell);

/**
 * Sortable, optionally searchable and paginated table. Every cell may carry an explicit sort key so
 * formatted text (₱, %, signs) still sorts by value, and N/A always sorts last.
 */
export function FinancialTable({ headings, rows, label, searchable = false, numeric = [], pageSize = 25, footer, empty = "No matching records." }: {
  headings: string[]; rows: TableCell[][]; label: string; searchable?: boolean; numeric?: number[]; pageSize?: number; footer?: TableCell[]; empty?: string;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ index: number; asc: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const needle = search.trim().toLowerCase();
  const shown = rows.filter(row => !needle || row.some(cell => String(sortKey(cell) ?? "").toLowerCase().includes(needle)));
  if (sort) shown.sort((a, b) => (sort.asc ? 1 : -1) * compareCells(a[sort.index], b[sort.index]));
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pages);
  const searchId = useId();
  return <div className="min-w-0 space-y-2">
    {searchable && <div className={styles.field}><label htmlFor={searchId}>Search {label.toLowerCase()}</label><input id={searchId} type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>}
    <div className={styles.tableScroll} role="region" aria-label={label} tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{label}</caption>
        <thead><tr>{headings.map((heading, index) => <th scope="col" key={heading} className={numeric.includes(index) ? styles.num : undefined} aria-sort={sort?.index === index ? (sort.asc ? "ascending" : "descending") : "none"}>
          <button type="button" aria-label={`Sort ${label} by ${heading}`} onClick={() => { setSort({ index, asc: sort?.index === index ? !sort.asc : index === 0 }); setPage(1); }}>{heading}{sort?.index === index ? (sort.asc ? " ↑" : " ↓") : ""}</button>
        </th>)}</tr></thead>
        <tbody>{shown.length ? shown.slice((current - 1) * pageSize, current * pageSize).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className={numeric.includes(cellIndex) ? styles.num : undefined}>{cellText(cell)}</td>)}</tr>) : <tr><td colSpan={headings.length}>{empty}</td></tr>}</tbody>
        {footer && <tfoot><tr>{footer.map((cell, index) => <td key={index} className={numeric.includes(index) ? styles.num : undefined}>{cellText(cell)}</td>)}</tr></tfoot>}
      </table>
    </div>
    {pages > 1 && <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span aria-live="polite">{shown.length} rows · page {current} of {pages}</span><div className="flex gap-2"><button type="button" className={styles.tab} disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous rows</button><button type="button" className={styles.tab} disabled={current >= pages} onClick={() => setPage(current + 1)}>Next rows</button></div></div>}
  </div>;
}

/** Accessible text alternative to a chart: a visible, collapsible data table. */
export function ChartData({ summary, headings, rows, label }: { summary: string; headings: string[]; rows: TableCell[][]; label: string }) {
  return <details className={styles.dataToggle}>
    <summary>View {label} as a table</summary>
    <p className={styles.compactNote}>{summary}</p>
    <FinancialTable label={label} headings={headings} rows={rows} numeric={headings.map((_, index) => index).slice(1)} pageSize={12} />
  </details>;
}
