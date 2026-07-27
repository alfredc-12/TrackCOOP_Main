"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Eye,
  Landmark,
  ListChecks,
  Pencil,
  Plus,
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
import { ApiClientError, apiRequest } from "@/lib/api-client";
import {
  createShareCapital,
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
  type CreateShareCapitalInput,
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
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(payments.length / itemsPerPage));
  const paginatedPayments = payments.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total" value={String(summary.total)} icon={ReceiptText} />
        <StatCard label="Pending" value={String(summary.pendingManual)} icon={Clock3} />
        <StatCard label="Clarify" value={String(summary.needsClarification)} icon={Send} />
        <StatCard label="Valid Today" value={String(summary.validatedToday)} icon={BadgeCheck} />
        <StatCard label="PayMongo" value={String(summary.paymongoTestPayments)} icon={WalletCards} />
        <StatCard label="Rejected" value={String(summary.rejected)} icon={X} />
        <StatCard label="Total ₱" value={money(summary.validatedAmount)} icon={Banknote} />
      </div>
      <div className="grid gap-4 rounded-lg border border-[#CAD8CB] bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
            <input
              value={filters.search ?? ""}
              onChange={(event) => setFilter("search", event.target.value)}
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20"
              placeholder="Search reference, payer, contact"
              type="search"
            />
          </label>
          <div className="w-full sm:w-auto">
            <Select value={filters.validationStatus ?? ""} onChange={(value) => setFilter("validationStatus", value)} options={statusOptions} label="All statuses" />
          </div>
          <div className="w-full sm:w-auto">
            <Select value={filters.paymentPurpose ?? ""} onChange={(value) => setFilter("paymentPurpose", value)} options={purposeOptions} label="All purposes" />
          </div>
          <div className="w-full sm:w-auto">
            <Select value={filters.paymentChannel ?? ""} onChange={(value) => setFilter("paymentChannel", value)} options={channelOptions} label="All channels" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-auto">
            <Select value={filters.validationSource ?? ""} onChange={(value) => setFilter("validationSource", value)} options={sourceOptions} label="All sources" />
          </div>
          <div className="w-full sm:w-auto">
            <Select value={filters.gatewayManual ?? "all"} onChange={(value) => setFilter("gatewayManual", value)} options={["all", "gateway", "manual"]} label="Gateway/manual" />
          </div>
          <input value={filters.dateFrom ?? ""} onChange={(event) => setFilter("dateFrom", event.target.value)} className="h-11 flex-1 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" type="date" aria-label="Date from" />
          <input value={filters.dateTo ?? ""} onChange={(event) => setFilter("dateTo", event.target.value)} className="h-11 flex-1 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" type="date" aria-label="Date to" />
          <input value={filters.amountMin ?? ""} onChange={(event) => setFilter("amountMin", event.target.value)} className="h-11 w-28 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" inputMode="decimal" placeholder="Min amount" />
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
              {paginatedPayments.map((payment) => (
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

      {!isLoading && payments.length > 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-[#CAD8CB] bg-white p-4 text-sm font-semibold text-[#294B39] sm:flex-row mt-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
          </div>

          <span className="px-2">
            Page {page} of {totalPages} &middot; {payments.length} applications
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="grid size-10 place-items-center rounded-md border border-[#CAD8CB] text-[#123D2A] transition hover:bg-[#EEF2EC] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
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

  // Add Share Capital modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string; code: string }[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [form, setForm] = useState<Omit<CreateShareCapitalInput, "paymentReferenceId">>({ 
    memberId: "", 
    amount: 0, 
    paymentDate: new Date().toISOString().split("T")[0], 
    paymentStatus: "Validated",
    remarks: "",
  });

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

  // Fetch members for dropdown when modal opens or search changes
  useEffect(() => {
    if (!isAddOpen) return;
    setIsMembersLoading(true);
    const params = new URLSearchParams({ pageSize: "100", sortBy: "createdAt", sortDirection: "asc" });
    if (memberSearch.trim()) params.set("search", memberSearch.trim());
    const timeoutId = window.setTimeout(() => {
      void apiRequest<{ id: string; fullName?: string; memberCode?: string }[]>(`/api/members?${params}`)
        .then(rows => {
          setMembers(rows.map(m => ({ id: String(m.id), name: m.fullName ?? "Unknown", code: m.memberCode ?? "" })));
        })
        .catch(() => setMembers([]))
        .finally(() => setIsMembersLoading(false));
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [isAddOpen, memberSearch]);

  const handleAddSubmit = async () => {
    if (!form.memberId) { toast.error("Please select a member."); return; }
    if (!form.amount || form.amount <= 0) { toast.error("Please enter a valid amount."); return; }
    if (!form.paymentDate) { toast.error("Please enter a payment date."); return; }
    setIsSubmitting(true);
    try {
      await createShareCapital({ ...form, amount: Number(form.amount) });
      toast.success("Share capital added successfully!");
      setIsAddOpen(false);
      setForm({ memberId: "", amount: 0, paymentDate: new Date().toISOString().split("T")[0], paymentStatus: "Validated", remarks: "" });
      setMemberSearch("");
      void load();
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Failed to add share capital.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMember = members.find(m => m.id === form.memberId);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Payments" title="Share Capital" description="Validated member capital progress, contribution limits, and payment records." actions={
        <div className="flex items-center gap-2">
          <StatusBadge tone={role === "bookkeeper" ? "success" : "neutral"}>{role === "bookkeeper" ? "Bookkeeper workflow" : "Read-only oversight"}</StatusBadge>
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#123D2A] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#0d2f20]"
          >
            <Plus className="size-4" />
            Add Share Capital
          </button>
        </div>
      } />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Validated Capital" value={money(summary.validatedTotal)} icon={WalletCards} />
        <StatCard label="Pending Capital" value={money(summary.pendingTotal)} icon={ListChecks} />
        <StatCard label="Validated Payments" value={String(summary.validatedPayments)} icon={BadgeCheck} />
        <StatCard label="Member Count" value={String(summary.membersWithValidatedCapital)} icon={Banknote} />
      </div>
      <Toolbar search={search} onSearch={setSearch} onRefresh={() => void load()} count={payments.length} label="share capital" />
      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingSkeleton /> : payments.length === 0 ? (
        <EmptyState icon={WalletCards} title="No share capital payments found" description="Share capital payments will appear here once recorded." />
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

      {/* Add Share Capital Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add Share Capital</h2>
              <button onClick={() => { setIsAddOpen(false); setMemberSearch(""); }} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="size-5" /></button>
            </div>

            <div className="space-y-4">
              {/* Member selector */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Member <span className="text-red-500">*</span></label>
                {selectedMember ? (
                  <div className="flex items-center justify-between rounded-xl border border-[#123D2A] bg-[#f0f7f4] px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-[#123D2A]">{selectedMember.name}</p>
                      <p className="text-xs text-gray-500">{selectedMember.code}</p>
                    </div>
                    <button onClick={() => { setForm(f => ({ ...f, memberId: "" })); setMemberSearch(""); }} className="text-xs text-red-500 hover:underline">Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type to search member name or code..."
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      onFocus={() => setShowMemberDropdown(true)}
                      onBlur={() => window.setTimeout(() => setShowMemberDropdown(false), 150)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A]"
                    />
                    {showMemberDropdown && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl">
                        {isMembersLoading ? (
                          <div className="px-4 py-3 text-sm text-gray-400">Loading members...</div>
                        ) : members.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-400">
                            {memberSearch.trim() ? `No members found for "${memberSearch}"` : "No members found"}
                          </div>
                        ) : (
                          members.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onMouseDown={e => {
                                e.preventDefault(); // prevent blur before click
                                setForm(f => ({ ...f, memberId: m.id }));
                                setMemberSearch("");
                                setShowMemberDropdown(false);
                              }}
                              className="flex w-full flex-col px-4 py-2.5 text-left text-sm hover:bg-[#f0f7f4] border-b border-gray-50 last:border-0"
                            >
                              <span className="font-semibold text-[#123D2A]">{m.name}</span>
                              <span className="text-xs text-gray-400">{m.code}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₱) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1" max="15000" step="0.01"
                  value={form.amount || ""}
                  onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  placeholder="e.g. 1500"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A]"
                />
              </div>

              {/* Payment Date */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Payment Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={form.paymentDate}
                  onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A]"
                />
              </div>

              {/* Status */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={form.paymentStatus}
                  onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value as CreateShareCapitalInput["paymentStatus"] }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A]"
                >
                  <option value="Validated">Validated</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Remarks */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
                <textarea
                  value={form.remarks ?? ""}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  rows={2}
                  placeholder="Optional notes..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#123D2A] focus:ring-1 focus:ring-[#123D2A] resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setIsAddOpen(false); setMemberSearch(""); }}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAddSubmit()}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-[#123D2A] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0d2f20] disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
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
