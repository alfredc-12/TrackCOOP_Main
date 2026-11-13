"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ClipboardCheck, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PaginationControls } from "@/components/portal/PortalPrimitives";
import { Button } from "@/components/ui/Button";
import { membershipUpgradeRequest } from "./TrueMembershipApplication";

type Application = { id: string; memberId: string; fullName: string; memberCode: string; message: string; requirements: { validatedTotal: number; fullRequirement: number }; createdAt: string };

export function MembershipUpgradeReviews({ onChanged }: { onChanged: () => void }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    if (selected) reviewHeading.current?.focus();
    else searchInput.current?.focus();
  }, [open, selected]);
  const load = useCallback(async () => {
    try { setApplications(await membershipUpgradeRequest<Application[]>("membership-upgrades")); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load applications."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  const term = search.trim().toLowerCase();
  const filtered = applications.filter(application => !term || [application.fullName, application.memberCode].some(value => value.toLowerCase().includes(term)));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const back = () => { setSelected(null); setReason(""); setError(""); };
  async function decide(decision: "Approved" | "Rejected") {
    if (!selected || busy || !reason.trim()) return;
    setBusy(true); setError("");
    try {
      await membershipUpgradeRequest(`membership-upgrades/${selected.id}/decision`, { decision, reason });
      setSelected(null); setReason(""); await load(); onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to review application."); }
    finally { setBusy(false); }
  }

  return <Dialog.Root open={open} onOpenChange={next => {
    if (busy) return;
    setOpen(next);
    if (!next) { setSelected(null); setReason(""); }
  }}>
    <Dialog.Trigger asChild>
      <Button type="button" variant="secondary" className="min-h-11">
        <ClipboardCheck className="size-4" aria-hidden="true" />
        True Membership Applications{!loading && !error && ` (${applications.length})`}
      </Button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-coop-forest/40" />
      <Dialog.Content className="fixed inset-y-0 right-0 z-[60] flex h-dvh w-full min-w-0 flex-col border-l border-coop-border bg-coop-surface shadow-coop-floating outline-none sm:max-w-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-coop-border p-4 sm:p-6">
          <div className="min-w-0">
            <Dialog.Title className="text-xl font-bold text-coop-forest">{selected ? "Review True Membership Application" : "True Membership Applications"}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-coop-muted">{selected ? "Approval checks the member's validated Share Capital and updates their membership." : "Review pending requests without leaving the Members page."}</Dialog.Description>
            {selected && <Button type="button" variant="ghost" className="mt-2" disabled={busy} onClick={back}><ArrowLeft className="size-4" aria-hidden="true" />Back to applications</Button>}
          </div>
          <Dialog.Close asChild><Button type="button" variant="ghost" disabled={busy} aria-label="Close membership applications" className="size-11 shrink-0 p-0"><X className="size-5" aria-hidden="true" /></Button></Dialog.Close>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {error && <p role="alert" className="mb-4 rounded-lg border border-coop-danger/30 bg-coop-danger/5 p-3 text-sm text-coop-danger">{error}</p>}
          {selected ? <section aria-label="Application review" className="space-y-4">
            <div><h3 ref={reviewHeading} tabIndex={-1} className="break-words text-lg font-bold text-coop-ink outline-none">{selected.fullName}</h3><p className="break-words text-sm text-coop-muted">{selected.memberCode}</p></div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-coop-ink">{selected.message}</p>
            <p className="rounded-lg border border-coop-border bg-coop-subtle p-4 text-sm leading-6 text-coop-ink">Validated Share Capital: <strong>{selected.requirements.validatedTotal.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</strong> / required {selected.requirements.fullRequirement.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
            <div><label htmlFor="upgrade-decision-reason" className="text-sm font-semibold text-coop-forest">Decision reason</label><textarea id="upgrade-decision-reason" maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 min-h-32 w-full rounded-coop-control border border-coop-border bg-coop-surface p-3 text-sm text-coop-ink focus-visible:outline-2 focus-visible:outline-coop-green" /><p className="mt-1 text-sm text-coop-muted">A reason is required for approval or rejection.</p></div>
          </section> : <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-coop-muted">{loading ? "Loading applications..." : `${applications.length} pending applications`}</p>
              <Button type="button" variant="secondary" onClick={() => void load()}><RefreshCw className="size-4" aria-hidden="true" />Refresh applications</Button>
            </div>
            <label className="mb-4 block"><span className="mb-1 block text-sm font-semibold text-coop-forest">Search applications</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-coop-muted" aria-hidden="true" /><input ref={searchInput} type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Member name or code" className="coop-field min-h-11 w-full rounded-coop-control border border-coop-border bg-coop-surface py-2 pl-10 pr-3 text-sm text-coop-ink" /></span></label>
            {loading ? <p role="status" className="py-6 text-sm text-coop-muted">Loading applications...</p> : <>
              {!filtered.length && !error && <p className="py-6 text-sm text-coop-muted">{term ? "No matching applications." : "No pending upgrade applications."}</p>}
              <ul className="grid gap-3" aria-label="Pending membership upgrades">{visible.map(application => <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 rounded-coop-panel border border-coop-border p-3">
                <div className="min-w-0"><p className="break-words font-semibold text-coop-ink">{application.fullName}</p><p className="break-words text-sm text-coop-muted">{application.memberCode} | {new Date(application.createdAt).toLocaleDateString("en-PH")}</p></div>
                <Button type="button" variant="secondary" onClick={() => { setSelected(application); setReason(""); setError(""); }}>Review application</Button>
              </li>)}</ul>
            </>}
          </>}
        </div>
        <footer className="shrink-0 border-t border-coop-border p-4 sm:px-6">
          {selected ? <div className="flex flex-wrap gap-3"><Button type="button" disabled={busy || !reason.trim()} onClick={() => void decide("Approved")}>Approve True Membership</Button><Button type="button" variant="secondary" disabled={busy || !reason.trim()} onClick={() => void decide("Rejected")}>Reject</Button></div> : <PaginationControls currentPage={currentPage} totalPages={pages} totalItems={filtered.length} itemName="applications" onPageChange={setPage} pageSize={pageSize} pageSizeOptions={[5, 10, 20]} onPageSizeChange={size => { setPageSize(size); setPage(1); }} disabled={loading} className="mt-0" />}
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
