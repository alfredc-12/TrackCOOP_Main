import { useState, useEffect, useCallback } from "react";
import { FormDialog, ConfirmDialog } from "@/components/portal/PortalPrimitives";
import { FileText, ArchiveRestore, Clock3, Inbox, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import type { DocumentListResponse, DocumentRecord } from "../records-types";
import { apiError, primaryButtonClass, secondaryButtonClass, formatDate } from "./RecordsUi";
import { toast } from "sonner";


export function ArchivedDocumentsModal({
  open,
  onOpenChange,
  basePath,
  onRestoreSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePath: string;
  onRestoreSuccess: () => void;
}) {
  const [data, setData] = useState<DocumentListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [mutating, setMutating] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const parameters = new URLSearchParams({
        status: "ARCHIVED",
        page: String(page),
        pageSize: "5",
      });
      const response = await fetch(`/api/documents?${parameters}`);
      if (!response.ok) throw new Error(await apiError(response));
      setData(await response.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load archived documents");
    } finally {
      setLoading(false);
    }
  }, [open, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function restoreDocument(documentId: string) {
    setMutating(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      toast.success("Document restored successfully.");
      await load();
      onRestoreSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore document.");
    } finally {
      setMutating(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.summary.archived ?? 0) / 5));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Archived Documents"
      description="View and restore previously archived cooperative documents."
      contentClassName="w-[min(48rem,calc(100vw-2rem))]"
    >
      <div className="mt-4 flex flex-col gap-4">
        {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        
        {loading && !data ? (
          <div className="flex justify-center p-8 text-[#5D6D63]"><Clock3 className="size-6 animate-spin" /></div>
        ) : null}

        {!loading && data?.documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Inbox className="size-8 text-[#CAD8CB]" />
            <h3 className="mt-2 font-medium text-[#123D2A]">No archived documents</h3>
            <p className="mt-1 text-sm text-[#5D6D63]">Archived documents will appear here.</p>
          </div>
        ) : null}

        {data && data.documents.length > 0 && (
          <div className="grid gap-3">
            {data.documents.map((doc) => (
              <div key={doc.id} className="flex flex-col justify-between rounded-md border border-[#CAD8CB] bg-white p-3 sm:flex-row sm:items-center">
                <div className="mb-3 sm:mb-0">
                  <div className="font-semibold text-[#123D2A]">{doc.title}</div>
                  <div className="text-xs text-[#5D6D63]">{doc.reference} &middot; Archived on {formatDate(doc.updatedAt)}</div>
                </div>
                <div className="flex gap-2">
                  <ConfirmDialog
                    title="Restore Document"
                    description={`Are you sure you want to restore "${doc.title}"?`}
                    confirmLabel="Restore Document"
                    onConfirm={() => void restoreDocument(doc.id)}
                    trigger={
                      <button
                        type="button"
                        disabled={mutating === doc.id}
                        className={primaryButtonClass}
                      >
                        <ArchiveRestore className="size-4" />
                        {mutating === doc.id ? "Restoring..." : "Restore"}
                      </button>
                    }
                  />
                </div>
              </div>
            ))}
            
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
                Page {page} of {totalPages} &middot; {data.summary.archived} document{data.summary.archived === 1 ? "" : "s"}
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
          </div>
        )}
        
        <div className="mt-4 flex justify-end border-t border-[#EEF2EC] pt-4">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClass}>
            Close
          </button>
        </div>
      </div>
    </FormDialog>
  );
}
