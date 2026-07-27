"use client";

import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Download,
  FileLock2,
  FilePlus2,
  FileText,
  Filter,
  FolderArchive,
  MoreVertical,
  Printer,
  Search,
  ShieldCheck,
  Upload,
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
  DOCUMENT_TYPES,
  RELATED_MODULES,
  accessLevelLabel,
  humanizeConstant,
} from "../record-constants";
import type {
  DocumentListResponse,
  DocumentRecord,
  DocumentStatus,
} from "../records-types";
import { DocumentMetadataFields } from "./DocumentMetadataFields";
import {
  BusyLabel,
  Field,
  apiError,
  fieldClass,
  formatDate,
  formatFileSize,
  primaryButtonClass,
  secondaryButtonClass,
  warningButtonClass,
} from "./RecordsUi";

type Filters = {
  search: string;
  category: string;
  documentType: string;
  accessLevel: string;
  relatedModule: string;
  status: string;
  uploadedBy: string;
  dateFrom: string;
  dateTo: string;
  expirationFrom: string;
  expirationTo: string;
  fileType: string;
};

const emptyFilters: Filters = {
  search: "",
  category: "",
  documentType: "",
  accessLevel: "",
  relatedModule: "",
  status: "",
  uploadedBy: "",
  dateFrom: "",
  dateTo: "",
  expirationFrom: "",
  expirationTo: "",
  fileType: "",
};

function statusTone(status: DocumentStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "EXPIRING_SOON") return "warning" as const;
  if (status === "EXPIRED") return "danger" as const;
  return "neutral" as const;
}

function queryFor(filters: Filters, page = 1) {
  const parameters = new URLSearchParams({
    page: String(page),
    pageSize: "5",
  });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) parameters.set(key, value);
  });
  return parameters;
}

export function DocumentsPage({ role }: { role: "chairman" | "bookkeeper" }) {
  const basePath = `/portal/${role}`;
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DocumentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<1 | 2>(1);
  const formRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<DocumentRecord | null>(
    null,
  );
  const [archiveReason, setArchiveReason] = useState("");
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/documents?${queryFor(filters, page)}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error(await apiError(response));
      setError(null);
      setData((await response.json()) as DocumentListResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Documents could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    // The async loader updates state only after the external request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 5));
  const visibleAccess = DOCUMENT_ACCESS_LEVELS.filter(
    (item) => role === "chairman" || item.value !== "ADMIN_ONLY",
  );
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const result = (await response.json()) as { reference: string };
      toast.success(`${result.reference} uploaded successfully.`);
      setUploadOpen(false);
      setUploadStep(1);
      event.currentTarget.reset();
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Document upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function changeArchiveState(document: DocumentRecord) {
    setMutating(true);
    const archive = document.status !== "ARCHIVED";
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: archive ? "archive" : "restore",
          reason: archive ? archiveReason : undefined,
        }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      toast.success(archive ? "Document archived." : "Document restored.");
      setArchiveTarget(null);
      setArchiveReason("");
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Document status could not be changed.",
      );
    } finally {
      setMutating(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        eyebrow="Records"
        title="Documents"
        description="Manage cooperative files, access permissions, versions, and document activity."
        actions={
          <>
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className={secondaryButtonClass}
            >
              <Filter className="size-4" /> More Filters{" "}
              {activeFilterCount ? `(${activeFilterCount})` : ""}
            </button>
            <Link href={`${basePath}/reports`} className={secondaryButtonClass}>
              <FilePlus2 className="size-4" /> Generate Document
            </Link>
            <a
              href={`/api/documents/export?${queryFor(filters)}`}
              className={secondaryButtonClass}
            >
              <Download className="size-4" /> Export List
            </a>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className={primaryButtonClass}
            >
              <Upload className="size-4" /> Upload Document
            </button>
          </>
        }
      />

      {data ? (
        <section
          className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]"
          aria-label="Document summary"
        >
          <StatCard
            label="Total Documents"
            value={String(data.summary.total)}
            icon={FileText}
          />
          <StatCard
            label="Recently Uploaded"
            value={String(data.summary.recentlyUploaded)}
            icon={Clock3}
          />
          <StatCard
            label="Expiring Soon"
            value={String(data.summary.expiringSoon)}
            icon={Clock3}
          />
          <StatCard
            label="Archived"
            value={String(data.summary.archived)}
            icon={FolderArchive}
          />
          <StatCard
            label="Restricted"
            value={String(data.summary.restricted)}
            icon={FileLock2}
          />
        </section>
      ) : null}

      <section className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setFilters(draftFilters);
          }}
          className="grid gap-3"
        >
          <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(14rem,2fr)_repeat(3,minmax(9rem,1fr))]">
            <label className="relative">
              <span className="sr-only">Search documents</span>
              <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#6C7A70]" />
              <input
                type="search"
                value={draftFilters.search}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Search title, file, reference, description, or keyword"
                className={`${fieldClass} pl-9`}
              />
            </label>
            <select
              aria-label="Category"
              value={draftFilters.category}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              className={fieldClass}
            >
              <option value="">All categories</option>
              {DOCUMENT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {humanizeConstant(item)}
                </option>
              ))}
            </select>
            <select
              aria-label="Document type"
              value={draftFilters.documentType}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  documentType: event.target.value,
                }))
              }
              className={fieldClass}
            >
              <option value="">All document types</option>
              {DOCUMENT_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              aria-label="Access level"
              value={draftFilters.accessLevel}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  accessLevel: event.target.value,
                }))
              }
              className={fieldClass}
            >
              <option value="">All access levels</option>
              {visibleAccess.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </form>
      </section>

      {error ? <ErrorState message={error} /> : null}
      {loading && !data ? <LoadingSkeleton /> : null}
      {!loading && data?.documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            activeFilterCount
              ? "No matching documents"
              : "No documents uploaded"
          }
          description={
            activeFilterCount
              ? "Clear or adjust the filters to see other cooperative files."
              : "Upload the first protected cooperative document to begin the register."
          }
        />
      ) : null}
      {data?.documents.length ? (
        <>
          <div className="hidden min-w-0 md:block">
            <DataTable>
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#53675A]">
                  <tr>
                    <th className="px-3 py-3 font-bold">Document</th>
                    <th className="px-3 py-3 font-bold">Reference</th>
                    <th className="px-3 py-3 font-bold">Category</th>
                    <th className="px-3 py-3 font-bold">Related Module</th>
                    <th className="px-3 py-3 font-bold">Access</th>
                    <th className="px-3 py-3 font-bold">Version</th>
                    <th className="px-3 py-3 font-bold">Status</th>
                    <th className="px-3 py-3 font-bold">Uploaded By</th>
                    <th className="px-3 py-3 font-bold">Updated</th>
                    <th className="px-3 py-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.documents.map((document) => (
                    <tr
                      key={document.id}
                      className="border-t border-[#E1E9E2] align-top"
                    >
                      <td className="px-3 py-3">
                        <div className="flex gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#E7F2E4] text-[#1F6B43]">
                            <FileText className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`${basePath}/documents/${document.id}`}
                              className="break-words font-bold text-[#123D2A] hover:underline"
                            >
                              {document.title}
                            </Link>
                            <p className="mt-1 truncate text-xs text-[#6C7A70]">
                              {document.fileName} ·{" "}
                              {formatFileSize(document.fileSizeBytes)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="break-all px-3 py-3 font-mono text-xs">
                        {document.reference}
                      </td>
                      <td className="px-3 py-3">
                        {humanizeConstant(document.category)}
                      </td>
                      <td className="px-3 py-3">
                        {document.relatedModule
                          ? humanizeConstant(document.relatedModule)
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge>
                          {accessLevelLabel(document.accessLevel)}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-3">v{document.currentVersion}</td>
                      <td className="px-3 py-3">
                        <StatusBadge tone={statusTone(document.status)}>
                          {humanizeConstant(document.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-3">
                        {document.uploadedBy}
                      </td>
                      <td className="px-3 py-3">
                        {formatDate(document.updatedAt, true)}
                      </td>
                      <td className="px-3 py-3">
                        <DocumentActions
                          document={document}
                          basePath={basePath}
                          onArchive={() => setArchiveTarget(document)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </div>
          <div className="grid gap-3 md:hidden">
            {data.documents.map((document) => (
              <article
                key={document.id}
                className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#E7F2E4] text-[#1F6B43]">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`${basePath}/documents/${document.id}`}
                      className="break-words font-black text-[#123D2A]"
                    >
                      {document.title}
                    </Link>
                    <p className="mt-1 break-all font-mono text-xs text-[#6C7A70]">
                      {document.reference}
                    </p>
                  </div>
                  <StatusBadge tone={statusTone(document.status)}>
                    {humanizeConstant(document.status)}
                  </StatusBadge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <MobileDetail
                    label="Category"
                    value={humanizeConstant(document.category)}
                  />
                  <MobileDetail
                    label="Access"
                    value={accessLevelLabel(document.accessLevel)}
                  />
                  <MobileDetail
                    label="Version"
                    value={`v${document.currentVersion}`}
                  />
                  <MobileDetail
                    label="Updated"
                    value={formatDate(document.updatedAt)}
                  />
                </dl>
                <div className="mt-4">
                  <DocumentActions
                    document={document}
                    basePath={basePath}
                    onArchive={() => setArchiveTarget(document)}
                    mobile
                  />
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#5D6D63]">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-md border border-[#CAD8CB] bg-white hover:bg-[#EEF2EC] disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="size-4" />
            </button>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-md border border-[#CAD8CB] bg-white hover:bg-[#EEF2EC] disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 font-medium">
              Page {page} of {totalPages} &middot; {data.total} document{data.total === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-md border border-[#CAD8CB] bg-white hover:bg-[#EEF2EC] disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-md border border-[#CAD8CB] bg-white hover:bg-[#EEF2EC] disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              <ChevronsRight className="size-4" />
            </button>
          </div>
        </>
      ) : null}

      <FormDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) setUploadStep(1);
        }}
        title={`Upload Document (Step ${uploadStep} of 2)`}
        description="The file is validated and stored outside public web paths. Access is enforced by the server."
        contentClassName="w-[min(48rem,calc(100vw-2rem))]"
      >
        <form onSubmit={submitUpload} ref={formRef}>
          <DocumentMetadataFields role={role} includeFile step={uploadStep} />
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {uploadStep === 1 ? (
              <>
                <button
                  key="btn-cancel"
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
                <button
                  key="btn-next"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (formRef.current?.reportValidity()) {
                      setUploadStep(2);
                    }
                  }}
                  className={primaryButtonClass}
                >
                  Next
                </button>
              </>
            ) : (
              <>
                <button
                  key="btn-back"
                  type="button"
                  onClick={() => setUploadStep(1)}
                  className={secondaryButtonClass}
                >
                  Back
                </button>
                <button key="btn-submit" disabled={uploading} className={primaryButtonClass}>
                  {uploading ? (
                    <BusyLabel label="Uploading..." />
                  ) : (
                    <>
                      <Upload className="size-4" /> Upload Document
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </FormDialog>

      <FormDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="More Filters"
        description="Refine your document search"
        contentClassName="w-[min(48rem,calc(100vw-2rem))]"
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FilterSelect
            label="Related module"
            value={draftFilters.relatedModule}
            onChange={(value) =>
              setDraftFilters((current) => ({
                ...current,
                relatedModule: value,
              }))
            }
            options={RELATED_MODULES.map((item) => ({
              value: item,
              label: humanizeConstant(item),
            }))}
          />
          <FilterSelect
            label="Status"
            value={draftFilters.status}
            onChange={(value) =>
              setDraftFilters((current) => ({ ...current, status: value }))
            }
            options={["ACTIVE", "EXPIRING_SOON", "EXPIRED", "ARCHIVED"].map(
              (item) => ({ value: item, label: humanizeConstant(item) }),
            )}
          />
          <FilterSelect
            label="Uploaded by"
            value={draftFilters.uploadedBy}
            onChange={(value) =>
              setDraftFilters((current) => ({
                ...current,
                uploadedBy: value,
              }))
            }
            options={(data?.filterOptions.uploaders ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
          <FilterSelect
            label="File type"
            value={draftFilters.fileType}
            onChange={(value) =>
              setDraftFilters((current) => ({
                ...current,
                fileType: value,
              }))
            }
            options={[
              "pdf",
              "doc",
              "docx",
              "xls",
              "xlsx",
              "csv",
              "jpg",
              "jpeg",
              "png",
            ].map((item) => ({ value: item, label: item.toUpperCase() }))}
          />
          <FilterDate
            label="Uploaded from"
            value={draftFilters.dateFrom}
            onChange={(value) =>
              setDraftFilters((current) => ({
                ...current,
                dateFrom: value,
              }))
            }
          />
          <FilterDate
            label="Uploaded to"
            value={draftFilters.dateTo}
            onChange={(value) =>
              setDraftFilters((current) => ({ ...current, dateTo: value }))
            }
          />
          <FilterDate
            label="Expires from"
            value={draftFilters.expirationFrom}
            onChange={(value) =>
              setDraftFilters((current) => ({
                ...current,
                expirationFrom: value,
              }))
            }
          />
          <FilterDate
            label="Expires to"
            value={draftFilters.expirationTo}
            onChange={(value) =>
              setDraftFilters((current) => ({
                ...current,
                expirationTo: value,
              }))
            }
          />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              setDraftFilters(emptyFilters);
              setFilters(emptyFilters);
              setPage(1);
              setFilterOpen(false);
            }}
          >
            Clear Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(draftFilters);
              setPage(1);
              setFilterOpen(false);
            }}
            className={primaryButtonClass}
          >
            <Filter className="size-4" /> Apply Filters
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
        title={
          archiveTarget?.status === "ARCHIVED"
            ? "Restore Document"
            : "Archive Document"
        }
        description={
          archiveTarget?.status === "ARCHIVED"
            ? `${archiveTarget?.title ?? "This document"} will return to the active register. All versions and history remain preserved.`
            : `${archiveTarget?.title ?? "This document"} will be hidden from the active register. The file, versions, and history will not be deleted.`
        }
      >
        {archiveTarget?.status !== "ARCHIVED" ? (
          <Field label="Archive reason" required>
            <textarea
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
              rows={3}
              className={`${fieldClass} py-3`}
            />
          </Field>
        ) : null}
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
            disabled={
              mutating ||
              (archiveTarget?.status !== "ARCHIVED" &&
                archiveReason.trim().length < 3)
            }
            onClick={() =>
              archiveTarget && void changeArchiveState(archiveTarget)
            }
            className={
              archiveTarget?.status === "ARCHIVED"
                ? primaryButtonClass
                : warningButtonClass
            }
          >
            {mutating ? (
              <BusyLabel label="Saving..." />
            ) : archiveTarget?.status === "ARCHIVED" ? (
              <>
                <ArchiveRestore className="size-4" /> Restore
              </>
            ) : (
              <>
                <Archive className="size-4" /> Archive
              </>
            )}
          </button>
        </div>
      </FormDialog>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      >
        <option value="">All</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function FilterDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </Field>
  );
}

function DocumentActions({
  document,
  basePath,
  onArchive,
  mobile,
}: {
  document: DocumentRecord;
  basePath: string;
  onArchive: () => void;
  mobile?: boolean;
}) {
  const preview = `/api/documents/${document.id}/file?action=preview`;
  const download = `/api/documents/${document.id}/file?action=download`;
  const print = `/api/documents/${document.id}/file?action=print`;
  if (mobile) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`${basePath}/documents/${document.id}`}
          className={secondaryButtonClass}
        >
          <FileText className="size-4" /> View
        </Link>
        <a href={download} className={secondaryButtonClass}>
          <Download className="size-4" /> Download
        </a>
        <a
          href={preview}
          target="_blank"
          rel="noreferrer"
          className={secondaryButtonClass}
        >
          <ShieldCheck className="size-4" /> Preview
        </a>
        <button
          type="button"
          onClick={onArchive}
          className={warningButtonClass}
        >
          {document.status === "ARCHIVED" ? (
            <ArchiveRestore className="size-4" />
          ) : (
            <Archive className="size-4" />
          )}
          {document.status === "ARCHIVED" ? "Restore" : "Archive"}
        </button>
      </div>
    );
  }
  const [open, setOpen] = useState(false);
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title="Document Actions"
      description=""
      trigger={
        <button
          type="button"
          aria-label={`Actions for ${document.title}`}
          className="grid size-10 cursor-pointer list-none place-items-center rounded-md border border-[#CAD8CB] hover:bg-[#EEF2EC]"
        >
          <MoreVertical className="size-4" />
        </button>
      }
    >
      <div className="grid gap-2">
        <Link
          href={`${basePath}/documents/${document.id}`}
          className={secondaryButtonClass}
        >
          <FileText className="size-4" /> View details
        </Link>
        <a
          href={preview}
          target="_blank"
          rel="noreferrer"
          className={secondaryButtonClass}
        >
          <ShieldCheck className="size-4" /> Preview
        </a>
        <a href={download} className={secondaryButtonClass}>
          <Download className="size-4" /> Download
        </a>
        <a
          href={print}
          target="_blank"
          rel="noreferrer"
          className={secondaryButtonClass}
        >
          <Printer className="size-4" /> Print
        </a>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onArchive();
          }}
          className={warningButtonClass}
        >
          {document.status === "ARCHIVED" ? (
            <ArchiveRestore className="size-4" />
          ) : (
            <Archive className="size-4" />
          )}
          {document.status === "ARCHIVED" ? "Restore" : "Archive"}
        </button>
      </div>
    </FormDialog>
  );
}

function MobileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold uppercase tracking-wide text-[#6C7A70]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-[#294B39]">{value}</dd>
    </div>
  );
}
