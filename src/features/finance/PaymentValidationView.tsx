"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  History,
  Pencil,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  getPaymentReferenceDetail,
  getPaymentReferenceSummary,
  getPaymongoPaymentStatus,
  listPaymentReferences,
  paymentReferenceProofUrl,
  rejectPaymentReference,
  requestPaymentClarification,
  retryGatewaySettlement,
  retryPaymentReceipt,
  reversePaymentReference,
  updatePaymentReference,
  validatePaymentReference,
  type PaymentGatewayEvent,
  type PaymentReferenceDetail,
  type PaymentReferenceFilters,
  type PaymentReferenceListItem,
  type PaymentReferenceSummary,
} from "./finance-api";
import {
  beginPaymentAction,
  canConfirmPaymentAction,
  canRetryGatewayEvent,
  canUsePaymentMutationControls,
  closePaymentAction,
  initialPaymentActionDialogState,
  openPaymentAction,
  paymentActionEffect,
  totalPaymentPages,
  updatePaymentAction,
  type PaymentActionDialogState,
  type PaymentMutationAction,
} from "./payment-validation-actions";

const emptySummary: PaymentReferenceSummary = {
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
const actionLabels: Record<PaymentMutationAction, string> = {
  validate: "Approve payment",
  reject: "Reject payment",
  clarification: "Ask for correction",
  reverse: "Reverse payment",
  retry: "Retry payment processing",
};
const selectLabels: Record<string, string> = {
  all: "All",
  gateway: "Online (PayMongo)",
  manual: "Manual payments",
  failed: "Has a system issue",
  submittedAt: "Date submitted",
  paidAt: "Date paid",
  amount: "Amount",
  referenceNumber: "Reference number",
  Validated: "Approved",
  "Needs Clarification": "Needs correction",
  desc: "Newest or highest first",
  asc: "Oldest or lowest first",
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(value);
}
function safe(value: string | null | undefined) { return value?.trim() || "Not recorded"; }
function dateTime(value: string | null | undefined) { return value ? new Date(value).toLocaleString() : "Not recorded"; }
function dateOnly(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(value)) : "Not recorded";
}
function statusLabel(status: string) {
  if (status === "Validated") return "Approved";
  if (status === "Needs Clarification") return "Needs correction";
  return status;
}
function paymentItemLabel(payment: Pick<PaymentReferenceListItem, "paymentPurpose" | "relatedEntityType">) {
  if (payment.paymentPurpose === "POS/Product") return "Product purchase";
  if (payment.paymentPurpose === "Rental") return "Rental payment";
  if (payment.paymentPurpose === "Share Capital") return "Share Capital";
  if (payment.paymentPurpose === "Associate Membership Fee") return "Membership fee";
  if (payment.paymentPurpose === "Document/Certificate") return "Document or certificate";
  if (payment.relatedEntityType) return payment.paymentPurpose;
  return payment.paymentPurpose || "Payment";
}
function rentedItemLabel(payment: Pick<PaymentReferenceListItem, "paymentPurpose" | "relatedEntityType" | "rentalEquipmentName">) {
  if (payment.paymentPurpose === "Rental") return safe(payment.rentalEquipmentName) === "Not recorded" ? "Rental payment" : safe(payment.rentalEquipmentName);
  return paymentItemLabel(payment);
}
function rentedItemSubLabel(payment: Pick<PaymentReferenceListItem, "paymentPurpose" | "referenceNumber" | "rentalNumber" | "rentalStartAt" | "rentalEndAt">) {
  if (payment.paymentPurpose !== "Rental") return `Ref: ${payment.referenceNumber}`;
  const start = dateOnly(payment.rentalStartAt);
  const end = dateOnly(payment.rentalEndAt);
  const period = start === end ? start : `${start} to ${end}`;
  return `${payment.rentalNumber ?? payment.referenceNumber} - ${period}`;
}
function paymentCountLabel(payment: Pick<PaymentReferenceListItem, "paymentPurpose" | "relatedEntityType" | "rentalQuantity" | "rentalUnit">) {
  if (payment.paymentPurpose === "Rental") return payment.rentalQuantity ? [payment.rentalQuantity, payment.rentalUnit].filter(Boolean).join(" ") : "1 rental";
  if (payment.paymentPurpose === "POS/Product") return "Not listed";
  return "1 payment";
}
function paymentForLabel(payment: Pick<PaymentReferenceListItem, "memberCode" | "memberName" | "applicationCode" | "applicationName" | "payerContact">) {
  if (payment.memberCode) return `${payment.memberCode} - ${safe(payment.memberName)}`;
  if (payment.applicationCode) return `${payment.applicationCode} - ${safe(payment.applicationName)}`;
  return safe(payment.payerContact);
}
function paidThroughLabel(payment: Pick<PaymentReferenceListItem, "paymentChannel" | "gatewayPaymentMethod" | "gatewayEnvironment">) {
  if (payment.paymentChannel === "PayMongo") {
    return payment.gatewayPaymentMethod ? `PayMongo - ${payment.gatewayPaymentMethod}` : "PayMongo";
  }
  return payment.paymentChannel;
}
function badgeTone(status: string) {
  if (["Validated", "Active", "Processed", "Generated", "paid"].includes(status)) return "success" as const;
  if (["Pending", "Processing", "Received", "Needs Clarification"].includes(status)) return "warning" as const;
  if (["Rejected", "Reversed", "Failed", "Voided"].includes(status)) return "danger" as const;
  return "neutral" as const;
}
function manualValidationEligible(payment: PaymentReferenceDetail) {
  return payment.paymentChannel !== "PayMongo" && ["Pending", "Needs Clarification"].includes(payment.validationStatus);
}
function mutationAllowed(payment: PaymentReferenceDetail) {
  return !["Validated", "Reversed"].includes(payment.validationStatus);
}

function Select({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: string[]; label: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}
      className="h-11 min-w-0 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-semibold text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20">
      {options.map((option) => <option key={option || label} value={option}>{option ? (selectLabels[option] ?? option) : label}</option>)}
    </select>
  );
}
function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-4">
    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C7A70]">{label}</p>
    <p className="mt-2 break-words text-sm font-bold text-[#123D2A]">{value}</p>
    {sub ? <p className="mt-1 break-words text-xs text-[#5D6D63]">{sub}</p> : null}
  </div>;
}
function MutateButton({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" disabled={disabled} onClick={onClick}
    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:cursor-not-allowed disabled:bg-[#CAD8CB] disabled:text-[#5D6D63]">
    {children}
  </button>;
}

function ActionConfirmationDialog({
  payment,
  state,
  event,
  onChange,
  onClose,
  onConfirm,
}: {
  payment: PaymentReferenceDetail | null;
  state: PaymentActionDialogState;
  event: PaymentGatewayEvent | null;
  onChange: (patch: Partial<Pick<PaymentActionDialogState, "reason" | "confirmation" | "recoveryNote" | "evidenceChecked" | "detailsChecked">>) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const action = state.action;
  const valid = payment && action ? canConfirmPaymentAction(state, payment) : false;
  return <FormDialog open={state.open} onOpenChange={(open: boolean) => { if (!open && !state.submitting) onClose(); }}
    title={action ? actionLabels[action] : "Confirm payment action"}
    description="Check the payment details carefully before you continue."
    contentClassName="w-[min(42rem,calc(100vw-2rem))]">
    {payment && action ? <div className="grid gap-4 pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Info label="Reference" value={payment.referenceNumber} sub={payment.provider} />
        <Info label="Payer" value={safe(payment.payerName)} sub={safe(payment.payerContact)} />
        <Info label="Amount" value={money(payment.amount)} sub={payment.paymentPurpose} />
        <Info label="Payment method / Status" value={payment.paymentChannel} sub={statusLabel(payment.validationStatus)} />
      </div>
      {event ? <Info label="Gateway event" value={`${event.eventType} / ${event.processingStatus}`} sub={`Retry count ${event.retryCount} · Payment ${safe(event.paymentId)}`} /> : null}
      <div className="rounded-lg border border-[#F3D08A] bg-[#FFF8E8] p-4 text-sm leading-6 text-[#775200]">
        <p className="font-black uppercase tracking-[0.12em]">What will happen</p>
        <p className="mt-1">{paymentActionEffect(action)}</p>
      </div>
      {action === "validate" ? <div className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4">
        <p className="font-bold text-[#123D2A]">Confirm both checks</p>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#294B39]">
          <input type="checkbox" checked={state.evidenceChecked} onChange={(e) => onChange({ evidenceChecked: e.target.checked })}
            className="mt-1 size-5 shrink-0 accent-[#1F6B43]" disabled={state.submitting} />
          <span>I checked the receipt, proof, cash record, or bank/GCash reference.</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#294B39]">
          <input type="checkbox" checked={state.detailsChecked} onChange={(e) => onChange({ detailsChecked: e.target.checked })}
            className="mt-1 size-5 shrink-0 accent-[#1F6B43]" disabled={state.submitting} />
          <span>The payer, amount, reference number, and payment purpose all match.</span>
        </label>
      </div> : null}
      {["reject", "clarification", "reverse"].includes(action) ? <FormField label={action === "clarification" ? "What needs to be corrected?" : "Reason"} hint="Required. Write at least 8 characters so the decision is clear in the audit record.">
        <textarea value={state.reason} onChange={(e) => onChange({ reason: e.target.value })}
          className="min-h-24 rounded-md border border-[#CAD8CB] bg-white px-3 py-2 text-sm" disabled={state.submitting} />
      </FormField> : null}
      {action === "reverse" ? <FormField label="Type the payment reference to confirm" hint={payment.referenceNumber}>
        <input value={state.confirmation} onChange={(e) => onChange({ confirmation: e.target.value })}
          className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" disabled={state.submitting} />
      </FormField> : null}
      {action === "retry" ? <FormField label="Recovery note" hint="Required, at least 8 characters. This note is added to the audit record.">
        <textarea value={state.recoveryNote} onChange={(e) => onChange({ recoveryNote: e.target.value })}
          className="min-h-24 rounded-md border border-[#CAD8CB] bg-white px-3 py-2 text-sm" disabled={state.submitting} />
      </FormField> : null}
      <div className="flex justify-end gap-3 border-t border-[#E2E8E2] pt-4">
        <button type="button" disabled={state.submitting} onClick={onClose}
          className="h-11 rounded-md border border-[#CAD8CB] bg-white px-5 text-sm font-bold text-[#294B39] disabled:opacity-60">Cancel</button>
        <button type="button" disabled={!valid} onClick={onConfirm}
          className="h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#CAD8CB] disabled:text-[#5D6D63]">
          {state.submitting ? "Processing…" : actionLabels[action]}
        </button>
      </div>
    </div> : null}
  </FormDialog>;
}

export function PaymentValidationView({ role }: { role: "chairman" | "bookkeeper" }) {
  const [payments, setPayments] = useState<PaymentReferenceListItem[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [filters, setFilters] = useState<PaymentReferenceFilters>({ page: 1, pageSize: 20, sortBy: "submittedAt", sortDirection: "desc", gatewayManual: "all" });
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<PaymentReferenceDetail | null>(null);
  const [dialog, setDialog] = useState(initialPaymentActionDialogState);
  const [editReference, setEditReference] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSecondarySubmitting, setIsSecondarySubmitting] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [error, setError] = useState("");
  const mutationLock = useRef(false);

  const load = useCallback(async () => {
    setIsLoading(true); setError("");
    try {
      const [page, nextSummary] = await Promise.all([listPaymentReferences(filters), getPaymentReferenceSummary()]);
      setPayments(page.items); setTotal(page.total); setSummary(nextSummary);
      if (page.page !== filters.page) setFilters((current) => ({ ...current, page: page.page }));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Payment references could not be loaded.");
    } finally { setIsLoading(false); }
  }, [filters]);

  useEffect(() => { const timeout = window.setTimeout(() => void load(), 180); return () => window.clearTimeout(timeout); }, [load]);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const pages = totalPaymentPages(total, pageSize);
  const canMutate = canUsePaymentMutationControls(role);
  const selectedEvent = useMemo(() => selected?.gatewayEvents.find((event) => event.id === dialog.gatewayEventId) ?? null, [dialog.gatewayEventId, selected]);

  const setFilter = (key: keyof PaymentReferenceFilters, value: string | boolean | number | undefined) => {
    setFilters((current) => ({ ...current, [key]: value === "" ? undefined : value, page: key === "page" ? Number(value) : 1 }));
  };
  const openDetail = useCallback(async (id: string) => {
    setIsDetailLoading(true);
    try {
      const detail = await getPaymentReferenceDetail(id);
      setSelected(detail); setEditReference(detail.referenceNumber); setEditAmount(String(detail.amount));
    } catch (caught) { toast.error(caught instanceof ApiClientError ? caught.message : "Payment details could not be loaded."); }
    finally { setIsDetailLoading(false); }
  }, []);
  const reloadSelected = useCallback(async () => {
    if (!selected) return;
    const detail = await getPaymentReferenceDetail(selected.id);
    setSelected(detail); setEditReference(detail.referenceNumber); setEditAmount(String(detail.amount));
  }, [selected]);

  const confirmMutation = useCallback(async () => {
    if (!canMutate || mutationLock.current) return;
    if (!selected || !dialog.action || !canConfirmPaymentAction(dialog, selected)) return;
    mutationLock.current = true;
    setDialog((current) => beginPaymentAction(current));
    try {
      if (dialog.action === "validate") await validatePaymentReference(selected.id);
      if (dialog.action === "reject") await rejectPaymentReference(selected.id, dialog.reason);
      if (dialog.action === "clarification") await requestPaymentClarification(selected.id, dialog.reason);
      if (dialog.action === "reverse") await reversePaymentReference(selected.id, dialog.reason, dialog.confirmation);
      if (dialog.action === "retry" && dialog.gatewayEventId) await retryGatewaySettlement(dialog.gatewayEventId, dialog.recoveryNote);
      toast.success(`${actionLabels[dialog.action]} completed.`);
      setDialog(closePaymentAction());
      await Promise.all([load(), reloadSelected()]);
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : "Payment action failed.");
      setDialog((current) => ({ ...current, submitting: false }));
    } finally {
      mutationLock.current = false;
    }
  }, [canMutate, dialog, load, reloadSelected, selected]);

  const saveEdit = async () => {
    if (!selected || !canMutate) return;
    const referenceNumber = editReference.trim();
    const amount = Number(editAmount);
    if (referenceNumber.length < 2) { toast.error("Enter a valid reference number."); return; }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) { toast.error("Enter a valid amount greater than zero."); return; }
    setIsSecondarySubmitting(true);
    try {
      await updatePaymentReference(selected.id, { referenceNumber, amount });
      toast.success("Payment details saved."); await Promise.all([load(), reloadSelected()]);
    } catch (caught) { toast.error(caught instanceof ApiClientError ? caught.message : "Payment update failed."); }
    finally { setIsSecondarySubmitting(false); }
  };
  const refreshFromPaymongo = async () => {
    if (!selected) return;
    setIsSecondarySubmitting(true);
    try {
      const status = await getPaymongoPaymentStatus(selected.id);
      toast.success(`PayMongo check complete. Status: ${statusLabel(status.validationStatus)}`);
      await reloadSelected();
    } catch (caught) { toast.error(caught instanceof ApiClientError ? caught.message : "PayMongo status could not be refreshed."); }
    finally { setIsSecondarySubmitting(false); }
  };
  const retryReceipt = async () => {
    if (!selected || !canMutate) return;
    setIsSecondarySubmitting(true);
    try { await retryPaymentReceipt(selected.id); toast.success("Receipt processing retried."); await reloadSelected(); }
    catch (caught) { toast.error(caught instanceof ApiClientError ? caught.message : "Receipt retry failed."); }
    finally { setIsSecondarySubmitting(false); }
  };

  return <div className="grid gap-6">
    <PageHeader eyebrow="Payments" title={role === "bookkeeper" ? "Payments to Check" : "Payments"}
      description={role === "bookkeeper" ? "Check payment details and approve only when everything matches." : "View payment status, posting history, and receipts."}
      actions={<StatusBadge tone={role === "bookkeeper" ? "success" : "neutral"}>{role === "bookkeeper" ? "Bookkeeper" : "View only"}</StatusBadge>} />

    {role === "bookkeeper" ? <div className="rounded-lg border border-[#B7D7BD] bg-[#F2FAF3] p-4 text-sm text-[#294B39]">
      <span className="font-bold text-[#123D2A]">Check the payment slip:</span> payer, item or rent, count, amount, payment method, and status. Approve only when the proof and saved details match.
    </div> : null}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Waiting for review" value={String(summary.pendingManual)} icon={Clock3} />
      <StatCard label="Needs correction" value={String(summary.needsClarification)} icon={Send} />
      <StatCard label="Approved today" value={String(summary.validatedToday)} icon={BadgeCheck} />
      <StatCard label="Approved amount" value={money(summary.validatedAmount)} icon={Banknote} />
    </div>

    <div className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_minmax(11rem,13rem)_auto_auto]">
        <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
          <input value={filters.search ?? ""} onChange={(e) => setFilter("search", e.target.value)} type="search"
            placeholder="Search payer or reference number"
            className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20" />
        </label>
        <Select value={filters.validationStatus ?? ""} onChange={(v) => setFilter("validationStatus", v)} options={statusOptions} label="All statuses" />
        <button type="button" onClick={() => setShowAdvancedFilters((current) => !current)} aria-expanded={showAdvancedFilters}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC]"><SlidersHorizontal className="size-4" />{showAdvancedFilters ? "Hide filters" : "More filters"}</button>
        <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC]"><RefreshCcw className="size-4" />Refresh</button>
      </div>
      {showAdvancedFilters ? <div className="grid gap-3 border-t border-[#E2E8E2] pt-3 md:grid-cols-3 xl:grid-cols-4">
        <Select value={filters.paymentPurpose ?? ""} onChange={(v) => setFilter("paymentPurpose", v)} options={purposeOptions} label="All purposes" />
        <Select value={filters.paymentChannel ?? ""} onChange={(v) => setFilter("paymentChannel", v)} options={channelOptions} label="All payment methods" />
        <Select value={filters.validationSource ?? ""} onChange={(v) => setFilter("validationSource", v)} options={sourceOptions} label="All validation sources" />
        <Select value={filters.gatewayManual ?? "all"} onChange={(v) => setFilter("gatewayManual", v)} options={["all", "gateway", "manual"]} label="Online or manual" />
        <Select value={filters.failedEvents ? "failed" : "all"} onChange={(v) => setFilter("failedEvents", v === "failed")} options={["all", "failed"]} label="Payment system issues" />
        <input value={filters.dateFrom ?? ""} onChange={(e) => setFilter("dateFrom", e.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" type="date" aria-label="From date" />
        <input value={filters.dateTo ?? ""} onChange={(e) => setFilter("dateTo", e.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" type="date" aria-label="To date" />
        <input value={filters.amountMin ?? ""} onChange={(e) => setFilter("amountMin", e.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" inputMode="decimal" placeholder="Minimum amount" aria-label="Minimum amount" />
        <input value={filters.amountMax ?? ""} onChange={(e) => setFilter("amountMax", e.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" inputMode="decimal" placeholder="Maximum amount" aria-label="Maximum amount" />
        <Select value={filters.sortBy ?? "submittedAt"} onChange={(v) => setFilter("sortBy", v)} options={["submittedAt", "paidAt", "amount", "referenceNumber"]} label="Sort payments by" />
        <Select value={filters.sortDirection ?? "desc"} onChange={(v) => setFilter("sortDirection", v)} options={["desc", "asc"]} label="Sort order" />
        <Select value={String(filters.pageSize ?? 20)} onChange={(v) => setFilter("pageSize", Number(v))} options={["10", "20", "50", "100"]} label="Payments per page" />
        <button type="button" onClick={() => setFilters({ page: 1, pageSize: 20, sortBy: "submittedAt", sortDirection: "desc", gatewayManual: "all" })}
          className="h-11 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC]">Clear all filters</button>
      </div> : null}
    </div>

    {error ? <ErrorState message={error} /> : null}
    {isLoading ? <LoadingSkeleton /> : payments.length === 0 ? <EmptyState icon={ReceiptText} title="No payment references found" description="No saved TrackCOOP payments match the selected filters." /> : <DataTable>
      <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
        <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]"><tr>
          <th className="px-5 py-4">Payer</th><th className="px-5 py-4">Bought / Rented</th><th className="px-5 py-4">Qty / Count</th><th className="px-5 py-4">Amount paid</th><th className="px-5 py-4">Paid through</th><th className="px-5 py-4">Status</th><th className="px-5 py-4"><span className="sr-only">Action</span></th>
        </tr></thead>
        <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">{payments.map((payment) => <tr key={payment.id} className="hover:bg-[#F7F8F3]">
          <td className="px-5 py-4"><p className="font-semibold text-[#123D2A]">{safe(payment.payerName)}</p><p className="mt-1 text-xs text-[#6C7A70]">{paymentForLabel(payment)}</p></td>
          <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{rentedItemLabel(payment)}</p><p className="mt-1 text-xs text-[#6C7A70]">{rentedItemSubLabel(payment)}</p><div className="mt-1 flex flex-wrap gap-1">{payment.gatewayEnvironment === "Test" ? <StatusBadge tone="warning">Test Mode</StatusBadge> : null}{payment.failedGatewayEvents ? <StatusBadge tone="danger">{payment.failedGatewayEvents} failed event</StatusBadge> : null}</div></td>
          <td className="px-5 py-4 font-semibold">{paymentCountLabel(payment)}</td>
          <td className="px-5 py-4"><CurrencyDisplay value={payment.amount} /></td>
          <td className="px-5 py-4"><StatusBadge tone={payment.paymentChannel === "PayMongo" ? "success" : "neutral"}>{paidThroughLabel(payment)}</StatusBadge></td>
          <td className="px-5 py-4"><StatusBadge tone={badgeTone(payment.validationStatus)}>{statusLabel(payment.validationStatus)}</StatusBadge></td>
          <td className="px-5 py-4"><button type="button" onClick={() => void openDetail(payment.id)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]"><Eye className="size-4" />Review</button></td>
        </tr>)}</tbody>
      </table>
    </DataTable>}

    <div className="flex flex-col gap-3 rounded-lg border border-[#CAD8CB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-[#5D6D63]">Page {page} of {pages} · {total} payment references</p>
      <div className="flex gap-2"><button type="button" disabled={page <= 1 || isLoading} onClick={() => setFilter("page", page - 1)} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold disabled:opacity-50"><ChevronLeft className="size-4" />Previous</button>
        <button type="button" disabled={page >= pages || isLoading} onClick={() => setFilter("page", page + 1)} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold disabled:opacity-50">Next<ChevronRight className="size-4" /></button></div>
    </div>

    <FormDialog open={Boolean(selected)} onOpenChange={(open: boolean) => { if (!open && !dialog.open) setSelected(null); }} title={selected?.referenceNumber ?? "Payment reference"}
      description={selected ? `${selected.paymentPurpose} / ${selected.paymentChannel}` : undefined} contentClassName="w-[min(74rem,calc(100vw-2rem))]">
      {isDetailLoading || !selected ? <LoadingSkeleton /> : <div className="grid gap-5 pt-3">
        {selected.posting.warnings.length ? <div className="rounded-lg border border-[#F3D08A] bg-[#FFF8E8] p-4 text-sm text-[#775200]"><p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4" />Warnings</p><ul className="mt-2 list-disc pl-5">{selected.posting.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
        <div className="rounded-lg border border-[#CAD8CB] bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Info label="Payer" value={safe(selected.payerName)} sub={`${safe(selected.payerEmail)} / ${safe(selected.payerContact)}`} />
            <Info label="Bought / Rented" value={rentedItemLabel(selected)} sub={selected.paymentPurpose === "Rental" ? rentedItemSubLabel(selected) : paymentForLabel(selected)} />
            <Info label="Qty / Count" value={paymentCountLabel(selected)} sub="Exact item quantity appears here only when saved in the payment record." />
            <Info label="Amount paid" value={money(selected.amount)} sub={selected.paymentPurpose} />
            <Info label="Paid through" value={paidThroughLabel(selected)} sub={selected.paymentChannel === "PayMongo" ? `${selected.gatewayEnvironment} mode` : "Manual payment"} />
            <Info label="Status" value={statusLabel(selected.validationStatus)} sub={selected.validatedByName ? `Last approved by ${selected.validatedByName}` : "Not yet approved"} />
          </div>
          <p className="mt-3 text-xs font-semibold text-[#5D6D63]">Reference: {selected.referenceNumber}</p>
        </div>
        {canMutate ? <section className="grid gap-4 rounded-lg border-2 border-[#B7D7BD] bg-[#F2FAF3] p-4 sm:p-5">
          <div><h3 className="text-lg font-bold text-[#123D2A]">Make a decision</h3><p className="mt-1 text-sm text-[#5D6D63]">Approve only after the payment evidence and all saved details match.</p></div>
          {selected.proofFilePath ? <a href={paymentReferenceProofUrl(selected.id)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-[#1F6B43] bg-white px-5 text-base font-bold text-[#123D2A] hover:bg-[#EEF7EF]"><Eye className="size-5" />Open payment proof</a>
            : selected.paymentChannel !== "PayMongo" ? <div className="rounded-md border border-[#F3D08A] bg-[#FFF8E8] p-3 text-sm text-[#775200]"><strong>No proof was uploaded.</strong> Check the cash book, bank record, or GCash record before approving.</div> : null}
          <div className="flex flex-wrap gap-2">
            <MutateButton disabled={!manualValidationEligible(selected)} onClick={() => setDialog(openPaymentAction("validate"))}><BadgeCheck className="size-4" />Approve payment</MutateButton>
            {selected.paymentChannel === "PayMongo" ? <MutateButton disabled={isSecondarySubmitting} onClick={() => void refreshFromPaymongo()}><RefreshCcw className="size-4" />Check PayMongo status</MutateButton> : null}
            <button type="button" disabled={!mutationAllowed(selected)} onClick={() => setDialog(openPaymentAction("clarification"))} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#1F6B43] bg-white px-4 text-sm font-bold text-[#123D2A] disabled:cursor-not-allowed disabled:border-[#CAD8CB] disabled:text-[#87948B]"><Send className="size-4" />Ask for correction</button>
            <button type="button" disabled={!mutationAllowed(selected)} onClick={() => setDialog(openPaymentAction("reject"))} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#D9A99F] bg-white px-4 text-sm font-bold text-[#7A3023] disabled:cursor-not-allowed disabled:border-[#CAD8CB] disabled:text-[#87948B]"><X className="size-4" />Reject payment</button>
          </div>
          {selected.paymentChannel === "PayMongo" ? <p className="text-sm text-[#5D6D63]">PayMongo payments are approved after PayMongo confirms the payment. Use Check PayMongo status when the payer says they already paid.</p> : null}
          <details className="rounded-md border border-[#CAD8CB] bg-white p-3">
            <summary className="cursor-pointer font-bold text-[#123D2A]">Correct the reference number or amount</summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><FormField label="Reference number"><input value={editReference} onChange={(e) => setEditReference(e.target.value)} disabled={!mutationAllowed(selected)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm disabled:bg-[#EEF2EC]" /></FormField>
              <FormField label="Amount"><input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} disabled={!mutationAllowed(selected)} inputMode="decimal" className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm disabled:bg-[#EEF2EC]" /></FormField></div>
            <button type="button" disabled={!mutationAllowed(selected) || isSecondarySubmitting} onClick={() => void saveEdit()} className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-[#CAD8CB] px-4 text-sm font-bold text-[#123D2A] disabled:opacity-50"><Pencil className="size-4" />Save corrected details</button>
          </details>
        </section> : <div className="rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4 text-sm text-[#5D6D63]">Chairman access is read-only. Payment mutation and recovery controls are available only to the Bookkeeper.</div>}

        <details className="rounded-lg border border-[#CAD8CB] bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold text-[#123D2A]">View records, history, and technical details</summary>
          <div className="mt-5 grid gap-5 border-t border-[#E2E8E2] pt-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Member" value={safe(selected.memberCode)} sub={safe(selected.memberName)} />
              <Info label="Application" value={safe(selected.applicationCode)} sub={safe(selected.applicationName)} />
              <Info label="Validation source" value={selected.validationSource ?? "Not yet validated"} sub={`Validated by ${safe(selected.validatedByName)}`} />
              <Info label="Paid time" value={dateTime(selected.paidAt)} sub={`Webhook ${dateTime(selected.webhookReceivedAt)}`} />
              <Info label="Finance posting" value={safe(selected.posting.financialRecordNumber)} sub={selected.posting.financialRecordStatus ?? "No finance posting"} />
              <Info label="Share Capital" value={safe(selected.posting.shareCapitalPaymentId)} sub={selected.posting.shareCapitalStatus ?? "Not posted"} />
              <Info label="Membership requirement" value={selected.posting.membershipRequirementStatus ?? "Not linked"} sub={selected.posting.membershipApplicationStatus ?? "No application status"} />
              <Info label="Receipt" value={selected.receipt?.processingStatus ?? "Not queued"} sub={selected.receipt ? `${selected.receipt.receiptNumber} · attempts ${selected.receipt.attemptCount}` : undefined} />
              <Info label="Gateway status" value={selected.gatewayEnvironment} sub={selected.gatewayStatus ?? "No gateway status"} />
              <Info label="Gateway IDs" value={safe(selected.gatewayCheckoutId)} sub={`Payment ${safe(selected.gatewayPaymentId)} · Intent ${safe(selected.gatewayPaymentIntentId)}`} />
            </div>

            {canMutate ? <div className="flex flex-wrap gap-2 rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4">
              <p className="w-full text-xs font-black uppercase tracking-[0.16em] text-[#5D6D63]">Support and recovery tools</p>
              <MutateButton disabled={selected.validationStatus !== "Validated"} onClick={() => setDialog(openPaymentAction("reverse"))}><RotateCcw className="size-4" />Reverse approved payment</MutateButton>
              {selected.paymentChannel === "PayMongo" ? <MutateButton disabled={isSecondarySubmitting} onClick={() => void refreshFromPaymongo()}><RefreshCcw className="size-4" />Check PayMongo status</MutateButton> : null}
              {selected.receipt?.processingStatus === "Failed" ? <MutateButton disabled={isSecondarySubmitting} onClick={() => void retryReceipt()}><ReceiptText className="size-4" />Retry receipt</MutateButton> : null}
            </div> : null}

        <section className="grid gap-3"><h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]"><WalletCards className="size-4" />Checkout attempts</h3>
          {selected.checkoutAttempts.length ? selected.checkoutAttempts.map((attempt) => <div key={attempt.id} className="rounded-lg border border-[#CAD8CB] bg-white p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-[#123D2A]">Attempt {attempt.attemptNumber} · {attempt.checkoutId}</p><div className="flex gap-2">{attempt.active ? <StatusBadge tone="warning">Active attempt</StatusBadge> : null}<StatusBadge tone={attempt.gatewayEnvironment === "Test" ? "warning" : "neutral"}>{attempt.gatewayEnvironment} Mode</StatusBadge></div></div><p className="mt-1 text-[#5D6D63]">{money(attempt.amount)} · {attempt.gatewayStatus ?? "No gateway status"} · reusable until {dateTime(attempt.reusableUntil)}</p></div>) : <p className="text-sm text-[#5D6D63]">No checkout attempts recorded.</p>}
        </section>

        <section className="grid gap-3"><h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]"><ShieldCheck className="size-4" />Gateway events</h3>
          {selected.gatewayEvents.length ? selected.gatewayEvents.map((event) => <div key={event.id} className="rounded-lg border border-[#CAD8CB] bg-white p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-[#123D2A]">{event.eventType}</p><div className="flex gap-2"><StatusBadge tone={badgeTone(event.processingStatus)}>{event.processingStatus}</StatusBadge>{event.livemode ? null : <StatusBadge tone="warning">Test Mode</StatusBadge>}</div></div><p className="mt-1 text-[#5D6D63]">Event {event.id} · retry count {event.retryCount} · signature {event.signatureVerified ? "verified" : "not verified"}</p><p className="mt-1 text-[#5D6D63]">Checkout {safe(event.checkoutId)} · Payment {safe(event.paymentId)} · Intent {safe(event.paymentIntentId)}</p>{event.errorCode || event.errorMessage ? <div className="mt-3 rounded-md border border-[#E7B8A8] bg-[#FFF4EC] p-3 text-[#7A3023]"><p className="font-bold">{event.errorCode ?? "Safe settlement error"}</p><p className="mt-1">{event.errorMessage ?? "No additional safe error detail."}</p></div> : null}{canMutate && canRetryGatewayEvent(event) ? <button type="button" onClick={() => setDialog(openPaymentAction("retry", event.id))} className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white"><RotateCcw className="size-4" />Retry Failed Settlement</button> : null}</div>) : <p className="text-sm text-[#5D6D63]">No gateway events recorded.</p>}
        </section>

        <section className="grid gap-3"><h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]"><History className="size-4" />Validation history</h3>
          {selected.validationHistory.length ? selected.validationHistory.map((entry) => <div key={entry.id} className="rounded-lg border border-[#CAD8CB] bg-white p-3 text-sm"><p className="font-bold text-[#123D2A]">{entry.oldStatus ?? "New"} to {entry.newStatus}</p><p className="mt-1 text-[#5D6D63]">{entry.validationSource} · {safe(entry.changedByName)} · {dateTime(entry.changedAt)}</p>{entry.reason ? <p className="mt-2 text-[#294B39]">{entry.reason}</p> : null}</div>) : <p className="text-sm text-[#5D6D63]">No validation history yet.</p>}
        </section>
          </div>
        </details>
      </div>}
    </FormDialog>

    <ActionConfirmationDialog payment={selected} state={dialog} event={selectedEvent}
      onChange={(patch) => setDialog((current) => updatePaymentAction(current, patch))}
      onClose={() => setDialog(closePaymentAction())} onConfirm={() => void confirmMutation()} />
  </div>;
}
