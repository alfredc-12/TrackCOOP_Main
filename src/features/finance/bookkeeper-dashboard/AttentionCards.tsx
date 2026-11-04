"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Clock3,
  ShieldAlert,
} from "lucide-react";
import { ErrorState, StatusBadge } from "@/components/portal/PortalPrimitives";
import type { AttentionItem, DashboardAttention } from "./dashboard-api";
import { formatManilaTimestamp, formatPeso } from "./dashboard-format";
import { InfoButton } from "./InfoButton";

type AttentionCardsProps = {
  attention: DashboardAttention | null;
  error?: string;
  onRetry: () => void;
};

function reasonBadge(reason: AttentionItem["reason"]) {
  if (reason === "exception") return { label: "Record issue", tone: "danger" as const };
  if (reason === "clarification") return { label: "Needs clarification", tone: "warning" as const };
  return { label: "Awaiting manual review", tone: "warning" as const };
}

export function AttentionCards({ attention, error, onRetry }: AttentionCardsProps) {
  if (error) {
    return (
      <section aria-label="Bookkeeper attention items">
        <ErrorState message={error} onRetry={onRetry} />
      </section>
    );
  }

  if (!attention) {
    return (
      <section aria-label="Bookkeeper attention items" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl bg-[#E7F2E4]" />
        ))}
      </section>
    );
  }

  const cards = [
    {
      label: "Payments Awaiting Review",
      value: attention.awaitingReview.toLocaleString("en-PH"),
      scopeBadge: "Current backlog",
      tone: attention.awaitingReview > 0 ? "warning" : "success",
      statusText:
        attention.awaitingReview > 0
          ? "Manual verification required"
          : "All manual payments reviewed",
      footnote:
        attention.awaitingGateway > 0
          ? `${attention.awaitingGateway.toLocaleString("en-PH")} online PayMongo ${
              attention.awaitingGateway === 1 ? "checkout awaits" : "checkouts await"
            } automatic gateway settlement`
          : "Excludes gateway-managed pending checkouts",
      info: "Counts Pending payment references submitted via Cash, Manual GCash, Bank Transfer, or Other channels. Online PayMongo checkouts settle via webhook and are excluded.",
      href: "/portal/bookkeeper/payment-validation?view=manual&status=Pending",
      cta: "Review manual payments",
      icon: Clock3,
    },
    {
      label: "Payments Needing Clarification",
      value: attention.needsClarification.toLocaleString("en-PH"),
      scopeBadge: "Current backlog",
      tone: attention.needsClarification > 0 ? "warning" : "neutral",
      statusText:
        attention.needsClarification > 0
          ? "Awaiting member or payer follow-up"
          : "No references awaiting correction",
      footnote: "Flagged for receipt, amount, or reference follow-up",
      info: "Counts operational payment references currently marked Needs Clarification.",
      href: "/portal/bookkeeper/payment-validation?status=Needs+Clarification",
      cta: "Open clarification queue",
      icon: CircleAlert,
    },
    {
      label: "Payments Approved Today",
      value: attention.approvedToday.toLocaleString("en-PH"),
      scopeBadge: "Today · Asia/Manila",
      tone: attention.approvedToday > 0 ? "success" : "neutral",
      statusText:
        attention.approvedToday > 0
          ? "Validated during today's Manila calendar day"
          : "No validations recorded yet today",
      footnote: "Midnight-to-midnight Philippine time (UTC+8)",
      info: "Counts operational payments whose validation timestamp falls within the current Asia/Manila calendar day, whether approved manually or via verified PayMongo webhook.",
      href: "/portal/bookkeeper/payment-validation?view=validations&period=today",
      cta: "View today's approvals",
      icon: BadgeCheck,
    },
    {
      label: "Records Needing Attention",
      value: attention.recordsNeedingAttention.toLocaleString("en-PH"),
      scopeBadge: "Current backlog",
      tone: attention.recordsNeedingAttention > 0 ? "danger" : "success",
      statusText:
        attention.recordsNeedingAttention > 0
          ? "Posting, receipt, or gateway exception detected"
          : "No posting or receipt discrepancies detected",
      footnote: "Missing/duplicate postings, failed gateway events, or failed receipts",
      info: "Counts reliably detectable exceptions: validated POS/Rental payments without a single matching income record, validated member share-capital payments without a single ledger credit, failed PayMongo events, or failed/missing receipts.",
      href: "/portal/bookkeeper/payment-validation?view=exceptions",
      cta: "Inspect exceptions",
      icon: ShieldAlert,
    },
  ] as const;

  return (
    <section aria-labelledby="attention-heading" className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="attention-heading" className="text-base font-black text-[#123D2A]">
            Requires Bookkeeper Attention
          </h2>
          <p className="text-xs text-[#5D6D63]">
            Live operational queues (lifetime backlog) and today&apos;s Philippine validation count.
            {attention.testPaymentsExcluded > 0
              ? ` ${attention.testPaymentsExcluded.toLocaleString("en-PH")} PayMongo test-mode ${
                  attention.testPaymentsExcluded === 1 ? "reference is" : "references are"
                } excluded from operational totals.`
              : ""}
          </p>
        </div>
        <Link
          href="/portal/bookkeeper/payment-validation"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#1F6B43] hover:text-[#123D2A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]"
        >
          Open Payment Validation
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const borderTone =
            card.tone === "danger"
              ? "border-[#E7B8A8]"
              : card.tone === "warning"
                ? "border-[#E6C97A]"
                : "border-[#CAD8CB]";
          const iconBg =
            card.tone === "danger"
              ? "bg-[#FFE6E0] text-[#9A392A]"
              : card.tone === "warning"
                ? "bg-[#FFF4D7] text-[#8A6200]"
                : "bg-[#EEF6EC] text-[#1F6B43]";

          return (
            <article
              key={card.label}
              className={`flex min-w-0 flex-col justify-between rounded-xl border ${borderTone} bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.05)]`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center rounded-md bg-[#F7F8F3] px-2 py-0.5 text-[11px] font-bold text-[#5D6D63]">
                    {card.scopeBadge}
                  </span>
                  <div className="flex items-center gap-1">
                    <InfoButton label={card.label}>{card.info}</InfoButton>
                    <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${iconBg}`}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
                <p className="mt-2.5 text-xs font-bold uppercase tracking-wider text-[#5D6D63]">
                  {card.label}
                </p>
                <p className="mt-1 text-3xl font-black tabular-nums text-[#123D2A]">{card.value}</p>
                <p className="mt-2 text-xs font-bold text-[#294B39]">{card.statusText}</p>
                <p className="mt-1 text-xs leading-5 text-[#5D6D63]">{card.footnote}</p>
              </div>
              <Link
                href={card.href}
                className="mt-3 inline-flex items-center gap-1 border-t border-[#EEF2EC] pt-2.5 text-xs font-bold text-[#1F6B43] hover:text-[#123D2A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]"
              >
                <span>{card.cta}</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </div>

      {attention.items.length > 0 ? (
        <div className="rounded-xl border border-[#CAD8CB] bg-white p-4 shadow-[0_10px_24px_rgba(18,61,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-[#8A6200]" aria-hidden="true" />
              <h3 className="text-sm font-black text-[#123D2A]">
                Oldest Outstanding Payment Items ({attention.items.length})
              </h3>
            </div>
            <Link
              href="/portal/bookkeeper/payment-validation"
              className="text-xs font-bold text-[#1F6B43] hover:text-[#123D2A]"
            >
              View full validation queue →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-[#EEF2EC]">
            {attention.items.map((item) => {
              const badge = reasonBadge(item.reason);
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-[#123D2A]">{item.referenceNumber}</span>
                      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                      <span className="font-semibold text-[#365F4A]">{item.purpose}</span>
                      <span className="text-[#5D6D63]">· {item.channel}</span>
                    </div>
                    <p className="mt-0.5 text-[#5D6D63]">
                      Payer: <strong className="font-semibold text-[#294B39]">{item.payer ?? "Not recorded"}</strong> · Submitted{" "}
                      {formatManilaTimestamp(item.submittedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <span className="text-sm font-black tabular-nums text-[#123D2A]">
                      {formatPeso(item.amount)}
                    </span>
                    <Link
                      href={`/portal/bookkeeper/payment-validation?paymentId=${encodeURIComponent(item.id)}`}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-xs font-bold text-[#123D2A] transition hover:border-[#1F6B43] hover:bg-[#EEF6EC]"
                    >
                      Inspect
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

