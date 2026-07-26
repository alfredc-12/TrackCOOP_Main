"use client";

import Link from "next/link";
import {
  BarChart3,
  Clock3,
  Database,
  Download,
  FileClock,
  FileText,
  Filter,
  Landmark,
  Printer,
  RefreshCw,
  Save,
  Settings2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FormDialog,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import {
  DOCUMENT_ACCESS_LEVELS,
  DOCUMENT_CATEGORIES,
  RELATED_MODULES,
  REPORT_CATEGORY_LABELS,
  humanizeConstant,
} from "../record-constants";
import type {
  GeneratedReportRecord,
  ReportCategory,
  ReportDefinition,
  ReportFilterKey,
  ReportFilterOptions,
  ReportFilters,
  ReportResult,
} from "../records-types";
import {
  BusyLabel,
  Field,
  apiError,
  fieldClass,
  formatDate,
  primaryButtonClass,
  secondaryButtonClass,
} from "./RecordsUi";

type ReportsLandingData = {
  catalog: ReportDefinition[];
  summary: {
    available: number;
    generatedThisMonth: number;
    financial: number;
    operational: number;
  };
  recent: GeneratedReportRecord[];
  filterOptions: ReportFilterOptions;
};

const categories: Array<ReportCategory | "ALL"> = [
  "ALL",
  "FINANCIAL",
  "MEMBERSHIP",
  "RENTAL",
  "SALES_INVENTORY",
  "DOCUMENTS",
  "AUDIT_ADMINISTRATION",
  "AGENCY_COOPERATIVE",
];

export function ReportsPage({ role }: { role: "chairman" | "bookkeeper" }) {
  const basePath = `/portal/${role}`;
  const [data, setData] = useState<ReportsLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ReportCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveAccess, setSaveAccess] = useState(
    role === "chairman" ? "ADMIN_ONLY" : "BOOKKEEPER_ONLY",
  );
  const [saving, setSaving] = useState(false);
  const generatorRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      if (!response.ok) throw new Error(await apiError(response));
      setError(null);
      setData((await response.json()) as ReportsLandingData);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Reports could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The async loader updates state only after the external request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const visibleReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.catalog ?? []).filter(
      (item) =>
        (category === "ALL" || item.category === category) &&
        (!term ||
          item.name.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          item.dataSource.toLowerCase().includes(term)),
    );
  }, [category, data?.catalog, search]);

  function chooseReport(definition: ReportDefinition) {
    setSelected(definition);
    setFilters({});
    setResult(null);
    window.setTimeout(() => {
      generatorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  async function generate() {
    if (!selected) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/generate/${selected.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const report = (await response.json()) as ReportResult;
      setResult(report);
      toast.success(
        `${report.reportName} generated from current database records.`,
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Report generation failed.";
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  async function printReport() {
    if (!result) return;
    try {
      const response = await fetch(`/api/reports/${result.reportId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "print" }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      window.print();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Print activity could not be recorded.",
      );
    }
  }

  async function saveReport() {
    if (!result) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/reports/${result.reportId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessLevel: saveAccess }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const saved = (await response.json()) as {
        documentReference?: string;
        alreadySaved?: boolean;
      };
      toast.success(
        saved.alreadySaved
          ? "This report is already linked to Documents."
          : `${saved.documentReference} saved to Documents.`,
      );
      setSaveOpen(false);
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Report could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  const exportQuery = useMemo(() => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    return query;
  }, [filters]);

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        eyebrow="Records"
        title="Reports"
        description="Generate and review cooperative financial, membership, rental, operational, and records reports."
        actions={
          <>
            <Link
              href={`${basePath}/reports/history`}
              className={secondaryButtonClass}
            >
              <FileClock className="size-4" /> View Generated Reports
            </Link>
            <Link
              href="/api/reports/history/export"
              className={secondaryButtonClass}
            >
              <Download className="size-4" /> Export Report Register
            </Link>
            <button
              type="button"
              onClick={() => {
                const first = data?.catalog.find(
                  (item) => !item.configurationRequired,
                );
                if (first) chooseReport(first);
              }}
              className={primaryButtonClass}
            >
              <BarChart3 className="size-4" /> Generate Report
            </button>
          </>
        }
      />

      {data ? (
        <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))]">
          <StatCard
            label="Available Reports"
            value={String(data.summary.available)}
            icon={Database}
          />
          <StatCard
            label="Generated This Month"
            value={String(data.summary.generatedThisMonth)}
            icon={Clock3}
          />
          <StatCard
            label="Financial Reports"
            value={String(data.summary.financial)}
            icon={Landmark}
          />
          <StatCard
            label="Operational Reports"
            value={String(data.summary.operational)}
            icon={BarChart3}
          />
        </section>
      ) : null}

      {error ? <ErrorState message={error} /> : null}
      {loading && !data ? <LoadingSkeleton /> : null}

      {data ? (
        <section className="grid min-w-0 gap-4">
          <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4">
            <label className="relative max-w-xl">
              <span className="sr-only">Search report catalog</span>
              <Filter className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#6C7A70]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                placeholder="Search report name, description, or data source"
                className={`${fieldClass} pl-9`}
              />
            </label>
            <div
              className="flex flex-wrap gap-2"
              aria-label="Report categories"
            >
              {categories
                .filter(
                  (item) =>
                    item === "ALL" ||
                    data.catalog.some((report) => report.category === item),
                )
                .map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setCategory(item)}
                    className={
                      item === category
                        ? primaryButtonClass
                        : secondaryButtonClass
                    }
                  >
                    {item === "ALL" ? "All" : REPORT_CATEGORY_LABELS[item]}
                  </button>
                ))}
            </div>
          </div>
          {visibleReports.length ? (
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {visibleReports.map((definition) => (
                <article
                  key={definition.key}
                  className="flex min-w-0 flex-col rounded-lg border border-[#CAD8CB] bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#D8A011]">
                        {REPORT_CATEGORY_LABELS[definition.category]}
                      </p>
                      <h2 className="mt-2 break-words text-lg font-black text-[#123D2A]">
                        {definition.name}
                      </h2>
                    </div>
                    {definition.configurationRequired ? (
                      <StatusBadge tone="warning">
                        Configuration Required
                      </StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#5D6D63]">
                    {definition.description}
                  </p>
                  <p className="mt-3 text-xs text-[#6C7A70]">
                    <strong>Data source:</strong> {definition.dataSource}
                  </p>
                  <p className="mt-1 text-xs text-[#6C7A70]">
                    <strong>Last generated:</strong>{" "}
                    {formatDate(
                      data.recent.find(
                        (item) => item.reportKey === definition.key,
                      )?.generatedAt ?? null,
                      true,
                    )}
                  </p>
                  <div className="mt-auto pt-5">
                    <button
                      type="button"
                      disabled={definition.configurationRequired}
                      onClick={() => chooseReport(definition)}
                      className={
                        definition.configurationRequired
                          ? secondaryButtonClass
                          : primaryButtonClass
                      }
                    >
                      {definition.configurationRequired ? (
                        <Settings2 className="size-4" />
                      ) : (
                        <BarChart3 className="size-4" />
                      )}
                      {definition.configurationRequired
                        ? "Client Configuration Required"
                        : "Generate"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No matching reports"
              description="Choose another category or clear the report search."
            />
          )}
        </section>
      ) : null}

      {selected && data ? (
        <section
          ref={generatorRef}
          className="min-w-0 scroll-mt-24 rounded-lg border border-[#CAD8CB] bg-white p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#D8A011]">
                Report Generator
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#123D2A]">
                {selected.name}
              </h2>
              <p className="mt-2 text-sm text-[#5D6D63]">
                {selected.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setResult(null);
              }}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
          {selected.filters.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {selected.filters.map((key) => (
                <ReportFilterField
                  key={key}
                  filterKey={key}
                  value={filters[key] ?? ""}
                  options={data.filterOptions}
                  onChange={(value) =>
                    setFilters((current) => ({ ...current, [key]: value }))
                  }
                />
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-md bg-[#EEF2EC] p-3 text-sm text-[#365F4A]">
              This report uses all eligible current records and has no optional
              filters.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={generating}
              onClick={() => void generate()}
              className={primaryButtonClass}
            >
              {generating ? (
                <BusyLabel label="Generating..." />
              ) : (
                <>
                  <BarChart3 className="size-4" /> Generate
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setFilters({});
                setResult(null);
              }}
              className={secondaryButtonClass}
            >
              <RefreshCw className="size-4" /> Reset
            </button>
          </div>
        </section>
      ) : null}

      {result ? (
        <ReportPreview
          key={`${result.reportReference}-${result.generatedAt}`}
          result={result}
          onPrint={() => void printReport()}
          onSave={() => setSaveOpen(true)}
          exportQuery={exportQuery}
        />
      ) : null}

      {data?.recent.length ? (
        <section className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#123D2A]">
                Recently Generated
              </h2>
              <p className="mt-1 text-sm text-[#5D6D63]">
                Report generation metadata stored in the TrackCOOP database.
              </p>
            </div>
            <Link
              href={`${basePath}/reports/history`}
              className={secondaryButtonClass}
            >
              View All
            </Link>
          </div>
          <div className="mt-4 grid gap-2">
            {data.recent.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-md border border-[#E1E9E2] p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words font-bold text-[#123D2A]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-[#6C7A70]">
                    {item.reference} · {item.periodLabel ?? "All records"} ·{" "}
                    {formatDate(item.generatedAt, true)}
                  </p>
                </div>
                <StatusBadge
                  tone={item.status === "Generated" ? "success" : "neutral"}
                >
                  {item.status}
                </StatusBadge>
                {item.documentId ? (
                  <Link
                    href={`${basePath}/documents/${item.documentId}`}
                    className={secondaryButtonClass}
                  >
                    <FileText className="size-4" /> Document
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <FormDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save Report to Documents"
        description={`${result?.reportName ?? "This report"} will be regenerated from current database records, exported as a protected PDF, linked to this report record, and audited.`}
      >
        <Field label="Document access level" required>
          <select
            value={saveAccess}
            onChange={(event) => setSaveAccess(event.target.value)}
            className={fieldClass}
          >
            {DOCUMENT_ACCESS_LEVELS.filter(
              (item) => role === "chairman" || item.value !== "ADMIN_ONLY",
            ).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setSaveOpen(false)}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveReport()}
            className={primaryButtonClass}
          >
            {saving ? (
              <BusyLabel label="Saving..." />
            ) : (
              <>
                <Save className="size-4" /> Confirm and Save
              </>
            )}
          </button>
        </div>
      </FormDialog>
    </div>
  );
}

function ReportFilterField({
  filterKey,
  value,
  options,
  onChange,
}: {
  filterKey: ReportFilterKey;
  value: string;
  options: ReportFilterOptions;
  onChange: (value: string) => void;
}) {
  const labels: Record<ReportFilterKey, string> = {
    dateFrom: "Date from",
    dateTo: "Date to",
    year: "Year",
    month: "Month",
    barangay: "Barangay",
    sector: "Sector",
    membershipType: "Membership type",
    paymentStatus: "Payment status",
    paymentMethod: "Payment method",
    rentalAssetId: "Rental asset",
    rentalStatus: "Rental booking status",
    productId: "Product",
    productCategory: "Product category",
    documentCategory: "Document category",
    documentAccessLevel: "Document access level",
    relatedModule: "Related module",
    userId: "User",
    role: "Role",
    auditAction: "Audit action",
  };
  if (filterKey === "dateFrom" || filterKey === "dateTo") {
    return (
      <Field label={labels[filterKey]}>
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={fieldClass}
        />
      </Field>
    );
  }
  if (filterKey === "year") {
    return (
      <Field label="Year">
        <input
          type="number"
          min="2000"
          max="2100"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={fieldClass}
        />
      </Field>
    );
  }
  if (filterKey === "month") {
    return (
      <SelectField
        label="Month"
        value={value}
        onChange={onChange}
        items={Array.from({ length: 12 }, (_, index) => ({
          value: String(index + 1),
          label: new Intl.DateTimeFormat("en-PH", { month: "long" }).format(
            new Date(2026, index, 1),
          ),
        }))}
      />
    );
  }
  if (filterKey === "auditAction") {
    return (
      <Field label={labels[filterKey]}>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="e.g. document."
          className={fieldClass}
        />
      </Field>
    );
  }
  const itemMap: Partial<
    Record<ReportFilterKey, Array<{ value: string; label: string }>>
  > = {
    barangay: options.barangays.map((item) => ({ value: item, label: item })),
    sector: options.sectors.map((item) => ({ value: item, label: item })),
    membershipType: ["Associate", "True Member"].map((item) => ({
      value: item,
      label: item,
    })),
    paymentStatus: [
      "Pending",
      "Validated",
      "Rejected",
      "Needs Clarification",
      "Unpaid",
      "Partially Paid",
      "Paid",
      "Refunded",
      "Reversed",
    ].map((item) => ({ value: item, label: item })),
    paymentMethod: options.paymentMethods.map((item) => ({
      value: item,
      label: item,
    })),
    rentalAssetId: options.rentalAssets.map((item) => ({
      value: item.id,
      label: item.label,
    })),
    rentalStatus: [
      "Inquiry",
      "Pending",
      "Approved",
      "Scheduled",
      "In Use",
      "Completed",
      "Rescheduled",
      "Cancelled",
      "Rejected",
    ].map((item) => ({ value: item, label: item })),
    productId: options.products.map((item) => ({
      value: item.id,
      label: item.label,
    })),
    productCategory: options.productCategories.map((item) => ({
      value: item,
      label: item,
    })),
    documentCategory: [
      ...new Set([...DOCUMENT_CATEGORIES, ...options.documentCategories]),
    ].map((item) => ({ value: item, label: humanizeConstant(item) })),
    documentAccessLevel: DOCUMENT_ACCESS_LEVELS.map((item) => ({
      value: item.value,
      label: item.label,
    })),
    relatedModule: [
      ...new Set([...RELATED_MODULES, ...options.relatedModules]),
    ].map((item) => ({ value: item, label: humanizeConstant(item) })),
    userId: options.users.map((item) => ({
      value: item.id,
      label: item.label,
    })),
    role: options.roles,
  };
  return (
    <SelectField
      label={labels[filterKey]}
      value={value}
      onChange={onChange}
      items={itemMap[filterKey] ?? []}
    />
  );
}

function SelectField({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      >
        <option value="">All</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ReportPreview({
  result,
  onPrint,
  onSave,
  exportQuery,
}: {
  result: ReportResult;
  onPrint: () => void;
  onSave: () => void;
  exportQuery: URLSearchParams;
}) {
  const exportBase = `/api/reports/generate/${result.reportKey}/export`;
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(result.rows.length / pageSize));
  const visibleRows = result.rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <section className="grid min-w-0 gap-4">
      <div data-no-records-print className="flex flex-wrap gap-2">
        <button type="button" onClick={onPrint} className={primaryButtonClass}>
          <Printer className="size-4" /> Print
        </button>
        <a
          href={`${exportBase}?format=pdf&${exportQuery}`}
          className={secondaryButtonClass}
        >
          <Download className="size-4" /> Export PDF
        </a>
        <a
          href={`${exportBase}?format=csv&${exportQuery}`}
          className={secondaryButtonClass}
        >
          <Download className="size-4" /> Export CSV
        </a>
        <button
          type="button"
          onClick={onSave}
          disabled={result.total === 0}
          className={secondaryButtonClass}
        >
          <Save className="size-4" /> Save to Documents
        </button>
      </div>
      <article
        data-records-print
        className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-5 sm:p-7"
      >
        <header className="border-b border-[#CAD8CB] pb-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-[#365F4A]">
            Nasugbu Farmers and Fisherfolks Agriculture Cooperative
          </p>
          <p className="mt-1 text-xs text-[#6C7A70]">
            TrackCOOP · System-Generated Report
          </p>
          <h2 className="mt-3 text-2xl font-black text-[#123D2A]">
            {result.reportName}
          </h2>
          <p className="mt-2 text-sm text-[#5D6D63]">{result.periodLabel}</p>
          <p className="mt-1 text-xs text-[#6C7A70]">
            Generated {formatDate(result.generatedAt, true)} by{" "}
            {result.generatedBy} · {result.reportReference}
          </p>
        </header>
        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {result.summary.map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-[#DCE5DC] bg-[#F7F8F3] p-3"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">
                {item.label}
              </p>
              <p className="mt-2 text-lg font-black text-[#123D2A]">
                {item.format === "currency"
                  ? new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(Number(item.value))
                  : new Intl.NumberFormat("en-PH").format(Number(item.value))}
              </p>
            </div>
          ))}
        </section>
        <div className="mt-5">
          {result.rows.length ? (
            <>
              <div data-no-records-print>
                <ReportTable
                  columns={result.columns}
                  rows={visibleRows}
                  rowOffset={(page - 1) * pageSize}
                />
                {totalPages > 1 ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-[#5D6D63]">
                      Page {page} of {totalPages} · {result.total} records
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={page === 1}
                        onClick={() =>
                          setPage((current) => Math.max(1, current - 1))
                        }
                        className={secondaryButtonClass}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() =>
                          setPage((current) =>
                            Math.min(totalPages, current + 1),
                          )
                        }
                        className={secondaryButtonClass}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div data-records-print-only>
                <ReportTable
                  columns={result.columns}
                  rows={result.rows}
                  rowOffset={0}
                />
              </div>
            </>
          ) : (
            <EmptyState
              icon={Database}
              title="No data for selected period"
              description="No current database records matched the selected report filters. No placeholder values were generated."
            />
          )}
        </div>
        <footer className="mt-5 flex flex-col gap-1 border-t border-[#CAD8CB] pt-4 text-xs text-[#6C7A70] sm:flex-row sm:justify-between">
          <span>
            {result.total} record{result.total === 1 ? "" : "s"}
          </span>
          <span>
            This system-generated report is not an audited financial statement.
          </span>
        </footer>
      </article>
    </section>
  );
}

function ReportTable({
  columns,
  rows,
  rowOffset,
}: {
  columns: ReportResult["columns"];
  rows: ReportResult["rows"];
  rowOffset: number;
}) {
  return (
    <DataTable>
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#EEF2EC] text-xs uppercase text-[#53675A]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-3">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowOffset + index} className="border-t border-[#E1E9E2]">
              {columns.map((column) => (
                <td key={column.key} className="max-w-sm break-words px-3 py-3">
                  {formatReportCell(row[column.key] ?? null, column.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  );
}

function formatReportCell(value: string | number | null, format?: string) {
  if (value === null || value === "") return "—";
  if (format === "currency")
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(value));
  if (format === "number")
    return new Intl.NumberFormat("en-PH").format(Number(value));
  if (format === "date") return formatDate(String(value));
  if (format === "datetime") return formatDate(String(value), true);
  return String(value);
}
