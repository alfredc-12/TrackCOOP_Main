"use client";

import {
  Check,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  ImageIcon,
  Images,
  LayoutGrid,
  Layers,
  MapPin,
  Palette,
  Pencil,
  Plus,
  Star,
  Trash2,
  RefreshCcw,
  Save,
  Search,
  UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { PageHeader } from "@/components/portal/PageHeader";
import { ConfirmDialog, DataTable, EmptyState, ErrorState, FormDialog, LoadingSkeleton, StatusBadge } from "@/components/portal/PortalPrimitives";
import { env } from "@/config/env";
import { ApiClientError } from "@/lib/api-client";
import {
  createLandingRecord,
  listAuditLogs,
  listLandingRecords,
  listSystemSettings,
  saveSystemSetting,
  updateLandingRecord,
  saveGalleryLandingSlot,
  uploadGalleryImages,
  uploadPartnerCertificationFile,
  type LandingCollection,
  type LandingRecord,
} from "./landing-admin-api";

type LandingAdminCollectionViewProps = {
  collection: LandingCollection;
  eyebrow: string;
  title: string;
  description: string;
  template: Record<string, unknown>;
  statusKey: string;
  primaryKey: string;
};

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonInput(value: string) {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Input must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback) || fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function fileNameWithoutExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function isPdfPath(path: string) {
  return path.toLowerCase().split("?")[0].endsWith(".pdf");
}

function resolveUploadPath(path: string) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:") || path.startsWith("data:") || path.startsWith("/images/")) return path;
  return `${env.apiUrl}${path}`;
}

function isAllowedPartnerFile(file: File) {
  return file.type.startsWith("image/") || file.type === "application/pdf";
}

function Toolbar({
  search,
  setSearch,
  onRefresh,
}: {
  search: string;
  setSearch: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block w-full max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
          placeholder="Search records"
          type="search"
        />
      </label>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
      >
        <RefreshCcw className="size-4" />
        Refresh
      </button>
    </div>
  );
}

type PartnerFileDraft = {
  file: File;
  name: string;
  previewUrl: string;
};

function PartnerFilePreview({
  path,
  name,
  isPdf,
  className = "",
}: {
  path: string;
  name: string;
  isPdf?: boolean;
  className?: string;
}) {
  const resolved = resolveUploadPath(path);

  if (!resolved) {
    return (
      <div className={`grid place-items-center bg-[#EAF3E8] text-[#1F6B43] ${className}`}>
        <FileText className="size-16" aria-hidden="true" />
      </div>
    );
  }

  if (isPdf || isPdfPath(resolved)) {
    return (
      <div className={`grid place-items-center bg-[#123D2A] text-white ${className}`}>
        <div className="grid justify-items-center gap-3 px-6 text-center">
          <span className="grid size-20 place-items-center rounded-2xl bg-white/12 text-[#F2C94C]">
            <FileText className="size-10" aria-hidden="true" />
          </span>
          <span className="line-clamp-2 text-sm font-black">{name}</span>
          <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/72">
            PDF
          </span>
        </div>
      </div>
    );
  }

  return <img src={resolved} alt={name} className={`bg-white object-contain ${className}`} />;
}

function PartnersCertificationsManager({
  eyebrow,
  title,
  description,
}: Pick<LandingAdminCollectionViewProps, "eyebrow" | "title" | "description">) {
  const [records, setRecords] = useState<LandingRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isUploadDropActive, setIsUploadDropActive] = useState(false);
  const [uploadDraft, setUploadDraft] = useState<PartnerFileDraft | null>(null);
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LandingRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState("");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => asNumber(a.displayOrder) - asNumber(b.displayOrder) || Number(b.id) - Number(a.id)),
    [records],
  );
  const totalSlides = Math.max(1, sortedRecords.length + 1);
  const boundedCurrentIndex = Math.min(currentIndex, Math.max(totalSlides - 1, 0));

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setRecords(await listLandingRecords("partners"));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Certification records could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 150);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    return () => {
      if (uploadDraft?.previewUrl) URL.revokeObjectURL(uploadDraft.previewUrl);
      if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    };
  }, [editPreviewUrl, uploadDraft?.previewUrl]);

  function openUploadDraft(file: File) {
    if (!isAllowedPartnerFile(file)) {
      setError("Please upload a PDF or image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Please upload a file smaller than 10MB.");
      return;
    }
    if (uploadDraft?.previewUrl) URL.revokeObjectURL(uploadDraft.previewUrl);
    setUploadDraft({
      file,
      name: fileNameWithoutExtension(file.name) || "Certification",
      previewUrl: URL.createObjectURL(file),
    });
    setError("");
  }

  function handleUploadDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsUploadDropActive(false);
    const file = event.dataTransfer.files[0];
    if (file) openUploadDraft(file);
  }

  async function createFromUpload() {
    if (!uploadDraft) return;
    setIsSaving(true);
    setError("");
    try {
      const uploaded = await uploadPartnerCertificationFile(uploadDraft.file);
      await createLandingRecord("partners", {
        recordType: "Certification",
        name: uploadDraft.name.trim(),
        description: "",
        logoPath: uploaded.url,
        externalUrl: "",
        issuedDate: null,
        expirationDate: null,
        publicVisibility: true,
        status: "Active",
        displayOrder: sortedRecords.length,
      });
      URL.revokeObjectURL(uploadDraft.previewUrl);
      setUploadDraft(null);
      setConfirmUploadOpen(false);
      setCurrentIndex(sortedRecords.length);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Certification could not be uploaded.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(record: LandingRecord) {
    setEditingRecord(record);
    setEditName(asString(record.name, "Certification"));
    setEditFile(null);
    if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    setEditPreviewUrl("");
  }

  function selectEditFile(file: File) {
    if (!isAllowedPartnerFile(file)) {
      setError("Please upload a PDF or image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Please upload a file smaller than 10MB.");
      return;
    }
    if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    setEditFile(file);
    setEditPreviewUrl(URL.createObjectURL(file));
    setError("");
  }

  async function saveEdit() {
    if (!editingRecord) return;
    setIsSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { name: editName.trim() };
      if (editFile) {
        const uploaded = await uploadPartnerCertificationFile(editFile);
        payload.logoPath = uploaded.url;
      }
      await updateLandingRecord("partners", editingRecord.id, payload);
      setEditingRecord(null);
      setEditFile(null);
      if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
      setEditPreviewUrl("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Certification could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleVisibility(record: LandingRecord) {
    setIsSaving(true);
    setError("");
    try {
      await updateLandingRecord("partners", record.id, {
        publicVisibility: !asBoolean(record.publicVisibility, true),
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Visibility could not be changed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function reorderRecords(fromId: string | null, toId: string) {
    if (!fromId || fromId === toId) return;
    const fromIndex = sortedRecords.findIndex((record) => record.id === fromId);
    const toIndex = sortedRecords.findIndex((record) => record.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextRecords = [...sortedRecords];
    const [moved] = nextRecords.splice(fromIndex, 1);
    nextRecords.splice(toIndex, 0, moved);
    setRecords(nextRecords.map((record, index) => ({ ...record, displayOrder: index })));
    setCurrentIndex(toIndex);

    try {
      await Promise.all(
        nextRecords.map((record, index) =>
          updateLandingRecord("partners", record.id, { displayOrder: index }),
        ),
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order could not be saved.");
      await load();
    }
  }

  function getSlidePosition(index: number) {
    const previous = (boundedCurrentIndex - 1 + totalSlides) % totalSlides;
    const next = (boundedCurrentIndex + 1) % totalSlides;
    if (index === boundedCurrentIndex) return "active";
    if (index === previous) return "previous";
    if (index === next) return "next";
    return "hidden";
  }

  function getSlideStyle(position: string) {
    const styles = {
      active: { transform: "translateX(0) scale(1) rotateY(0deg)", opacity: 1, zIndex: 30 },
      previous: { transform: "translateX(-72%) scale(0.84) rotateY(34deg)", opacity: 0.72, zIndex: 20 },
      next: { transform: "translateX(72%) scale(0.84) rotateY(-34deg)", opacity: 0.72, zIndex: 20 },
      hidden: { transform: "translateX(0) scale(0.68)", opacity: 0, zIndex: 0 },
    };
    return styles[position as keyof typeof styles];
  }

  const activeRecord = sortedRecords[boundedCurrentIndex] ?? null;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<StatusBadge tone="success">Carousel editor</StatusBadge>}
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="overflow-hidden rounded-lg border border-[#CAD8CB] bg-[#F8F1E5] p-3 shadow-[0_18px_44px_rgba(18,61,42,0.08)] sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black leading-tight text-[#123D2A]">Certification carousel</h2>
            <p className="mt-0.5 text-xs leading-5 text-[#5D6D63]">Upload, rename, reorder, and hide public files.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentIndex((index) => (index - 1 + totalSlides) % totalSlides)}
              className="grid size-9 place-items-center rounded-full border border-[#CAD8CB] bg-white text-[#123D2A] transition hover:bg-[#EEF2EC]"
              aria-label="Previous carousel item"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex((index) => (index + 1) % totalSlides)}
              className="grid size-9 place-items-center rounded-full border border-[#CAD8CB] bg-white text-[#123D2A] transition hover:bg-[#EEF2EC]"
              aria-label="Next carousel item"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6"><LoadingSkeleton /></div>
        ) : (
          <>
            <div className="relative mt-3 h-[36rem] perspective-[1200px] sm:h-[39rem] xl:h-[40rem]">
              {sortedRecords.map((record, index) => {
                const name = asString(record.name, "Certification");
                const path = asString(record.logoPath);
                const visible = asBoolean(record.publicVisibility, true);
                const position = getSlidePosition(index);
                const isActive = position === "active";

                return (
                  <article
                    key={record.id}
                    draggable
                    aria-hidden={!isActive}
                    onDoubleClick={() => beginEdit(record)}
                    onClick={() => setCurrentIndex(index)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", record.id);
                      setDraggedId(record.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      void reorderRecords(draggedId, record.id);
                      setDraggedId(null);
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    className="absolute inset-x-0 top-0 mx-auto cursor-grab overflow-hidden rounded-[22px] border border-[#DDE8D8] bg-white shadow-2xl shadow-[#123D2A]/12 transition-[transform,opacity] duration-700 ease-out active:cursor-grabbing"
                    style={{
                      ...getSlideStyle(position),
                      transformOrigin: "center center",
                      width: "min(76vw, 29rem)",
                      aspectRatio: "3 / 4",
                    }}
                  >
                    <PartnerFilePreview path={path} name={name} className="h-full w-full" />
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-[#03291d]/64 to-transparent p-4 text-white">
                      <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white/18 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] ring-1 ring-white/20 backdrop-blur-md">
                        <GripVertical className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">Order {index + 1}</span>
                      </span>
                      <StatusBadge tone={visible ? "success" : "neutral"}>{visible ? "Visible" : "Hidden"}</StatusBadge>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#03291d]/88 via-[#03291d]/54 to-transparent p-5 text-white">
                      <h3 className="line-clamp-2 text-2xl font-black leading-tight">{name}</h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginEdit(record);
                          }}
                          className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-xs font-black text-[#123D2A] transition hover:bg-[#F2C94C]"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleVisibility(record);
                          }}
                          className="inline-flex h-9 items-center gap-2 rounded-full border border-white/25 bg-white/14 px-3 text-xs font-black text-white backdrop-blur transition hover:bg-white hover:text-[#123D2A]"
                        >
                          {visible ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
                          {visible ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              <article
                aria-hidden={boundedCurrentIndex !== sortedRecords.length}
                onClick={() => uploadInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsUploadDropActive(true);
                }}
                onDragLeave={() => setIsUploadDropActive(false)}
                onDrop={handleUploadDrop}
                className={`absolute inset-x-0 top-0 mx-auto grid cursor-pointer place-items-center overflow-hidden rounded-[22px] border border-dashed bg-white shadow-2xl shadow-[#123D2A]/12 transition-[transform,opacity,border-color,background] duration-700 ease-out ${
                  isUploadDropActive ? "border-[#1F6B43] bg-[#EAF3E8]" : "border-[#B8CAB9]"
                }`}
                style={{
                  ...getSlideStyle(getSlidePosition(sortedRecords.length)),
                  transformOrigin: "center center",
                  width: "min(76vw, 29rem)",
                  aspectRatio: "3 / 4",
                }}
              >
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) openUploadDraft(file);
                    event.target.value = "";
                  }}
                />
                <div className="grid justify-items-center gap-4 px-8 text-center">
                  <span className="grid size-20 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
                    <Plus className="size-9" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-2xl font-black text-[#123D2A]">Upload file</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5D6D63]">Drop a certification photo/PDF here or click to choose one.</p>
                  </div>
                  <span className="rounded-full bg-[#F7F8F3] px-3 py-1 text-xs font-black text-[#365F4A]">PDF, PNG, JPG, WebP up to 10MB</span>
                </div>
              </article>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2">
              {Array.from({ length: totalSlides }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Go to carousel item ${index + 1}`}
                  aria-current={boundedCurrentIndex === index ? "true" : undefined}
                  onClick={() => setCurrentIndex(index)}
                  className={`size-2.5 rounded-full transition ${
                    boundedCurrentIndex === index ? "w-8 bg-[#123D2A]" : "bg-[#C9D8C8]"
                  }`}
                />
              ))}
            </div>

            {activeRecord ? (
              <p className="mt-2 text-center text-xs font-semibold text-[#5D6D63]">
                Double-click the active card to edit its name or replace its file.
              </p>
            ) : null}
          </>
        )}
      </section>

      <FormDialog
        open={Boolean(uploadDraft)}
        onOpenChange={(open) => {
          if (!open && uploadDraft) {
            URL.revokeObjectURL(uploadDraft.previewUrl);
            setUploadDraft(null);
          }
        }}
        title="Name uploaded file"
        description="Only the name and uploaded file are required."
      >
        {uploadDraft ? (
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!uploadDraft.name.trim()) {
                setError("Please enter a name for the file.");
                return;
              }
              setConfirmUploadOpen(true);
            }}
          >
            <div className="overflow-hidden rounded-lg border border-[#CAD8CB]">
              <PartnerFilePreview
                path={uploadDraft.previewUrl}
                name={uploadDraft.name}
                isPdf={uploadDraft.file.type === "application/pdf"}
                className="h-64 w-full"
              />
            </div>
            <label className="grid gap-2 text-sm font-black text-[#123D2A]">
              Name
              <input
                value={uploadDraft.name}
                onChange={(event) => setUploadDraft({ ...uploadDraft, name: event.target.value })}
                className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
                placeholder="Certificate name"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(uploadDraft.previewUrl);
                  setUploadDraft(null);
                }}
                className="h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#294B39] transition hover:bg-[#EEF2EC]"
              >
                Cancel
              </button>
              <button type="submit" className="h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white transition hover:bg-[#1F6B43]">
                Continue
              </button>
            </div>
          </form>
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={confirmUploadOpen}
        onOpenChange={setConfirmUploadOpen}
        title="Upload file?"
        description="This will add the file to the public certification carousel."
        confirmLabel={isSaving ? "Uploading..." : "Upload"}
        onConfirm={() => void createFromUpload()}
      />

      <FormDialog
        open={Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRecord(null);
            setEditFile(null);
            if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
            setEditPreviewUrl("");
          }
        }}
        title="Edit carousel item"
        description="Update the display name or replace the uploaded file."
      >
        {editingRecord ? (
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveEdit();
            }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => editInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") editInputRef.current?.click();
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) selectEditFile(file);
              }}
              className="overflow-hidden rounded-lg border border-dashed border-[#B8CAB9] bg-[#F7F8F3] outline-none transition focus:ring-4 focus:ring-[#82E6A7]/20"
            >
              <input
                ref={editInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) selectEditFile(file);
                  event.target.value = "";
                }}
              />
              <PartnerFilePreview
                path={editPreviewUrl || asString(editingRecord.logoPath)}
                name={editName}
                isPdf={editFile?.type === "application/pdf"}
                className="h-64 w-full"
              />
              <div className="flex items-center justify-center gap-2 border-t border-[#CAD8CB] bg-white px-3 py-3 text-sm font-bold text-[#123D2A]">
                <UploadCloud className="size-4" aria-hidden="true" />
                Drop or click to replace file
              </div>
            </div>
            <label className="grid gap-2 text-sm font-black text-[#123D2A]">
              Name
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
                placeholder="Certificate name"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#294B39] transition hover:bg-[#EEF2EC]"
              >
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-60">
                <Check className="size-4" aria-hidden="true" />
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        ) : null}
      </FormDialog>
    </div>
  );
}

const GALLERY_SLOTS = [
  { key: "gallery-feature-1", label: "Feature 1" },
  { key: "gallery-feature-2", label: "Feature 2" },
  { key: "gallery-feature-3", label: "Feature 3" },
  { key: "gallery-feature-4", label: "Feature 4" },
  { key: "gallery-feature-5", label: "Feature 5" },
  { key: "gallery-feature-6", label: "Feature 6" },
];

const GROUP_BORDER_COLORS = ["#D8B04C", "#1F6B43", "#7A9E7E", "#B85C38", "#476C9B", "#8A6F42"];

type GalleryImageRecord = LandingRecord & {
  imagePath?: string;
  thumbnailPath?: string | null;
  altText?: string | null;
  sortOrder?: number;
  isCover?: boolean;
  publicVisibility?: boolean;
};

type GalleryDraftImage = {
  id: string;
  existingId?: string;
  file?: File;
  path?: string;
  src: string;
  name: string;
  isCover: boolean;
};

function getGalleryImages(record: LandingRecord): GalleryImageRecord[] {
  return Array.isArray(record.images) ? record.images as GalleryImageRecord[] : [];
}

function getGallerySlots(record: LandingRecord) {
  return Array.isArray(record.landingSlots) ? record.landingSlots as LandingRecord[] : [];
}

function imageNameFromPath(path: string) {
  const clean = decodeURIComponent(path.split("?")[0] ?? path);
  return fileNameWithoutExtension(clean.split("/").pop() ?? "Gallery photo") || "Gallery photo";
}

function formatGalleryDate(value: unknown) {
  if (!value) return "No date";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function getGroupDate(record: LandingRecord) {
  return new Date(String(record.activityDate || record.createdAt || Date.now()));
}

function getDateSection(date: Date) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.floor((startToday - target) / 86400000);
  if (days <= 0) return "Today";
  if (days < 7) return "This week";
  if (days < 31) return "This month";
  return "Older";
}

function GalleryDeckPreview({
  images,
  title,
  borderColor,
  compact = false,
}: {
  images: GalleryImageRecord[];
  title: string;
  borderColor: string;
  compact?: boolean;
}) {
  const visibleImages = images.slice(0, compact ? 3 : 5);
  if (!visibleImages.length) {
    return (
      <div className="grid h-full min-h-40 place-items-center rounded-lg border border-dashed border-[#B8CAB9] bg-[#F7F8F3] text-[#1F6B43]">
        <ImageIcon className="size-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={`relative ${compact ? "h-32" : "h-52 sm:h-60"} min-w-0`}>
      {visibleImages.map((image, index) => (
        <div
          key={String(image.id ?? image.imagePath ?? index)}
          className="absolute top-0 overflow-hidden rounded-lg bg-white shadow-[0_14px_28px_rgba(18,61,42,0.16)] transition duration-300 ease-out group-hover/gallery:-translate-y-2"
          style={{
            left: `${index * (compact ? 22 : 30)}px`,
            zIndex: index + 1,
            width: compact ? "7.8rem" : "min(15rem, calc(100% - 8rem))",
            height: compact ? "8rem" : "100%",
            border: `2px solid ${borderColor}`,
            transform: `rotate(${(index - 1) * 2}deg)`,
            transitionDelay: `${index * 24}ms`,
          }}
        >
          <img
            src={resolveUploadPath(asString(image.imagePath))}
            alt={asString(image.altText, title)}
            className="h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}

function GalleryAdminManager({
  eyebrow,
  title,
  description,
}: Pick<LandingAdminCollectionViewProps, "eyebrow" | "title" | "description">) {
  const [records, setRecords] = useState<LandingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LandingRecord | null>(null);
  const [previewRecord, setPreviewRecord] = useState<LandingRecord | null>(null);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [slotGroupId, setSlotGroupId] = useState("");
  const [slotImageId, setSlotImageId] = useState("");
  const [titleValue, setTitleValue] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("Community");
  const [location, setLocation] = useState("Nasugbu, Batangas");
  const [activityDate, setActivityDate] = useState("");
  const [borderColor, setBorderColor] = useState(GROUP_BORDER_COLORS[0]);
  const [publicVisibility, setPublicVisibility] = useState(true);
  const [galleryStatus, setGalleryStatus] = useState<"Draft" | "Published" | "Archived">("Published");
  const [photoDrafts, setPhotoDrafts] = useState<GalleryDraftImage[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [draggedDraftId, setDraggedDraftId] = useState<string | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => asNumber(a.displayOrder) - asNumber(b.displayOrder) || Number(b.id) - Number(a.id)),
    [records],
  );

  const slotsByKey = useMemo(() => {
    const map = new Map<string, LandingRecord & { group: LandingRecord; image?: GalleryImageRecord }>();
    for (const record of sortedRecords) {
      const images = getGalleryImages(record);
      for (const slot of getGallerySlots(record)) {
        const key = asString(slot.slotKey || slot.id);
        const image = images.find((item) => String(item.id) === String(slot.galleryImageId));
        if (key) map.set(key, { ...slot, group: record, image });
      }
    }
    return map;
  }, [sortedRecords]);

  const groupedRecords = useMemo(() => {
    const sections = new Map<string, LandingRecord[]>([
      ["Today", []],
      ["This week", []],
      ["This month", []],
      ["Older", []],
    ]);
    for (const record of sortedRecords) {
      const section = getDateSection(getGroupDate(record));
      sections.get(section)?.push(record);
    }
    return [...sections.entries()].filter(([, items]) => items.length > 0);
  }, [sortedRecords]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setRecords(await listLandingRecords("gallery"));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Gallery records could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 150);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    return () => {
      for (const draft of photoDrafts) {
        if (draft.file) URL.revokeObjectURL(draft.src);
      }
    };
  }, [photoDrafts]);

  function resetForm() {
    for (const draft of photoDrafts) {
      if (draft.file) URL.revokeObjectURL(draft.src);
    }
    setEditingRecord(null);
    setTitleValue("");
    setCaption("");
    setCategory("Community");
    setLocation("Nasugbu, Batangas");
    setActivityDate("");
    setBorderColor(GROUP_BORDER_COLORS[0]);
    setPublicVisibility(true);
    setGalleryStatus("Published");
    setPhotoDrafts([]);
    setActivePhotoIndex(0);
    setDraggedDraftId(null);
    setIsDropActive(false);
  }

  function addPhotoFiles(files: FileList | File[] | null) {
    const nextFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!nextFiles.length) return;
    const invalid = nextFiles.find((file) => file.size > 10 * 1024 * 1024);
    if (invalid) {
      setError("Please upload images smaller than 10MB each.");
      return;
    }
    setPhotoDrafts((current) => [
      ...current,
      ...nextFiles.map((file, index) => ({
        id: `new-${Date.now()}-${index}-${file.name}`,
        file,
        src: URL.createObjectURL(file),
        name: fileNameWithoutExtension(file.name) || "Gallery photo",
        isCover: current.length === 0 && index === 0,
      })),
    ]);
    setError("");
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(record: LandingRecord) {
    resetForm();
    setEditingRecord(record);
    setTitleValue(asString(record.title, "Gallery group"));
    setCaption(asString(record.caption));
    setCategory(asString(record.category, "Community"));
    setLocation(asString(record.location, "Nasugbu, Batangas"));
    setActivityDate(asString(record.activityDate).slice(0, 10));
    setBorderColor(asString(record.borderColor, GROUP_BORDER_COLORS[0]));
    setPublicVisibility(asBoolean(record.publicVisibility, true));
    setGalleryStatus(asString(record.galleryStatus, "Published") as "Draft" | "Published" | "Archived");
    const images = getGalleryImages(record);
    setPhotoDrafts(images.map((image, index) => ({
      id: String(image.id ?? image.imagePath ?? index),
      existingId: String(image.id ?? ""),
      path: asString(image.imagePath),
      src: resolveUploadPath(asString(image.imagePath)),
      name: asString(image.altText, imageNameFromPath(asString(image.imagePath))),
      isCover: asBoolean(image.isCover, index === 0),
    })));
    setActivePhotoIndex(0);
    setModalOpen(true);
  }

  function reorderDrafts(fromId: string | null, toId: string) {
    if (!fromId || fromId === toId) return;
    setPhotoDrafts((current) => {
      const fromIndex = current.findIndex((draft) => draft.id === fromId);
      const toIndex = current.findIndex((draft) => draft.id === toId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((draft, index) => ({ ...draft, isCover: draft.isCover || index === 0 }));
    });
  }

  function removeDraft(id: string) {
    setPhotoDrafts((current) => {
      const removed = current.find((draft) => draft.id === id);
      if (removed?.file) URL.revokeObjectURL(removed.src);
      const next = current.filter((draft) => draft.id !== id);
      return next.map((draft, index) => ({ ...draft, isCover: index === 0 ? true : draft.isCover && !removed?.isCover }));
    });
    setActivePhotoIndex((index) => Math.max(0, index - 1));
  }

  async function saveGroup() {
    if (titleValue.trim().length < 2) {
      setError("Please enter a gallery title.");
      return;
    }
    if (!photoDrafts.length) {
      setError("Please upload at least one gallery photo.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const newDrafts = photoDrafts.filter((draft): draft is GalleryDraftImage & { file: File } => Boolean(draft.file));
      const uploadedByDraftId = new Map<string, string>();
      if (newDrafts.length) {
        const uploaded = await uploadGalleryImages(newDrafts.map((draft) => draft.file));
        newDrafts.forEach((draft, index) => {
          const uploadedPath = uploaded.urls[index] ?? uploaded.files[index]?.url;
          if (uploadedPath) uploadedByDraftId.set(draft.id, uploadedPath);
        });
      }

      const images = photoDrafts.map((draft, index) => ({
        id: draft.existingId || undefined,
        imagePath: draft.path ?? uploadedByDraftId.get(draft.id) ?? "",
        thumbnailPath: draft.path ?? uploadedByDraftId.get(draft.id) ?? "",
        altText: draft.name,
        sortOrder: index,
        isCover: draft.isCover || index === 0,
        publicVisibility: true,
      })).filter((image) => image.imagePath);

      const payload = {
        title: titleValue.trim(),
        caption: caption.trim() || null,
        category: category.trim() || null,
        activityDate: activityDate || null,
        location: location.trim() || null,
        borderColor,
        publicVisibility,
        galleryStatus,
        displayOrder: editingRecord ? asNumber(editingRecord.displayOrder) : sortedRecords.length,
        images,
      };

      if (editingRecord) {
        await updateLandingRecord("gallery", editingRecord.id, payload);
      } else {
        await createLandingRecord("gallery", payload);
      }

      resetForm();
      setModalOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gallery group could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleVisibility(record: LandingRecord) {
    setIsSaving(true);
    setError("");
    try {
      await updateLandingRecord("gallery", record.id, {
        publicVisibility: !asBoolean(record.publicVisibility, true),
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Visibility could not be changed.");
    } finally {
      setIsSaving(false);
    }
  }

  function openSlotEditor(key: string) {
    const assigned = slotsByKey.get(key);
    setSlotKey(key);
    setSlotGroupId(asString(assigned?.galleryGroupId || assigned?.group?.id));
    setSlotImageId(asString(assigned?.galleryImageId || assigned?.image?.id));
  }

  async function saveSlot() {
    if (!slotKey) return;
    setIsSaving(true);
    setError("");
    try {
      const slotIndex = Math.max(0, GALLERY_SLOTS.findIndex((slot) => slot.key === slotKey));
      await saveGalleryLandingSlot(slotKey, {
        galleryGroupId: slotGroupId || null,
        galleryImageId: slotImageId || null,
        displayOrder: slotIndex + 1,
      });
      setSlotKey(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Landing placement could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedSlotGroup = sortedRecords.find((record) => record.id === slotGroupId) ?? null;
  const activeDraft = photoDrafts[activePhotoIndex] ?? null;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <button type="button" onClick={openCreate} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-black text-white transition hover:bg-[#1F6B43]">
            <Plus className="size-4" aria-hidden="true" />
            Add photos
          </button>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="rounded-lg border border-[#CAD8CB] bg-[#F8F1E5] p-4 shadow-[0_14px_32px_rgba(18,61,42,0.07)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-[#123D2A]">Landing placement</h2>
            <p className="text-sm text-[#5D6D63]">Choose the exact gallery photos shown on the public landing page.</p>
          </div>
          <StatusBadge tone="warning">{GALLERY_SLOTS.length} slots</StatusBadge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {GALLERY_SLOTS.map((slot) => {
            const assigned = slotsByKey.get(slot.key);
            const imagePath = asString(assigned?.image?.imagePath || assigned?.group?.imagePath);
            return (
              <button
                key={slot.key}
                type="button"
                onClick={() => openSlotEditor(slot.key)}
                className="group/slot min-h-36 overflow-hidden rounded-lg border border-[#CAD8CB] bg-white text-left shadow-[0_10px_24px_rgba(18,61,42,0.06)] transition hover:-translate-y-1 hover:border-[#D8B04C]"
              >
                {imagePath ? (
                  <div className="relative h-24 overflow-hidden">
                    <img src={resolveUploadPath(imagePath)} alt={asString(assigned?.group?.title, slot.label)} className="h-full w-full object-cover transition duration-500 group-hover/slot:scale-105" />
                    <span className="absolute left-2 top-2 rounded-full bg-[#123D2A]/86 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">{slot.label}</span>
                  </div>
                ) : (
                  <div className="grid h-24 place-items-center bg-[#EEF6EC] text-[#1F6B43]">
                    <LayoutGrid className="size-6" aria-hidden="true" />
                  </div>
                )}
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-black text-[#123D2A]">{assigned ? asString(assigned.group.title, "Gallery group") : "Choose photo"}</p>
                  <p className="mt-1 text-xs text-[#5D6D63]">{assigned ? "Click to change placement" : "Empty landing slot"}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {isLoading ? <LoadingSkeleton /> : sortedRecords.length === 0 ? (
        <EmptyState icon={Images} title="No gallery groups yet" description="Upload a group of photos to start building the public gallery." />
      ) : (
        <div className="grid gap-8">
          {groupedRecords.map(([section, items]) => (
            <section key={section} className="grid gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-[#123D2A]">{section}</h2>
                <span className="h-px flex-1 bg-[#CAD8CB]" />
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#6C7A70]">{items.length} groups</span>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {items.map((record) => {
                  const images = getGalleryImages(record);
                  const color = asString(record.borderColor, GROUP_BORDER_COLORS[0]);
                  const visible = asBoolean(record.publicVisibility, true);
                  return (
                    <article
                      key={record.id}
                      onClick={() => setPreviewRecord(record)}
                      className="group/gallery cursor-pointer rounded-lg border border-[#CAD8CB] bg-white p-4 shadow-[0_12px_32px_rgba(18,61,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(18,61,42,0.14)]"
                    >
                      <GalleryDeckPreview images={images} title={asString(record.title, "Gallery group")} borderColor={color} />
                      <div className="mt-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-lg font-black leading-tight text-[#123D2A]">{asString(record.title, "Gallery group")}</h3>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[#5D6D63]">
                            <span className="inline-flex items-center gap-1"><Images className="size-3.5" />{images.length} photos</span>
                            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{formatGalleryDate(record.activityDate || record.createdAt)}</span>
                          </div>
                        </div>
                        <StatusBadge tone={visible && record.galleryStatus === "Published" ? "success" : "neutral"}>{visible ? asString(record.galleryStatus, "Draft") : "Hidden"}</StatusBadge>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#5D6D63]">{asString(record.caption, "No caption yet.")}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(record);
                          }}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#CAD8CB] px-3 text-xs font-black text-[#123D2A] transition hover:bg-[#EEF2EC]"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleVisibility(record);
                          }}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#CAD8CB] px-3 text-xs font-black text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:opacity-60"
                        >
                          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          {visible ? "Hide" : "Show"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <FormDialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetForm();
        }}
        title={editingRecord ? "Edit gallery group" : "Add gallery group"}
        description="Upload multiple photos once and give them one shared caption."
        contentClassName="w-[min(76rem,calc(100vw-2rem))] p-3 sm:p-4"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveGroup();
          }}
          className="mt-3 grid gap-4 lg:h-[calc(100vh-8.5rem)] lg:max-h-[44rem] lg:grid-cols-[minmax(20rem,0.95fr)_minmax(25rem,1.05fr)] lg:overflow-hidden"
        >
          <section className="relative min-h-[25rem] overflow-hidden rounded-lg border border-[#CAD8CB] bg-[#F7F8F3]">
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                addPhotoFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => uploadInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") uploadInputRef.current?.click();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!draggedDraftId) setIsDropActive(true);
              }}
              onDragLeave={() => setIsDropActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDropActive(false);
                if (draggedDraftId) return;
                addPhotoFiles(event.dataTransfer.files);
              }}
              className={`absolute inset-0 outline-none transition focus:ring-2 focus:ring-inset focus:ring-[#1F6B43]/20 ${isDropActive ? "bg-[#EAF3E8]" : "bg-white"}`}
            >
              {activeDraft ? (
                <>
                  <img src={activeDraft.src} alt={activeDraft.name} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#061B11]/76 via-transparent to-transparent" />
                  <button type="button" onClick={(event) => { event.stopPropagation(); uploadInputRef.current?.click(); }} className="absolute right-4 top-4 inline-flex h-9 items-center gap-2 rounded-full bg-white/90 px-3 text-xs font-black text-[#123D2A] shadow-sm">
                    <UploadCloud className="size-4" />
                    Add
                  </button>
                </>
              ) : (
                <div className="grid h-full place-items-center px-8 text-center">
                  <div>
                    <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]"><UploadCloud className="size-9" /></span>
                    <h3 className="mt-5 text-2xl font-black text-[#123D2A]">Drop gallery photos here</h3>
                    <p className="mt-2 text-sm text-[#5D6D63]">Upload multiple photos that share one caption.</p>
                  </div>
                </div>
              )}
            </div>
            {photoDrafts.length ? (
              <div className="absolute inset-x-3 bottom-3 flex gap-2 overflow-x-auto rounded-lg bg-[#061B11]/62 p-2 backdrop-blur-md">
                {photoDrafts.map((draft, index) => (
                  <button
                    key={draft.id}
                    type="button"
                    draggable
                    onClick={(event) => {
                      event.stopPropagation();
                      setActivePhotoIndex(index);
                    }}
                    onDragStart={(event) => {
                      event.stopPropagation();
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedDraftId(draft.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      reorderDrafts(draggedDraftId, draft.id);
                      setDraggedDraftId(null);
                    }}
                    onDragEnd={() => setDraggedDraftId(null)}
                    className={`relative h-20 w-24 shrink-0 overflow-hidden rounded-md border-2 transition ${index === activePhotoIndex ? "border-[#F2C94C]" : "border-white/40"}`}
                  >
                    <img src={draft.src} alt={draft.name} className="h-full w-full object-cover" />
                    {draft.isCover ? <span className="absolute left-1 top-1 rounded-full bg-[#123D2A] p-1 text-white"><Star className="size-3" /></span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="min-h-0 overflow-y-auto rounded-lg border border-[#CAD8CB] bg-white p-4 custom-scrollbar">
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-black text-[#123D2A]">Title
                <input value={titleValue} onChange={(event) => setTitleValue(event.target.value)} className="h-11 rounded-md border border-[#CAD8CB] px-3 outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20" placeholder="Cooperative activity" />
              </label>
              <label className="grid gap-2 text-sm font-black text-[#123D2A]">Caption
                <textarea value={caption} onChange={(event) => setCaption(event.target.value)} className="min-h-32 rounded-md border border-[#CAD8CB] p-3 outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20" placeholder="Shared caption for all selected photos" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-[#123D2A]">Category
                  <input value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-md border border-[#CAD8CB] px-3 outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20" />
                </label>
                <label className="grid gap-2 text-sm font-black text-[#123D2A]">Date
                  <input value={activityDate} onChange={(event) => setActivityDate(event.target.value)} type="date" className="h-11 rounded-md border border-[#CAD8CB] px-3 outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20" />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-black text-[#123D2A]">Location
                <input value={location} onChange={(event) => setLocation(event.target.value)} className="h-11 rounded-md border border-[#CAD8CB] px-3 outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-[#123D2A]">Status
                  <select value={galleryStatus} onChange={(event) => setGalleryStatus(event.target.value as "Draft" | "Published" | "Archived")} className="h-11 rounded-md border border-[#CAD8CB] px-3 outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20">
                    <option>Published</option>
                    <option>Draft</option>
                    <option>Archived</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-[#123D2A]">Visibility
                  <select value={publicVisibility ? "visible" : "hidden"} onChange={(event) => setPublicVisibility(event.target.value === "visible")} className="h-11 rounded-md border border-[#CAD8CB] px-3 outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20">
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-black text-[#123D2A]"><Palette className="size-4" /> Group border color</span>
                <div className="flex flex-wrap gap-2">
                  {GROUP_BORDER_COLORS.map((color) => (
                    <button key={color} type="button" aria-label={`Use ${color}`} onClick={() => setBorderColor(color)} className={`size-9 rounded-full border-2 ${borderColor === color ? "border-[#123D2A]" : "border-white shadow-[0_0_0_1px_#CAD8CB]"}`} style={{ background: color }} />
                  ))}
                </div>
              </div>
              {activeDraft ? (
                <div className="rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[#123D2A]">Selected photo</p>
                    <button type="button" onClick={() => removeDraft(activeDraft.id)} className="grid size-8 place-items-center rounded-md border border-[#E7B8A8] text-[#9A392A] hover:bg-[#FFF4EC]" aria-label="Remove photo"><Trash2 className="size-4" /></button>
                  </div>
                  <input value={activeDraft.name} onChange={(event) => setPhotoDrafts((current) => current.map((draft, index) => index === activePhotoIndex ? { ...draft, name: event.target.value } : draft))} className="mt-3 h-10 w-full rounded-md border border-[#CAD8CB] px-3 text-sm outline-none focus:border-[#1F6B43]" />
                  <button type="button" onClick={() => setPhotoDrafts((current) => current.map((draft, index) => ({ ...draft, isCover: index === activePhotoIndex })))} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-[#123D2A] px-3 text-xs font-black text-white">
                    <Star className="size-3.5" />
                    Set as cover
                  </button>
                </div>
              ) : null}
              <button type="submit" disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-black text-white transition hover:bg-[#1F6B43] disabled:opacity-60">
                <Check className="size-4" />
                {isSaving ? "Saving..." : editingRecord ? "Save gallery" : "Create gallery"}
              </button>
            </div>
          </section>
        </form>
      </FormDialog>

      <FormDialog open={Boolean(slotKey)} onOpenChange={(open) => !open && setSlotKey(null)} title="Choose landing photo" description="Pick which gallery photo appears in this landing page slot.">
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-black text-[#123D2A]">Gallery group
            <select value={slotGroupId} onChange={(event) => { setSlotGroupId(event.target.value); setSlotImageId(""); }} className="h-11 rounded-md border border-[#CAD8CB] px-3 outline-none focus:border-[#1F6B43]">
              <option value="">Empty slot</option>
              {sortedRecords.map((record) => <option key={record.id} value={record.id}>{asString(record.title, "Gallery group")}</option>)}
            </select>
          </label>
          {selectedSlotGroup ? (
            <div className="grid max-h-80 gap-3 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2">
              {getGalleryImages(selectedSlotGroup).map((image) => (
                <button key={String(image.id)} type="button" onClick={() => setSlotImageId(String(image.id))} className={`overflow-hidden rounded-lg border-2 bg-white text-left transition ${slotImageId === String(image.id) ? "border-[#D8B04C]" : "border-[#CAD8CB] hover:border-[#1F6B43]"}`}>
                  <img src={resolveUploadPath(asString(image.imagePath))} alt={asString(image.altText, "Gallery photo")} className="h-28 w-full object-cover" />
                  <p className="p-2 text-xs font-black text-[#123D2A]">{asString(image.altText, imageNameFromPath(asString(image.imagePath)))}</p>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setSlotKey(null)} className="h-11 rounded-md border border-[#CAD8CB] px-4 text-sm font-black text-[#294B39] hover:bg-[#EEF2EC]">Cancel</button>
            <button type="button" onClick={() => void saveSlot()} disabled={isSaving || Boolean(slotGroupId && !slotImageId)} className="h-11 rounded-md bg-[#123D2A] px-5 text-sm font-black text-white hover:bg-[#1F6B43] disabled:opacity-60">Save</button>
          </div>
        </div>
      </FormDialog>

      <FormDialog open={Boolean(previewRecord)} onOpenChange={(open) => !open && setPreviewRecord(null)} title={asString(previewRecord?.title, "Gallery group")} description={asString(previewRecord?.caption, "Gallery photos") } contentClassName="w-[min(62rem,calc(100vw-2rem))]">
        {previewRecord ? (
          <div className="mt-4 grid gap-4">
            <div className="flex flex-wrap gap-2 text-sm text-[#5D6D63]">
              <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{asString(previewRecord.location, "Nasugbu, Batangas")}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" />{formatGalleryDate(previewRecord.activityDate || previewRecord.createdAt)}</span>
              <span className="inline-flex items-center gap-1"><Layers className="size-4" />{getGalleryImages(previewRecord).length} photos</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {getGalleryImages(previewRecord).map((image) => (
                <img key={String(image.id)} src={resolveUploadPath(asString(image.imagePath))} alt={asString(image.altText, asString(previewRecord.title))} className="h-56 w-full rounded-lg object-cover" />
              ))}
            </div>
          </div>
        ) : null}
      </FormDialog>
    </div>
  );
}

function GenericLandingJsonEditor({
  collection,
  eyebrow,
  title,
  description,
  template,
  statusKey,
  primaryKey,
}: LandingAdminCollectionViewProps) {
  const [records, setRecords] = useState<LandingRecord[]>([]);
  const [selected, setSelected] = useState<LandingRecord | null>(null);
  const [editorValue, setEditorValue] = useState(prettyJson(template));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedId = selected?.id;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setRecords(await listLandingRecords(collection));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Landing records could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [collection]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 150);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  function startCreate() {
    setSelected(null);
    setEditorValue(prettyJson(template));
  }

  function startEdit(record: LandingRecord) {
    setSelected(record);
    const editable = Object.fromEntries(
      Object.entries(record).filter(
        ([key]) => !["id", "createdAt", "updatedAt", "publishedAt"].includes(key),
      ),
    );
    setEditorValue(prettyJson(editable));
  }

  async function save() {
    setIsSaving(true);
    setError("");
    try {
      const payload = parseJsonInput(editorValue);
      if (selectedId) {
        await updateLandingRecord(collection, selectedId, payload);
      } else {
        await createLandingRecord(collection, payload);
      }
      startCreate();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Landing record could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<StatusBadge tone="success">Chairman editor</StatusBadge>}
      />
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="grid gap-4">
          {isLoading ? <LoadingSkeleton /> : records.length === 0 ? (
            <EmptyState title="No landing records found" description="Create a record to publish content to the public website." />
          ) : (
            <DataTable>
              <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
                <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
                  <tr><th className="px-5 py-4">Record</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Order</th><th className="px-5 py-4">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-[#F7F8F3]">
                      <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{String(record[primaryKey] ?? record.id)}</p><p className="mt-1 text-xs text-[#6C7A70]">ID {record.id}</p></td>
                      <td className="px-5 py-4"><StatusBadge tone={String(record[statusKey]).includes("Active") || String(record[statusKey]).includes("Published") ? "success" : "neutral"}>{String(record[statusKey] ?? "Draft")}</StatusBadge></td>
                      <td className="px-5 py-4">{String(record.displayOrder ?? "0")}</td>
                      <td className="px-5 py-4"><button onClick={() => startEdit(record)} className="rounded-md border border-[#CAD8CB] px-3 py-2 text-xs font-bold text-[#123D2A] hover:bg-[#EEF2EC]">Edit JSON</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </section>
        <section className="rounded-lg border border-[#CAD8CB] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-[#123D2A]">{selected ? "Edit record" : "Create record"}</h2>
            <button onClick={startCreate} className="text-xs font-bold uppercase tracking-[0.16em] text-[#1F6B43]">New</button>
          </div>
          <textarea
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
            className="min-h-[480px] w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-4 font-mono text-xs leading-6 text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
            spellCheck={false}
          />
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void save()}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-60"
          >
            <Save className="size-4" />
            {isSaving ? "Saving..." : "Save"}
          </button>
        </section>
      </div>
    </div>
  );
}

export function LandingAdminCollectionView(props: LandingAdminCollectionViewProps) {
  if (props.collection === "partners") {
    return (
      <PartnersCertificationsManager
        eyebrow={props.eyebrow}
        title={props.title}
        description={props.description}
      />
    );
  }

  if (props.collection === "gallery") {
    return (
      <GalleryAdminManager
        eyebrow={props.eyebrow}
        title={props.title}
        description={props.description}
      />
    );
  }

  return <GenericLandingJsonEditor {...props} />;
}

export function LandingSettingsView() {
  const [settings, setSettings] = useState<LandingRecord[]>([]);
  const [logs, setLogs] = useState<LandingRecord[]>([]);
  const [search, setSearch] = useState("");
  const [editorValue, setEditorValue] = useState(prettyJson({
    settingGroup: "Landing",
    settingKey: "landing.review_note",
    settingValue: "",
    valueType: "String",
    description: "Internal landing content note.",
    isPublic: false,
    effectiveDate: null,
  }));
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextSettings, nextLogs] = await Promise.all([
        listSystemSettings(search),
        listAuditLogs(search),
      ]);
      setSettings(nextSettings);
      setLogs(nextLogs);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Settings and audit logs could not be loaded.");
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 150);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function save() {
    try {
      await saveSystemSetting(parseJsonInput(editorValue));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setting could not be saved.");
    }
  }

  const latestLogs = useMemo(() => logs.slice(0, 12), [logs]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="System"
        title="Settings and Audit"
        description="Chairman-only settings and audit records for landing administration."
        actions={<StatusBadge tone="success">Chairman only</StatusBadge>}
      />
      <Toolbar search={search} setSearch={setSearch} onRefresh={() => void load()} />
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-[#CAD8CB] bg-white p-4">
          <h2 className="text-lg font-black text-[#123D2A]">Save Setting</h2>
          <textarea value={editorValue} onChange={(event) => setEditorValue(event.target.value)} className="mt-3 min-h-[260px] w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] p-4 font-mono text-xs leading-6" />
          <button onClick={() => void save()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white"><Save className="size-4" />Save setting</button>
        </section>
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4">Setting</th><th className="px-5 py-4">Value</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC]">
              {settings.map((setting) => <tr key={setting.id}><td className="px-5 py-4 font-bold text-[#123D2A]">{String(setting.settingKey)}</td><td className="px-5 py-4 text-[#294B39]">{String(setting.settingValue ?? "")}</td></tr>)}
            </tbody>
          </table>
        </DataTable>
      </div>
      <DataTable>
        <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
          <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
            <tr><th className="px-5 py-4">Action</th><th className="px-5 py-4">Table</th><th className="px-5 py-4">User</th><th className="px-5 py-4">Time</th></tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2EC]">
            {latestLogs.map((log) => <tr key={log.id}><td className="px-5 py-4 font-bold text-[#123D2A]">{String(log.action)}</td><td className="px-5 py-4">{String(log.entityTable)}</td><td className="px-5 py-4">{String(log.userName ?? "System")}</td><td className="px-5 py-4">{String(log.actionTime ?? "")}</td></tr>)}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
