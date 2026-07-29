"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Search,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type ChangeEvent, type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiClientError } from "@/lib/api-client";
import {
  createMembershipApplicationPaymongoCheckout,
  getMembershipApplicationStatus,
} from "../membership-application-api";
import type { PublicMembershipPaymentStatus } from "../public-payment-types";

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}

function suggestedCapitalAmount(status: PublicMembershipPaymentStatus) {
  if (
    status.latestCheckout?.paymentPurpose === "Share Capital"
    && status.latestCheckout.amount > 0
    && status.shareCapital.pendingAmount > 0
  ) {
    return status.latestCheckout.amount;
  }
  const minimum = status.shareCapital.minimumNextAmount;
  const targetGap = status.shareCapital.remainingToTarget;
  const maximumGap = status.shareCapital.remainingToMaximum;
  const preferred = targetGap > 0 ? Math.max(minimum, targetGap) : minimum;
  return Math.min(preferred, maximumGap);
}

export function ApplicationStatusPayments() {
  const searchParams = useSearchParams();
  const [applicationCode, setApplicationCode] = useState(
    searchParams.get("code") ?? "",
  );
  const [trackingToken, setTrackingToken] = useState("");
  const [status, setStatus] = useState<PublicMembershipPaymentStatus | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [checkoutAction, setCheckoutAction] = useState<
    "Associate Membership Fee" | "Share Capital" | null
  >(null);
  const [shareCapitalAmount, setShareCapitalAmount] = useState("1500");

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = applicationCode.trim();
    const token = trackingToken.trim();
    if (!code || !token) {
      setLookupError("Enter the application code and private tracking secret.");
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setCheckoutError(null);
    try {
      const result = await getMembershipApplicationStatus({
        applicationCode: code,
        trackingToken: token,
      }) as PublicMembershipPaymentStatus;
      setStatus(result);
      const suggested = suggestedCapitalAmount(result);
      if (suggested > 0) setShareCapitalAmount(String(suggested));
    } catch (error) {
      setStatus(null);
      setLookupError(
        error instanceof ApiClientError
          ? error.message
          : "Unable to load the application status. Please try again.",
      );
    } finally {
      setIsLookingUp(false);
    }
  }

  async function startCheckout(
    paymentPurpose: "Associate Membership Fee" | "Share Capital",
  ) {
    if (!status || checkoutAction) return;
    const amount = Number(shareCapitalAmount);
    if (
      paymentPurpose === "Share Capital"
      && (!Number.isFinite(amount)
        || amount < status.shareCapital.minimumNextAmount
        || amount > status.shareCapital.remainingToMaximum)
    ) {
      setCheckoutError(
        `Enter an amount from ${peso(status.shareCapital.minimumNextAmount)} to ${peso(status.shareCapital.remainingToMaximum)}.`,
      );
      return;
    }

    setCheckoutAction(paymentPurpose);
    setCheckoutError(null);
    try {
      const checkout = await createMembershipApplicationPaymongoCheckout({
        applicationCode: status.applicationCode,
        trackingToken: trackingToken.trim(),
        paymentPurpose,
        requestedAmount: paymentPurpose === "Share Capital" ? amount : undefined,
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setCheckoutError(
        error instanceof ApiClientError
          ? error.message
          : "Unable to start PayMongo checkout. Please try again.",
      );
      setCheckoutAction(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <form
        onSubmit={lookup}
        className="h-fit rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(18,61,42,0.10)] ring-1 ring-[#DDE8D8] sm:p-8"
      >
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b62a]">
          Secure lookup
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-normal text-[#123D2A]">
          Track your application
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#365F4A]">
          Enter the application code and private tracking secret shown after submission.
        </p>

        <label className="mt-7 block text-sm font-bold text-[#365F4A]">
          Application code
          <input
            value={applicationCode}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setApplicationCode(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-[#DDE8D8] bg-white px-4 text-base text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
            autoComplete="off"
          />
        </label>
        <label className="mt-5 block text-sm font-bold text-[#365F4A]">
          Tracking secret
          <input
            type="password"
            value={trackingToken}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTrackingToken(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-[#DDE8D8] bg-white px-4 text-base text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"
            autoComplete="off"
          />
        </label>

        {lookupError ? <ErrorNotice message={lookupError} /> : null}

        <Button
          type="submit"
          disabled={isLookingUp}
          className="mt-6 h-11 w-full rounded-full bg-[#123D2A] text-white hover:bg-[#1F6B43]"
        >
          {isLookingUp ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {isLookingUp ? "Checking..." : "Check Status"}
        </Button>
      </form>

      <section className="rounded-[2rem] border border-[#DDE8D8] bg-[#F8F1E5] p-5 shadow-sm sm:p-8">
        {!status ? (
          <div className="grid min-h-[420px] place-items-center text-center">
            <div>
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
                <ShieldCheck className="size-7" />
              </div>
              <h2 className="mt-4 text-2xl font-black text-[#123D2A]">
                Safe public status
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[#365F4A]">
                Only applicant-safe review and payment totals are displayed. Internal IDs,
                webhook data, secret values, and tracking hashes stay hidden.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b62a]">
                  {status.applicationStatus}
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#123D2A]">
                  {status.applicationCode}
                </h2>
                <p className="mt-1 text-sm text-[#365F4A]">{status.fullName}</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#FFF3C9] px-4 py-2 text-xs font-black text-[#775200]">
                <ShieldCheck className="size-4" />
                {status.paymongoMode === "test"
                  ? "PayMongo Test Mode — No real money will be charged"
                  : "PayMongo Live Mode"}
              </span>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <AmountCard
                title="Membership fee"
                icon={CreditCard}
                rows={[
                  ["Required", peso(status.membershipFee.requiredAmount)],
                  ["Validated", peso(status.membershipFee.validatedAmount)],
                  ["Pending checkout", peso(status.membershipFee.pendingAmount)],
                  ["Remaining", peso(status.membershipFee.remainingAmount)],
                ]}
                state={status.membershipFee.status}
              >
                {status.membershipFee.canStartCheckout ? (
                  <Button
                    type="button"
                    disabled={Boolean(checkoutAction)}
                    onClick={() => void startCheckout("Associate Membership Fee")}
                    className="mt-4 h-11 w-full rounded-full bg-[#123D2A] text-white hover:bg-[#1F6B43]"
                  >
                    {checkoutAction === "Associate Membership Fee"
                      ? <Loader2 className="size-4 animate-spin" />
                      : <CreditCard className="size-4" />}
                    {status.membershipFee.pendingAmount > 0
                      ? "Continue Membership Fee Checkout"
                      : "Pay Membership Fee"}
                  </Button>
                ) : null}
              </AmountCard>

              {status.requestedMembershipType === "True Member" ? (
                <AmountCard
                  title="Share capital"
                  icon={Wallet}
                  rows={[
                    ["Validated", peso(status.shareCapital.validatedAmount)],
                    ["Active pending", peso(status.shareCapital.pendingAmount)],
                    ["Remaining to PHP 3,000", peso(status.shareCapital.remainingToTarget)],
                    ["Remaining to PHP 15,000 max", peso(status.shareCapital.remainingToMaximum)],
                    ["Installments", String(status.shareCapital.installmentCount)],
                  ]}
                  state={status.shareCapital.pendingAmount > 0
                    ? "Pending"
                    : status.shareCapital.validatedAmount >= status.shareCapital.targetAmount
                      ? "Confirmed"
                      : status.shareCapital.canStartCheckout
                        ? "Required"
                        : "Unavailable"}
                >
                  {status.shareCapital.canStartCheckout ? (
                    <div className="mt-4 grid gap-3">
                      <label className="text-xs font-black uppercase tracking-[0.14em] text-[#365F4A]">
                        Installment amount
                        <input
                          type="number"
                          min={status.shareCapital.minimumNextAmount}
                          max={status.shareCapital.remainingToMaximum}
                          step="0.01"
                          value={shareCapitalAmount}
                          disabled={status.shareCapital.pendingAmount > 0}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => setShareCapitalAmount(event.target.value)}
                          className="mt-2 h-11 w-full rounded-full border border-[#DDE8D8] bg-white px-4 text-base font-bold text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20 disabled:bg-[#EEF2EC]"
                        />
                      </label>
                      <Button
                        type="button"
                        disabled={Boolean(checkoutAction)}
                        onClick={() => void startCheckout("Share Capital")}
                        className="h-11 w-full rounded-full bg-[#123D2A] text-white hover:bg-[#1F6B43]"
                      >
                        {checkoutAction === "Share Capital"
                          ? <Loader2 className="size-4 animate-spin" />
                          : <Wallet className="size-4" />}
                        {status.shareCapital.pendingAmount > 0
                          ? "Continue Active Installment"
                          : "Start Share Capital Installment"}
                      </Button>
                    </div>
                  ) : null}
                </AmountCard>
              ) : null}
            </div>

            {status.latestCheckout ? (
              <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#FFF3C9] text-[#775200]">
                    <Clock3 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#365F4A]">
                      Latest checkout state
                    </p>
                    <p className="mt-1 break-words text-sm font-black text-[#123D2A]">
                      {status.latestCheckout.paymentPurpose} · {status.latestCheckout.referenceNumber}
                    </p>
                    <p className="mt-1 text-sm text-[#365F4A]">
                      {peso(status.latestCheckout.amount)} · {status.latestCheckout.gatewayStatus}
                      {status.latestCheckout.isReusable ? " · Ready to continue" : " · No longer reserving capital"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {checkoutError ? <ErrorNotice message={checkoutError} /> : null}

            <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4 text-sm text-[#365F4A]">
              <p className="font-black text-[#123D2A]">Applicant message</p>
              <p className="mt-2 leading-7">
                {status.latestApplicantMessage ?? "No message posted yet."}
              </p>
            </div>

            {status.missingOrRejectedRequirements.length > 0 ? (
              <div className="rounded-2xl border border-[#DDE8D8] bg-white p-4">
                <p className="text-sm font-black uppercase tracking-[0.14em] text-[#123D2A]">
                  Requirements needing attention
                </p>
                <ul className="mt-3 grid gap-2 text-sm text-[#365F4A]">
                  {status.missingOrRejectedRequirements.map((requirement) => (
                    <li
                      key={`${requirement.requirementType}-${requirement.requirementStatus}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[#F8F1E5] px-3 py-2"
                    >
                      <span>{requirement.requirementType}</span>
                      <span className="font-black text-[#123D2A]">
                        {requirement.requirementStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function AmountCard({
  title,
  icon: Icon,
  rows,
  state,
  children,
}: {
  title: string;
  icon: LucideIcon;
  rows: Array<[string, string]>;
  state: string;
  children?: ReactNode;
}) {
  const confirmed = state === "Confirmed";
  return (
    <article className="rounded-2xl border border-[#DDE8D8] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-[#123D2A]">{title}</p>
          <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
            confirmed
              ? "bg-[#EAF3E8] text-[#1F6B43]"
              : state === "Pending"
                ? "bg-[#FFF3C9] text-[#775200]"
                : "bg-[#EEF2EC] text-[#365F4A]"
          }`}>
            {confirmed ? <CheckCircle2 className="size-3.5" /> : <Clock3 className="size-3.5" />}
            {state}
          </span>
        </div>
        <div className="grid size-10 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
          <Icon className="size-5" />
        </div>
      </div>
      <dl className="mt-4 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 border-b border-[#EEF2EC] pb-2 last:border-0 last:pb-0">
            <dt className="text-[#5D6D63]">{label}</dt>
            <dd className="text-right font-black text-[#123D2A]">{value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </article>
  );
}
