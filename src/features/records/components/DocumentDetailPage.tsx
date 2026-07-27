"use client";

import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Download,
  ExternalLink,
  FileClock,
  FilePenLine,
  FileText,
  History,
  Printer,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  DataTable,
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
    relatedModule: value("relatedModule"),
    relatedRecordId: value("relatedRecordId"),
    relatedRecordReference: value("relatedRecordReference"),
    relationshipType: value("relationshipType"),
    memberId: value("memberId"),
    documentDate: value("documentDate"),
    expirationDate: value("expirationDate"),
    tags: value("tags"),
    internalNote: value("internalNote"),
  };
}

function sourceHref(role: "chairman" | "bookkeeper", document: DocumentDetail) {
  const base = `/portal/${role}`;
  if (!document.relatedModule) return null;
  if (document.relatedModule === "REPORT") return `${base}/reports/history`;
  if (role === "bookkeeper") {
    if (["PAYMENT", "RECEIPT"].includes(document.relatedModule))
      return `${base}/payment-validation`;
    if (document.relatedModule === "SHARE_CAPITAL")
      return `${base}/share-capital`;
    if (document.relatedModule.startsWith("RENTAL"))
      return `${base}/rental-transactions`;
    if (["POS_SALE", "ORDER"].includes(document.relatedModule))
      return `${base}/pos-sales`;
    if (["PRODUCT", "INVENTORY"].includes(document.relatedModule))
      return `${base}/products-inventory`;
    if (["FINANCIAL_LEDGER", "EXPENSE"].includes(document.relatedModule))
      return `${base}/financial-ledger`;
    return null;
  }
  if (
    ["MEMBERSHIP", "MEMBERSHIP_APPLICATION", "MEMBER_PROFILE"].includes(
      document.relatedModule,
    )
  )
    return `${base}/members`;
  if (["PAYMENT", "RECEIPT"].includes(document.relatedModule))
    return `${base}/payments`;
  if (document.relatedModule === "SHARE_CAPITAL")
    return `${base}/share-capital`;
  if (document.relatedModule === "RENTAL_ASSET") {
    return document.relatedRecordId
      ? `${base}/rentals/assets/${document.relatedRecordId}`
      : `${base}/rentals/assets`;
  }
  if (document.relatedModule === "RENTAL_BOOKING") {
    return document.relatedRecordId
      ? `${base}/rentals/bookings/${document.relatedRecordId}`
      : `${base}/rentals/bookings`;
  }
  if (document.relatedModule.startsWith("RENTAL"))
    return `${base}/rentals/bookings`;
  if (["POS_SALE", "ORDER"].includes(document.relatedModule))
    return `${base}/pos`;
  if (["PRODUCT", "INVENTORY"].includes(document.relatedModule))
    return `${base}/products`;
  if (["FINANCIAL_LEDGER", "EXPENSE"].includes(document.relatedModule))
    return `${base}/finance`;
  if (document.relatedModule === "ANNOUNCEMENT") return `${base}/announcements`;
  if (document.relatedModule === "AUDIT_RECORD") return `${base}/audit-logs`;
  return null;
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
  const [versionOpen, setVersionOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [saving, setSaving] = useState(false);

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
    // The async loader updates state only after the external request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function updateMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document) return;
    const next = metadataFromForm(event.currentTarget);
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

  async function uploadVersion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/documents/${document.id}/versions`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const result = (await response.json()) as { version: number };
      toast.success(
        `Version ${result.version} uploaded. The previous version is preserved.`,
      );
      setVersionOpen(false);
      event.currentTarget.reset();
      await load();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Version upload failed.",
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
  const source = sourceHref(role, document);
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
              disabled={document.status === "ARCHIVED"}
              onClick={() => setVersionOpen(true)}
              className={primaryButtonClass}
            >
              <Upload className="size-4" /> New Version
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
        <StatusBadge>Version {document.currentVersion}</StatusBadge>
      </div>

      {error ? <ErrorState message={error} /> : null}
      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
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
            <Detail
              label="Document date"
              value={formatDate(document.documentDate)}
            />
            <Detail
              label="Expiration date"
              value={formatDate(document.expirationDate)}
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
            <Detail label="Tags" value={document.tags ?? "—"} />
            <Detail
              label="Internal note"
              value={document.internalNote ?? "—"}
            />
            {document.archiveReason ? (
              <Detail label="Archive reason" value={document.archiveReason} />
            ) : null}
          </dl>
        </Panel>
        <Panel title="Related Record" icon={ExternalLink}>
          <dl className="grid gap-4">
            <Detail
              label="Related module"
              value={
                document.relatedModule
                  ? humanizeConstant(document.relatedModule)
                  : "Not linked"
              }
            />
            <Detail
              label="Record reference"
              value={document.relatedRecordReference ?? "—"}
            />
            <Detail
              label="Relationship"
              value={
                document.relationshipType
                  ? humanizeConstant(document.relationshipType)
                  : "—"
              }
            />
            {source ? (
              <Link href={source} className={`${secondaryButtonClass} w-fit`}>
                Open source record <ExternalLink className="size-4" />
              </Link>
            ) : null}
          </dl>
        </Panel>
      </section>

      <Panel title="Version History" icon={FileClock}>
        {document.versions.length ? (
          <DataTable>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#EEF2EC] text-xs uppercase text-[#53675A]">
                <tr>
                  {[
                    "Version",
                    "File",
                    "Change Note",
                    "Uploaded By",
                    "Uploaded At",
                    "Action",
                  ].map((item) => (
                    <th key={item} className="px-4 py-3">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {document.versions.map((version) => (
                  <tr key={version.id} className="border-t border-[#E1E9E2]">
                    <td className="px-4 py-3 font-bold">
                      v{version.versionNumber}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="break-all">{version.originalFileName}</p>
                      <p className="text-xs text-[#6C7A70]">
                        {formatFileSize(version.fileSizeBytes)}
                      </p>
                    </td>
                    <td className="px-4 py-3">{version.changeNote ?? "—"}</td>
                    <td className="px-4 py-3">{version.uploadedBy}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(version.uploadedAt, true)}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`${currentFile}?action=download&version=${version.versionNumber}`}
                        className={secondaryButtonClass}
                      >
                        <Download className="size-4" /> Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : (
          <p className="text-sm text-[#5D6D63]">
            No document versions are available.
          </p>
        )}
      </Panel>

      {role === "chairman" ? (
        <section className="grid min-w-0 gap-5 xl:grid-cols-2">
          <Panel title="Access and Download History" icon={ShieldCheck}>
            <ActivityList
              items={document.accessHistory.map((item) => ({
                id: item.id,
                title: `${item.action} · ${item.user}`,
                detail: `${item.role ?? "Unknown role"}${item.versionNumber ? ` · version ${item.versionNumber}` : ""}`,
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
        contentClassName="w-[min(48rem,calc(100vw-2rem))]"
      >
        <form onSubmit={updateMetadata}>
          <DocumentMetadataFields
            role={role}
            defaults={{
              title: document.title,
              description: document.description,
              category: document.category,
              documentType: document.documentType,
              accessLevel: document.accessLevel,
              relatedModule: document.relatedModule,
              relatedRecordId: document.relatedRecordId,
              relatedRecordReference: document.relatedRecordReference,
              relationshipType: document.relationshipType,
              memberId: document.memberId,
              documentDate: document.documentDate,
              expirationDate: document.expirationDate,
              tags: document.tags,
              internalNote: document.internalNote,
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
        open={versionOpen}
        onOpenChange={setVersionOpen}
        title="Upload New Version"
        description={`The current version (v${document.currentVersion}) will remain available. The new file becomes the current version after server confirmation.`}
      >
        <form onSubmit={uploadVersion} className="grid gap-4">
          <Field label="Change note" required>
            <textarea
              name="changeNote"
              required
              minLength={3}
              maxLength={5000}
              rows={3}
              className={`${fieldClass} py-3`}
            />
          </Field>
          <Field
            label="New file"
            required
            hint="PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, JPEG, or PNG; maximum 10 MB."
          >
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
              className={`${fieldClass} py-2`}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setVersionOpen(false)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button disabled={saving} className={primaryButtonClass}>
              {saving ? (
                <BusyLabel label="Uploading..." />
              ) : (
                <>
                  <Upload className="size-4" /> Confirm New Version
                </>
              )}
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
            : "The document will leave the active register, but its file, versions, access log, and audit history remain preserved."
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
