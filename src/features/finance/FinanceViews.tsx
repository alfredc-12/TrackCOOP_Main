"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Clock3,
  Eye,
  Landmark,
  ListChecks,
  Pencil,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  WalletCards,
  X,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  CurrencyDisplay,
  DataTable,
  EmptyState,
  ErrorState,
  FormDialog,
  FormField,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { ApiClientError } from "@/lib/api-client";
import {
  getFinancialSummary,
  getPaymentReferenceDetail,
  getPaymentReferenceSummary,
  getPaymongoPaymentStatus,
  getShareCapitalSummary,
  listFinancialCategories,
  listFinancialRecords,
  listPaymentReferences,
  listShareCapital,
  paymentReferenceProofUrl,
  rejectPaymentReference,
  requestPaymentClarification,
  reversePaymentReference,
  updatePaymentReference,
  validatePaymentReference,
  type FinancialCategory,
  type FinancialRecord,
  type FinancialSummary,
  type PaymentReferenceDetail,
  type PaymentReferenceFilters,
  type PaymentReferenceSummary,
  type PaymentReference,
  type ShareCapitalPayment,
  type ShareCapitalSummary,
} from "./finance-api";

const emptyShareSummary: ShareCapitalSummary = {
  validatedTotal: 0,
  pendingTotal: 0,
  validatedPayments: 0,
  membersWithValidatedCapital: 0,
  initialRequirement: 1500,
  fullRequirement: 3000,
  maximumAllowed: 15000,
};

const emptyFinancialSummary: FinancialSummary = {
  incomeTotal: 0,
  expenseTotal: 0,
  adjustmentTotal: 0,
  netTotal: 0,
  activeRecords: 0,
  voidedRecords: 0,
};

const emptyPaymentSummary: PaymentReferenceSummary = {
  total: 0,
  pendingManual: 0,
  needsClarification: 0,
  validatedToday: 0,
  paymongoTestPayments: 0,
  rejected: 0,
  validatedAmount: 0,
};

const statusOptions = ["", "Pending", "Needs Clarification", "Validated", "Rejected", "Reversed"];
const purposeOptions = ["", "Associate Membership Fee", "Share Capital", "Rental", "POS/Product", "Preorder", "Bulk Order", "Document/Certificate", "Other"];
const channelOptions = ["", "PayMongo", "Manual GCash", "Cash", "Bank Transfer", "Other"];
const sourceOptions = ["", "Manual Bookkeeper", "PayMongo Webhook", "System"];

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function badgeTone(status: string) {
  if (["Validated", "Active", "Income", "Posted"].includes(status)) return "success";
  if (["Pending", "Needs Clarification", "Adjustment"].includes(status)) return "warning";
  if (["Rejected", "Reversed", "Voided", "Expense"].includes(status)) return "danger";
  return "neutral";
}

function shortDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function safeValue(value: string | null | undefined) {
  return value?.trim() ? value : "Not recorded";
}

function isManualPayment(payment: PaymentReference | PaymentReferenceDetail) {
  return payment.paymentChannel !== "PayMongo";
}

function canManualValidate(payment: PaymentReference | PaymentReferenceDetail) {
  return isManualPayment(payment) && ["Pending", "Needs Clarification"].includes(payment.validationStatus);
}

function Toolbar({
  search,
  onSearch,
  onRefresh,
  count,
  label,
}: {
  search: string;
  onSearch: (value: string) => void;
  onRefresh: () => void;
  count: number;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block w-full max-w-md">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]"
          aria-hidden="true"
        />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
          placeholder={`Search ${label}`}
          type="search"
        />
      </label>
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C7A70]">
          {count} shown
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]"
        >
          <RefreshCcw className="size-4" aria-hidden="true" />
          Refresh
        </button>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 min-w-0 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-semibold text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
      aria-label={label}
    >
      {options.map((option) => (
        <option key={option || label} value={option}>
          {option || label}
        </option>
      ))}
    </select>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C7A70]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-[#123D2A]">{value}</p>
      {sub ? <p className="mt-1 break-words text-xs text-[#5D6D63]">{sub}</p> : null}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  disabled,
  onClick,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:bg-[#CAD8CB] disabled:text-[#5D6D63]"
    >
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </button>
  );
}

export function PaymentReferencesView({ role }: { role: "chairman" | "bookkeeper" }) {
  const [payments, setPayments] = useState<PaymentReference[]>([]);
  const [summary, setSummary] = useState<PaymentReferenceSummary>(emptyPaymentSummary);
  const [filters, setFilters] = useState<PaymentReferenceFilters>({
    sortBy: "submittedAt",
    sortDirection: "desc",
    gatewayManual: "all",
  });
  const [selected, setSelected] = useState<PaymentReferenceDetail | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editReference, setEditReference] = useState("");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [nextPayments, nextSummary] = await Promise.all([
        listPaymentReferences(filters),
        getPaymentReferenceSummary(),
      ]);
      setPayments(nextPayments);
      setSummary(nextSummary);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Payment references could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const openDetail = useCallback(async (paymentId: string) => {
    setIsDetailLoading(true);
    setReason("");
    setConfirmation("");
    try {
      const detail = await getPaymentReferenceDetail(paymentId);
      setSelected(detail);
      setEditAmount(String(detail.amount));
      setEditReference(detail.referenceNumber);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Payment details could not be loaded.");
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const reloadSelected = useCallback(async () => {
    if (!selected) return;
    const detail = await getPaymentReferenceDetail(selected.id);
    setSelected(detail);
    setEditAmount(String(detail.amount));
    setEditReference(detail.referenceNumber);
  }, [selected]);

  const runAction = useCallback(async (
    action: "validate" | "reject" | "clarification" | "reverse" | "edit" | "status",
  ) => {
    if (!selected) return;
    if (["reject", "clarification", "reverse"].includes(action) && reason.trim().length < 8) {
      toast.error("Enter a reason with at least 8 characters.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (action === "validate") {
        await validatePaymentReference(selected.id);
        toast.success("Payment reference validated.");
      } else if (action === "reject") {
        await rejectPaymentReference(selected.id, reason);
        toast.success("Payment reference rejected.");
      } else if (action === "clarification") {
        await requestPaymentClarification(selected.id, reason);
        toast.success("Clarification requested.");
      } else if (action === "reverse") {
        await reversePaymentReference(selected.id, reason, confirmation);
        toast.success("Payment reference reversed.");
      } else if (action === "edit") {
        await updatePaymentReference(selected.id, {
          referenceNumber: editReference,
          amount: Number(editAmount),
        });
        toast.success("Payment reference updated.");
      } else {
        const status = await getPaymongoPaymentStatus(selected.id);
        toast.success(`TrackCOOP status: ${status.validationStatus}`);
      }
      await Promise.all([load(), reloadSelected()]);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Payment action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmation, editAmount, editReference, load, reason, reloadSelected, selected]);

  const setFilter = (key: keyof PaymentReferenceFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value || undefined,
    }));
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Payments"
        title={role === "bookkeeper" ? "Payment Validation" : "Payments"}
        description={role === "bookkeeper" ? "Validate manual payments, review PayMongo webhook outcomes, and reverse posted references without deleting originals." : "Read-only oversight for submitted payment references and validation outcomes."}
        actions={<StatusBadge tone={role === "bookkeeper" ? "success" : "neutral"}>{role === "bookkeeper" ? "Bookkeeper workflow" : "Read-only oversight"}</StatusBadge>}
      />
      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total" value={String(summary.total)} icon={ReceiptText} />
        <StatCard label="Pending Manual" value={String(summary.pendingManual)} icon={Clock3} />
        <StatCard label="Clarification" value={String(summary.needsClarification)} icon={Send} />
        <StatCard label="Validated Today" value={String(summary.validatedToday)} icon={BadgeCheck} />
        <StatCard label="PayMongo Test" value={String(summary.paymongoTestPayments)} icon={WalletCards} />
        <StatCard label="Rejected" value={String(summary.rejected)} icon={X} />
        <StatCard label="Validated Amount" value={money(summary.validatedAmount)} icon={Banknote} />
      </div>
      <div className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(10rem,12rem))]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
            <input
              value={filters.search ?? ""}
              onChange={(event) => setFilter("search", event.target.value)}
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
              placeholder="Search reference, payer, contact"
              type="search"
            />
          </label>
          <Select value={filters.validationStatus ?? ""} onChange={(value) => setFilter("validationStatus", value)} options={statusOptions} label="All statuses" />
          <Select value={filters.paymentPurpose ?? ""} onChange={(value) => setFilter("paymentPurpose", value)} options={purposeOptions} label="All purposes" />
          <Select value={filters.paymentChannel ?? ""} onChange={(value) => setFilter("paymentChannel", value)} options={channelOptions} label="All channels" />
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Select value={filters.validationSource ?? ""} onChange={(value) => setFilter("validationSource", value)} options={sourceOptions} label="All sources" />
          <Select value={filters.gatewayManual ?? "all"} onChange={(value) => setFilter("gatewayManual", value)} options={["all", "gateway", "manual"]} label="Gateway/manual" />
          <input value={filters.dateFrom ?? ""} onChange={(event) => setFilter("dateFrom", event.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" type="date" aria-label="Date from" />
          <input value={filters.dateTo ?? ""} onChange={(event) => setFilter("dateTo", event.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" type="date" aria-label="Date to" />
          <input value={filters.amountMin ?? ""} onChange={(event) => setFilter("amountMin", event.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" inputMode="decimal" placeholder="Min amount" />
          <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] transition hover:bg-[#EEF2EC]">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingSkeleton /> : payments.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No payment references found" description="Submitted payment references will appear here for validation and review." />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4">Reference</th><th className="px-5 py-4">Payer</th><th className="px-5 py-4">Purpose</th><th className="px-5 py-4">Channel</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{payment.referenceNumber}</p><p className="mt-1 text-xs text-[#6C7A70]">{payment.provider}</p></td>
                  <td className="px-5 py-4"><p className="font-semibold text-[#123D2A]">{safeValue(payment.payerName)}</p><p className="mt-1 text-xs text-[#6C7A70]">{safeValue(payment.payerContact)}</p></td>
                  <td className="px-5 py-4">{payment.paymentPurpose}</td>
                  <td className="px-5 py-4"><StatusBadge tone={payment.paymentChannel === "PayMongo" ? "success" : "neutral"}>{payment.paymentChannel}</StatusBadge></td>
                  <td className="px-5 py-4"><CurrencyDisplay value={payment.amount} /></td>
                  <td className="px-5 py-4"><StatusBadge tone={badgeTone(payment.validationStatus)}>{payment.validationStatus}</StatusBadge></td>
                  <td className="px-5 py-4">
                    <button type="button" onClick={() => void openDetail(payment.id)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white transition hover:bg-[#1F6B43]">
                      <Eye className="size-4" aria-hidden="true" />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
      <FormDialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected ? selected.referenceNumber : "Payment reference"}
        description={selected ? `${selected.paymentPurpose} / ${selected.paymentChannel}` : undefined}
        contentClassName="w-[min(70rem,calc(100vw-2rem))]"
      >
        {isDetailLoading || !selected ? <LoadingSkeleton /> : (
          <div className="grid gap-5">
            {selected.posting.warnings.length ? (
              <div className="rounded-lg border border-[#F3D08A] bg-[#FFF8E8] p-4 text-sm text-[#775200]">
                <div className="flex gap-2 font-bold"><AlertTriangle className="size-4" aria-hidden="true" /> Warnings</div>
                <ul className="mt-2 list-disc pl-5">
                  {selected.posting.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-3">
              <Info label="Payer" value={safeValue(selected.payerName)} sub={safeValue(selected.payerContact)} />
              <Info label="Expected Amount" value={money(selected.amount)} sub={selected.paymentPurpose} />
              <Info label="Status" value={selected.validationStatus} sub={selected.validationSource ?? "No source yet"} />
              <Info label="Gateway" value={selected.gatewayEnvironment} sub={selected.gatewayStatus ?? selected.gatewayPaymentMethod ?? "No gateway status"} />
              <Info label="Checkout ID" value={safeValue(selected.gatewayCheckoutId)} sub={`Payment: ${safeValue(selected.gatewayPaymentId)}`} />
              <Info label="Paid Time" value={shortDate(selected.paidAt)} sub={`Webhook: ${shortDate(selected.webhookReceivedAt)}`} />
              <Info label="Finance Posting" value={safeValue(selected.posting.financialRecordNumber)} sub={selected.posting.financialRecordStatus ?? "No ledger record"} />
              <Info label="Requirement" value={selected.posting.membershipRequirementStatus ?? "Not linked"} sub={selected.posting.membershipApplicationStatus ?? "No application"} />
              <Info label="Fees / Net" value={selected.gatewayFeeAmount === null ? "Not recorded" : money(selected.gatewayFeeAmount)} sub={selected.gatewayNetAmount === null ? "Net not recorded" : `Net ${money(selected.gatewayNetAmount)}`} />
            </div>

            {role === "bookkeeper" ? (
              <div className="grid gap-4 rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField label="Reference number">
                    <input value={editReference} onChange={(event) => setEditReference(event.target.value)} disabled={selected.validationStatus === "Validated" || selected.validationStatus === "Reversed"} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm disabled:bg-[#EEF2EC]" />
                  </FormField>
                  <FormField label="Amount">
                    <input value={editAmount} onChange={(event) => setEditAmount(event.target.value)} disabled={selected.validationStatus === "Validated" || selected.validationStatus === "Reversed"} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm disabled:bg-[#EEF2EC]" inputMode="decimal" />
                  </FormField>
                </div>
                <FormField label="Reason">
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 rounded-md border border-[#CAD8CB] bg-white px-3 py-2 text-sm" />
                </FormField>
                <FormField label="Reversal confirmation">
                  <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" placeholder={selected.referenceNumber} />
                </FormField>
                <div className="flex flex-wrap gap-2">
                  <ActionButton icon={BadgeCheck} disabled={!canManualValidate(selected) || isSubmitting} onClick={() => void runAction("validate")}>Validate</ActionButton>
                  <ActionButton icon={X} disabled={selected.validationStatus === "Validated" || selected.validationStatus === "Reversed" || isSubmitting} onClick={() => void runAction("reject")}>Reject</ActionButton>
                  <ActionButton icon={Send} disabled={selected.validationStatus === "Validated" || selected.validationStatus === "Reversed" || isSubmitting} onClick={() => void runAction("clarification")}>Request Clarification</ActionButton>
                  <ActionButton icon={Pencil} disabled={selected.validationStatus === "Validated" || selected.validationStatus === "Reversed" || isSubmitting} onClick={() => void runAction("edit")}>Save Edit</ActionButton>
                  <ActionButton icon={RotateCcw} disabled={selected.validationStatus !== "Validated" || isSubmitting} onClick={() => void runAction("reverse")}>Reverse</ActionButton>
                  {selected.paymentChannel === "PayMongo" ? <ActionButton icon={RefreshCcw} disabled={isSubmitting} onClick={() => void runAction("status")}>Refresh Status</ActionButton> : null}
                  {selected.proofFilePath ? <a className="inline-flex h-10 items-center rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]" href={paymentReferenceProofUrl(selected.id)} target="_blank" rel="noreferrer">Proof</a> : null}
                </div>
              </div>
            ) : null}

            <section className="grid gap-3">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">Validation History</h3>
              {selected.validationHistory.length ? selected.validationHistory.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-[#CAD8CB] bg-white p-3 text-sm">
                  <p className="font-bold text-[#123D2A]">{entry.oldStatus ?? "New"} to {entry.newStatus}</p>
                  <p className="mt-1 text-[#5D6D63]">{entry.validationSource} / {safeValue(entry.changedByName)} / {shortDate(entry.changedAt)}</p>
                  {entry.reason ? <p className="mt-2 text-[#294B39]">{entry.reason}</p> : null}
                </div>
              )) : <p className="text-sm text-[#5D6D63]">No validation history yet.</p>}
            </section>
            <section className="grid gap-3">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">Gateway Events</h3>
              {selected.gatewayEvents.length ? selected.gatewayEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-[#CAD8CB] bg-white p-3 text-sm">
                  <p className="font-bold text-[#123D2A]">{event.eventType} / {event.processingStatus}</p>
                  <p className="mt-1 text-[#5D6D63]">Checkout {safeValue(event.checkoutId)} / Payment {safeValue(event.paymentId)}</p>
                  {event.errorCode ? <p className="mt-2 text-[#9A392A]">{event.errorCode}: {event.errorMessage}</p> : null}
                </div>
              )) : <p className="text-sm text-[#5D6D63]">No gateway events recorded.</p>}
            </section>
          </div>
        )}
      </FormDialog>
    </div>
  );
}

export function ShareCapitalView({ role }: { role: "chairman" | "bookkeeper" }) {
  const [payments, setPayments] = useState<ShareCapitalPayment[]>([]);
  const [summary, setSummary] = useState<ShareCapitalSummary>(emptyShareSummary);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [nextPayments, nextSummary] = await Promise.all([listShareCapital(search), getShareCapitalSummary()]);
      setPayments(nextPayments);
      setSummary(nextSummary);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Share capital records could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Payments" title="Share Capital" description="Validated member capital progress, contribution limits, and payment records." actions={<StatusBadge tone={role === "bookkeeper" ? "success" : "neutral"}>{role === "bookkeeper" ? "Bookkeeper workflow" : "Read-only oversight"}</StatusBadge>} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Validated Capital" value={money(summary.validatedTotal)} icon={WalletCards} />
        <StatCard label="Pending Capital" value={money(summary.pendingTotal)} icon={ListChecks} />
        <StatCard label="Validated Payments" value={String(summary.validatedPayments)} icon={BadgeCheck} />
        <StatCard label="Member Count" value={String(summary.membersWithValidatedCapital)} icon={Banknote} />
      </div>
      <Toolbar search={search} onSearch={setSearch} onRefresh={() => void load()} count={payments.length} label="share capital" />
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingSkeleton /> : payments.length === 0 ? (
        <EmptyState icon={WalletCards} title="No share capital payments found" description="Share capital payments will appear here once recorded by the bookkeeper." />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4">Member</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Payment Date</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{payment.memberName}</p><p className="mt-1 text-xs text-[#6C7A70]">{payment.memberCode}</p></td>
                  <td className="px-5 py-4"><CurrencyDisplay value={payment.amount} /></td>
                  <td className="px-5 py-4"><StatusBadge tone={badgeTone(payment.paymentStatus)}>{payment.paymentStatus}</StatusBadge></td>
                  <td className="px-5 py-4">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  );
}

export function FinancialLedgerView({ role }: { role: "chairman" | "bookkeeper" }) {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>(emptyFinancialSummary);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [nextRecords, nextSummary] = await Promise.all([listFinancialRecords(search), getFinancialSummary()]);
      setRecords(nextRecords);
      setSummary(nextSummary);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Financial records could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Finance" title="Financial Ledger" description="Income, expenses, adjustments, posting, and void tracking for cooperative finances." actions={<StatusBadge tone={role === "bookkeeper" ? "success" : "neutral"}>{role === "bookkeeper" ? "Bookkeeper workflow" : "Read-only oversight"}</StatusBadge>} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Income" value={money(summary.incomeTotal)} icon={Landmark} />
        <StatCard label="Expenses" value={money(summary.expenseTotal)} icon={ReceiptText} />
        <StatCard label="Net" value={money(summary.netTotal)} icon={Banknote} />
        <StatCard label="Active Records" value={String(summary.activeRecords)} icon={ListChecks} />
      </div>
      <Toolbar search={search} onSearch={setSearch} onRefresh={() => void load()} count={records.length} label="ledger" />
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingSkeleton /> : records.length === 0 ? (
        <EmptyState icon={Landmark} title="No financial records found" description="Ledger entries will appear here once posted or recorded by the bookkeeper." />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4">Record</th><th className="px-5 py-4">Category</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{record.recordNumber}</p><p className="mt-1 text-xs text-[#6C7A70]">{new Date(record.recordDate).toLocaleDateString()}</p></td>
                  <td className="px-5 py-4">{record.categoryName}</td>
                  <td className="px-5 py-4"><StatusBadge tone={badgeTone(record.recordType)}>{record.recordType}</StatusBadge></td>
                  <td className="px-5 py-4"><CurrencyDisplay value={record.amount} /></td>
                  <td className="px-5 py-4"><StatusBadge tone={badgeTone(record.approvedBy ? "Posted" : record.recordStatus)}>{record.approvedBy ? "Posted" : record.recordStatus}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  );
}

export function FinancialCategoriesView() {
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setCategories(await listFinancialCategories());
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Financial categories could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Finance" title="Financial Categories" description="Reusable income and expense categories for ledger organization." actions={<StatusBadge tone="success">Bookkeeper workflow</StatusBadge>} />
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingSkeleton /> : categories.length === 0 ? (
        <EmptyState icon={ListChecks} title="No categories found" description="Create financial categories before posting detailed ledger records." />
      ) : (
        <DataTable>
          <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
              <tr><th className="px-5 py-4">Code</th><th className="px-5 py-4">Name</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4 font-bold text-[#123D2A]">{category.categoryCode}</td>
                  <td className="px-5 py-4">{category.categoryName}</td>
                  <td className="px-5 py-4"><StatusBadge tone={badgeTone(category.categoryType)}>{category.categoryType}</StatusBadge></td>
                  <td className="px-5 py-4"><StatusBadge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? "Active" : "Inactive"}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
    </div>
  );
}
