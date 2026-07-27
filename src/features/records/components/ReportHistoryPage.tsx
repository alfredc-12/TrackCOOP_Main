"use client";

import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Printer,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FormDialog,
  LoadingSkeleton,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import type { GeneratedReportRecord, ReportFilters } from "../records-types";
import {
  BusyLabel,
  Field,
  apiError,
  fieldClass,
  formatDate,
  primaryButtonClass,
  secondaryButtonClass,
  warningButtonClass,
} from "./RecordsUi";

export function ReportHistoryPage({
  role,
}: {
  role: "chairman" | "bookkeeper";
}) {
  const basePath = `/portal/${role}`;
  const [reports, setReports] = useState<GeneratedReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<GeneratedReportRecord | null>(
    null,
  );
  const [regenerateTarget, setRegenerateTarget] =
    useState<GeneratedReportRecord | null>(null);
  const [archiveTarget, setArchiveTarget] =
    useState<GeneratedReportRecord | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/reports/history", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await apiError(response));
      const payload = (await response.json()) as {
        reports: GeneratedReportRecord[];
      };
      setError(null);
      setReports(payload.reports);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Generated reports could not be loaded.",
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

  async function regenerate(report: GeneratedReportRecord) {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/reports/generate/${report.reportKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: report.filters }),
        },
      );
      if (!response.ok) throw new Error(await apiError(response));
      const generated = (await response.json()) as { reportReference: string };
      toast.success(
        `${generated.reportReference} regenerated from current database records.`,
      );
      setRegenerateTarget(null);
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Report regeneration failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function archive(report: GeneratedReportRecord) {
    setSaving(true);
    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", reason: archiveReason }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      toast.success("Generated report record archived.");
      setArchiveTarget(null);
      setArchiveReason("");
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Report could not be archived.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function print(report: GeneratedReportRecord) {
    try {
      const response = await fetch(`/api/reports/${report.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "print" }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      window.open(exportHref(report, "pdf"), "_blank", "noopener,noreferrer");
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Print activity could not be recorded.",
      );
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <Link
        href={`${basePath}/reports`}
        className={`${secondaryButtonClass} w-fit`}
      >
        <ArrowLeft className="size-4" /> Back to Reports
      </Link>
      <PageHeader
        eyebrow="Records"
        title="Generated Reports"
        description="Review report generation history, filters, linked documents, exports, regenerations, and archived records."
        actions={
          <Link
            href="/api/reports/history/export"
            className={secondaryButtonClass}
          >
            <Download className="size-4" /> Export Register
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}
      {loading && reports.length === 0 ? <LoadingSkeleton /> : null}
      {!loading && reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No generated reports"
          description="Generate a database-backed report to create the first history record."
        />
      ) : null}
      {reports.length ? (
        <>
          <div className="hidden min-w-0 md:block">
            <DataTable>
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-[#EEF2EC] text-xs uppercase text-[#53675A]">
                  <tr>
                    {[
                      "Reference",
                      "Report",
                      "Category",
                      "Period",
                      "Generated By",
                      "Generated At",
                      "Format",
                      "Document",
                      "Status",
                      "Actions",
                    ].map((item) => (
                      <th key={item} className="px-4 py-3">
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-t border-[#E1E9E2] align-top"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {report.reference}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#123D2A]">
                        {report.title}
                      </td>
                      <td className="px-4 py-3">
                        {report.category.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-3">
                        {report.periodLabel ?? "All records"}
                      </td>
                      <td className="px-4 py-3">{report.generatedBy}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(report.generatedAt, true)}
                      </td>
                      <td className="px-4 py-3">{report.outputFormat}</td>
                      <td className="px-4 py-3">
                        {report.documentReference ?? "Not saved"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          tone={
                            report.status === "Generated"
                              ? "success"
                              : "neutral"
                          }
                        >
                          {report.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <HistoryActions
                          report={report}
                          basePath={basePath}
                          onView={() => setViewTarget(report)}
                          onRegenerate={() => setRegenerateTarget(report)}
                          onArchive={() => setArchiveTarget(report)}
                          onPrint={() => void print(report)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </div>
          <div className="grid gap-3 md:hidden">
            {reports.map((report) => (
              <article
                key={report.id}
                className="rounded-lg border border-[#CAD8CB] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="break-words font-black text-[#123D2A]">
                      {report.title}
                    </h2>
                    <p className="mt-1 break-all font-mono text-xs text-[#6C7A70]">
                      {report.reference}
                    </p>
                  </div>
                  <StatusBadge
                    tone={report.status === "Generated" ? "success" : "neutral"}
                  >
                    {report.status}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-sm text-[#5D6D63]">
                  {report.periodLabel ?? "All records"} ·{" "}
                  {formatDate(report.generatedAt, true)}
                </p>
                <div className="mt-4">
                  <HistoryActions
                    report={report}
                    basePath={basePath}
                    onView={() => setViewTarget(report)}
                    onRegenerate={() => setRegenerateTarget(report)}
                    onArchive={() => setArchiveTarget(report)}
                    onPrint={() => void print(report)}
                    mobile
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <FormDialog
        open={Boolean(viewTarget)}
        onOpenChange={(open) => !open && setViewTarget(null)}
        title={viewTarget?.title ?? "Generated Report"}
        description={
          viewTarget
            ? `${viewTarget.reference} · generated ${formatDate(viewTarget.generatedAt, true)} by ${viewTarget.generatedBy}`
            : undefined
        }
      >
        {viewTarget ? (
          <div className="grid gap-4 text-sm">
            <Detail
              label="Category"
              value={viewTarget.category.replaceAll("_", " ")}
            />
            <Detail
              label="Reporting period"
              value={viewTarget.periodLabel ?? "All records"}
            />
            <Detail label="Output format" value={viewTarget.outputFormat} />
            <Detail
              label="Linked document"
              value={viewTarget.documentReference ?? "Not saved to Documents"}
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">
                Applied filters
              </p>
              <FilterSummary filters={viewTarget.filters} />
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={exportHref(viewTarget, "pdf")}
                className={secondaryButtonClass}
              >
                <Download className="size-4" /> Export Current PDF
              </a>
              <a
                href={exportHref(viewTarget, "csv")}
                className={secondaryButtonClass}
              >
                <Download className="size-4" /> Export Current CSV
              </a>
              {viewTarget.documentId ? (
                <Link
                  href={`${basePath}/documents/${viewTarget.documentId}`}
                  className={primaryButtonClass}
                >
                  <FileText className="size-4" /> Open Linked Document
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </FormDialog>

      <FormDialog
        open={Boolean(regenerateTarget)}
        onOpenChange={(open) => !open && setRegenerateTarget(null)}
        title="Regenerate Report"
        description={`${regenerateTarget?.title ?? "This report"} will run again against current database records using the same saved filters. A new report history record will be created.`}
      >
        {regenerateTarget ? (
          <FilterSummary filters={regenerateTarget.filters} />
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setRegenerateTarget(null)}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              regenerateTarget && void regenerate(regenerateTarget)
            }
            className={primaryButtonClass}
          >
            {saving ? (
              <BusyLabel label="Regenerating..." />
            ) : (
              <>
                <RefreshCw className="size-4" /> Confirm Regeneration
              </>
            )}
          </button>
        </div>
      </FormDialog>

      <FormDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
            setArchiveReason("");
          }
        }}
        title="Archive Generated Report"
        description={`${archiveTarget?.title ?? "This report"} will be archived in report history. Any linked document remains preserved separately.`}
      >
        <Field label="Archive reason" required>
          <textarea
            value={archiveReason}
            onChange={(event) => setArchiveReason(event.target.value)}
            rows={3}
            className={`${fieldClass} py-3`}
          />
        </Field>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setArchiveTarget(null)}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || archiveReason.trim().length < 3}
            onClick={() => archiveTarget && void archive(archiveTarget)}
            className={warningButtonClass}
          >
            {saving ? (
              <BusyLabel label="Archiving..." />
            ) : (
              <>
                <Archive className="size-4" /> Confirm Archive
              </>
            )}
          </button>
        </div>
      </FormDialog>
    </div>
  );
}

function exportHref(report: GeneratedReportRecord, format: "pdf" | "csv") {
  const query = new URLSearchParams({ format });
  Object.entries(report.filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return `/api/reports/generate/${report.reportKey}/export?${query}`;
}

function FilterSummary({ filters }: { filters: ReportFilters }) {
  const entries = Object.entries(filters).filter((entry) => entry[1]);
  if (!entries.length)
    return (
      <p className="mt-2 rounded-md bg-[#EEF2EC] p-3 text-sm text-[#365F4A]">
        All eligible records
      </p>
    );
  return (
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md border border-[#E1E9E2] p-3">
          <dt className="text-xs font-bold uppercase text-[#6C7A70]">
            {key.replace(/([A-Z])/g, " $1")}
          </dt>
          <dd className="mt-1 break-words text-[#294B39]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">
        {label}
      </p>
      <p className="mt-1 break-words text-[#294B39]">{value}</p>
    </div>
  );
}

function HistoryActions({
  report,
  basePath,
  onView,
  onRegenerate,
  onArchive,
  onPrint,
  mobile,
}: {
  report: GeneratedReportRecord;
  basePath: string;
  onView: () => void;
  onRegenerate: () => void;
  onArchive: () => void;
  onPrint: () => void;
  mobile?: boolean;
}) {
  const actions = (
    <>
      <button type="button" onClick={onView} className={secondaryButtonClass}>
        <Eye className="size-4" /> View
      </button>
      <a href={exportHref(report, "pdf")} className={secondaryButtonClass}>
        <Download className="size-4" /> PDF
      </a>
      <button type="button" onClick={onPrint} className={secondaryButtonClass}>
        <Printer className="size-4" /> Print
      </button>
      <button
        type="button"
        onClick={onRegenerate}
        className={secondaryButtonClass}
      >
        <RefreshCw className="size-4" /> Regenerate
      </button>
      {report.documentId ? (
        <Link
          href={`${basePath}/documents/${report.documentId}`}
          className={secondaryButtonClass}
        >
          <FileText className="size-4" /> Document
        </Link>
      ) : null}
      {report.status !== "Archived" ? (
        <button
          type="button"
          onClick={onArchive}
          className={warningButtonClass}
        >
          <Archive className="size-4" /> Archive
        </button>
      ) : null}
    </>
  );
  if (mobile) return <div className="grid grid-cols-2 gap-2">{actions}</div>;
  return <div className="flex min-w-[32rem] flex-wrap gap-2">{actions}</div>;
}
