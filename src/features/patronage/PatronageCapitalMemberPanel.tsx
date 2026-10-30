"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getPatronageCapitalOverview, requestPatronageCapital, type PatronageCapitalOverview } from "./patronage-api";

const money = (amount: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

export function PatronageCapitalMemberPanel() {
  const [data, setData] = useState<PatronageCapitalOverview | null>(null);
  const [allocationId, setAllocationId] = useState("");
  const [amount, setAmount] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await getPatronageCapitalOverview();
      setData(result);
      setAllocationId((current) => result.refunds.some((refund) => refund.allocationId === current) ? current : result.refunds[0]?.allocationId ?? "");
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load your refund. Please try again.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const refund = data?.refunds.find((item) => item.allocationId === allocationId);
  const maximum = Math.min(refund?.availableAmount ?? 0, data?.availableCapacity ?? 0);
  const requested = Number(amount);
  const valid = amount !== "" && Number.isFinite(requested) && requested > 0 && requested <= maximum
    && Math.abs(requested * 100 - Math.round(requested * 100)) < 0.000001;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      await requestPatronageCapital({ allocationId, amount: requested, requestKey });
      setSuccess(`${money(requested)} sent for Bookkeeper approval. Your Share Capital has not changed yet.`);
      setConfirming(false);
      setAmount("");
      setRequestKey(crypto.randomUUID());
      await load();
      window.dispatchEvent(new Event("trackcoop:patronage-updated"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[#5D6D63]">Use an unpaid patronage refund instead of receiving it as cash. The Bookkeeper will check your request before adding it to your Share Capital.</p>
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<Button className="mt-2" variant="secondary" disabled={busy} onClick={() => void load()}>Try again</Button></div> : null}
      {success ? <p role="status" className="rounded-xl border border-[#BFD9C5] bg-[#EAF3E8] p-4 text-sm text-[#1F6B43]">{success}</p> : null}
      {!data && !error ? <p role="status">Loading your patronage refund…</p> : null}
      {data ? <>
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F3F7F1] p-4 text-sm text-[#365F4A]">
          <p>Current Share Capital<strong className="mt-1 block text-lg text-[#123D2A]">{money(data.currentCapital)}</strong></p>
          <p>You can still add<strong className="mt-1 block text-lg text-[#123D2A]">{money(data.availableCapacity)}</strong></p>
        </div>
        {!data.refunds.length ? <p className="rounded-xl border border-dashed border-[#CAD8CB] p-4 text-sm text-[#5D6D63]">You have no patronage refund available yet. Refunds awaiting review are shown below.</p> : data.availableCapacity <= 0 ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Your Share Capital limit is already reached or reserved by pending payments.</p> : <>
          <label className="block text-sm font-bold text-[#173626]" htmlFor="patronage-refund-period">Choose a refund</label>
          <select id="patronage-refund-period" value={allocationId} disabled={busy} onChange={(event) => { setAllocationId(event.target.value); setAmount(""); setConfirming(false); setRequestKey(crypto.randomUUID()); }} className="h-11 w-full rounded-xl border border-[#CAD8CB] bg-white px-3 text-sm text-[#173626]">
            {data.refunds.map((item) => <option key={item.allocationId} value={item.allocationId}>{item.periodName} — {money(item.availableAmount)} available</option>)}
          </select>
          <div className="rounded-xl border border-[#CAD8CB] p-4">
            <p className="mb-3 text-sm text-[#5D6D63]">Available refund: <strong className="text-[#1F6B43]">{money(refund?.availableAmount ?? 0)}</strong></p>
            <label htmlFor="patronage-capital-amount" className="text-sm font-bold text-[#173626]">Amount to add (₱)</label>
            <input id="patronage-capital-amount" type="number" min="0.01" max={maximum} step="0.01" value={amount} disabled={busy} onChange={(event) => { setAmount(event.target.value); setConfirming(false); setRequestKey(crypto.randomUUID()); }} className="mt-2 h-12 w-full rounded-xl border border-[#CAD8CB] px-3 text-lg font-bold text-[#173626]" />
            <button type="button" disabled={busy} onClick={() => { setAmount(maximum.toFixed(2)); setConfirming(false); setRequestKey(crypto.randomUUID()); }} className="mt-2 min-h-10 text-sm font-bold text-[#1F6B43] underline">Use the available amount: {money(maximum)}</button>
            {amount && !valid ? <p role="alert" className="mt-2 text-sm text-red-700">Enter an amount from ₱0.01 to {money(maximum)}, with up to two decimal places.</p> : null}
            {confirming ? <div className="mt-4 rounded-xl bg-[#F3F7F1] p-4">
              <p className="font-bold text-[#173626]">Add {money(requested)} from your refund to your Share Capital?</p>
              <p className="mt-2 text-sm text-[#5D6D63]">This amount will be held for review. Once approved, it cannot also be received as cash. Any unused refund stays available.</p>
              <div className="mt-4 flex flex-wrap gap-2"><Button loading={busy} disabled={busy || !valid} onClick={() => void submit()}>Yes, send request</Button><Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>Go back</Button></div>
            </div> : <Button className="mt-4 w-full" disabled={!valid || busy} onClick={() => setConfirming(true)}>Add refund to Share Capital</Button>}
          </div>
        </>}
        {data.transfers.length ? <section className="space-y-2" aria-label="Refund transfer history">
          <h3 className="text-sm font-bold text-[#173626]">Your refund transfer requests</h3>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {data.transfers.map((item) => <div key={item.id} className="rounded-xl border border-[#DDE8D8] p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><span className="font-bold text-[#173626]">{money(item.amount)} · {item.periodName}</span><span className="font-semibold text-[#365F4A]">{item.status === "Pending" ? "Waiting for Bookkeeper" : item.status === "Approved" ? "Added to Share Capital" : "Declined — refund released"}</span></div>
              <p className="mt-1 text-xs text-[#6C7A70]">Requested {new Date(item.requestedAt).toLocaleDateString("en-PH")}</p>
              {item.notes ? <p className="mt-1 text-[#5D6D63]">{item.notes}</p> : null}
            </div>)}
          </div>
        </section> : null}
      </> : null}
    </div>
  );
}
