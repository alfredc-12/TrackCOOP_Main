"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileWarning,
  History,
  Pencil,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
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
  validate: "Validate manual payment",
  reject: "Reject payment",
  clarification: "Request clarification",
  reverse: "Reverse payment",
  retry: "Retry failed gateway settlement",
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(value);
}
function safe(value: string | null | undefined) { return value?.trim() || "Not recorded"; }
function dateTime(value: string | null | undefined) { return value ? new Date(value).toLocaleString() : "Not recorded"; }
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
    <select value={value} onChange={(event: any) => onChange(event.target.value)} aria-label={label}
      className="h-11 min-w-0 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-semibold text-[#123D2A] outline-none transition focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20">
      {options.map((option) => <option key={option || label} value={option}>{option || label}</option>)}
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
  onChange: (patch: Partial<Pick<PaymentActionDialogState, "reason" | "confirmation" | "recoveryNote">>) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const action = state.action;
  const valid = payment && action ? canConfirmPaymentAction(state, payment) : false;
  return <FormDialog open={state.open} onOpenChange={(open: boolean) => { if (!open && !state.submitting) onClose(); }}
    title={action ? actionLabels[action] : "Confirm payment action"}
    description="Review the saved TrackCOOP information and the effect before confirming."
    contentClassName="w-[min(42rem,calc(100vw-2rem))]">
    {payment && action ? <div className="grid gap-4 pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Info label="Reference" value={payment.referenceNumber} sub={payment.provider} />
        <Info label="Payer" value={safe(payment.payerName)} sub={safe(payment.payerContact)} />
        <Info label="Amount" value={money(payment.amount)} sub={payment.paymentPurpose} />
        <Info label="Channel / Status" value={payment.paymentChannel} sub={payment.validationStatus} />
      </div>
      {event ? <Info label="Gateway event" value={`${event.eventType} / ${event.processingStatus}`} sub={`Retry count ${event.retryCount} · Payment ${safe(event.paymentId)}`} /> : null}
      <div className="rounded-lg border border-[#F3D08A] bg-[#FFF8E8] p-4 text-sm leading-6 text-[#775200]">
        <p className="font-black uppercase tracking-[0.12em]">Effect</p>
        <p className="mt-1">{paymentActionEffect(action)}</p>
      </div>
      {["reject", "clarification", "reverse"].includes(action) ? <FormField label="Reason" hint="Required, at least 8 characters.">
        <textarea value={state.reason} onChange={(e: any) => onChange({ reason: e.target.value })}
          className="min-h-24 rounded-md border border-[#CAD8CB] bg-white px-3 py-2 text-sm" disabled={state.submitting} />
      </FormField> : null}
      {action === "reverse" ? <FormField label="Type the payment reference to confirm" hint={payment.referenceNumber}>
        <input value={state.confirmation} onChange={(e: any) => onChange({ confirmation: e.target.value })}
          className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" disabled={state.submitting} />
      </FormField> : null}
      {action === "retry" ? <FormField label="Recovery note" hint="Required, at least 8 characters. This note is added to the audit record.">
        <textarea value={state.recoveryNote} onChange={(e: any) => onChange({ recoveryNote: e.target.value })}
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
    setIsSecondarySubmitting(true);
    try {
      await updatePaymentReference(selected.id, { referenceNumber: editReference, amount: Number(editAmount) });
      toast.success("Payment reference updated."); await Promise.all([load(), reloadSelected()]);
    } catch (caught) { toast.error(caught instanceof ApiClientError ? caught.message : "Payment update failed."); }
    finally { setIsSecondarySubmitting(false); }
  };
  const refreshFromPaymongo = async () => {
    if (!selected) return;
    setIsSecondarySubmitting(true);
    try {
      const status = await getPaymongoPaymentStatus(selected.id);
      toast.success(`PayMongo inquiry complete. TrackCOOP status: ${status.validationStatus}`);
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
    <PageHeader eyebrow="Payments" title={role === "bookkeeper" ? "Payment Validation" : "Payments"}
      description={role === "bookkeeper" ? "Review manual payments, inspect safe PayMongo outcomes, and recover verified failed settlement events." : "Read-only payment oversight, safe gateway status, posting history, and receipts."}
      actions={<StatusBadge tone={role === "bookkeeper" ? "success" : "neutral"}>{role === "bookkeeper" ? "Bookkeeper controls" : "Chairman read-only"}</StatusBadge>} />
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
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(10rem,12rem))]">
        <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" />
          <input value={filters.search ?? ""} onChange={(e: any) => setFilter("search", e.target.value)} type="search"
            placeholder="Search reference, payer, member, or application"
            className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-4 text-sm outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20" />
        </label>
        <Select value={filters.validationStatus ?? ""} onChange={(v) => setFilter("validationStatus", v)} options={statusOptions} label="All statuses" />
        <Select value={filters.paymentPurpose ?? ""} onChange={(v) => setFilter("paymentPurpose", v)} options={purposeOptions} label="All purposes" />
        <Select value={filters.paymentChannel ?? ""} onChange={(v) => setFilter("paymentChannel", v)} options={channelOptions} label="All channels" />
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Select value={filters.validationSource ?? ""} onChange={(v) => setFilter("validationSource", v)} options={sourceOptions} label="All sources" />
        <Select value={filters.gatewayManual ?? "all"} onChange={(v) => setFilter("gatewayManual", v)} options={["all", "gateway", "manual"]} label="Gateway/manual" />
        <Select value={filters.failedEvents ? "failed" : "all"} onChange={(v) => setFilter("failedEvents", v === "failed")} options={["all", "failed"]} label="Gateway event state" />
        <input value={filters.dateFrom ?? ""} onChange={(e: any) => setFilter("dateFrom", e.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" type="date" aria-label="Date from" />
        <input value={filters.dateTo ?? ""} onChange={(e: any) => setFilter("dateTo", e.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" type="date" aria-label="Date to" />
        <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC]"><RefreshCcw className="size-4" />Reload TrackCOOP Status</button>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <input value={filters.amountMin ?? ""} onChange={(e: any) => setFilter("amountMin", e.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" inputMode="decimal" placeholder="Minimum amount" />
        <input value={filters.amountMax ?? ""} onChange={(e: any) => setFilter("amountMax", e.target.value)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm" inputMode="decimal" placeholder="Maximum amount" />
        <Select value={filters.sortBy ?? "submittedAt"} onChange={(v) => setFilter("sortBy", v)} options={["submittedAt", "paidAt", "amount", "referenceNumber"]} label="Sort by" />
        <Select value={filters.sortDirection ?? "desc"} onChange={(v) => setFilter("sortDirection", v)} options={["desc", "asc"]} label="Sort direction" />
        <Select value={String(filters.pageSize ?? 20)} onChange={(v) => setFilter("pageSize", Number(v))} options={["10", "20", "50", "100"]} label="Rows per page" />
        <button type="button" onClick={() => setFilters({ page: 1, pageSize: 20, sortBy: "submittedAt", sortDirection: "desc", gatewayManual: "all" })}
          className="h-11 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC]">Clear filters</button>
      </div>
    </div>

    {error ? <ErrorState message={error} /> : null}
    {isLoading ? <LoadingSkeleton /> : payments.length === 0 ? <EmptyState icon={ReceiptText} title="No payment references found" description="No saved TrackCOOP payments match the selected filters." /> : <DataTable>
      <table className="min-w-full divide-y divide-[#E2E8E2] text-left text-sm">
        <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]"><tr>
          <th className="px-5 py-4">Reference</th><th className="px-5 py-4">Payer / Subject</th><th className="px-5 py-4">Purpose</th><th className="px-5 py-4">Channel</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Action</th>
        </tr></thead>
        <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">{payments.map((payment) => <tr key={payment.id} className="hover:bg-[#F7F8F3]">
          <td className="px-5 py-4"><p className="font-bold text-[#123D2A]">{payment.referenceNumber}</p><div className="mt-1 flex flex-wrap gap-1">{payment.gatewayEnvironment === "Test" ? <StatusBadge tone="warning">Test Mode</StatusBadge> : null}{payment.failedGatewayEvents ? <StatusBadge tone="danger">{payment.failedGatewayEvents} failed event</StatusBadge> : null}</div></td>
          <td className="px-5 py-4"><p className="font-semibold text-[#123D2A]">{safe(payment.payerName)}</p><p className="mt-1 text-xs text-[#6C7A70]">{payment.memberCode ? `${payment.memberCode} · ${safe(payment.memberName)}` : payment.applicationCode ? `${payment.applicationCode} · ${safe(payment.applicationName)}` : safe(payment.payerContact)}</p></td>
          <td className="px-5 py-4">{payment.paymentPurpose}</td>
          <td className="px-5 py-4"><StatusBadge tone={payment.paymentChannel === "PayMongo" ? "success" : "neutral"}>{payment.paymentChannel}</StatusBadge></td>
          <td className="px-5 py-4"><CurrencyDisplay value={payment.amount} /></td>
          <td className="px-5 py-4"><StatusBadge tone={badgeTone(payment.validationStatus)}>{payment.validationStatus}</StatusBadge></td>
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
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Info label="Payment reference" value={selected.referenceNumber} sub={selected.provider} />
          <Info label="Payer" value={safe(selected.payerName)} sub={`${safe(selected.payerEmail)} · ${safe(selected.payerContact)}`} />
          <Info label="Member" value={safe(selected.memberCode)} sub={safe(selected.memberName)} />
          <Info label="Application" value={safe(selected.applicationCode)} sub={safe(selected.applicationName)} />
          <Info label="Amount / Purpose" value={money(selected.amount)} sub={selected.paymentPurpose} />
          <Info label="Channel / Source" value={selected.paymentChannel} sub={selected.validationSource ?? "No validation source"} />
          <Info label="Current status" value={selected.validationStatus} sub={`Validated by ${safe(selected.validatedByName)}`} />
          <Info label="Gateway mode" value={selected.gatewayEnvironment} sub={selected.gatewayEnvironment === "Test" ? "Test Mode" : selected.gatewayStatus ?? "No gateway status"} />
          <Info label="Gateway IDs" value={safe(selected.gatewayCheckoutId)} sub={`Payment ${safe(selected.gatewayPaymentId)} · Intent ${safe(selected.gatewayPaymentIntentId)}`} />
          <Info label="Paid time" value={dateTime(selected.paidAt)} sub={`Webhook ${dateTime(selected.webhookReceivedAt)}`} />
          <Info label="Finance posting" value={safe(selected.posting.financialRecordNumber)} sub={selected.posting.financialRecordStatus ?? "No finance posting"} />
          <Info label="Share Capital" value={safe(selected.posting.shareCapitalPaymentId)} sub={selected.posting.shareCapitalStatus ?? "Not posted"} />
          <Info label="Membership requirement" value={selected.posting.membershipRequirementStatus ?? "Not linked"} sub={selected.posting.membershipApplicationStatus ?? "No application status"} />
          <Info label="Receipt" value={selected.receipt?.processingStatus ?? "Not queued"} sub={selected.receipt ? `${selected.receipt.receiptNumber} · attempts ${selected.receipt.attemptCount}` : undefined} />
        </div>

        {canMutate ? <section className="grid gap-4 rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">Bookkeeper controls</h3>
          <div className="grid gap-3 md:grid-cols-2"><FormField label="Reference number"><input value={editReference} onChange={(e: any) => setEditReference(e.target.value)} disabled={!mutationAllowed(selected)} className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm disabled:bg-[#EEF2EC]" /></FormField>
            <FormField label="Amount"><input value={editAmount} onChange={(e: any) => setEditAmount(e.target.value)} disabled={!mutationAllowed(selected)} inputMode="decimal" className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm disabled:bg-[#EEF2EC]" /></FormField></div>
          <div className="flex flex-wrap gap-2">
            <MutateButton disabled={!manualValidationEligible(selected)} onClick={() => setDialog(openPaymentAction("validate"))}><BadgeCheck className="size-4" />Validate</MutateButton>
            <MutateButton disabled={!mutationAllowed(selected)} onClick={() => setDialog(openPaymentAction("reject"))}><X className="size-4" />Reject</MutateButton>
            <MutateButton disabled={!mutationAllowed(selected)} onClick={() => setDialog(openPaymentAction("clarification"))}><Send className="size-4" />Request Clarification</MutateButton>
            <MutateButton disabled={!mutationAllowed(selected) || isSecondarySubmitting} onClick={() => void saveEdit()}><Pencil className="size-4" />Save Edit</MutateButton>
            <MutateButton disabled={selected.validationStatus !== "Validated"} onClick={() => setDialog(openPaymentAction("reverse"))}><RotateCcw className="size-4" />Reverse</MutateButton>
            {selected.paymentChannel === "PayMongo" ? <MutateButton disabled={isSecondarySubmitting} onClick={() => void refreshFromPaymongo()}><RefreshCcw className="size-4" />Refresh from PayMongo</MutateButton> : null}
            {selected.receipt?.processingStatus === "Failed" ? <MutateButton disabled={isSecondarySubmitting} onClick={() => void retryReceipt()}><ReceiptText className="size-4" />Retry Receipt</MutateButton> : null}
            {selected.proofFilePath ? <a href={paymentReferenceProofUrl(selected.id)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A]">Proof</a> : null}
          </div>
        </section> : <div className="rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4 text-sm text-[#5D6D63]">Chairman access is read-only. Payment mutation and recovery controls are available only to the Bookkeeper.</div>}

        <section className="grid gap-3"><h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]"><WalletCards className="size-4" />Checkout attempts</h3>
          {selected.checkoutAttempts.length ? selected.checkoutAttempts.map((attempt) => <div key={attempt.id} className="rounded-lg border border-[#CAD8CB] bg-white p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-[#123D2A]">Attempt {attempt.attemptNumber} · {attempt.checkoutId}</p><div className="flex gap-2">{attempt.active ? <StatusBadge tone="warning">Active attempt</StatusBadge> : null}<StatusBadge tone={attempt.gatewayEnvironment === "Test" ? "warning" : "neutral"}>{attempt.gatewayEnvironment} Mode</StatusBadge></div></div><p className="mt-1 text-[#5D6D63]">{money(attempt.amount)} · {attempt.gatewayStatus ?? "No gateway status"} · reusable until {dateTime(attempt.reusableUntil)}</p></div>) : <p className="text-sm text-[#5D6D63]">No checkout attempts recorded.</p>}
        </section>

        <section className="grid gap-3"><h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]"><ShieldCheck className="size-4" />Gateway events</h3>
          {selected.gatewayEvents.length ? selected.gatewayEvents.map((event) => <div key={event.id} className="rounded-lg border border-[#CAD8CB] bg-white p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-[#123D2A]">{event.eventType}</p><div className="flex gap-2"><StatusBadge tone={badgeTone(event.processingStatus)}>{event.processingStatus}</StatusBadge>{event.livemode ? null : <StatusBadge tone="warning">Test Mode</StatusBadge>}</div></div><p className="mt-1 text-[#5D6D63]">Event {event.id} · retry count {event.retryCount} · signature {event.signatureVerified ? "verified" : "not verified"}</p><p className="mt-1 text-[#5D6D63]">Checkout {safe(event.checkoutId)} · Payment {safe(event.paymentId)} · Intent {safe(event.paymentIntentId)}</p>{event.errorCode || event.errorMessage ? <div className="mt-3 rounded-md border border-[#E7B8A8] bg-[#FFF4EC] p-3 text-[#7A3023]"><p className="font-bold">{event.errorCode ?? "Safe settlement error"}</p><p className="mt-1">{event.errorMessage ?? "No additional safe error detail."}</p></div> : null}{canMutate && canRetryGatewayEvent(event) ? <button type="button" onClick={() => setDialog(openPaymentAction("retry", event.id))} className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white"><RotateCcw className="size-4" />Retry Failed Settlement</button> : null}</div>) : <p className="text-sm text-[#5D6D63]">No gateway events recorded.</p>}
        </section>

        <section className="grid gap-3"><h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]"><History className="size-4" />Validation history</h3>
          {selected.validationHistory.length ? selected.validationHistory.map((entry) => <div key={entry.id} className="rounded-lg border border-[#CAD8CB] bg-white p-3 text-sm"><p className="font-bold text-[#123D2A]">{entry.oldStatus ?? "New"} to {entry.newStatus}</p><p className="mt-1 text-[#5D6D63]">{entry.validationSource} · {safe(entry.changedByName)} · {dateTime(entry.changedAt)}</p>{entry.reason ? <p className="mt-2 text-[#294B39]">{entry.reason}</p> : null}</div>) : <p className="text-sm text-[#5D6D63]">No validation history yet.</p>}
        </section>
      </div>}
    </FormDialog>

    <ActionConfirmationDialog payment={selected} state={dialog} event={selectedEvent}
      onChange={(patch) => setDialog((current) => updatePaymentAction(current, patch))}
      onClose={() => setDialog(closePaymentAction())} onConfirm={() => void confirmMutation()} />
  </div>;
}
