"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, Package } from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api-client";

type PaymentStatus = {
  referenceNumber: string;
  validationStatus: "Pending" | "Needs Clarification" | "Validated" | "Rejected" | "Reversed";
  gatewayStatus: string | null;
  amount: number;
  currency: string;
};

type StorePaymentReturnPanelProps = {
  paymentReferenceId: string;
  referenceNumber: string;
  statusToken: string;
  onContinueShopping: () => void;
};

const POLL_INTERVAL_MS = 2_500;
const MAX_POLL_ATTEMPTS = 24;

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function StorePaymentReturnPanel({
  paymentReferenceId,
  referenceNumber,
  statusToken,
  onContinueShopping,
}: StorePaymentReturnPanelProps) {
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [view, setView] = useState<"checking" | "confirmed" | "review" | "unavailable" | "timed-out">("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    async function checkStatus(attempt: number) {
      try {
        const nextPayment = await apiRequest<PaymentStatus>(
          `/api/paymongo/public/payments/${encodeURIComponent(paymentReferenceId)}/status?referenceNumber=${encodeURIComponent(referenceNumber)}&statusToken=${encodeURIComponent(statusToken)}`,
        );

        if (cancelled) return;

        setPayment(nextPayment);
        setErrorMessage("");

        if (nextPayment.validationStatus === "Validated") {
          setView("confirmed");
          return;
        }

        if (["Rejected", "Reversed", "Needs Clarification"].includes(nextPayment.validationStatus)) {
          setView("review");
          return;
        }

        if (attempt >= MAX_POLL_ATTEMPTS) {
          setView("timed-out");
          return;
        }

        timeoutId = window.setTimeout(() => void checkStatus(attempt + 1), POLL_INTERVAL_MS);
      } catch (error) {
        if (cancelled) return;

        setView("unavailable");
        setErrorMessage(
          error instanceof ApiClientError
            ? error.message
            : "We could not check the QRPH payment status right now.",
        );
      }
    }

    void checkStatus(1);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [paymentReferenceId, referenceNumber, retryKey, statusToken]);

  const isConfirmed = view === "confirmed";
  const needsReview = view === "review";
  const canRetry = view === "unavailable" || view === "timed-out";

  return (
    <section className="grid min-h-full content-center gap-5 py-5 text-center" aria-live="polite">
      <div className={`mx-auto grid size-14 place-items-center rounded-full ${isConfirmed ? "bg-[#EAF5EC] text-[#1F6B43]" : needsReview || canRetry ? "bg-[#FFF4E0] text-[#9A6400]" : "bg-[#EAF5EC] text-[#1F6B43]"}`}>
        {isConfirmed ? <CheckCircle className="size-7" /> : needsReview || canRetry ? <AlertCircle className="size-7" /> : <Loader2 className="size-7 animate-spin" />}
      </div>

      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#D8A011]">QRPH order</p>
        <h3 className="mt-2 text-2xl font-black text-[#123D2A]">
          {isConfirmed ? "Payment confirmed" : needsReview ? "Payment needs review" : "Payment submitted"}
        </h3>
        <p className="mt-3 text-sm leading-6 text-[#52705D]">
          {isConfirmed
            ? "Thank you. Your payment is confirmed. Please wait for the bookkeeper to release your products."
            : needsReview
              ? "Your order will not be released until the payment status has been resolved."
              : canRetry
                ? "Your payment may still be processing. You can safely return later while QRPH confirmation is completed."
                : "We are waiting for QRPH confirmation before your products can be released."}
        </p>
      </div>

      <div className="rounded-xl border border-[#D8E5DB] bg-[#F8FBF8] p-4 text-left">
        <dl className="grid gap-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="font-semibold text-[#789181]">Order reference</dt>
            <dd className="max-w-[60%] break-words text-right font-black text-[#123D2A]">{payment?.referenceNumber ?? referenceNumber}</dd>
          </div>
          {payment && (
            <div className="flex items-center justify-between gap-4 border-t border-[#DDE9E0] pt-3">
              <dt className="font-semibold text-[#789181]">Amount</dt>
              <dd className="font-black text-[#123D2A]">{formatAmount(payment.amount, payment.currency)}</dd>
            </div>
          )}
        </dl>
      </div>

      {isConfirmed && (
        <div className="flex items-start gap-3 rounded-xl border border-[#BBD7C1] bg-[#EEF8F0] p-4 text-left text-sm leading-6 text-[#315D42]">
          <Package className="mt-0.5 size-5 shrink-0 text-[#1F6B43]" />
          <p>Your products are paid and queued for release. The store team will update the order when it is ready.</p>
        </div>
      )}

      {errorMessage && <p className="text-sm font-semibold text-[#A54A2A]">{errorMessage}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {canRetry && (
          <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="rounded-xl border border-[#BBD7C1] bg-white px-4 py-3 text-sm font-bold text-[#123D2A] transition hover:bg-[#F5F8F3]">
            Check status again
          </button>
        )}
        <button type="button" onClick={onContinueShopping} className="rounded-xl bg-[#123D2A] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#123D2A]/90">
          Continue shopping
        </button>
      </div>
    </section>
  );
}
