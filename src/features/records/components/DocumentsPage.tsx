"use client";

import Link from "next/link";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Download,
  Eye,
  FileLock2,
  FilePlus2,
  FileText,
  Filter,
  FolderArchive,
  LayoutGrid,
  List,
  MoreVertical,
  Printer,
  Search,
  ShieldCheck,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { expressApiUrl, expressFetch } from "@/lib/express-api";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FormDialog,
  ConfirmDialog,
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
import { ArchivedDocumentsModal } from "./ArchivedDocumentsModal";
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
import { useDebounce } from "@/hooks/useDebounce";

type Filters = {
  search: string;
  category: string;
  documentType: string;
  accessLevel: string;
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
  status: "ACTIVE",
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
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<1 | 2>(1);
  const formRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<DocumentRecord | null>(
    null,
  );
  const [archiveReason, setArchiveReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [confirmUpload, setConfirmUpload] = useState<FormData | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const debouncedSearch = useDebounce(draftFilters.search, 300);

  useEffect(() => {
    setFilters((current) => ({ ...current, search: debouncedSearch }));
    setPage(1);
  }, [debouncedSearch]);

  const load = useCallback(async () => {
    try {
      const response = await expressFetch(
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
    const form = event.currentTarget;
    const formData = new FormData(form);
    
    const title = String(formData.get("title") || "").trim();
    const category = String(formData.get("category") || "");
    const documentType = String(formData.get("documentType") || "");
    const accessLevel = String(formData.get("accessLevel") || "");
    const file = uploadFile;
    
    const errors: Record<string, string> = {};
    if (title.length < 2 || title.length > 255) errors.title = "Document title must contain 2 to 255 characters.";
    if (!category) errors.category = "Please select a category.";
    if (!documentType) errors.documentType = "Please select a document type.";
    if (!accessLevel) errors.accessLevel = "Please select an access level.";
    if (!file || file.size === 0) errors.file = "Please select a file to upload.";
    
    if (Object.keys(errors).length > 0) {
      setUploadErrors(errors);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    
    setUploadErrors({});
    formData.delete("file-dropzone");
    if (file) {
      formData.set("file", file);
    }
    setConfirmUpload(formData);
  }

  async function executeUpload() {
    if (!confirmUpload) return;
    setUploading(true);
    try {
      const response = await expressFetch("/api/documents", {
        method: "POST",
        body: confirmUpload,
      });
      if (!response.ok) throw new Error(await apiError(response));
      const result = (await response.json()) as { reference: string };
      toast.success(`${result.reference} uploaded successfully.`);
      setUploadOpen(false);
      setConfirmUpload(null);
      setUploadFile(null);
      setUploadErrors({});
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
      const response = await expressFetch(`/api/documents/${document.id}`, {
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

  async function handleBulkArchive() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Archive ${selectedIds.size} selected documents?`)) return;
    
    setMutating(true);
    let successCount = 0;
    
    for (const id of Array.from(selectedIds)) {
      try {
        const response = await expressFetch(`/api/documents/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive", reason: "Bulk archived" }),
        });
        if (response.ok) successCount++;
      } catch (err) {
        // Continue with others
      }
    }
    
    toast.success(`Archived ${successCount} documents.`);
    setSelectedIds(new Set());
    setMutating(false);
    await load();
  }

  async function handleBulkDownload() {
    if (selectedIds.size === 0) return;
    setIsZipping(true);
    const zip = new JSZip();
    let successCount = 0;

    try {
      const selectedDocs = data?.documents.filter(doc => selectedIds.has(doc.id)) || [];
      
      const downloadPromises = selectedDocs.map(async (doc) => {
        try {
          const response = await expressFetch(`/api/documents/${doc.id}/file?action=download`);
          if (!response.ok) throw new Error("Failed to fetch");
          const blob = await response.blob();
          zip.file(doc.fileName, blob);
          successCount++;
        } catch (err) {
          toast.error(`Failed to download ${doc.fileName}`);
        }
      });

      await Promise.all(downloadPromises);

      if (successCount > 0) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `documents_export_${new Date().toISOString().slice(0, 10)}.zip`);
        toast.success(`Downloaded ${successCount} documents.`);
      }
    } catch (err) {
      toast.error("An error occurred during bulk download.");
    } finally {
      setIsZipping(false);
      setSelectedIds(new Set());
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        eyebrow="Records"
        title="Documents"
        description="Manage cooperative files, access permissions, and document activity."
        actions={
          <div className="flex flex-col items-end gap-3">
            <div className="flex bg-[#F8FAF8] rounded-md border border-[#CAD8CB] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center justify-center rounded px-3 py-1.5 transition-colors ${viewMode === "table" ? "bg-white text-[#1F6B43] shadow-sm font-medium" : "text-[#6C7A70] hover:text-[#123D2A]"}`}
                aria-label="Table View"
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center justify-center rounded px-3 py-1.5 transition-colors ${viewMode === "grid" ? "bg-white text-[#1F6B43] shadow-sm font-medium" : "text-[#6C7A70] hover:text-[#123D2A]"}`}
                aria-label="Grid View"
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 justify-end">
              <a
                href={expressApiUrl(`/api/documents/export?${queryFor(filters)}`)}
                className={secondaryButtonClass}
              >
                <Download className="size-4" /> Export List
              </a>
              <button
                type="button"
                onClick={() => setArchiveModalOpen(true)}
                className={secondaryButtonClass}
              >
                <Archive className="size-4" /> Archived Documents
              </button>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className={primaryButtonClass}
              >
                <Upload className="size-4" /> Upload Document
              </button>
            </div>
          </div>
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
          <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(14rem,2fr)_repeat(4,minmax(9rem,1fr))]">
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
              onChange={(event) => {
                const val = event.target.value;
                setDraftFilters((current) => ({ ...current, category: val }));
                setFilters((current) => ({ ...current, category: val }));
                setPage(1);
              }}
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
              onChange={(event) => {
                const val = event.target.value;
                setDraftFilters((current) => ({ ...current, documentType: val }));
                setFilters((current) => ({ ...current, documentType: val }));
                setPage(1);
              }}
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
              onChange={(event) => {
                const val = event.target.value;
                setDraftFilters((current) => ({ ...current, accessLevel: val }));
                setFilters((current) => ({ ...current, accessLevel: val }));
                setPage(1);
              }}
              className={fieldClass}
            >
              <option value="">All access levels</option>
              {visibleAccess.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              aria-label="File type"
              value={draftFilters.fileType || ""}
              onChange={(event) => {
                const val = event.target.value;
                setDraftFilters((current) => ({ ...current, fileType: val }));
                setFilters((current) => ({ ...current, fileType: val }));
                setPage(1);
              }}
              className={fieldClass}
            >
              <option value="">All file types</option>
              <option value="pdf">PDF (.pdf)</option>
              <option value="docx">Word (.docx)</option>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="png">PNG (.png)</option>
              <option value="jpg">JPEG (.jpg)</option>
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
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-[#E7F2E4] p-3 text-sm font-medium text-[#123D2A]">
              <span>{selectedIds.size} document{selectedIds.size > 1 ? 's' : ''} selected</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBulkDownload}
                  disabled={isZipping}
                  className={`${secondaryButtonClass} bg-white`}
                >
                  <Download className="size-4" /> {isZipping ? 'Zipping...' : 'Download ZIP'}
                </button>
                <button
                  type="button"
                  onClick={handleBulkArchive}
                  disabled={mutating}
                  className={`${warningButtonClass} bg-white`}
                >
                  <Archive className="size-4" /> Archive
                </button>
              </div>
            </div>
          )}

          <div className="hidden min-w-0 md:block">
            {viewMode === "table" ? (
              <DataTable>
                <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-[#EEF2EC] text-xs uppercase tracking-wide text-[#53675A]">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === data.documents.length && data.documents.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(data.documents.map(d => d.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        className="rounded border-[#CAD8CB] text-[#1F6B43] focus:ring-[#1F6B43]"
                      />
                    </th>
                    <th className="px-3 py-3 font-bold">Document</th>
                    <th className="px-3 py-3 font-bold">Reference</th>
                    <th className="px-3 py-3 font-bold">Category</th>
                    <th className="px-3 py-3 font-bold">Access</th>
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
                        <input
                          type="checkbox"
                          checked={selectedIds.has(document.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedIds);
                            if (e.target.checked) newSet.add(document.id);
                            else newSet.delete(document.id);
                            setSelectedIds(newSet);
                          }}
                          className="rounded border-[#CAD8CB] text-[#1F6B43] focus:ring-[#1F6B43]"
                        />
                      </td>
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
                        <StatusBadge>
                          {accessLevelLabel(document.accessLevel)}
                        </StatusBadge>
                      </td>
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
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.documents.map((document) => {
                  const previewUrl = expressApiUrl(`/api/documents/${document.id}/file?action=preview`);
                  const isImage = document.mimeType?.startsWith("image/");
                  return (
                    <div key={document.id} className="relative flex flex-col overflow-hidden rounded-lg border border-[#CAD8CB] bg-white transition-shadow hover:shadow-md">
                      <div className="absolute top-2 left-2 z-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(document.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedIds);
                            if (e.target.checked) newSet.add(document.id);
                            else newSet.delete(document.id);
                            setSelectedIds(newSet);
                          }}
                          className="rounded border-[#CAD8CB] bg-white text-[#1F6B43] focus:ring-[#1F6B43] shadow-sm"
                        />
                      </div>
                      <div className="absolute top-2 right-2 z-10">
                        <DocumentActions document={document} basePath={basePath} onArchive={() => setArchiveTarget(document)} mobile />
                      </div>
                      <div className="aspect-[4/3] bg-[#F8FAF8] border-b border-[#E1E9E2] flex items-center justify-center relative">
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previewUrl} alt={document.title} className="object-cover w-full h-full" />
                        ) : (
                          <FileText className="size-16 text-[#CAD8CB]" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <Link href={`${basePath}/documents/${document.id}`} className="font-bold text-[#123D2A] hover:underline line-clamp-1 mb-1">
                          {document.title}
                        </Link>
                        <div className="flex items-center gap-2 mb-2">
                          <StatusBadge tone={statusTone(document.status)}>
                            {humanizeConstant(document.status)}
                          </StatusBadge>
                        </div>
                        <div className="text-xs text-[#5D6D63] mt-auto">
                          <p>Uploaded: {formatDate(document.uploadedAt)}</p>
                          <p className="truncate">By: {document.uploadedBy}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
          if (!open) {
            setUploadFile(null);
            setUploadErrors({});
          }
        }}
        title="Upload Document"
        description="The file is validated and stored outside public web paths. Access is enforced by the server."
        contentClassName="w-[min(48rem,calc(100vw-2rem))]"
      >
        <form onSubmit={submitUpload} noValidate>
          <DocumentMetadataFields 
            role={role} 
            includeFile 
            errors={uploadErrors} 
            file={uploadFile}
            onFileChange={setUploadFile}
          />
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setUploadOpen(false)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button type="submit" disabled={uploading} className={primaryButtonClass}>
              Review Document
            </button>
          </div>
        </form>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(confirmUpload)}
        onOpenChange={(open) => {
          if (!open) setConfirmUpload(null);
        }}
        title="Upload Document"
        description="Are you sure you want to upload this document? It will be immediately available to members based on its access level."
        confirmLabel={uploading ? "Uploading..." : "Confirm Upload"}
        onConfirm={executeUpload}
      />

      <ArchivedDocumentsModal
        open={archiveModalOpen}
        onOpenChange={setArchiveModalOpen}
        basePath={basePath}
        onRestoreSuccess={() => {
          load();
        }}
      />

      <FormDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="More Filters"
        description="Refine your document search"
        contentClassName="w-[min(48rem,calc(100vw-2rem))]"
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

      <ConfirmDialog
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
              ? `${archiveTarget?.title ?? "This document"} will return to the active register. All history remains preserved.`
              : `${archiveTarget?.title ?? "This document"} will be hidden from the active register. The file and history will not be deleted.`
          }
          confirmLabel={
            mutating
              ? "Saving..."
              : archiveTarget?.status === "ARCHIVED"
                ? "Confirm Restore"
                : "Confirm Archive"
          }
          onConfirm={() => {
            if (archiveTarget?.status !== "ARCHIVED" && archiveReason.trim().length < 3) {
              toast.error("Please provide a valid archive reason.");
              return;
            }
            archiveTarget && changeArchiveState(archiveTarget);
          }}
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
        </ConfirmDialog>
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
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const download = expressApiUrl(`/api/documents/${document.id}/file?action=download`);
  const previewUrl = expressApiUrl(`/api/documents/${document.id}/file?action=preview`);

  const triggerButton = mobile ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`${secondaryButtonClass} w-full`}
    >
      <FileText className="size-4" /> View Details
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={`View details for ${document.title}`}
      className="grid size-10 cursor-pointer list-none place-items-center rounded-md border border-[#CAD8CB] hover:bg-[#EEF2EC]"
    >
      <MoreVertical className="size-4" />
    </button>
  );

  return (
    <>
      {mobile && (
        <div className="grid grid-cols-2 gap-2">
          {triggerButton}
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
      )}
      {!mobile && triggerButton}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Document Details"
        description=""
        contentClassName="w-[min(42rem,calc(100vw-2rem))]"
      >
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-xl border border-[#E7F2E4] bg-[#F8FAF8] p-5">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#1F6B43]">Document Title</h3>
            <p className="mt-2 text-2xl font-black text-[#123D2A]">{document.title}</p>
            <p className="mt-2 text-sm text-[#5D6D63]">
              {document.description || <span className="italic opacity-70">No description provided.</span>}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">Reference</h3>
            <p className="mt-1 font-mono text-sm font-medium text-[#294B39]">{document.reference}</p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">Category & Type</h3>
            <p className="mt-1 text-sm font-medium text-[#294B39]">
              {humanizeConstant(document.category)} <span className="mx-1 text-[#CAD8CB]">•</span> {document.documentType}
            </p>
          </div>

          <div className="sm:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">File Information</h3>
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-[#CAD8CB] p-3">
              <div className="grid size-10 shrink-0 place-items-center rounded bg-[#EEF2EC] text-[#1F6B43]">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#123D2A]">{document.fileName}</p>
                <p className="text-xs text-[#5D6D63]">{formatFileSize(document.fileSizeBytes)}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">Uploaded By</h3>
            <p className="mt-1 text-sm text-[#294B39]">
              <span className="font-semibold">{document.uploadedBy}</span>
              <br />
              <span className="text-xs text-[#5D6D63]">{formatDate(document.uploadedAt)}</span>
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6C7A70]">Access & Status</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge>{accessLevelLabel(document.accessLevel)}</StatusBadge>
              <StatusBadge tone={statusTone(document.status)}>
                {humanizeConstant(document.status)}
              </StatusBadge>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-[#CAD8CB] pt-5 sm:flex-row sm:justify-end">
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
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className={secondaryButtonClass}
          >
            <Eye className="size-4" /> Preview
          </button>
          <a href={download} className={primaryButtonClass}>
            <Download className="size-4" /> Download
          </a>
        </div>
      </FormDialog>

      <FormDialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setZoomLevel(1);
        }}
        title={`Preview: ${document.title}`}
        description=""
        contentClassName="w-[min(64rem,calc(100vw-2rem))] h-[85vh] flex flex-col"
        bodyClassName="flex-1 flex flex-col min-h-0"
      >
        <div className="flex-1 min-h-0 mt-4 overflow-auto rounded-lg border border-[#CAD8CB] bg-black/5 flex items-center justify-center relative">
          {document.mimeType?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`Preview of ${document.title}`}
              className="max-w-full max-h-full transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})` }}
            />
          ) : (
            <iframe
              src={previewUrl}
              className="w-full h-full"
              title={`Preview of ${document.title}`}
            />
          )}
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <div>
            {document.mimeType?.startsWith("image/") && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}
                  className={secondaryButtonClass}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className={secondaryButtonClass}
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((prev) => Math.min(3, prev + 0.25))}
                  className={secondaryButtonClass}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="size-4" />
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPreviewOpen(false)} className={secondaryButtonClass}>
              Close
            </button>
            <a href={download} className={primaryButtonClass}>
              <Download className="size-4" /> Download Original
            </a>
          </div>
        </div>
      </FormDialog>
    </>
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
