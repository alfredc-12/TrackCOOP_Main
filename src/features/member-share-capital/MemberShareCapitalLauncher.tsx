"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiClientError } from "@/lib/api-client";
import {
  createMemberShareCapitalCheckout,
  getMemberShareCapitalSummary,
  refreshMemberShareCapitalPayment,
} from "./api";
import type { MemberShareCapitalSummary } from "./types";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}

function errorMessage(error: unknown) {
  return error instanceof ApiClientError
    ? error.message
    : "The Share Capital checkout could not be completed.";
}

export function MemberShareCapitalLauncher() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<MemberShareCapitalSummary | null>(null);
  const [amount, setAmount] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getMemberShareCapitalSummary();
      setSummary(data);
      if (!amount && data.availableCapacity > 0) {
        setAmount(String(Math.min(data.availableCapacity, Math.max(500, data.remainingToTrueMember || 500))));
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [amount]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const requestedAmount = Number(amount);
  const amountValid = useMemo(
    () =>
      Number.isFinite(requestedAmount)
      && requestedAmount > 0
      && Boolean(summary)
      && requestedAmount <= (summary?.availableCapacity ?? 0),
    [requestedAmount, summary],
  );

  async function startCheckout() {
    if (!amountValid) return;
    setLoading(true);
    setError("");
    try {
      const checkout = await createMemberShareCapitalCheckout({
        requestedAmount,
        clientRequestId: requestId,
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (caught) {
      setError(errorMessage(caught));
      await load().catch(() => undefined);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    if (!summary?.activeCheckout) return;
    setChecking(true);
    setError("");
    try {
      await refreshMemberShareCapitalPayment(
        summary.activeCheckout.paymentReferenceId,
      );
      setRequestId(crypto.randomUUID());
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setChecking(false);
    }
  }

  return (
    <Modal
      title="Pay Share Capital with PayMongo"
      description="Create a secure contribution for your own authenticated Member profile. Confirmation comes only from verified PayMongo settlement."
      open={open}
      onOpenChange={setOpen}
      maxWidth="max-w-2xl"
      trigger={
        <button
          type="button"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-[#123D2A] px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#1F6B43] focus:outline-none focus:ring-4 focus:ring-[#1F6B43]/25"
        >
          <Wallet className="size-5" />
          Pay Share Capital
        </button>
      }
    >
      {loading && !summary ? (
        <div className="flex min-h-48 items-center justify-center text-[#365f4a]">
          <Loader2 className="mr-2 size-5 animate-spin" /> Loading your capital record…
        </div>
      ) : error && !summary ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-bold">Checkout is unavailable</p>
              <p className="mt-1">{error}</p>
              <Button className="mt-4" onClick={() => void load()}>Try again</Button>
            </div>
          </div>
        </div>
      ) : summary ? (
        <div className="space-y-5">
          {summary.mode === "test" ? (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <ShieldCheck className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-bold">PayMongo Test Mode</p>
                <p>No real money will be charged. Test and Live payments remain separated.</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Validated Capital", money(summary.validatedCapital)],
              ["Active Pending", money(summary.activePendingCapital)],
              ["Remaining to PHP 3,000", money(summary.remainingToTrueMember)],
              ["Maximum", money(summary.maximumShareCapital)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[#D7E1D9] bg-[#F8FAF7] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#5b7164]">{label}</p>
                <p className="mt-2 text-lg font-bold text-[#123D2A]">{value}</p>
              </div>
            ))}
          </div>

          {summary.activeCheckout ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 size-5 text-blue-700" />
                <div className="flex-1">
                  <p className="font-bold text-blue-950">A checkout is already active</p>
                  <p className="mt-1 text-sm text-blue-800">
                    {money(summary.activeCheckout.amount)} · attempt {summary.activeCheckout.attemptNumber ?? "—"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => window.location.assign(summary.activeCheckout!.checkoutUrl)}>
                      Continue checkout <ExternalLink className="size-4" />
                    </Button>
                    <Button variant="outline" disabled={checking} onClick={() => void refreshStatus()}>
                      {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                      Refresh status
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#D7E1D9] p-5">
              <label className="text-sm font-bold text-[#173626]" htmlFor="member-share-capital-amount">
                Contribution amount
              </label>
              <div className="mt-2 flex rounded-xl border border-[#BFD0C3] bg-white focus-within:ring-2 focus-within:ring-[#1F6B43]/25">
                <span className="flex items-center px-4 font-semibold text-[#365f4a]">PHP</span>
                <input
                  id="member-share-capital-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={summary.availableCapacity}
                  value={amount}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setAmount(event.target.value);
                    setRequestId(crypto.randomUUID());
                  }}
                  className="min-w-0 flex-1 rounded-r-xl px-3 py-3 text-right text-lg font-bold outline-none"
                />
              </div>
              <p className="mt-2 text-xs text-[#5b7164]">
                Available capacity: {money(summary.availableCapacity)}. Your contribution must be positive and cannot make your total exceed PHP 15,000.
              </p>
              {!amountValid && amount ? (
                <p className="mt-2 text-sm font-semibold text-red-600">Enter an amount from PHP 0.01 to {money(summary.availableCapacity)}.</p>
              ) : null}
              <Button
                className="mt-4 w-full bg-[#123D2A] text-white hover:bg-[#1F6B43]"
                disabled={!summary.eligible || !amountValid || loading}
                onClick={() => void startCheckout()}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Start secure PayMongo checkout
              </Button>
            </div>
          )}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-4">
            <p className="text-xs text-[#5b7164]">Member {summary.memberCode} · {summary.membershipType}</p>
            <Link href="/statement" target="_blank" className="inline-flex items-center gap-2 text-sm font-bold text-[#1F6B43] hover:underline">
              <History className="size-4" /> Payment history
            </Link>
          </div>

          {summary.history.length > 0 ? (
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {summary.history.slice(0, 5).map((item) => (
                <div key={item.paymentReferenceId} className="flex items-center justify-between rounded-xl bg-[#F8FAF7] px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-[#173626]">{item.referenceNumber}</p>
                    <p className="text-xs text-[#6B7280]">{new Date(item.submittedAt).toLocaleDateString("en-US")}{item.receiptNumber ? ` · ${item.receiptNumber}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#173626]">{money(item.amount)}</p>
                    <p className="text-xs font-semibold text-[#5b7164]">{item.validationStatus}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
