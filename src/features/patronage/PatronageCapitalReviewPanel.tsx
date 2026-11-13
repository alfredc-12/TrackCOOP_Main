"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  decidePatronageCapital,
  getPatronageCapitalTransfers,
  type PatronageCapitalTransfer,
} from "./patronage-api";

const money = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

type PatronageCapitalReviewPanelProps = {
  canReview: boolean;
  onProcessed: () => void;
  refreshKey?: number;
};

export function PatronageCapitalReviewPanel({
  canReview,
  onProcessed,
  refreshKey = 0,
}: PatronageCapitalReviewPanelProps) {
  const [requests, setRequests] = useState<PatronageCapitalTransfer[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequests(await getPatronageCapitalTransfers());
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load transfer requests.");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load, refreshKey]);

  async function decide(item: PatronageCapitalTransfer, decision: "Approve" | "Reject") {
    if (busy) return;

    const confirmed = window.confirm(
      decision === "Approve"
        ? `Add ${money(item.amount)} from ${item.memberName}'s patronage refund to their Share Capital? This is not a cash payout.`
        : `Decline this transfer and release ${money(item.amount)} back to the available refund?`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await decidePatronageCapital(item.id, decision);
      await load();
      onProcessed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to review this transfer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#CAD8CB] bg-white p-5" aria-label="Patronage refund transfers">
      <div>
        <h2 className="text-lg font-bold text-[#123D2A]">Refunds to Share Capital</h2>
        <p className="mt-1 text-sm text-[#5D6D63]">
          Only approval credits the member&apos;s capital. Pending requests are held out of cash payout; declined
          amounts become available again.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
        {!requests.length && !error ? (
          <p className="text-sm text-[#6C7A70]">No refund transfer requests yet.</p>
        ) : null}

        {requests.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DDE8D8] p-4 text-sm"
          >
            <div>
              <p className="font-bold text-[#173626]">
                {item.memberName} · {money(item.amount)}
              </p>
              <p className="text-[#5D6D63]">
                {item.memberCode} · {item.periodName} · {new Date(item.requestedAt).toLocaleDateString("en-PH")}
              </p>
              <p className="mt-1 font-semibold text-[#365F4A]">
                {item.status === "Approved" ? "Added to Share Capital" : item.status}
              </p>
            </div>

            {canReview && item.status === "Pending" ? (
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => void decide(item, "Approve")}>
                  Approve transfer
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void decide(item, "Reject")}>
                  Decline
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
