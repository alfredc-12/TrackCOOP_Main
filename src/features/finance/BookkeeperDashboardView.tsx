"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  CircleAlert,
  Clock3,
  FileText,
  Landmark,
  ReceiptText,
  RefreshCcw,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  CurrencyDisplay,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  getFinancialSummary,
  getPaymentReferenceSummary,
  listPaymentReferences,
  type FinancialSummary,
  type PaymentReferenceListItem,
  type PaymentReferenceSummary,
} from "./finance-api";

const emptyPaymentSummary: PaymentReferenceSummary = {
  total: 0,
  pendingTotal: 0,
  pendingManual: 0,
  needsClarification: 0,
  validatedToday: 0,
  validatedTotal: 0,
  paymongoTestPayments: 0,
  rejected: 0,
  reversed: 0,
  validatedAmount: 0,
};

const emptyFinanceSummary: FinancialSummary = {
  incomeTotal: 0,
  expenseTotal: 0,
  adjustmentTotal: 0,
  netTotal: 0,
  activeRecords: 0,
  voidedRecords: 0,
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

function purposeLabel(payment: PaymentReferenceListItem) {
  if (payment.paymentPurpose === "POS/Product") return "Product purchase";
  if (payment.paymentPurpose === "Rental") return payment.rentalEquipmentName || "Rental payment";
  if (payment.paymentPurpose === "Associate Membership Fee") return "Membership fee";
  return payment.paymentPurpose;
}

function paymentInstruction(payment: PaymentReferenceListItem) {
  if (payment.paymentChannel === "PayMongo") return "Check PayMongo";
  return "Check and decide";
}

function QuickLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-32 items-start gap-4 rounded-lg border border-[#CAD8CB] bg-white p-5 shadow-[0_10px_24px_rgba(18,61,42,0.05)] transition hover:border-[#8FB79A] hover:bg-[#F7FBF6]"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#E7F2E4] text-[#1F6B43]">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-black text-[#123D2A]">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-[#5D6D63]">{description}</span>
      </span>
      <ArrowRight className="mt-1 size-5 shrink-0 text-[#6C7A70] transition group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

export function BookkeeperDashboardView() {
  const [paymentSummary, setPaymentSummary] = useState(emptyPaymentSummary);
  const [financeSummary, setFinanceSummary] = useState(emptyFinanceSummary);
  const [waitingPayments, setWaitingPayments] = useState<PaymentReferenceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextPaymentSummary, nextFinanceSummary, pendingPage] = await Promise.all([
        getPaymentReferenceSummary(),
        getFinancialSummary(),
        listPaymentReferences({
          validationStatus: "Pending",
          page: 1,
          pageSize: 6,
          sortBy: "submittedAt",
          sortDirection: "asc",
        }),
      ]);
      setPaymentSummary(nextPaymentSummary);
      setFinanceSummary(nextFinanceSummary);
      setWaitingPayments(pendingPage.items);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "The bookkeeper dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const refreshTimer = window.setInterval(() => void load(), 30000);
    return () => { window.clearTimeout(timer); window.clearInterval(refreshTimer); };
  }, [load]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Today"
        title="Bookkeeper Home"
        description="Start with payments that need checking. Approved payments are automatically added to the correct cooperative records."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/portal/bookkeeper/financial-dashboard"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]"
            >
              <Landmark className="size-4" aria-hidden="true" />
              Financial Dashboard
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:opacity-60"
            >
              <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        }
      />

      <div className="rounded-lg border border-[#B7D7BD] bg-[#F2FAF3] p-4 text-sm leading-6 text-[#294B39]">
        <strong className="text-[#123D2A]">Simple daily work:</strong> check the payer and amount, confirm how it was paid, then approve only when everything matches. PayMongo payments are confirmed by PayMongo; cash and other manual payments are your decision.
      </div>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading ? <LoadingSkeleton /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Pending payments to check" value={String(paymentSummary.pendingTotal)} icon={Clock3} />
            <StatCard label="Needs correction" value={String(paymentSummary.needsClarification)} icon={CircleAlert} />
            <StatCard label="Approved today" value={String(paymentSummary.validatedToday)} icon={BadgeCheck} />
            <StatCard label="Approved payment total" value={money(paymentSummary.validatedAmount)} icon={Banknote} />
          </div>

          <section className="overflow-hidden rounded-lg border border-[#CAD8CB] bg-white shadow-[0_10px_24px_rgba(18,61,42,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#E2E8E2] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#123D2A]">Payments waiting for you</h2>
                <p className="mt-1 text-sm text-[#5D6D63]">Oldest payments are shown first.</p>
              </div>
              <Link href="/portal/bookkeeper/payment-validation" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white hover:bg-[#1F6B43]">
                Open all payments <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            {waitingPayments.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={BookOpenCheck} title="No payments waiting" description="You are caught up. New cash, rental, product, membership, and share-capital payments will appear here." />
              </div>
            ) : (
              <div className="divide-y divide-[#EEF2EC]">
                {waitingPayments.map((payment) => (
                  <Link
                    key={payment.id}
                    href="/portal/bookkeeper/payment-validation"
                    className="grid gap-3 p-5 transition hover:bg-[#F7F8F3] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#123D2A]">{payment.payerName || "Payer not recorded"}</p>
                      <p className="mt-1 truncate text-xs text-[#6C7A70]">{payment.referenceNumber}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#294B39]">{purposeLabel(payment)}</p>
                      <p className="mt-1 text-xs text-[#6C7A70]">{payment.paymentChannel}</p>
                    </div>
                    <CurrencyDisplay value={payment.amount} />
                    <StatusBadge tone={payment.paymentChannel === "PayMongo" ? "success" : "warning"}>{paymentInstruction(payment)}</StatusBadge>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QuickLink href="/portal/bookkeeper/financial-dashboard" title="Financial Dashboard" description="View income, expenses, surplus, and cooperative finance activity." icon={Landmark} />
            <QuickLink href="/portal/bookkeeper/payment-validation" title="Payments to Check" description="Approve cash or check PayMongo status." icon={ReceiptText} />
            <QuickLink href="/portal/bookkeeper/share-capital" title="Share Capital" description="See member contributions and limits." icon={WalletCards} />
            <QuickLink href="/portal/bookkeeper/financial-ledger" title="Money Records" description={`${money(financeSummary.incomeTotal)} income and ${money(financeSummary.expenseTotal)} expenses recorded.`} icon={Landmark} />
            <QuickLink href="/portal/bookkeeper/documents" title="Receipts & Documents" description="Find payment receipts and supporting files." icon={FileText} />
          </section>

          <section className="rounded-lg border border-[#CAD8CB] bg-white p-5">
            <h2 className="text-lg font-black text-[#123D2A]">What happens after approval?</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-[#F7F8F3] p-4"><p className="font-bold text-[#123D2A]">1. Payment is saved</p><p className="mt-1 text-sm leading-5 text-[#5D6D63]">The payment is locked with your name, date, and decision.</p></div>
              <div className="rounded-lg bg-[#F7F8F3] p-4"><p className="font-bold text-[#123D2A]">2. Coop records update</p><p className="mt-1 text-sm leading-5 text-[#5D6D63]">The linked sale, rental, membership, or share capital and money record are updated.</p></div>
              <div className="rounded-lg bg-[#F7F8F3] p-4"><p className="font-bold text-[#123D2A]">3. Receipt is prepared</p><p className="mt-1 text-sm leading-5 text-[#5D6D63]">TrackCOOP creates the receipt and keeps the history for checking later.</p></div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
