"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Download, ExternalLink, Minus, Plus, RotateCcw, Sparkles } from "lucide-react";
import { FilterSelect, SearchField } from "@/features/people-management/PeopleFilterUi";
import { RankedBars } from "./ExpenseCharts";
import {
  classLabel, count, dateTime, downloadExpenseReport, errorMessage, getExpenseCategories, getExpenseMatrix, getExpenseRecord, getExpenseRecords,
  getExpenseSources, peso, percentText, periodOptions, saveBlob, shortDate, signedPeso,
  type ComparisonMode, type ExpenseBudgetContext, type ExpenseCategories, type ExpenseDrivers, type ExpenseIntegrity, type ExpenseRecordDetail,
  type ExpenseSources, type ExpenseSummary, type ExpenseUiQuery, type PeriodPreset,
} from "./expense-client";
import { useExpenseData } from "./expense-hooks";
import type { TrendBucket } from "../../../server/src/modules/expense-overview/expense-overview.types";

const panel = "rounded-lg border border-[#D9E4DA] bg-white";

export function Block({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="text-sm font-black text-[#123D2A]">{title}</h3>
      {note ? <p className="mt-0.5 text-xs text-[#5D6D63]">{note}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p role="status" className="rounded-md bg-[#F4F8F2] p-4 text-sm text-[#5D6D63]">{label}</p>;
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E6B9B3] bg-[#FDF3F1] p-3 text-sm text-[#8A2A20]">
      <span>{message}</span>
      {onRetry ? <button type="button" onClick={onRetry} className="min-h-9 px-2 font-bold underline underline-offset-4">Retry</button> : null}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-[#5D6D63]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-bold text-[#123D2A]">{children}</dd>
    </div>
  );
}

const actionButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-bold text-[#123D2A] outline-none transition hover:bg-[#EEF2EC] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-3 text-sm font-bold text-white outline-none transition hover:bg-[#1F6B43] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40 focus-visible:ring-offset-2";

export const ledgerHref = "/portal/chairman/financial-ledger";

// ---------------------------------------------------------------- total

export function TotalDrawer({ summary, categories, sources, onShowRecords, onOpenCategory, onOpenIntegrity }: {
  summary: ExpenseSummary;
  categories: ExpenseCategories | null;
  sources: ExpenseSources | null;
  onShowRecords: () => void;
  onOpenCategory: (id: string, name: string) => void;
  onOpenIntegrity: () => void;
}) {
  const { reconciliation: rec } = summary;
  const period = summary.period.effective;
  return (
    <div>
      <p className="text-3xl font-black text-[#123D2A]">{peso(summary.totals.amount)}</p>
      <p className="mt-1 text-sm text-[#5D6D63]">
        {count(summary.totals.records)} posted {summary.totals.records === 1 ? "record" : "records"}, {shortDate(period.startDate)} to {shortDate(period.endDate)}
        {period.partial ? ` (${period.days} of ${period.periodDays} days so far)` : ""}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onShowRecords} className={primaryButton}>Show these records</button>
      </div>
      <Block title="By category" note="Category totals add up to the figure above.">
        {categories ? <RankedBars items={categories.items.map((item) => ({ key: item.categoryId, label: item.name, amount: item.amount, records: item.records, share: item.share }))} onOpen={(item) => onOpenCategory(item.key, item.label)} emptyText="No posted expenses in this period." /> : <Loading />}
      </Block>
      <Block title="By source module">
        {sources ? <RankedBars items={sources.items.map((item) => ({ key: item.sourceModule, label: item.sourceModule, amount: item.amount, records: item.records, share: item.share }))} onOpen={() => undefined} emptyText="No posted expenses in this period." /> : <Loading />}
      </Block>
      <Block title="How this total is made up" note="Every posted expense row in the period, grouped by what kind of money it is. Only the selected classifications are in the headline figure.">
        <ul className={`${panel} divide-y divide-[#E1E8E2]`}>
          {rec.classTotals.map((item) => (
            <li key={item.expenseClass} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-bold text-[#123D2A]">{classLabel(item.expenseClass)}</span>
                {rec.selectedClasses.includes(item.expenseClass) ? <span className="ml-2 rounded-full bg-[#E3F4E7] px-2 py-0.5 text-[0.65rem] font-bold text-[#16804D]">In headline</span> : <span className="ml-2 rounded-full bg-[#EEF2EC] px-2 py-0.5 text-[0.65rem] font-bold text-[#52675A]">Not in headline</span>}
              </span>
              <span className="shrink-0 text-right font-black text-[#123D2A]">{peso(item.amount)}<span className="block text-xs font-normal text-[#5D6D63]">{count(item.records)} {item.records === 1 ? "record" : "records"}</span></span>
            </li>
          ))}
          {!rec.classTotals.length ? <li className="px-3 py-3 text-sm text-[#5D6D63]">No posted expense rows in this period.</li> : null}
        </ul>
        <p className="mt-2 text-xs leading-5 text-[#5D6D63]">
          Recognized expenses (everything above except non-expense disbursements): <b>{peso(rec.recognizedExpenseTotal)}</b>. Financial Analytics counts the same population as expenses: <b>{peso(rec.analyticsComparableTotal)}</b>.{" "}
          {rec.reconciles ? "The two agree." : "They differ; the integrity panel explains why."}
        </p>
        {!rec.reconciles ? <button type="button" onClick={onOpenIntegrity} className="mt-1 text-xs font-bold text-[#123D2A] underline underline-offset-4">Open data integrity</button> : null}
      </Block>
      <Block title="What this figure is not">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[#365F4A]">
          {summary.limitations.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------- drivers

function StateLabel({ state }: { state: ExpenseDrivers["items"][number]["state"] }) {
  const map = {
    new: { text: "New this period", Icon: Plus },
    stopped: { text: "No activity now", Icon: Minus },
    increase: { text: "Higher", Icon: ArrowUp },
    decrease: { text: "Lower", Icon: ArrowDown },
    unchanged: { text: "No change", Icon: Minus },
  } as const;
  const { text, Icon } = map[state];
  return <span className="inline-flex items-center gap-1 text-xs font-bold text-[#365F4A]"><Icon className="size-3.5" aria-hidden="true" />{text}</span>;
}

export function DriversDrawer({ drivers, onOpenCategory }: { drivers: ExpenseDrivers | null; onOpenCategory: (id: string, name: string) => void }) {
  if (!drivers) return <Loading />;
  if (!drivers.available) return <p className="rounded-md bg-[#F4F8F2] p-4 text-sm text-[#365F4A]">{drivers.unavailableReason}</p>;
  const largest = Math.max(...drivers.items.map((item) => Math.abs(item.change)), 1);
  return (
    <div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Fact label="Now">{peso(drivers.currentTotal)}</Fact>
        <Fact label="Comparison period">{peso(drivers.previousTotal)}</Fact>
        <Fact label="Overall change">{signedPeso(drivers.totalChange)}</Fact>
      </dl>
      <p className="mt-2 text-xs leading-5 text-[#5D6D63]">
        Category changes add up to the overall change{drivers.reconciles ? "." : ", but they do not match the headline totals right now. Treat this panel with care and open the integrity panel."} A change describes how recorded spending moved. It does not say why.
      </p>
      <Block title="Change by category" note="Bars show the size of each category's change; the table has the exact figures.">
        <ul className="grid gap-1.5">
          {drivers.items.map((item) => (
            <li key={item.categoryId} className="flex items-center gap-2 text-xs">
              <span className="w-32 shrink-0 truncate font-semibold text-[#123D2A] sm:w-44">{item.name}</span>
              <span className="relative h-3 flex-1 rounded bg-[#EEF2EC]" aria-hidden="true">
                <span className="absolute inset-y-0 rounded bg-[#1F6B43]" style={item.change >= 0 ? { left: "50%", width: `${(Math.abs(item.change) / largest) * 50}%` } : { right: "50%", width: `${(Math.abs(item.change) / largest) * 50}%`, background: "#8A9A8F" }} />
                <span className="absolute inset-y-0 left-1/2 w-px bg-[#365F4A]" />
              </span>
              <span className="w-24 shrink-0 text-right font-bold text-[#123D2A]">{signedPeso(item.change)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-[#5D6D63]">Right of the centre line: higher than the comparison period. Left: lower.</p>
      </Block>
      <Block title="Category comparison">
        <div role="region" aria-label="Category comparison scroll area" tabIndex={0} className={`${panel} overflow-x-auto`}>
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Category comparison table</caption>
            <thead className="bg-[#F4F8F2] text-xs text-[#52675A]">
              <tr><th scope="col" className="px-3 py-2">Category</th><th scope="col" className="px-3 py-2 text-right">Now</th><th scope="col" className="px-3 py-2 text-right">Before</th><th scope="col" className="px-3 py-2 text-right">Change</th><th scope="col" className="px-3 py-2 text-right">Change %</th><th scope="col" className="px-3 py-2 text-right">Share of change</th></tr>
            </thead>
            <tbody className="divide-y divide-[#E1E8E2]">
              {drivers.items.map((item) => (
                <tr key={item.categoryId}>
                  <th scope="row" className="px-3 py-2 font-bold text-[#123D2A]">
                    <button type="button" onClick={() => onOpenCategory(item.categoryId, item.name)} className="min-h-9 text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#1F6B43]">{item.name}</button>
                    <div><StateLabel state={item.state} /></div>
                  </th>
                  <td className="px-3 py-2 text-right">{peso(item.current)}</td>
                  <td className="px-3 py-2 text-right">{peso(item.previous)}</td>
                  <td className="px-3 py-2 text-right font-bold">{signedPeso(item.change)}</td>
                  <td className="px-3 py-2 text-right">{percentText(item.changePercent, true)}</td>
                  <td className="px-3 py-2 text-right">{percentText(item.contribution)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------- category

export function CategoryDrawer({ query, categoryId, name, onShowRecords, onOpenRecord }: {
  query: ExpenseUiQuery;
  categoryId: string;
  name: string;
  onShowRecords: () => void;
  onOpenRecord: (id: string) => void;
}) {
  const scoped = useMemo(() => ({ ...query, categoryIds: [categoryId], search: "", view: "posted" as const, page: 1, pageSize: 8, sortBy: "recordDate" as const, sortDirection: "desc" as const }), [query, categoryId]);
  const key = JSON.stringify(scoped);
  const totals = useExpenseData(`cat-total|${key}`, (signal) => getExpenseCategories(scoped, { signal }));
  const sources = useExpenseData(`cat-src|${key}`, (signal) => getExpenseSources(scoped, { signal }));
  const records = useExpenseData(`cat-rec|${key}`, (signal) => getExpenseRecords(scoped, { signal }));
  const item = totals.data?.items.find((entry) => entry.categoryId === categoryId);
  return (
    <div>
      {totals.error ? <LoadError message={totals.error} onRetry={totals.retry} /> : totals.loading ? <Loading /> : (
        <>
          <p className="text-3xl font-black text-[#123D2A]">{peso(item?.amount ?? 0)}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <Fact label="Records">{count(item?.records ?? 0)}</Fact>
            <Fact label="Comparison period">{item?.previousAmount === null || item?.previousAmount === undefined ? "—" : peso(item.previousAmount)}</Fact>
            <Fact label="Classification">{item ? classLabel(item.expenseClass) : "—"}</Fact>
          </dl>
          {item && !item.isActive ? <p className="mt-2 text-xs text-[#5D6D63]">{name} is no longer an active category. Its history is unchanged.</p> : null}
          {!item ? <p className="mt-3 rounded-md bg-[#F4F8F2] p-3 text-sm text-[#365F4A]">{name} has no posted expenses for the selected period and filters.</p> : null}
        </>
      )}
      <div className="mt-3"><button type="button" onClick={onShowRecords} className={primaryButton}>Show these records in the table</button></div>
      <Block title="By source module">
        {sources.error ? <LoadError message={sources.error} onRetry={sources.retry} /> : sources.data ? <RankedBars items={sources.data.items.map((entry) => ({ key: entry.sourceModule, label: entry.sourceModule, amount: entry.amount, records: entry.records, share: entry.share, previous: entry.previousAmount }))} onOpen={() => undefined} emptyText="No posted expenses." /> : <Loading />}
      </Block>
      <Block title="Latest records">
        {records.error ? <LoadError message={records.error} onRetry={records.retry} /> : records.data ? <RecordList records={records.data.records} onOpen={onOpenRecord} /> : <Loading />}
      </Block>
    </div>
  );
}

function RecordList({ records, onOpen }: { records: Array<{ id: string; recordNumber: string; recordDate: string; description: string; amount: number }>; onOpen: (id: string) => void }) {
  if (!records.length) return <p className="rounded-md bg-[#F4F8F2] p-3 text-sm text-[#5D6D63]">No records.</p>;
  return (
    <ul className={`${panel} divide-y divide-[#E1E8E2]`}>
      {records.map((record) => (
        <li key={record.id}>
          <button type="button" onClick={() => onOpen(record.id)} className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left outline-none hover:bg-[#F4FAF2] focus-visible:bg-[#F4FAF2] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1F6B43]/40">
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#123D2A]">{record.recordNumber}</span>
              <span className="block truncate text-xs text-[#5D6D63]">{shortDate(record.recordDate)} · {record.description}</span>
            </span>
            <span className="shrink-0 text-sm font-black text-[#123D2A]">{peso(record.amount)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- period (trend click)

export function PeriodDrawer({ query, bucket, onShowRecords, onOpenRecord, onOpenCategory }: {
  query: ExpenseUiQuery;
  bucket: TrendBucket;
  onShowRecords: () => void;
  onOpenRecord: (id: string) => void;
  onOpenCategory: (id: string, name: string) => void;
}) {
  const scoped = useMemo<ExpenseUiQuery>(() => ({ ...query, period: "custom", startDate: bucket.startDate, endDate: bucket.endDate, compare: "none", search: "", view: "posted", page: 1, pageSize: 10, sortBy: "amount", sortDirection: "desc" }), [query, bucket]);
  const key = JSON.stringify(scoped);
  const categories = useExpenseData(`per-cat|${key}`, (signal) => getExpenseCategories(scoped, { signal }));
  const sources = useExpenseData(`per-src|${key}`, (signal) => getExpenseSources(scoped, { signal }));
  const records = useExpenseData(`per-rec|${key}`, (signal) => getExpenseRecords(scoped, { signal }));
  const difference = bucket.previous ? bucket.amount - bucket.previous.amount : null;
  return (
    <div>
      <p className="text-3xl font-black text-[#123D2A]">{peso(bucket.amount)}</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <Fact label="Records">{count(bucket.records)}</Fact>
        <Fact label="Comparison period">{bucket.previous ? `${peso(bucket.previous.amount)} (${bucket.previous.label})` : "No matching period"}</Fact>
        <Fact label="Difference">{signedPeso(difference)}</Fact>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onShowRecords} className={primaryButton}>Show these records in the table</button>
        <Link href={ledgerHref} className={actionButton}>Open Financial Ledger<ExternalLink className="size-4" aria-hidden="true" /></Link>
      </div>
      <Block title="By category">
        {categories.error ? <LoadError message={categories.error} onRetry={categories.retry} /> : categories.data ? <RankedBars items={categories.data.items.map((item) => ({ key: item.categoryId, label: item.name, amount: item.amount, records: item.records, share: item.share }))} onOpen={(item) => onOpenCategory(item.key, item.label)} emptyText="No posted expenses in this period." /> : <Loading />}
      </Block>
      <Block title="By source module">
        {sources.error ? <LoadError message={sources.error} onRetry={sources.retry} /> : sources.data ? <RankedBars items={sources.data.items.map((item) => ({ key: item.sourceModule, label: item.sourceModule, amount: item.amount, records: item.records, share: item.share }))} onOpen={() => undefined} emptyText="No posted expenses in this period." /> : <Loading />}
      </Block>
      <Block title="Largest records" note={records.data && records.data.total > records.data.records.length ? `Showing ${records.data.records.length} of ${count(records.data.total)}.` : undefined}>
        {records.error ? <LoadError message={records.error} onRetry={records.retry} /> : records.data ? <RecordList records={records.data.records} onOpen={onOpenRecord} /> : <Loading />}
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------- record

export function RecordDrawer({ id }: { id: string }) {
  const result = useExpenseData(`record|${id}`, (signal) => getExpenseRecord(id, { signal }));
  if (result.error) return <LoadError message={result.error} onRetry={result.retry} />;
  if (!result.data) return <Loading />;
  return <RecordDetailView record={result.data} />;
}

export function RecordDetailView({ record }: { record: ExpenseRecordDetail }) {
  const statusTone = record.postingStatus === "Posted" ? "bg-[#E3F4E7] text-[#16804D]" : record.postingStatus === "Unposted" ? "bg-[#FFF4D6] text-[#8A5A00]" : "bg-[#EEF2EC] text-[#52675A]";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone}`}>{record.postingStatus}</span>
        <span className="text-xs font-semibold text-[#5D6D63]">{record.recordNumber}</span>
      </div>
      <p className="mt-2 text-3xl font-black text-[#123D2A]">{peso(record.amount)}</p>
      <p className="mt-1 text-sm text-[#365F4A]">{record.description}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Fact label="Expense date">{shortDate(record.recordDate)}</Fact>
        <Fact label="Category">{record.categoryName}</Fact>
        <Fact label="Classification">
          {classLabel(record.expenseClass)}
          {record.classificationBasis === "default" ? <span className="block text-xs font-normal text-[#5D6D63]">Counted as operating by the default rule: this category is not named in the classification list.</span> : null}
          {record.classificationBasis === "unresolved" ? <span className="block text-xs font-normal text-[#5D6D63]">The category is not an expense category, so the economic nature is unclear.</span> : null}
        </Fact>
        <Fact label="Source module">{record.sourceModule}{record.sourceRecordId ? ` · record ${record.sourceRecordId}` : ""}</Fact>
        <Fact label="Recorded by">{record.recordedBy.name}</Fact>
        <Fact label="Posted by">{record.postedBy ? record.postedBy.name : "Not posted yet"}</Fact>
        <Fact label="Season">{record.season?.name ?? "Not linked"}</Fact>
        <Fact label="Created">{dateTime(record.createdAt)}</Fact>
      </dl>
      {record.rental ? (
        <Block title="Rental expense entry" note="Typed in by staff when the expense was recorded. It is not proof that a payment was made.">
          <dl className={`${panel} grid gap-3 p-3 sm:grid-cols-2`}>
            <Fact label="Payee as entered">{record.rental.payee ?? "—"}</Fact>
            <Fact label="Payment method as entered">{record.rental.paymentMethod ?? "—"}</Fact>
            <Fact label="Reference as entered">{record.rental.referenceNumber ?? "—"}</Fact>
            <Fact label="Receipt file name">{record.rental.receiptFileName ?? "—"}</Fact>
          </dl>
        </Block>
      ) : null}
      <Block title="Corrections and reversals">
        {record.correctionOf || record.reversalOf || record.correctedBy.length || record.reversedBy.length ? (
          <ul className={`${panel} divide-y divide-[#E1E8E2] text-sm`}>
            {record.correctionOf ? <li className="px-3 py-2">Corrects {record.correctionOf.recordNumber} ({record.correctionOf.recordStatus}).</li> : null}
            {record.reversalOf ? <li className="px-3 py-2">Reverses {record.reversalOf.recordNumber} ({record.reversalOf.recordStatus}).</li> : null}
            {record.correctedBy.map((item) => <li key={item.id} className="px-3 py-2">Corrected by {item.recordNumber} ({item.recordStatus}).</li>)}
            {record.reversedBy.map((item) => <li key={item.id} className="px-3 py-2">Reversed by {item.recordNumber} ({item.recordStatus}), {peso(item.amount)}.</li>)}
          </ul>
        ) : <p className="text-sm text-[#5D6D63]">None. This record has not been corrected or reversed.</p>}
      </Block>
      <Block title="History">
        {record.history.length ? (
          <ol className={`${panel} divide-y divide-[#E1E8E2] text-sm`}>
            {record.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="px-3 py-2">
                <span className="font-bold text-[#123D2A]">{entry.action.replace(/^financial_record\./, "").replace(/_/g, " ")}</span>
                <span className="text-[#5D6D63]"> · {dateTime(entry.at)}{entry.by ? ` · ${entry.by}` : ""}</span>
                {entry.description ? <span className="block text-xs text-[#5D6D63]">{entry.description}</span> : null}
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-[#5D6D63]">No audit entries are stored for this record.</p>}
      </Block>
      {record.budget ? (
        <Block title="Approved budget">
          <p className="text-sm text-[#365F4A]">Covered by {record.budget.budgetName}, with a limit of {peso(record.budget.limitAmount)} for this category.</p>
        </Block>
      ) : null}
      <Block title="What the system cannot confirm">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[#365F4A]">
          <li>{record.disbursement.note}</li>
          <li>{record.evidence.note}</li>
        </ul>
      </Block>
      <div className="mt-4">
        <Link href={ledgerHref} className={actionButton}>Open Financial Ledger<ExternalLink className="size-4" aria-hidden="true" /></Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- integrity

export function IntegrityDrawer({ integrity, onDrill }: { integrity: ExpenseIntegrity | null; onDrill: (drill: NonNullable<ExpenseIntegrity["checks"][number]["drill"]>) => void }) {
  if (!integrity) return <Loading />;
  return (
    <div>
      <p className="text-sm leading-6 text-[#365F4A]">
        These checks read the ledger and change nothing. A finding is a prompt to look, not a conclusion: a missing receipt or an unusual pattern does not by itself mean money is missing.
      </p>
      <ul className="mt-3 grid gap-2">
        {integrity.checks.map((check) => (
          <li key={check.id} className={`${panel} p-3`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-[#123D2A]">{check.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-[#5D6D63]">{check.description}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${check.status === "review" ? "bg-[#FFF4D6] text-[#8A5A00]" : check.status === "info" ? "bg-[#EAF1F8] text-[#2D5A85]" : "bg-[#E3F4E7] text-[#16804D]"}`}>
                {check.status === "review" ? "Requires review" : check.status === "info" ? "For information" : "Clear"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#123D2A]">{count(check.records)} {check.records === 1 ? "record" : "records"} · {peso(check.amount)}</p>
              {check.drill && check.records > 0 ? <button type="button" onClick={() => onDrill(check.drill!)} className={actionButton}>Show records</button> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- budget

export function BudgetDrawer({ budget }: { budget: ExpenseBudgetContext | null }) {
  if (!budget) return <Loading />;
  if (!budget.available) return <p className="rounded-md bg-[#F4F8F2] p-4 text-sm text-[#365F4A]">{budget.unavailableReason}</p>;
  return (
    <div>
      <p className="text-sm leading-6 text-[#365F4A]">
        Read-only context from approved budgets. Each posted expense is counted against one line only, the most specific one covering its date, so overlapping budgets are never added twice. Limits and approvals are managed in Budget Controls.
      </p>
      <Block title="Approved budget lines">
        {budget.lines.length ? (
          <ul className="grid gap-2">
            {budget.lines.map((line) => (
              <li key={line.budgetLineId} className={`${panel} p-3`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-black text-[#123D2A]">{line.categoryName}{line.seasonName ? ` · ${line.seasonName}` : ""}</p>
                  <span className="text-xs font-bold text-[#52675A]">{line.state === "over" ? "Over the limit" : line.state === "warning" ? "Near the limit" : line.state === "no_limit" ? "No limit set" : "Within the limit"}</span>
                </div>
                <p className="text-xs text-[#5D6D63]">{line.budgetName} · {shortDate(line.coverageStart)} to {shortDate(line.coverageEnd)}</p>
                <div className="mt-2 h-2 rounded-full bg-[#E9F0E9]" aria-hidden="true">
                  <div className={`h-full rounded-full ${line.state === "over" ? "bg-[#A13226]" : line.state === "warning" ? "bg-[#C98A00]" : "bg-[#1F6B43]"}`} style={{ width: `${Math.min(line.utilization ?? 0, 100)}%` }} />
                </div>
                <dl className="mt-2 grid gap-2 sm:grid-cols-4">
                  <Fact label="Posted">{peso(line.spentAmount)}</Fact>
                  <Fact label="Limit">{peso(line.limitAmount)}</Fact>
                  <Fact label="Remaining">{peso(line.remaining)}</Fact>
                  <Fact label="Used">{line.utilization === null ? "N/A" : `${line.utilization}%`}</Fact>
                </dl>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-md bg-[#F4F8F2] p-3 text-sm text-[#5D6D63]">No approved budget line covers the selected period.</p>}
      </Block>
      <Block title="Posted expenses without an approved budget line" note="Within the selected period and filters.">
        {budget.unbudgeted.categories.length ? <RankedBars items={budget.unbudgeted.categories.map((item) => ({ key: item.categoryId, label: item.name, amount: item.amount, records: item.records, share: null }))} onOpen={() => undefined} emptyText="" /> : <p className="rounded-md bg-[#F4F8F2] p-3 text-sm text-[#5D6D63]">Every posted expense in this period is covered by an approved line.</p>}
      </Block>
      <div className="mt-4"><Link href="/portal/chairman/budget-controls" className={actionButton}>Open Budget Controls<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
    </div>
  );
}

// ---------------------------------------------------------------- matrix (left drawer)

type Metric = "amount" | "records" | "share" | "change";
const metricOptions: Array<{ value: Metric; label: string }> = [
  { value: "amount", label: "Total amount" },
  { value: "records", label: "Record count" },
  { value: "share", label: "Share of total" },
  { value: "change", label: "Change vs comparison" },
];

export function MatrixDrawer({ query, sourceModules, onPick }: {
  query: ExpenseUiQuery;
  sourceModules: string[];
  onPick: (categoryId: string, sourceModule: string) => void;
}) {
  const [period, setPeriod] = useState<PeriodPreset | "page">("page");
  const [compare, setCompare] = useState<ComparisonMode | "page">("page");
  const [metric, setMetric] = useState<Metric>("amount");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"total" | "name">("total");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const local = useMemo<ExpenseUiQuery>(() => ({
    ...query,
    ...(period === "page" ? {} : { period, startDate: undefined, endDate: undefined }),
    ...(compare === "page" ? {} : { compare }),
    search: "",
    page: 1,
  }), [query, period, compare]);
  const result = useExpenseData(`matrix|${JSON.stringify(local)}`, (signal) => getExpenseMatrix(local, { signal }));
  const matrix = result.data;

  const view = useMemo(() => {
    if (!matrix) return null;
    const visibleSources = matrix.sources.filter((item) => source === "all" || item.sourceModule === source);
    const names = new Map(matrix.categories.map((item) => [item.categoryId, item.name]));
    const cells = new Map(matrix.cells.map((cell) => [`${cell.categoryId}|${cell.sourceModule}`, cell]));
    const needle = search.trim().toLocaleLowerCase("en-PH");
    let rows = matrix.categories
      .filter((item) => !needle || item.name.toLocaleLowerCase("en-PH").includes(needle))
      .map((item) => {
        const own = visibleSources.map((column) => cells.get(`${item.categoryId}|${column.sourceModule}`));
        return { ...item, shown: own.reduce((sum, cell) => sum + Math.round((cell?.amount ?? 0) * 100), 0) / 100, shownRecords: own.reduce((sum, cell) => sum + (cell?.records ?? 0), 0) };
      })
      .filter((item) => item.shownRecords > 0 || source === "all");
    rows = rows.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b.shown - a.shown || a.name.localeCompare(b.name)));
    const total = rows.reduce((sum, row) => sum + Math.round(row.shown * 100), 0) / 100;
    return { visibleSources, names, cells, rows, total };
  }, [matrix, source, search, sort]);

  const render = (cell: { amount: number; records: number; share: number | null; previousAmount: number | null } | undefined) => {
    if (!cell) return "—";
    if (metric === "amount") return peso(cell.amount);
    if (metric === "records") return count(cell.records);
    if (metric === "share") return percentText(cell.share);
    return matrix?.hasPrevious ? signedPeso(Math.round((cell.amount - (cell.previousAmount ?? 0)) * 100) / 100) : "—";
  };

  const exportExcel = async () => {
    setExporting(true);
    setExportError("");
    try {
      const file = await downloadExpenseReport(local, "comparison", "xlsx");
      saveBlob(file.blob, file.filename);
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const reset = () => { setPeriod("page"); setCompare("page"); setMetric("amount"); setSource("all"); setSearch(""); setSort("total"); };

  return (
    <div>
      <p className="text-sm leading-6 text-[#365F4A]">Posted expenses by category and source module. The grand total equals the Total Posted Expenses figure for the same period and filters. Select a cell to show its records in the table.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <FilterSelect label="Period" value={period} onChange={setPeriod} options={[{ value: "page", label: "Same as page" }, ...periodOptions.filter((option) => option.value !== "custom").map((option) => ({ value: option.value as PeriodPreset | "page", label: option.label }))]} />
        <FilterSelect label="Compare" value={compare} onChange={setCompare} options={[{ value: "page", label: "Same as page" }, { value: "previous", label: "Previous period" }, { value: "last_year", label: "Same period last year" }, { value: "none", label: "None" }]} />
        <FilterSelect label="Show" value={metric} onChange={setMetric} options={metricOptions} />
        <FilterSelect label="Source" value={source} onChange={setSource} options={[{ value: "all", label: "All sources" }, ...(matrix?.sources ?? sourceModules.map((value) => ({ sourceModule: value }))).map((item) => ({ value: item.sourceModule, label: item.sourceModule }))]} />
        <SearchField value={search} onCommit={setSearch} placeholder="Search categories" label="Search categories" />
        <FilterSelect label="Sort" value={sort} onChange={setSort} options={[{ value: "total", label: "Largest first" }, { value: "name", label: "Category name" }]} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={exportExcel} disabled={exporting || !matrix} className={`${actionButton} disabled:opacity-60`}><Download className="size-4" aria-hidden="true" />{exporting ? "Preparing…" : "Export Excel"}</button>
        <button type="button" onClick={reset} className={actionButton}><RotateCcw className="size-4" aria-hidden="true" />Reset</button>
      </div>
      {exportError ? <p role="alert" className="mt-2 text-sm font-semibold text-[#A13226]">{exportError}</p> : null}
      <div className="mt-4" aria-busy={result.loading || undefined}>
        {result.error ? <LoadError message={result.error} onRetry={result.retry} /> : !matrix || !view ? <Loading /> : !matrix.cells.length ? (
          <p className="rounded-md bg-[#F4F8F2] p-4 text-sm text-[#5D6D63]">No posted expenses match this period and the page filters.</p>
        ) : (
          <>
            {!matrix.reconciles ? <p role="alert" className="mb-2 rounded-md border border-[#E6B9B3] bg-[#FDF3F1] p-3 text-sm text-[#8A2A20]">The cells do not add up to the headline total for this selection. Check the integrity panel before using this table.</p> : null}
            <div role="region" aria-label="Category by source module scroll area" tabIndex={0} className={`${panel} overflow-auto`}>
              <table className="w-full min-w-[30rem] text-left text-sm">
                <caption className="sr-only">Category by source module</caption>
                <thead className="sticky top-0 bg-[#F4F8F2] text-xs text-[#52675A]">
                  <tr>
                    <th scope="col" className="px-3 py-2">Category</th>
                    {view.visibleSources.map((column) => <th key={column.sourceModule} scope="col" className="px-3 py-2 text-right">{column.sourceModule}</th>)}
                    <th scope="col" className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E8E2]">
                  {view.rows.map((row) => (
                    <tr key={row.categoryId}>
                      <th scope="row" className="px-3 py-1 font-bold text-[#123D2A]">{row.name}</th>
                      {view.visibleSources.map((column) => {
                        const cell = view.cells.get(`${row.categoryId}|${column.sourceModule}`);
                        return (
                          <td key={column.sourceModule} className="px-1 py-1 text-right">
                            {cell ? (
                              <button type="button" onClick={() => onPick(row.categoryId, column.sourceModule)} aria-label={`${row.name}, ${column.sourceModule}: ${peso(cell.amount)}, ${cell.records} ${cell.records === 1 ? "record" : "records"}. Show these records.`} className="min-h-11 w-full rounded px-2 text-right font-semibold text-[#123D2A] outline-none hover:bg-[#EAF3E8] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40">{render(cell)}</button>
                            ) : <span className="px-2 text-[#9AA69E]">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1 text-right font-black text-[#123D2A]">{metric === "records" ? count(row.shownRecords) : metric === "share" ? percentText(view.total > 0 ? Math.round((row.shown / view.total) * 10000) / 100 : null) : metric === "change" ? "—" : peso(row.shown)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#F4F8F2] text-sm font-black text-[#123D2A]">
                  <tr>
                    <th scope="row" className="px-3 py-2">All categories</th>
                    {view.visibleSources.map((column) => <td key={column.sourceModule} className="px-3 py-2 text-right">{metric === "records" ? count(column.records) : metric === "amount" ? peso(column.amount) : metric === "share" ? percentText(matrix.total > 0 ? Math.round((column.amount / matrix.total) * 10000) / 100 : null) : "—"}</td>)}
                    <td className="px-3 py-2 text-right">{metric === "amount" ? peso(view.total) : metric === "records" ? count(view.rows.reduce((sum, row) => sum + row.shownRecords, 0)) : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-2 text-xs text-[#5D6D63]">{view.rows.length} of {matrix.categories.length} categories shown. Grand total for the selection: {peso(matrix.total)} from {count(matrix.records)} records.</p>
          </>
        )}
      </div>
    </div>
  );
}

export function InsightsIcon() {
  return <Sparkles className="size-4" aria-hidden="true" />;
}
