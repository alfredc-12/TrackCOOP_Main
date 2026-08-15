"use client";

import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Download,
  FilePenLine,
  FileText,
  History,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  ErrorState,
  FormDialog,
  LoadingSkeleton,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { accessLevelLabel, humanizeConstant } from "../record-constants";
import type {
  DocumentAccessLevel,
  DocumentDetail,
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

function statusTone(status: DocumentStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "EXPIRING_SOON") return "warning" as const;
  if (status === "EXPIRED") return "danger" as const;
  return "neutral" as const;
}

function metadataFromForm(form: HTMLFormElement) {
  const data = new FormData(form);
  const value = (key: string) => String(data.get(key) ?? "");
  return {
    title: value("title"),
    description: value("description"),
    category: value("category"),
    documentType: value("documentType"),
    accessLevel: value("accessLevel") as DocumentAccessLevel,
  };
}

export function DocumentDetailPage({
  role,
  documentId,
}: {
  role: "chairman" | "bookkeeper";
  documentId: string;
}) {
  const basePath = `/portal/${role}`;
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await apiError(response));
      setError(null);
      setDocument((await response.json()) as DocumentDetail);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Document could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document) return;
    const next = metadataFromForm(event.currentTarget);
    
    const errors: Record<string, string> = {};
    if (next.title.length < 2 || next.title.length > 255) errors.title = "Document title must contain 2 to 255 characters.";
    if (!next.category) errors.category = "Please select a category.";
    if (!next.documentType) errors.documentType = "Please select a document type.";
    if (!next.accessLevel) errors.accessLevel = "Please select an access level.";
    
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setEditErrors({});

    if (
      next.accessLevel !== document.accessLevel &&
      !window.confirm(
        `Change access for ${document.title} from ${accessLevelLabel(document.accessLevel)} to ${accessLevelLabel(next.accessLevel)}? Server authorization will use the new level immediately.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", document: next }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      toast.success("Document details updated.");
      setEditOpen(false);
      setEditErrors({});
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Document update failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeArchiveState() {
    if (!document) return;
    const archive = document.status !== "ARCHIVED";
    setSaving(true);
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
      setArchiveOpen(false);
      setArchiveReason("");
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Document status update failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !document) return <LoadingSkeleton />;
  if (error && !document) {
    return (
      <div className="grid gap-4">
        <Link href={`${basePath}/documents`} className={secondaryButtonClass}>
          <ArrowLeft className="size-4" /> Back to Documents
        </Link>
        <ErrorState message={error} />
      </div>
    );
  }
  if (!document) return null;
  const currentFile = `/api/documents/${document.id}/file`;

  return (
    <div className="grid min-w-0 gap-6">
      <Link
        href={`${basePath}/documents`}
        className={`${secondaryButtonClass} w-fit`}
      >
        <ArrowLeft className="size-4" /> Back to Documents
      </Link>
      <PageHeader
        eyebrow={document.reference}
        title={document.title}
        description={
          document.description ?? "Protected cooperative document record."
        }
        actions={
          <>
            <a
              href={`${currentFile}?action=preview`}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClass}
            >
              <ShieldCheck className="size-4" /> Preview
            </a>
            <a
              href={`${currentFile}?action=download`}
              className={secondaryButtonClass}
            >
              <Download className="size-4" /> Download
            </a>
            <a
              href={`${currentFile}?action=print`}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClass}
            >
              <Printer className="size-4" /> Print
            </a>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className={secondaryButtonClass}
            >
              <FilePenLine className="size-4" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setArchiveOpen(true)}
              className={warningButtonClass}
            >
              {document.status === "ARCHIVED" ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
              {document.status === "ARCHIVED" ? "Restore" : "Archive"}
            </button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadge>{humanizeConstant(document.category)}</StatusBadge>
        <StatusBadge>{accessLevelLabel(document.accessLevel)}</StatusBadge>
        <StatusBadge tone={statusTone(document.status)}>
          {humanizeConstant(document.status)}
        </StatusBadge>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <Panel title="Document Details" icon={FileText}>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Detail
            label="Original file name"
            value={document.fileName}
            breakAll
          />
          <Detail
            label="File type"
            value={`${document.fileExtension.toUpperCase() || "Unknown"} · ${document.mimeType}`}
          />
          <Detail
            label="File size"
            value={formatFileSize(document.fileSizeBytes)}
          />
          <Detail label="Uploaded by" value={document.uploadedBy} />
          <Detail
            label="Uploaded at"
            value={formatDate(document.uploadedAt, true)}
          />
          <Detail
            label="Last updated"
            value={formatDate(document.updatedAt, true)}
          />
        </dl>
      </Panel>

      {role === "chairman" ? (
        <section className="grid min-w-0 gap-5 xl:grid-cols-2">
          <Panel title="Access and Download History" icon={ShieldCheck}>
            <ActivityList
              items={document.accessHistory.map((item) => ({
                id: item.id,
                title: `${item.action} · ${item.user}`,
                detail: item.role ?? "Unknown role",
                date: item.occurredAt,
              }))}
              empty="No server-recorded document access is available."
            />
          </Panel>
          <Panel title="Audit History" icon={History}>
            <ActivityList
              items={document.auditHistory.map((item) => ({
                id: item.id,
                title: item.action,
                detail: `${item.actor}${item.description ? ` · ${item.description}` : ""}`,
                date: item.occurredAt,
              }))}
              empty="No document audit events are available."
            />
          </Panel>
        </section>
      ) : null}

      <FormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Document Details"
        description="Metadata and access changes are written to the audit trail."
        contentClassName="w-[min(36rem,calc(100vw-2rem))]"
      >
        <form onSubmit={updateMetadata} noValidate>
            <DocumentMetadataFields
              role={role}
              errors={editErrors}
              defaults={{
              title: document.title,
              description: document.description,
              category: document.category,
              documentType: document.documentType,
              accessLevel: document.accessLevel,
            }}
          />
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button disabled={saving} className={primaryButtonClass}>
              {saving ? <BusyLabel label="Saving..." /> : "Save Details"}
            </button>
          </div>
        </form>
      </FormDialog>

      <FormDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={
          document.status === "ARCHIVED"
            ? "Restore Document"
            : "Archive Document"
        }
        description={
          document.status === "ARCHIVED"
            ? "The document will return to the active register. Its complete history remains unchanged."
            : "The document will leave the active register, but its file, access log, and audit history remain preserved."
        }
      >
        {document.status !== "ARCHIVED" ? (
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
            onClick={() => setArchiveOpen(false)}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void changeArchiveState()}
            disabled={
              saving ||
              (document.status !== "ARCHIVED" &&
                archiveReason.trim().length < 3)
            }
            className={
              document.status === "ARCHIVED"
                ? primaryButtonClass
                : warningButtonClass
            }
          >
            {saving ? (
              <BusyLabel label="Saving..." />
            ) : document.status === "ARCHIVED" ? (
              "Confirm Restore"
            ) : (
              "Confirm Archive"
            )}
          </button>
        </div>
      </FormDialog>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-5">
      <h2 className="flex items-center gap-2 text-lg font-black text-[#123D2A]">
        <Icon className="size-5 text-[#1F6B43]" />
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Detail({
  label,
  value,
  breakAll,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-[#6C7A70]">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm text-[#294B39] ${breakAll ? "break-all" : "break-words"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ActivityList({
  items,
  empty,
}: {
  items: Array<{ id: string; title: string; detail: string; date: string }>;
  empty: string;
}) {
  if (!items.length) return <p className="text-sm text-[#5D6D63]">{empty}</p>;
  return (
    <ol className="grid max-h-[28rem] gap-3 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id} className="rounded-md border border-[#E1E9E2] p-3">
          <p className="break-words text-sm font-bold text-[#123D2A]">
            {item.title}
          </p>
          <p className="mt-1 break-words text-xs text-[#5D6D63]">
            {item.detail}
          </p>
          <time className="mt-2 block text-xs text-[#6C7A70]">
            {formatDate(item.date, true)}
          </time>
        </li>
      ))}
    </ol>
  );
}
