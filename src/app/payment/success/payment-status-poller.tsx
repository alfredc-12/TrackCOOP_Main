"use client";

import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiClientError, apiRequest } from "@/lib/api-client";

type PaymentValidationStatus =
  | "Pending"
  | "Needs Clarification"
  | "Validated"
  | "Rejected"
  | "Reversed";

type PaymentStatus = {
  paymentReferenceId: string;
  referenceNumber: string;
  validationStatus: PaymentValidationStatus;
  gatewayStatus: string | null;
  amount: number;
  currency: "PHP";
};

type PollState = "idle" | "checking" | "confirmed" | "failed" | "unavailable" | "timeout";

const maxAttempts = 48;
const pollIntervalMs = 2500;

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);
}

function statusFor(payment: PaymentStatus): PollState {
  if (payment.validationStatus === "Validated") return "confirmed";
  if (payment.validationStatus === "Rejected" || payment.validationStatus === "Reversed") return "failed";
  return "checking";
}

export default function PaymentStatusPoller() {
  const searchParams = useSearchParams();
  const paymentReferenceId = searchParams?.get("paymentReferenceId")?.trim() ?? "";
  const referenceNumber = searchParams?.get("referenceNumber")?.trim() ?? "";
  const [attempts, setAttempts] = useState(0);
  const [state, setState] = useState<PollState>(paymentReferenceId && referenceNumber ? "checking" : "idle");
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const statusText = useMemo(() => {
    if (state === "confirmed") return "Payment confirmed";
    if (state === "failed") return "Payment needs review";
    if (state === "timeout") return "Still waiting for confirmation";
    if (state === "unavailable") return "Status check unavailable";
    if (state === "idle") return "Payment checkout submitted";
    return "Waiting for PayMongo confirmation";
  }, [state]);

  const StatusIcon = state === "confirmed"
    ? CheckCircle2
    : state === "failed" || state === "unavailable"
      ? AlertTriangle
      : state === "checking"
        ? RefreshCw
        : Clock3;

  useEffect(() => {
    if (!paymentReferenceId || !referenceNumber) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function checkStatus(nextAttempt: number) {
      try {
        const data = await apiRequest<PaymentStatus>(
          `/api/paymongo/public/payments/${encodeURIComponent(paymentReferenceId)}/status?referenceNumber=${encodeURIComponent(referenceNumber)}`,
        );
        if (cancelled) return;
        setPayment(data);
        const nextState = statusFor(data);
        setState(nextState);
        setMessage(null);
        setAttempts(nextAttempt);
        if (nextState === "confirmed" || nextState === "failed") return;
      } catch (error) {
        if (cancelled) return;
        setState("unavailable");
        setMessage(
          error instanceof ApiClientError
            ? error.message
            : "TrackCOOP could not check the payment status.",
        );
        setAttempts(nextAttempt);
      }

      if (nextAttempt >= maxAttempts) {
        setState("timeout");
        return;
      }

      timeoutId = setTimeout(() => {
        void checkStatus(nextAttempt + 1);
      }, pollIntervalMs);
    }

    void checkStatus(1);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [paymentReferenceId, referenceNumber]);

  return (
    <div className="mt-7 rounded-3xl border border-[#DDE8D8] bg-[#F8FBF5] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
          <StatusIcon className={`size-6 ${state === "checking" ? "animate-spin" : ""}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#D8A71D]">
            {statusText}
          </p>
          <p className="mt-3 text-sm leading-7 text-[#365F4A]">
            TrackCOOP confirms payments only after the signed PayMongo webhook updates the database.
            This page checks that database status and does not validate the payment by itself.
          </p>
          {payment ? (
            <div className="mt-4 grid gap-3 text-sm text-[#123D2A] sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#68806F]">Reference</p>
                <p className="mt-1 font-bold">{payment.referenceNumber}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#68806F]">Amount</p>
                <p className="mt-1 font-bold">{money(payment.amount)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#68806F]">Status</p>
                <p className="mt-1 font-bold">{payment.validationStatus}</p>
              </div>
            </div>
          ) : null}
          {message ? <p className="mt-3 text-sm font-semibold text-[#9A3412]">{message}</p> : null}
          {state === "timeout" ? (
            <p className="mt-3 text-sm font-semibold text-[#365F4A]">
              You can close this page or check again from the application status page. The webhook may still arrive shortly.
            </p>
          ) : null}
          {attempts > 0 && state === "checking" ? (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-[#68806F]">
              Check {attempts} of {maxAttempts}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
