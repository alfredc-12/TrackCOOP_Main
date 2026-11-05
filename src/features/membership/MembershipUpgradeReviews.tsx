"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { membershipUpgradeRequest } from "./TrueMembershipApplication";

type Application = { id: string; memberId: string; fullName: string; memberCode: string; message: string; requirements: { validatedTotal: number; fullRequirement: number }; createdAt: string };

export function MembershipUpgradeReviews({ onChanged }: { onChanged: () => void }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setApplications(await membershipUpgradeRequest<Application[]>("membership-upgrades")); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load applications."); }
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 15000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  async function decide(decision: "Approved" | "Rejected") {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try {
      await membershipUpgradeRequest(`membership-upgrades/${selected.id}/decision`, { decision, reason });
      setSelected(null); setReason(""); await load(); onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to review application."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-coop-border bg-white p-5" aria-labelledby="membership-upgrades-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="membership-upgrades-heading" className="text-lg font-bold text-coop-forest">True Membership Applications ({applications.length})</h2><Button variant="secondary" onClick={() => void load()}>Refresh applications</Button></div>
    {error && !selected && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {!applications.length && !error && <p className="mt-3 text-sm text-coop-muted">No pending upgrade applications.</p>}
    <div className="mt-3 grid gap-3">{applications.map((application) => <div key={application.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-coop-border p-3"><div><p className="font-semibold text-coop-ink">{application.fullName}</p><p className="text-sm text-coop-muted">{application.memberCode} · {new Date(application.createdAt).toLocaleDateString("en-PH")}</p></div><Button variant="secondary" onClick={() => { setSelected(application); setReason(""); setError(""); }}>Review application</Button></div>)}</div>
    <Modal title="Review True Membership Application" description="Approval checks the member’s validated Share Capital and updates their membership." trigger={<span className="hidden" />} open={Boolean(selected)} onOpenChange={(open) => { if (!open && !busy) setSelected(null); }}>
      <p className="font-bold text-coop-ink">{selected?.fullName} · {selected?.memberCode}</p><p className="my-4 whitespace-pre-wrap break-words text-sm text-coop-ink">{selected?.message}</p>
      <p className="mb-4 text-sm text-coop-ink">Validated Share Capital: <strong>{selected?.requirements.validatedTotal.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</strong> / required {selected?.requirements.fullRequirement.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
      <label htmlFor="upgrade-decision-reason" className="text-sm font-semibold">Decision reason</label><textarea id="upgrade-decision-reason" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-coop-border p-3 text-sm" />
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex gap-3"><Button disabled={busy || !reason.trim()} onClick={() => void decide("Approved")}>Approve True Membership</Button><Button variant="secondary" disabled={busy || !reason.trim()} onClick={() => void decide("Rejected")}>Reject</Button></div>
    </Modal>
  </section>;
}
