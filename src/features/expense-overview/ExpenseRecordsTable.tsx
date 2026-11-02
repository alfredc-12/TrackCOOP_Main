"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye } from "lucide-react";
import { FilterSelect } from "@/features/people-management/PeopleFilterUi";
import {
  classLabel, count, peso, shortDate, viewOptions,
  type ExpenseRecordsPage, type ExpenseRecordView, type ExpenseUiQuery,
} from "./expense-client";
import { LoadError } from "./ExpenseDrawerViews";
import type { ExpenseSortField } from "../../../server/src/modules/expense-overview/expense-overview.schema";

type Row = ExpenseRecordsPage["records"][number];

const statusTone: Record<Row["postingStatus"], string> = {
  Posted: "bg-[#E3F4E7] text-[#16804D]",
  Unposted: "bg-[#FFF4D6] text-[#8A5A00]",
  Voided: "bg-[#EEF2EC] text-[#52675A]",
  Corrected: "bg-[#EAF1F8] text-[#2D5A85]",
  Reversed: "bg-[#EAF1F8] text-[#2D5A85]",
};

function Status({ value }: { value: Row["postingStatus"] }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone[value]}`}>{value}</span>;
}

const columns: Array<{ key: ExpenseSortField | null; label: string; align?: "right" }> = [
  { key: "recordDate", label: "Expense date" },
  { key: "recordNumber", label: "Record no." },
  { key: "category", label: "Category" },
  { key: null, label: "Description" },
  { key: "source", label: "Source" },
  { key: "amount", label: "Amount", align: "right" },
  { key: null, label: "Status" },
  { key: null, label: "Actions", align: "right" },
];

const pageSizes = [10, 20, 50, 100];

export function ExpenseRecordsTable({ data, loading, error, onRetry, query, onChange, onOpen }: {
  data: ExpenseRecordsPage | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  query: ExpenseUiQuery;
  onChange: (patch: Partial<ExpenseUiQuery>) => void;
  onOpen: (id: string) => void;
}) {
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const sortBy = (field: ExpenseSortField) => onChange({ sortBy: field, sortDirection: query.sortBy === field && query.sortDirection === "desc" ? "asc" : "desc", page: 1 });
  const page = (next: number) => onChange({ page: Math.min(Math.max(1, next), totalPages) });

  return (
    <div aria-busy={loading || undefined}>
      <div role="tablist" aria-label="Which expense records to list" className="flex flex-wrap gap-2">
        {viewOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={query.view === option.value}
            onClick={() => onChange({ view: option.value as ExpenseRecordView, page: 1 })}
            className={`min-h-11 rounded-full border px-4 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40 ${query.view === option.value ? "border-[#1F6B43] bg-[#123D2A] text-white" : "border-[#CAD8CB] bg-white text-[#365F4A] hover:bg-[#EEF2EC]"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2" aria-live="polite">
        <p className="text-sm font-semibold text-[#365F4A]">
          {loading && !data ? "Loading records…" : data ? `${count(data.total)} ${data.total === 1 ? "record" : "records"}, ${peso(data.totalAmount)} in total.` : ""}
        </p>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
          <FilterSelect label="Sort by" value={query.sortBy} onChange={(value) => onChange({ sortBy: value, page: 1 })} options={columns.filter((column) => column.key).map((column) => ({ value: column.key as ExpenseSortField, label: column.label }))} />
          <FilterSelect label="Order" value={query.sortDirection} onChange={(value) => onChange({ sortDirection: value, page: 1 })} options={[{ value: "desc", label: "Newest or largest first" }, { value: "asc", label: "Oldest or smallest first" }]} />
        </div>
      </div>

      {error ? <div className="mt-3"><LoadError message={error} onRetry={onRetry} /></div> : null}

      {!error && data && data.records.length === 0 ? (
        <p className="mt-3 rounded-md bg-[#F4F8F2] p-6 text-center text-sm text-[#365F4A]">
          {query.view === "posted" ? "No posted expense records match the selected period and filters." : "No records match the selected record view, period and filters."}
        </p>
      ) : null}

      {data && data.records.length > 0 ? (
        <>
          <div role="region" aria-label="Expense records table" tabIndex={0} className="mt-3 hidden overflow-x-auto rounded-lg border border-[#D9E4DA] lg:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <caption className="sr-only">Expense records</caption>
              <thead className="bg-[#F4F8F2] text-xs text-[#52675A]">
                <tr>
                  {columns.map((column) => (
                    <th key={column.label} scope="col" aria-sort={column.key && query.sortBy === column.key ? (query.sortDirection === "asc" ? "ascending" : "descending") : undefined} className={`px-3 py-2 ${column.align === "right" ? "text-right" : ""}`}>
                      {column.key ? (
                        <button type="button" onClick={() => sortBy(column.key as ExpenseSortField)} className={`inline-flex min-h-9 items-center gap-1 font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40 ${column.align === "right" ? "flex-row-reverse" : ""}`}>
                          {column.label}
                          {query.sortBy === column.key ? (query.sortDirection === "asc" ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" />) : null}
                        </button>
                      ) : column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E8E2]">
                {data.records.map((record) => (
                  <tr key={record.id} className="hover:bg-[#F8FBF6] focus-within:bg-[#F8FBF6]">
                    <td className="whitespace-nowrap px-3 py-2">{shortDate(record.recordDate)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-bold text-[#123D2A]">{record.recordNumber}</td>
                    <td className="px-3 py-2"><span className="font-semibold text-[#123D2A]">{record.categoryName}</span>{record.expenseClass !== "operating" ? <span className="block text-xs text-[#5D6D63]">{classLabel(record.expenseClass)}</span> : null}</td>
                    <td className="max-w-[18rem] px-3 py-2 text-[#365F4A]"><span className="line-clamp-2 break-words">{record.description}</span></td>
                    <td className="whitespace-nowrap px-3 py-2">{record.sourceModule}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-black text-[#123D2A]">{peso(record.amount)}</td>
                    <td className="px-3 py-2"><Status value={record.postingStatus} /></td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => onOpen(record.id)} aria-label={`View expense record ${record.recordNumber}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-bold text-[#123D2A] outline-none hover:bg-[#EAF3E8] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40">
                        <Eye className="size-4" aria-hidden="true" />View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-3 grid gap-2 lg:hidden" aria-label="Expense records">
            {data.records.map((record) => (
              <li key={record.id}>
                <button type="button" onClick={() => onOpen(record.id)} aria-label={`View expense record ${record.recordNumber}, ${peso(record.amount)}`} className="w-full rounded-lg border border-[#D9E4DA] bg-white p-3 text-left outline-none transition hover:bg-[#F8FBF6] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-[#123D2A]">{record.categoryName}</span>
                      <span className="block text-xs text-[#5D6D63]">{shortDate(record.recordDate)} · {record.recordNumber}</span>
                    </span>
                    <span className="shrink-0 text-sm font-black text-[#123D2A]">{peso(record.amount)}</span>
                  </span>
                  <span className="mt-1 line-clamp-2 block break-words text-xs text-[#365F4A]">{record.description}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#5D6D63]"><Status value={record.postingStatus} />{record.sourceModule}</span>
                </button>
              </li>
            ))}
          </ul>

          <nav aria-label="Expense record pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-[#365F4A]">
              <span>Rows per page</span>
              <div className="w-36"><FilterSelect label="Rows" value={String(query.pageSize)} onChange={(value) => onChange({ pageSize: Number(value), page: 1 })} options={pageSizes.map((size) => ({ value: String(size), label: String(size) }))} /></div>
            </div>
            <div className="flex items-center gap-1.5">
              <PageButton label="First page" disabled={data.page <= 1} onClick={() => page(1)}><ChevronsLeft className="size-4" aria-hidden="true" /></PageButton>
              <PageButton label="Previous page" disabled={data.page <= 1} onClick={() => page(data.page - 1)}><ChevronLeft className="size-4" aria-hidden="true" /></PageButton>
              <span className="min-w-28 text-center text-sm font-bold text-[#123D2A]">Page {data.page} of {totalPages}</span>
              <PageButton label="Next page" disabled={data.page >= totalPages} onClick={() => page(data.page + 1)}><ChevronRight className="size-4" aria-hidden="true" /></PageButton>
              <PageButton label="Last page" disabled={data.page >= totalPages} onClick={() => page(totalPages)}><ChevronsRight className="size-4" aria-hidden="true" /></PageButton>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="grid size-11 place-items-center rounded-md border border-[#CAD8CB] bg-white text-[#365F4A] outline-none transition hover:bg-[#EEF2EC] focus-visible:ring-2 focus-visible:ring-[#1F6B43]/40 disabled:cursor-not-allowed disabled:opacity-40">
      {children}
    </button>
  );
}
