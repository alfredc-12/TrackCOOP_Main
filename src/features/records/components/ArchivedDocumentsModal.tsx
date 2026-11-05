import { useState, useEffect, useCallback } from "react";
import { ConfirmDialog, FormDialog, PaginationControls } from "@/components/portal/PortalPrimitives";
import { ArchiveRestore, Clock3, Inbox } from "lucide-react";
import { expressFetch } from "@/lib/express-api";
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
  const [pageSize, setPageSize] = useState(5);
  const [mutating, setMutating] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<DocumentRecord | null>(null);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const parameters = new URLSearchParams({
        status: "ARCHIVED",
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await expressFetch(`/api/documents?${parameters}`);
      if (!response.ok) throw new Error(await apiError(response));
      setData(await response.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load archived documents");
    } finally {
      setLoading(false);
    }
  }, [open, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  async function restoreDocument(documentId: string) {
    setMutating(documentId);
    try {
      const response = await expressFetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      toast.success("Document restored successfully.");
      await load();
      onRestoreSuccess();
      setRestoreTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore document.");
    } finally {
      setMutating(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.summary.archived ?? 0) / pageSize));

  return (
    <>
    <FormDialog
      open={open && !restoreTarget}
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
                  <button
                    type="button"
                    disabled={mutating === doc.id}
                    onClick={() => setRestoreTarget(doc)}
                    className={primaryButtonClass}
                  >
                    <ArchiveRestore className="size-4" />
                    {mutating === doc.id ? "Restoring..." : "Restore"}
                  </button>
                </div>
              </div>
            ))}
            
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={data.summary.archived}
              itemName="documents"
              onPageChange={setPage}
              pageSize={pageSize}
              pageSizeOptions={[5, 10, 20]}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              disabled={loading}
              className="mt-4 border-t border-[#EEF2EC] pt-4"
            />
          </div>
        )}
        
        <div className="mt-4 flex justify-end border-t border-[#EEF2EC] pt-4">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButtonClass}>
            Close
          </button>
        </div>
      </div>
    </FormDialog>
    <ConfirmDialog
      open={Boolean(restoreTarget)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !mutating) setRestoreTarget(null);
      }}
      title="Restore Document"
      description={`Are you sure you want to restore "${restoreTarget?.title ?? "this document"}"?`}
      confirmLabel="Restore Document"
      loading={Boolean(mutating)}
      onConfirm={() => {
        if (restoreTarget) void restoreDocument(restoreTarget.id);
      }}
    />
    </>
  );
}
