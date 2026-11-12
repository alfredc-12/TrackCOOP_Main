"use client";

import Link from "next/link";
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  FileClock,
  FileText,
  PieChart,
  Printer,
  Landmark,
  RefreshCw,
  Save,
  Settings2,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { PaymentSummaryCard } from "@/components/portal/PaymentWorkspace";
import { expressApiUrl, expressFetch } from "@/lib/express-api";
import { calendarDateInMonth } from "@/lib/calendar-date";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FormDialog,
  LoadingSkeleton,
  PaginationControls,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import {
  DOCUMENT_ACCESS_LEVELS,
  DOCUMENT_CATEGORIES,
  RELATED_MODULES,
  REPORT_CATALOG,
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
  RecordsSelect,
  Field,
  apiError,
  fieldClass,
  formatDate,
  primaryButtonClass,
  secondaryButtonClass,
} from "./RecordsUi";
import { ReportHistoryPage } from "./ReportHistoryPage";
import { ReportHub, ReportTrendChart } from "./ReportHub";

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

type ReportPeriodPreset = "custom" | "daily" | "weekly" | "monthly" | "yearly";

function localIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function periodRange(preset: Exclude<ReportPeriodPreset, "custom">) {
  const today = new Date();
  const end = localIsoDate(today);
  if (preset === "daily") return { dateFrom: end, dateTo: end };
  if (preset === "monthly") {
    return { dateFrom: localIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: end };
  }
  if (preset === "yearly") {
    return { dateFrom: localIsoDate(new Date(today.getFullYear(), 0, 1)), dateTo: end };
  }
  const day = today.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  return {
    dateFrom: localIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset)),
    dateTo: end,
  };
}

const emptyReportFilterOptions: ReportFilterOptions = {
  barangays: [],
  sectors: [],
  paymentMethods: [],
  rentalAssets: [],
  products: [],
  productCategories: [],
  documentCategories: [],
  relatedModules: [],
  users: [],
  roles: [],
};

function fallbackReportsData(role: "chairman" | "bookkeeper"): ReportsLandingData {
  const catalog = REPORT_CATALOG.filter((item) =>
    item.allowedRoles.includes(role),
  );
  return {
    catalog,
    summary: {
      available: catalog.filter((item) => !item.configurationRequired).length,
      generatedThisMonth: 0,
      financial: catalog.filter((item) => item.category === "FINANCIAL").length,
      operational: catalog.filter((item) =>
        ["RENTAL", "SALES_INVENTORY", "DOCUMENTS"].includes(item.category),
      ).length,
    },
    recent: [],
    filterOptions: emptyReportFilterOptions,
  };
}

export function ReportsPage({ role }: { role: "chairman" | "bookkeeper" }) {
  const basePath = `/portal/${role}`;
  const [data, setData] = useState<ReportsLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportKey, setSelectedReportKey] = useState("");
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [periodPreset, setPeriodPreset] = useState<ReportPeriodPreset>("custom");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveAccess, setSaveAccess] = useState(
    role === "chairman" ? "ADMIN_ONLY" : "BOOKKEEPER_ONLY",
  );
  const [saving, setSaving] = useState(false);
  const [recentModalOpen, setRecentModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await expressFetch("/api/reports", { cache: "no-store" });
      if (!response.ok) throw new Error(await apiError(response));
      setError(null);
      setData((await response.json()) as ReportsLandingData);
    } catch (requestError) {
      console.error("Reports landing data could not be loaded:", requestError);
      setData(fallbackReportsData(role));
      setError(requestError instanceof Error ? requestError.message : "Reports could not be loaded. Showing the available report catalog.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    // The async loader updates state only after the external request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const selectableReports = (data?.catalog ?? []).filter(
    (item) => !item.configurationRequired,
  );
  const selectedReport =
    selectableReports.find((item) => item.key === selectedReportKey) ??
    selectableReports[0] ??
    null;

  function chooseReport(definition: ReportDefinition, initialFilters: ReportFilters = {}) {
    setSelected(definition);
    setSelectedReportKey(definition.key);
    setFilters(initialFilters);
    setPeriodPreset("custom");
    setResult(null);
    setIsGeneratorOpen(true);
  }

  async function generate() {
    if (!selected) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await expressFetch(`/api/reports/generate/${selected.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const report = (await response.json()) as ReportResult;
      setResult(report);
      setFilters(report.appliedFilters);
      setIsGeneratorOpen(false);
      void load();
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
      const response = await expressFetch(`/api/reports/${result.reportId}/activity`, {
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
      const response = await expressFetch(`/api/reports/${result.reportId}/save`, {
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
    <div className="grid min-w-0 gap-4">
      <PageHeader
        eyebrow={role === "bookkeeper" ? "Bookkeeper · Reports" : "Records · Reports"}
        title="Reports"
        description="Generate and review cooperative financial, membership, rental, operational, and records reports."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryModalOpen(true)}
              className={secondaryButtonClass}
            >
              <FileClock className="size-4" /> View Generated Reports
            </button>
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
          </div>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading && !data ? <LoadingSkeleton /> : null}

      {data ? (
        <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))]">
          <PaymentSummaryCard showTopBorder={false} label="Available Reports" value={String(data.summary.available)} icon={Database} />
          <PaymentSummaryCard showTopBorder={false} tone="gold" label="Generated This Month" value={error ? "—" : String(data.summary.generatedThisMonth)} icon={Clock3} />
          <PaymentSummaryCard showTopBorder={false} label="Financial Reports" value={String(data.summary.financial)} icon={Landmark} />
          <PaymentSummaryCard showTopBorder={false} label="Operational Reports" value={String(data.summary.operational)} icon={BarChart3} />
        </section>
      ) : null}

      {data ? <ReportHub catalog={data.catalog} recent={data.recent} role={role} onChoose={chooseReport} /> : null}

      {data ? (
        <section className="grid min-w-0 gap-4">
          <ReportPicker
            reports={selectableReports}
            selectedReport={selectedReport}
            recent={data.recent}
            generating={generating}
            onSelect={setSelectedReportKey}
            onGenerate={() => selectedReport && chooseReport(selectedReport)}
          />
        </section>
      ) : null}

      {selected && data ? (
        <FormDialog
          open={isGeneratorOpen}
          onOpenChange={(open) => {
            setIsGeneratorOpen(open);
            if (!open && !result) {
              setSelected(null);
            }
          }}
          title={selected.name}
          description={selected.description || "Report Generator"}
        >
          {selected.filters.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {selected.filters.includes("dateFrom") && selected.filters.includes("dateTo") ? (
                <ReportPeriodPresetField
                  value={periodPreset}
                  onChange={(value) => {
                    setPeriodPreset(value);
                    if (value !== "custom") {
                      setFilters((current) => ({ ...current, ...periodRange(value) }));
                    }
                  }}
                />
              ) : null}
              {selected.filters.map((key) => (
                <ReportFilterField
                  key={key}
                  filterKey={key}
                  value={filters[key] ?? ""}
                  options={data.filterOptions}
                  onChange={(value) => {
                    if (key === "dateFrom" || key === "dateTo") setPeriodPreset("custom");
                    setFilters((current) => ({ ...current, [key]: value }));
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md bg-[#EEF2EC] p-3 text-sm text-[#365F4A]">
              This report uses all eligible current records and has no optional
              filters.
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFilters({});
                setPeriodPreset("custom");
                setResult(null);
              }}
              className={secondaryButtonClass}
            >
              <RefreshCw className="size-4" /> Reset
            </button>
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
          </div>
        </FormDialog>
      ) : null}

      {result ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border border-[#CAD8CB] bg-white p-4">
            <div>
              <h3 className="font-bold text-[#123D2A]">{result.reportName}</h3>
              <p className="text-sm text-[#5D6D63]">Generated report results</p>
            </div>
            <button
              type="button"
              onClick={() => setIsGeneratorOpen(true)}
              className={secondaryButtonClass}
            >
              <Settings2 className="size-4" /> Modify Filters
            </button>
          </div>
          <ReportPreview
            key={`${result.reportReference}-${result.generatedAt}`}
            result={result}
            onPrint={() => void printReport()}
            onSave={() => setSaveOpen(true)}
            exportQuery={exportQuery}
          />
        </div>
      ) : null}

      {data?.recent.length ? (
        <FormDialog
          open={recentModalOpen}
          onOpenChange={setRecentModalOpen}
          title="Recently Generated"
          description="Report generation metadata stored in the TrackCOOP database."
        >
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-1">
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
        </FormDialog>
      ) : null}

      <FormDialog
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        title=""
        description=""
        contentClassName="!w-[min(76rem,calc(100vw-2rem))]"
      >
        <div className="max-h-[80vh] overflow-y-auto">
          <ReportHistoryPage role={role} isModal />
        </div>
      </FormDialog>

      <FormDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save Report to Documents"
        description={`${result?.reportName ?? "This report"} will be regenerated from current database records, exported as a protected PDF, linked to this report record, and audited.`}
      >
        <Field label="Document access level" required>
          <RecordsSelect ariaLabel="Document access level" value={saveAccess} onChange={setSaveAccess}
            options={DOCUMENT_ACCESS_LEVELS.filter((item) => role === "chairman" || item.value !== "ADMIN_ONLY")} />
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

function ReportPeriodPresetField({
  value,
  onChange,
}: {
  value: ReportPeriodPreset;
  onChange: (value: ReportPeriodPreset) => void;
}) {
  return (
    <SelectField
      label="Quick period"
      value={value}
      onChange={(nextValue) => onChange(nextValue as ReportPeriodPreset)}
      items={[
        { value: "custom", label: "Custom date range" },
        { value: "daily", label: "Daily (today)" },
        { value: "weekly", label: "Weekly (this week)" },
        { value: "monthly", label: "Monthly (this month)" },
        { value: "yearly", label: "Yearly (this year)" },
      ]}
    />
  );
}

function ReportPicker({
  reports,
  selectedReport,
  recent,
  generating,
  onSelect,
  onGenerate,
}: {
  reports: ReportDefinition[];
  selectedReport: ReportDefinition | null;
  recent: GeneratedReportRecord[];
  generating: boolean;
  onSelect: (key: string) => void;
  onGenerate: () => void;
}) {
  const [category, setCategory] = useState<ReportCategory>(selectedReport?.category ?? reports[0]?.category ?? "FINANCIAL");
  const categories = Array.from(new Set(reports.map((report) => report.category)));
  const categoryReports = reports.filter((report) => report.category === category);
  const activeReport = categoryReports.find((report) => report.key === selectedReport?.key) ?? categoryReports[0] ?? null;
  return <section className="min-w-0 rounded-2xl border border-coop-border bg-coop-surface p-4 shadow-coop-soft sm:p-5">
    <div className="mb-4 flex items-start gap-3 border-b border-coop-border pb-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-coop-success-bg text-coop-green"><BarChart3 className="size-5" aria-hidden="true" /></span>
      <div><h2 className="text-lg font-bold text-coop-forest">Build a report</h2><p className="mt-1 text-sm text-coop-muted">Choose a category and report, then set the filters for your preview.</p></div>
    </div>
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
      <Field label="Choose category"><RecordsSelect ariaLabel="Choose report category" value={category}
        options={categories.map((item) => ({ value: item, label: REPORT_CATEGORY_LABELS[item] }))}
        onChange={(value) => { setCategory(value as ReportCategory); const first = reports.find((report) => report.category === value); if (first) onSelect(first.key); }} /></Field>
      <Field label="Choose report"><RecordsSelect ariaLabel="Choose report" value={activeReport?.key ?? ""}
        options={categoryReports.map((item) => ({ value: item.key, label: item.name }))} onChange={onSelect} /></Field>
      <button type="button" disabled={!selectedReport || generating} onClick={onGenerate} className={primaryButtonClass}>
        {generating ? <BusyLabel label="Generating..." /> : <><BarChart3 className="size-4" />Generate</>}
      </button>
    </div>
    {selectedReport ? <div className="mt-4 rounded-xl border border-coop-border bg-coop-sage/50 p-4 text-sm text-coop-muted">
      <p className="font-bold text-coop-forest">{selectedReport.name}</p><p className="mt-1 leading-6">{selectedReport.description}</p>
      <p className="mt-3 text-xs">Source: {selectedReport.dataSource} · Last generated: {formatDate(recent.find((item) => item.reportKey === selectedReport.key)?.generatedAt ?? null, true)}</p>
    </div> : <p className="mt-4 text-sm text-coop-muted">No reports are available in this category.</p>}
  </section>;
}

function ReportCatalogCards({
  reports,
  recent,
  generating,
  onGenerate,
}: {
  reports: ReportDefinition[];
  recent: GeneratedReportRecord[];
  generating: boolean;
  onGenerate: (definition: ReportDefinition) => void;
}) {
  return (
    <div className="grid gap-3">
      {reports.map((definition) => {
        const lastGenerated = recent.find(
          (item) => item.reportKey === definition.key,
        );
        return (
          <article
            key={definition.key}
            className="flex flex-col gap-4 rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-sm sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-[#D8A011]">
                {REPORT_CATEGORY_LABELS[definition.category]}
              </p>
              <h3 className="mt-1 text-lg font-black text-[#123D2A]">
                {definition.name}
              </h3>
              <p className="mt-1 text-sm text-[#5D6D63]">
                {definition.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#5D6D63]">
                <span className="inline-flex items-center gap-1">
                  <Database className="size-3.5" />
                  {definition.dataSource}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" />
                  Last generated:{" "}
                  {lastGenerated ? formatDate(lastGenerated.generatedAt, true) : "—"}
                </span>
              </div>
            </div>
            {definition.configurationRequired ? (
              <StatusBadge tone="warning">Needs setup</StatusBadge>
            ) : (
              <button
                type="button"
                disabled={generating}
                onClick={() => onGenerate(definition)}
                className={primaryButtonClass}
              >
                <BarChart3 className="size-4" /> Generate
              </button>
            )}
          </article>
        );
      })}
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
        <DateField value={value} onChange={onChange} />
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

function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const pickerId = useId();
  const selection = useRef({ value, day: value ? Number(value.slice(8, 10)) : null });
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  useEffect(() => {
    const closeOtherPickers = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
    };
    document.addEventListener("date-picker-open", closeOtherPickers);
    document.addEventListener("custom-picker-open", closeOtherPickers);
    return () => {
      document.removeEventListener("date-picker-open", closeOtherPickers);
      document.removeEventListener("custom-picker-open", closeOtherPickers);
    };
  }, [pickerId]);
  const [month, setMonth] = useState(() => {
    const date = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const format = (year: number, monthIndex: number, day: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const label = selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Select date";
  const today = new Date();
  function moveMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    const day = selection.current.value === value ? selection.current.day : value ? Number(value.slice(8, 10)) : null;
    if (day !== null) {
      const nextValue = calendarDateInMonth(next.getFullYear(), next.getMonth(), day);
      selection.current = { value: nextValue, day };
      onChange(nextValue);
    }
  }
  return (
    <div ref={rootRef} className="relative">
      <button type="button" aria-expanded={open} onClick={() => {
        const nextOpen = !open;
        if (nextOpen) {
          if (selection.current.value !== value) {
            const date = value ? new Date(`${value}T00:00:00`) : new Date();
            setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
            selection.current = { value, day: value ? date.getDate() : null };
          }
          document.dispatchEvent(new CustomEvent("date-picker-open", { detail: pickerId }));
          document.dispatchEvent(new CustomEvent("custom-picker-open", { detail: pickerId }));
        }
        setOpen(nextOpen);
      }} className={`${fieldClass} flex w-full items-center justify-between gap-2 text-left font-semibold`}>
        <span>{label}</span><Calendar className="size-4 text-[#365F4A]" aria-hidden="true" />
      </button>
      {open ? <div className="absolute bottom-full z-50 mb-2 w-72 rounded-lg border border-[#CAD8CB] bg-white p-3 shadow-[0_18px_45px_rgba(18,61,42,0.18)]">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="rounded p-2 text-[#123D2A] hover:bg-[#EEF6EF]"><ChevronLeft className="size-4" /></button>
          <span className="text-sm font-bold text-[#123D2A]">{month.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</span>
          <button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="rounded p-2 text-[#123D2A] hover:bg-[#EEF6EF]"><ChevronRight className="size-4" /></button>
        </div>
        <div className="mt-2 grid grid-cols-7 text-center text-xs font-bold text-[#6C7A70]">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day} className="py-2">{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">{cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const dateValue = format(month.getFullYear(), month.getMonth(), day);
          const selected = dateValue === value;
          return <button key={dateValue} type="button" aria-pressed={selected} onClick={() => { selection.current = { value: dateValue, day }; onChange(dateValue); setOpen(false); }} className={`rounded-md py-2 ${selected ? "bg-[#123D2A] font-bold text-white" : "text-[#294B39] hover:bg-[#EEF6EF]"}`}>{day}</button>;
        })}</div>
        <div className="mt-2 flex justify-between border-t border-[#E1E9E2] pt-2 text-xs font-semibold"><button type="button" onClick={() => { selection.current = { value: "", day: null }; onChange(""); setOpen(false); }} className="text-[#2F7D50] hover:underline">Clear</button><button type="button" onClick={() => { const todayValue = format(today.getFullYear(), today.getMonth(), today.getDate()); selection.current = { value: todayValue, day: today.getDate() }; onChange(todayValue); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setOpen(false); }} className="text-[#2F7D50] hover:underline">Today</button></div>
      </div> : null}
    </div>
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
  return <Field label={label}><RecordsSelect ariaLabel={`Choose ${label}`} value={value} onChange={onChange}
    options={[{ value: "", label: "All" }, ...items]} /></Field>;
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
  const exportBase = expressApiUrl(`/api/reports/generate/${result.reportKey}/export`);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
        <a
          href={`${exportBase}?format=xlsx&${exportQuery}`}
          className={secondaryButtonClass}
        >
          <Download className="size-4" /> Export Excel
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
        {result.notes?.length ? <div className="mt-4 space-y-2 rounded-xl border border-coop-border bg-coop-workspace p-4 text-xs leading-5 text-coop-muted">{result.notes.map((note) => <p key={note}>{note}</p>)}</div> : null}
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
        {result.reportKey === "performance-trends" ? <ReportTrendChart rows={result.rows} /> : ["cooperative-overview", "attention-needed"].includes(result.reportKey) ? null : <ReportVisuals result={result} />}
        <div className="mt-5">
          {result.rows.length ? (
            <>
              <div data-no-records-print>
                <ReportTable
                  columns={result.columns}
                  rows={visibleRows}
                  rowOffset={(page - 1) * pageSize}
                />
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={result.rows.length}
                  itemName="records"
                  onPageChange={setPage}
                  pageSize={pageSize}
                  pageSizeOptions={[10, 25, 50]}
                  onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }}
                  className="mt-3"
                />
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

type VisualPoint = {
  label: string;
  value: number;
  format?: "currency" | "number";
};

function ReportVisuals({ result }: { result: ReportResult }) {
  const summaryPoints = result.summary
    .map((item) => ({
      label: item.label,
      value: Number(item.value),
      format: item.format,
    }))
    .filter((item) => Number.isFinite(item.value));
  const rowPoints = buildRowChart(result);
  const statusPoints = buildDistributionChart(result);

  if (!summaryPoints.length && !rowPoints.length && !statusPoints.length) {
    return null;
  }

  return (
    <section className="mt-5 grid gap-4" data-no-records-print>
      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">
        <BarChart3 className="size-4" />
        Visual Summary
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {summaryPoints.length ? (
          <VisualCard
            title="Report totals"
            description="Quick view of the main totals in this report."
            icon={TrendingUp}
          >
            <MiniBarChart points={summaryPoints.slice(0, 8)} />
          </VisualCard>
        ) : null}
        {rowPoints.length ? (
          <VisualCard
            title="Top records"
            description="Largest values from the generated rows."
            icon={BarChart3}
          >
            <MiniBarChart points={rowPoints} />
          </VisualCard>
        ) : statusPoints.length ? (
          <VisualCard
            title="Record grouping"
            description="Rows grouped by their most useful status or type column."
            icon={PieChart}
          >
            <DonutChart points={statusPoints} />
          </VisualCard>
        ) : null}
      </div>
      {rowPoints.length && statusPoints.length ? (
        <VisualCard
          title="Record grouping"
          description="Rows grouped by their most useful status or type column."
          icon={PieChart}
        >
          <DonutChart points={statusPoints} compact />
        </VisualCard>
      ) : null}
    </section>
  );
}

function VisualCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.06)]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#EEF2EC] text-[#1F6B43]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-[#123D2A]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#6C7A70]">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function MiniBarChart({
  points,
  compact = false,
}: {
  points: VisualPoint[];
  compact?: boolean;
}) {
  const max = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  return (
    <div className="grid gap-3">
      <div className={`flex items-end gap-3 ${compact ? "h-36" : "h-48"}`}>
        {points.map((point) => {
          const height = Math.max(8, Math.round((Math.abs(point.value) / max) * 100));
          return (
            <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-full w-full items-end rounded-t-md bg-[#EEF2EC] px-1 pt-2">
                <div
                  className="w-full rounded-t-md bg-[#1F6B43] shadow-[0_8px_18px_rgba(31,107,67,0.22)]"
                  style={{ height: `${height}%` }}
                  aria-hidden="true"
                />
              </div>
              <p className="line-clamp-2 min-h-8 text-center text-[11px] font-bold leading-4 text-[#294B39]">
                {point.label}
              </p>
            </div>
          );
        })}
      </div>
      {points.map((point) => {
        return (
          <div key={`${point.label}-legend`} className={compact ? "grid gap-1" : "grid gap-1.5"}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-bold text-[#294B39]">
                {point.label}
              </span>
              <span className="shrink-0 font-black text-[#123D2A]">
                {formatVisualValue(point.value, point.format)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({
  points,
  compact = false,
}: {
  points: VisualPoint[];
  compact?: boolean;
}) {
  const total = points.reduce((sum, point) => sum + Math.max(0, point.value), 0);
  const colors = ["#1F6B43", "#D8A011", "#6EA77A", "#9A6B00", "#86B990", "#CAD8CB"];
  const gradient = points.map((point, index) => {
    const previous = points
      .slice(0, index)
      .reduce((sum, item) => sum + Math.max(0, item.value), 0);
    const current = previous + Math.max(0, point.value);
    const start = total > 0 ? (previous / total) * 100 : 0;
    const end = total > 0 ? (current / total) * 100 : 0;
    const color = colors[index % colors.length];
    return `${color} ${start}% ${end}%`;
  }).join(", ");

  return (
    <div className={`grid gap-4 ${compact ? "sm:grid-cols-[10rem_1fr]" : "sm:grid-cols-[13rem_1fr]"} sm:items-center`}>
      <div className="relative mx-auto grid aspect-square w-full max-w-[13rem] place-items-center rounded-full"
        style={{ background: `conic-gradient(${gradient || "#CAD8CB 0% 100%"})` }}>
        <div className="grid size-[62%] place-items-center rounded-full bg-white text-center shadow-inner">
          <span className="text-2xl font-black text-[#123D2A]">
            {formatVisualValue(total, "number")}
          </span>
          <span className="-mt-1 text-[10px] font-bold uppercase tracking-wide text-[#6C7A70]">
            records
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        {points.map((point, index) => (
          <div key={point.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 font-bold text-[#294B39]">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
                aria-hidden="true"
              />
              <span className="truncate">{point.label}</span>
            </span>
            <span className="shrink-0 font-black text-[#123D2A]">
              {formatVisualValue(point.value, "number")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildRowChart(result: ReportResult): VisualPoint[] {
  const valueColumn =
    result.columns.find((column) => column.format === "currency") ??
    result.columns.find((column) => column.format === "number");
  if (!valueColumn) return [];

  const labelColumn = result.columns.find((column) =>
    column.key !== valueColumn.key &&
    column.format !== "currency" &&
    column.format !== "number" &&
    column.format !== "date" &&
    column.format !== "datetime",
  );
  if (!labelColumn) return [];

  return result.rows
    .map((row) => ({
      label: String(row[labelColumn.key] ?? "Not recorded"),
      value: numericCell(row[valueColumn.key]),
      format: valueColumn.format === "currency" ? "currency" as const : "number" as const,
    }))
    .filter((point) => Number.isFinite(point.value) && point.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8);
}

function buildDistributionChart(result: ReportResult): VisualPoint[] {
  const preferredKeys = [
    "status",
    "paymentStatus",
    "validationStatus",
    "bookingStatus",
    "recordType",
    "category",
    "source",
    "membershipType",
    "asset",
  ];
  const column =
    preferredKeys
      .map((key) => result.columns.find((item) => item.key === key))
      .find(Boolean) ??
    result.columns.find((item) => !item.format);
  if (!column) return [];

  const counts = new Map<string, number>();
  result.rows.forEach((row) => {
    const label = String(row[column.key] ?? "Not recorded").trim() || "Not recorded";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, format: "number" as const }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function numericCell(value: string | number | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatVisualValue(value: number, format?: "currency" | "number") {
  if (format === "currency") {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat("en-PH").format(value);
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
