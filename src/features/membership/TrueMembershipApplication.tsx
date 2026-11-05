"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { expressFetch } from "@/lib/express-api";

export async function membershipUpgradeRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await expressFetch(`/api/${path}`, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "Unable to process this application.");
  return data;
}

export type UpgradeStatus = {
  application: { status: string; decisionReason: string | null } | null;
  requirements: { fullRequirement: number; validatedTotal: number; remainingToFull: number; fullRequirementMet: boolean; maximumAllowed: number };
};
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export function TrueMembershipApplication({ open, onOpenChange, onStatus }: { open: boolean; onOpenChange: (open: boolean) => void; onStatus?: (status: UpgradeStatus | null) => void }) {
  const [status, setStatus] = useState<UpgradeStatus | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = await membershipUpgradeRequest<UpgradeStatus>("members/me/true-membership");
      setStatus(next); onStatus?.(next); setError("");
    }
    catch (caught) { onStatus?.(null); setError(caught instanceof Error ? caught.message : "Unable to load requirements."); }
  }, [onStatus]);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 15000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  const pending = status?.application?.status === "Pending";
  return <Modal title="Apply for True Membership" description="Submit your application for the chairman’s review. Access is granted after approval."
    open={open} onOpenChange={onOpenChange} trigger={<Button variant="secondary" className="min-h-9 rounded-full px-4 text-xs">{pending ? "Application Pending" : "Apply for True Membership"}</Button>}>
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error} <button type="button" className="underline" onClick={() => void load()}>Try again</button></p>}
    {status ? <>
      <div className="mb-4 rounded-xl border border-coop-border bg-coop-subtle p-4 text-sm leading-6 text-coop-ink">
        <p className="font-bold">Requirements</p>
        <ul className="mt-2 list-disc pl-5"><li>Approved and active Associate membership.</li><li>At least {money(status.requirements.fullRequirement)} in validated Share Capital.</li><li>Chairman approval of this application and cooperative requirements.</li></ul>
        <p className="mt-2">Validated contributions: <strong>{money(status.requirements.validatedTotal)}</strong></p>
        {status.requirements.remainingToFull > 0 && <p>Still required before approval: {money(status.requirements.remainingToFull)}. You may submit now and complete your contributions while awaiting review.</p>}
      </div>
      {status.application?.status === "Rejected" && <p className="mb-3 text-sm text-red-700">Previous application rejected: {status.application.decisionReason}</p>}
      {pending ? <p role="status" className="rounded-xl bg-coop-subtle p-4 text-sm font-semibold text-coop-forest">Application Pending. The chairman will review your request. Check My Requests for other inquiries.</p> : <form onSubmit={async (event) => {
        event.preventDefault(); if (busy) return; setBusy(true); setError("");
        try { await membershipUpgradeRequest("members/me/true-membership", { message }); await load(); setMessage(""); }
        catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to submit."); }
        finally { setBusy(false); }
      }}>
        <label htmlFor="true-membership-message" className="text-sm font-semibold text-coop-ink">Application message</label>
        <textarea id="true-membership-message" required maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-coop-border p-3 text-sm" placeholder="Tell the chairman you would like to become a True Member." />
        <Button type="submit" disabled={busy || !message.trim()} className="mt-4">{busy ? "Submitting…" : "Submit Application"}</Button>
      </form>}
    </> : !error && <p role="status">Loading requirements…</p>}
  </Modal>;
}
