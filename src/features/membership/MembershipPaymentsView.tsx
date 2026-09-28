"use client";

import {
  BadgeCheck,
  Banknote,
  CircleDollarSign,
  ChevronDown,
  Eye,
  ReceiptText,
  RefreshCcw,
  Search,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
  createPaymentReference,
  getPaymentReferenceDetail,
  getPaymongoPaymentStatus,
  listPaymentReferences,
  paymentReferenceProofUrl,
  rejectPaymentReference,
  requestPaymentClarification,
  validatePaymentReference,
  type PaymentReferenceDetail,
  type PaymentReferenceListItem,
} from "@/features/finance/finance-api";
import {
  getChairmanApplication,
  listChairmanApplications,
} from "@/features/membership-applications/membership-application-api";
import type {
  ChairmanApplicationDetail,
  ChairmanApplicationListItem,
} from "@/features/membership-applications/membership-application-types";

type ManualChannel = "Cash" | "Manual GCash" | "Bank Transfer" | "Other";
type PaymentPurpose = "Associate Membership Fee" | "Share Capital";

const manualChannels: ManualChannel[] = ["Cash", "Manual GCash", "Bank Transfer", "Other"];
const simpleStatuses = ["All", "Needs payment", "Pending review", "Approved", "Needs clarification", "Rejected", "Reversed"] as const;

function StatusFilter({ value, onChange }: { value: (typeof simpleStatuses)[number]; onChange: (value: (typeof simpleStatuses)[number]) => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideOrEscape = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") setOpen(false);
      if (event instanceof MouseEvent && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideOrEscape);
    document.addEventListener("keydown", closeOnOutsideOrEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideOrEscape);
      document.removeEventListener("keydown", closeOnOutsideOrEscape);
    };
  }, [open]);
  return (
    <div ref={dropdownRef} className="relative">
      <button type="button" aria-label="Filter membership payments by status" aria-expanded={open} onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-left text-sm font-bold text-[#123D2A] outline-none transition hover:border-[#8FB79A] focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20">
        <span>{value}</span><ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? <div role="listbox" aria-label="Payment status options" className="absolute z-30 mt-2 w-full rounded-md border border-[#CAD8CB] bg-white p-1 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">
        {simpleStatuses.map((status) => <button key={status} type="button" role="option" aria-selected={status === value} onClick={() => { onChange(status); setOpen(false); }}
          className={`flex w-full items-center rounded px-3 py-2 text-left text-sm transition ${status === value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F2FAF3]"}`}>{status}</button>)}
      </div> : null}
    </div>
  );
}

function ManualChannelSelect({ value, onChange }: { value: ManualChannel; onChange: (value: ManualChannel) => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideOrEscape = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") setOpen(false);
      if (event instanceof MouseEvent && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideOrEscape);
    document.addEventListener("keydown", closeOnOutsideOrEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideOrEscape);
      document.removeEventListener("keydown", closeOnOutsideOrEscape);
    };
  }, [open]);
  return (
    <div ref={dropdownRef} className="relative">
      <button type="button" aria-label="Select payment method" aria-expanded={open} onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-[#CAD8CB] bg-white px-3 text-left text-sm font-semibold text-[#123D2A] outline-none transition hover:border-[#8FB79A] focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20">
        <span>{value}</span><ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? <div role="listbox" aria-label="Payment method options" className="absolute z-30 mt-2 w-full rounded-md border border-[#CAD8CB] bg-white p-1 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">
        {manualChannels.map((channel) => <button key={channel} type="button" role="option" aria-selected={channel === value} onClick={() => { onChange(channel); setOpen(false); }}
          className={`flex w-full items-center rounded px-3 py-2 text-left text-sm transition ${channel === value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F2FAF3]"}`}>{channel}</button>)}
      </div> : null}
    </div>
  );
}

function PageSizeSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const options = [5, 10, 20, 50];
  return (
    <div className="relative">
      <button type="button" aria-label="Payments per page" aria-expanded={open} onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-left text-sm font-bold text-[#123D2A] outline-none transition hover:border-[#8FB79A] focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/20">
        <span>{value} per page</span><ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? <div role="listbox" aria-label="Payments per page options" className="absolute z-30 mt-2 w-full rounded-md border border-[#CAD8CB] bg-white p-1 shadow-[0_12px_28px_rgba(18,61,42,0.16)]">
        {options.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false); }}
          className={`flex w-full items-center rounded px-3 py-2 text-left text-sm transition ${option === value ? "bg-[#EAF5EC] font-bold text-[#123D2A]" : "text-[#294B39] hover:bg-[#F2FAF3]"}`}>{option} per page</button>)}
      </div> : null}
    </div>
  );
}
const associateMembershipFee = 200;
const trueMemberInitialCapital = 1500;

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

function safe(value: string | null | undefined) {
  return value?.trim() || "Not recorded";
}

function statusTone(status: string) {
  if (["Validated", "Payment Confirmed", "Approved", "Verified"].includes(status)) return "success" as const;
  if (["Rejected", "Reversed"].includes(status)) return "danger" as const;
  if (["Pending", "Needs Clarification", "Payment Required"].includes(status)) return "warning" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "Validated") return "Approved";
  if (status === "Needs Clarification") return "Needs correction";
  if (status === "Payment Required") return "Needs payment";
  return status;
}

function paymentMethodLabel(payment: PaymentReferenceListItem | PaymentReferenceDetail) {
  if (payment.paymentChannel === "PayMongo") {
    return payment.gatewayPaymentMethod ? `PayMongo - ${payment.gatewayPaymentMethod}` : "PayMongo";
  }
  return payment.paymentChannel;
}

function providerFromChannel(channel: ManualChannel) {
  if (channel === "Cash") return "Cash received by Bookkeeper";
  if (channel === "Manual GCash") return "Manual GCash";
  if (channel === "Bank Transfer") return "Bank Transfer";
  return "Manual payment";
}

function defaultReference(applicationCode: string, purpose: PaymentPurpose, channel: ManualChannel) {
  const purposeCode = purpose === "Associate Membership Fee" ? "FEE" : "CAP";
  const channelCode = channel === "Manual GCash" ? "GCASH" : channel.replaceAll(" ", "").toUpperCase();
  return `${applicationCode}-${channelCode}-${purposeCode}-${String(Date.now()).slice(-6)}`;
}

function paymentPurposeLabel(purpose: string) {
  if (purpose === "Associate Membership Fee") return "Membership fee";
  if (purpose === "Share Capital") return "Initial share capital";
  return purpose;
}

function paymentBelongsToApplication(
  payment: PaymentReferenceListItem,
  application: ChairmanApplicationListItem | ChairmanApplicationDetail,
) {
  return (
    payment.relatedEntityId === application.id ||
    payment.applicationCode === application.applicationCode
  );
}

function isUsableApplicationPayment(payment: PaymentReferenceListItem) {
  return payment.validationStatus !== "Rejected" && payment.validationStatus !== "Reversed";
}

function applicationPaymentTotal(
  application: ChairmanApplicationListItem | ChairmanApplicationDetail,
  payments: PaymentReferenceListItem[],
  purpose: PaymentPurpose,
) {
  return payments
    .filter(
      (payment) =>
        isUsableApplicationPayment(payment) &&
        paymentBelongsToApplication(payment, application) &&
        payment.paymentPurpose === purpose,
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function nextRequiredPayment(
  application: ChairmanApplicationListItem | ChairmanApplicationDetail,
  payments: PaymentReferenceListItem[],
): { purpose: PaymentPurpose; amount: number; label: string } | null {
  const hasMembershipFeePayment = payments.some(
    (payment) =>
      isUsableApplicationPayment(payment) &&
      paymentBelongsToApplication(payment, application) &&
      payment.paymentPurpose === "Associate Membership Fee" &&
      payment.amount === associateMembershipFee,
  );
  if (application.requestedMembershipType === "Associate" && !hasMembershipFeePayment) {
    return {
      purpose: "Associate Membership Fee",
      amount: associateMembershipFee,
      label: "Membership fee",
    };
  }
  if (
    application.requestedMembershipType === "True Member" &&
    applicationPaymentTotal(application, payments, "Share Capital") < trueMemberInitialCapital
  ) {
    return {
      purpose: "Share Capital",
      amount: trueMemberInitialCapital,
      label: "Initial share capital",
    };
  }
  return null;
}

function amountForPurpose(purpose: PaymentPurpose) {
  return purpose === "Associate Membership Fee"
    ? associateMembershipFee
    : trueMemberInitialCapital;
}

function applicantName(application: ChairmanApplicationListItem | ChairmanApplicationDetail) {
  return application.fullName || [application.firstName, application.lastName].filter(Boolean).join(" ");
}

function InfoBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#CAD8CB] bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C7A70]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-[#123D2A]">{value}</p>
      {sub ? <p className="mt-1 break-words text-xs text-[#5D6D63]">{sub}</p> : null}
    </div>
  );
}

function CheckBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold leading-6 text-[#294B39]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[#1F6B43]"
      />
      <span>{label}</span>
    </label>
  );
}

export function MembershipPaymentsView() {
  const [applications, setApplications] = useState<ChairmanApplicationListItem[]>([]);
  const [payments, setPayments] = useState<PaymentReferenceListItem[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<ChairmanApplicationDetail | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentReferenceDetail | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof simpleStatuses)[number]>("All");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentsPerPage, setPaymentsPerPage] = useState(5);
  const [manualPurpose, setManualPurpose] = useState<PaymentPurpose>("Associate Membership Fee");
  const [manualChannel, setManualChannel] = useState<ManualChannel>("Cash");
  const [manualReference, setManualReference] = useState("");
  const [manualAmount, setManualAmount] = useState("200");
  const [manualNote, setManualNote] = useState("");
  const [manualCreatedPaymentId, setManualCreatedPaymentId] = useState<string | null>(null);
  const [moneyChecked, setMoneyChecked] = useState(false);
  const [detailsChecked, setDetailsChecked] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");
  const [action, setAction] = useState<"clarification" | "reject" | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [feePayments, capitalPayments, pendingApplications] = await Promise.all([
        listPaymentReferences({
          paymentPurpose: "Associate Membership Fee",
          page: 1,
          pageSize: 100,
          sortBy: "submittedAt",
          sortDirection: "desc",
        }),
        listPaymentReferences({
          paymentPurpose: "Share Capital",
          page: 1,
          pageSize: 100,
          sortBy: "submittedAt",
          sortDirection: "desc",
        }),
        listChairmanApplications({
          page: 1,
          pageSize: 100,
          status: "Payment Required",
          requestedMembershipType: "All",
          applicationSource: "All",
          sortBy: "submittedAt",
          sortDirection: "desc",
        }),
      ]);
      const combinedPayments = [...feePayments.items, ...capitalPayments.items]
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setPayments(combinedPayments);
      setApplications(pendingApplications.applications);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Membership payments could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 120);
    const refreshTimer = window.setInterval(() => void load(), 30000);
    return () => { window.clearTimeout(timer); window.clearInterval(refreshTimer); };
  }, [load]);

  const applicationsNeedingPayment = useMemo(() => {
    return applications.filter((application) => nextRequiredPayment(application, payments));
  }, [applications, payments]);

  const summary = useMemo(() => {
    const forChecking = payments.filter(
      (payment) => ["Pending", "Needs Clarification"].includes(payment.validationStatus),
    ).length;
    const approved = payments.filter((payment) => payment.validationStatus === "Validated");
    return {
      needsPayment: applicationsNeedingPayment.length,
      forChecking,
      approved: approved.length,
      approvedAmount: approved.reduce((sum, payment) => sum + payment.amount, 0),
    };
  }, [applicationsNeedingPayment.length, payments]);

  const filteredApplications = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (statusFilter !== "All" && statusFilter !== "Needs payment") return [];
    if (!term) return applicationsNeedingPayment;
    return applicationsNeedingPayment.filter((application) =>
      [
        application.applicationCode,
        application.fullName,
        application.contactNumber,
        application.requestedMembershipType,
      ].some((value) => value?.toLowerCase().includes(term)),
    );
  }, [applicationsNeedingPayment, search, statusFilter]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((payment) => {
      const simpleStatus = payment.validationStatus === "Validated"
        ? "Approved"
        : payment.validationStatus === "Needs Clarification"
          ? "Needs clarification"
          : payment.validationStatus === "Rejected"
            ? "Rejected"
            : payment.validationStatus === "Reversed"
              ? "Reversed"
              : "Pending review";
      const statusMatches = statusFilter === "All" || statusFilter === simpleStatus;
      if (!statusMatches) return false;
      if (!term) return true;
      return [
        payment.referenceNumber,
        payment.payerName,
        payment.payerContact,
        payment.applicationCode,
        payment.applicationName,
        payment.paymentPurpose,
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [payments, search, statusFilter]);
  const paymentPageCount = Math.max(1, Math.ceil(filteredPayments.length / paymentsPerPage));
  const visiblePayments = filteredPayments.slice((paymentPage - 1) * paymentsPerPage, paymentPage * paymentsPerPage);

  async function openManualPayment(applicationId: string) {
    setSubmitting(true);
    setError("");
    setModalError("");
    try {
      const detail = await getChairmanApplication(applicationId);
      const nextPayment = nextRequiredPayment(detail, payments);
      if (!nextPayment) {
        toast.success("This applicant already has the required payment recorded.");
        await load();
        return;
      }
      const purpose = nextPayment.purpose;
      const channel: ManualChannel = "Cash";
      setSelectedPayment(null);
      setModalError("");
      setSelectedApplication(detail);
      setManualPurpose(purpose);
      setManualChannel(channel);
      setManualAmount(String(nextPayment.amount));
      setManualReference(defaultReference(detail.applicationCode, purpose, channel));
      setManualNote("");
      setManualCreatedPaymentId(null);
      setMoneyChecked(false);
      setDetailsChecked(false);
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError
          ? caught.message
          : "Application details could not be loaded.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function openPayment(paymentId: string) {
    setSubmitting(true);
    setModalError("");
    try {
      setSelectedApplication(null);
      setSelectedPayment(await getPaymentReferenceDetail(paymentId));
      setCorrectionNote("");
      setAction(null);
      setMoneyChecked(false);
      setDetailsChecked(false);
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError
          ? caught.message
          : "Payment details could not be loaded.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function updateManualChannel(nextChannel: ManualChannel) {
    if (!selectedApplication) return;
    setManualChannel(nextChannel);
    setManualReference(defaultReference(selectedApplication.applicationCode, manualPurpose, nextChannel));
  }

  async function recordAndApproveManualPayment() {
    if (!selectedApplication || submitting) return;
    const amount = Number(manualAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter the amount paid.");
      return;
    }
    const requiredAmount = amountForPurpose(manualPurpose);
    if (amount !== requiredAmount) {
      toast.error(`Amount must be ${money(requiredAmount)} for this application.`);
      return;
    }
    if (manualReference.trim().length < 2) {
      toast.error("Enter the receipt or reference number.");
      return;
    }
    if (!moneyChecked || !detailsChecked) {
      toast.error("Please tick both checks before approving.");
      return;
    }
    if (!manualCreatedPaymentId && payments.some((payment) => payment.referenceNumber.trim().toLowerCase() === manualReference.trim().toLowerCase())) {
      const message = "This receipt or reference number is already recorded. Use a unique reference number.";
      setModalError(message);
      toast.error(message);
      return;
    }
    setModalError("");
    setSubmitting(true);
    let approvalPaymentId = manualCreatedPaymentId;
    try {
      const paymentId = approvalPaymentId ?? (await createPaymentReference({
        payerName: applicantName(selectedApplication),
        payerEmail: selectedApplication.email,
        payerContact: selectedApplication.contactNumber,
        provider: providerFromChannel(manualChannel),
        paymentChannel: manualChannel,
        referenceNumber: manualReference.trim(),
        paymentPurpose: manualPurpose,
        relatedEntityType: "membership_application",
        relatedEntityId: selectedApplication.id,
        amount,
        notes: manualNote.trim() || `Bookkeeper recorded ${manualChannel} membership payment.`,
      })).id;
      approvalPaymentId = paymentId;
      setManualCreatedPaymentId(paymentId);
      await validatePaymentReference(paymentId);
      toast.success("Payment approved and posted.");
      setSelectedApplication(null);
      setManualCreatedPaymentId(null);
      await load();
    } catch (caught) {
      const message = caught instanceof ApiClientError
        ? approvalPaymentId
          ? `Payment was recorded, but approval failed: ${caught.message}`
          : caught.message
        : approvalPaymentId
          ? "Payment was recorded, but approval failed. You can retry approval safely."
          : "Payment could not be recorded.";
      setModalError(message);
      toast.error(
        message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function approveExistingManualPayment() {
    if (!selectedPayment || submitting || !moneyChecked || !detailsChecked) return;
    setSubmitting(true);
    setModalError("");
    try {
      await validatePaymentReference(selectedPayment.id);
      toast.success("Payment approved and posted.");
      setSelectedPayment(null);
      await load();
    } catch (caught) {
      const message = caught instanceof ApiClientError ? caught.message : "Payment could not be approved.";
      setModalError(message);
      toast.error(
        message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshPaymongo() {
    if (!selectedPayment || submitting) return;
    setSubmitting(true);
    setModalError("");
    try {
      const status = await getPaymongoPaymentStatus(selectedPayment.id);
      toast.success(`PayMongo status: ${statusLabel(status.validationStatus)}.`);
      const detail = await getPaymentReferenceDetail(selectedPayment.id);
      setSelectedPayment(detail);
      await load();
    } catch (caught) {
      const message = caught instanceof ApiClientError ? caught.message : "PayMongo status could not be checked.";
      setModalError(message);
      toast.error(
        message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function sendPaymentAction() {
    if (!selectedPayment || !action || correctionNote.trim().length < 8 || submitting) return;
    setSubmitting(true);
    setModalError("");
    try {
      if (action === "clarification") {
        await requestPaymentClarification(selectedPayment.id, correctionNote.trim());
        toast.success("Correction request saved.");
      } else {
        await rejectPaymentReference(selectedPayment.id, correctionNote.trim());
        toast.success("Payment rejected.");
      }
      setSelectedPayment(null);
      await load();
    } catch (caught) {
      const message = caught instanceof ApiClientError ? caught.message : "Payment action failed.";
      setModalError(message);
      toast.error(
        message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Needs payment" value={String(summary.needsPayment)} icon={CircleDollarSign} />
        <StatCard label="Pending review" value={String(summary.forChecking)} icon={ReceiptText} />
        <StatCard label="Approved" value={String(summary.approved)} icon={BadgeCheck} />
        <StatCard label="Approved Amount" value={money(summary.approvedAmount)} icon={Banknote} />
      </div>

      <div className="rounded-lg border border-[#CAD8CB] bg-white p-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_150px_auto]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPaymentPage(1);
              }}
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-3 text-sm outline-none focus:border-[#1F6B43]"
              placeholder="Search applicant or reference"
              type="search"
            />
          </label>
          <StatusFilter
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPaymentPage(1);
            }}
          />
          <PageSizeSelect value={paymentsPerPage} onChange={(value) => { setPaymentsPerPage(value); setPaymentPage(1); }} />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC] disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Loading payments..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {loading ? <LoadingSkeleton /> : (
        <>
          {filteredApplications.length ? (
            <section className="grid gap-2">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">Applicants Needing Payment</h2>
              <DataTable>
                <table className="w-full min-w-[900px] divide-y divide-[#E2E8E2] text-left text-sm">
                  <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
                    <tr>
                      <th className="px-5 py-4">Applicant</th>
                      <th className="px-5 py-4">Application</th>
                      <th className="px-5 py-4">Amount due</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                    {filteredApplications.map((application) => {
                      const due = nextRequiredPayment(application, payments);
                      if (!due) return null;
                      return (
                      <tr key={application.id} className="hover:bg-[#F7F8F3]">
                        <td className="px-5 py-4">
                          <p className="font-bold text-[#123D2A]">{applicantName(application)}</p>
                          <p className="mt-1 text-xs text-[#6C7A70]">{application.contactNumber}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold">{application.applicationCode}</p>
                          <p className="mt-1 text-xs text-[#6C7A70]">{application.requestedMembershipType}</p>
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          <p className="font-black text-[#123D2A]">
                            {money(due.amount)}
                          </p>
                          <p className="mt-1 text-xs text-[#6C7A70]">
                            {due.label}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge tone="warning">Needs payment</StatusBadge>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void openManualPayment(application.id)}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43] disabled:opacity-50"
                          >
                            <Banknote className="size-4" />Record manual payment
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </DataTable>
            </section>
          ) : null}

          <section className="grid gap-2">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">Recorded Membership Payments</h2>
            {filteredPayments.length ? (
              <>
              <DataTable>
                <table className="w-full min-w-[950px] divide-y divide-[#E2E8E2] text-left text-sm">
                  <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
                    <tr>
                      <th className="px-5 py-4">Payer</th>
                      <th className="px-5 py-4">Payment purpose</th>
                      <th className="px-5 py-4">Amount</th>
                      <th className="px-5 py-4">Payment method</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                    {visiblePayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-[#F7F8F3]">
                        <td className="px-5 py-4">
                          <p className="font-bold text-[#123D2A]">{safe(payment.payerName)}</p>
                          <p className="mt-1 text-xs text-[#6C7A70]">{safe(payment.applicationCode ?? payment.memberCode ?? payment.payerContact)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold">{paymentPurposeLabel(payment.paymentPurpose)}</p>
                          <p className="mt-1 text-xs text-[#6C7A70]">{payment.referenceNumber}</p>
                        </td>
                        <td className="px-5 py-4"><CurrencyDisplay value={payment.amount} /></td>
                        <td className="px-5 py-4">
                          <StatusBadge tone={payment.paymentChannel === "PayMongo" ? "success" : "neutral"}>
                            {paymentMethodLabel(payment)}
                          </StatusBadge>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge tone={statusTone(payment.validationStatus)}>
                            {statusLabel(payment.validationStatus)}
                          </StatusBadge>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void openPayment(payment.id)}
                            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43] disabled:opacity-50"
                          >
                            <Eye className="size-4" />Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
              <div className="flex items-center justify-between rounded-lg border border-[#CAD8CB] bg-white p-3 text-sm">
                <span className="font-semibold text-[#6C7A70]">Page {paymentPage} of {paymentPageCount} · {filteredPayments.length} payments</span>
                <div className="flex gap-2">
                  <button type="button" disabled={paymentPage <= 1} onClick={() => setPaymentPage((current) => Math.max(1, current - 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Previous</button>
                  <button type="button" disabled={paymentPage >= paymentPageCount} onClick={() => setPaymentPage((current) => Math.min(paymentPageCount, current + 1))} className="rounded-md border border-[#CAD8CB] px-3 py-2 font-bold text-[#123D2A] disabled:opacity-40">Next</button>
                </div>
              </div>
              </>
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="No membership payments found"
                description="Cash/manual payments and PayMongo membership payments will appear here."
              />
            )}
          </section>
        </>
      )}

      <FormDialog
        open={Boolean(selectedApplication)}
        onOpenChange={(open) => { if (!open && !submitting) setSelectedApplication(null); }}
        title="Record membership payment"
        description={selectedApplication ? `${applicantName(selectedApplication)} / ${selectedApplication.applicationCode}` : undefined}
        contentClassName="w-[min(50rem,calc(100vw-2rem))]"
      >
        {selectedApplication ? (
          <div className="grid gap-4 pt-3">
            {modalError ? <div role="alert" aria-live="assertive" className="rounded-md border border-[#D9A99F] bg-[#FFF4F1] p-3 text-sm font-semibold text-[#7A3023]">{modalError}</div> : null}
            <div className="grid gap-3 lg:grid-cols-2">
              <InfoBox label="Applicant" value={applicantName(selectedApplication)} sub={selectedApplication.contactNumber} />
              <InfoBox label="Application" value={selectedApplication.applicationCode} sub={selectedApplication.requestedMembershipType} />
            </div>
            <div className="rounded-xl border border-[#B7D7BD] bg-[#F2FAF3] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5D6D63]">
                Amount to collect
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-3xl font-black leading-none text-[#123D2A]">
                    {money(amountForPurpose(manualPurpose))}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#365F4A]">
                    {paymentPurposeLabel(manualPurpose)}
                  </p>
                </div>
                <p className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#365F4A]">
                  True Member: PHP 1,500 / Associate: PHP 200
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Paid through" required>
                <ManualChannelSelect value={manualChannel} onChange={updateManualChannel} />
              </FormField>
              <FormField label="Amount paid" required>
                <input
                  value={manualAmount}
                  readOnly
                  inputMode="decimal"
                  className="h-11 rounded-md border border-[#CAD8CB] bg-[#F7F8F3] px-3 text-sm font-black text-[#123D2A]"
                />
              </FormField>
              <FormField label="Receipt or reference number" required>
                <input
                  value={manualReference}
                  onChange={(event) => setManualReference(event.target.value)}
                  className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm"
                />
              </FormField>
            </div>
            <FormField label="Note">
              <textarea
                value={manualNote}
                onChange={(event) => setManualNote(event.target.value)}
                rows={3}
                className="rounded-md border border-[#CAD8CB] bg-white p-3 text-sm"
                placeholder="Optional note, for example: cash received at office."
              />
            </FormField>
            <div className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-[#FBFCF8] p-3">
              <CheckBox checked={moneyChecked} onChange={setMoneyChecked} label="I checked the cash, GCash, or bank record." />
              <CheckBox checked={detailsChecked} onChange={setDetailsChecked} label="The applicant, amount, reference number, and application type are correct." />
            </div>
            <div className="flex justify-end gap-3 border-t border-[#E2E8E2] pt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setSelectedApplication(null)}
                className="h-11 rounded-md border border-[#CAD8CB] bg-white px-5 text-sm font-bold text-[#294B39] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !moneyChecked || !detailsChecked}
                onClick={() => void recordAndApproveManualPayment()}
                className="h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#CAD8CB] disabled:text-[#5D6D63]"
              >
                {submitting ? "Approving..." : "Approve payment"}
              </button>
            </div>
          </div>
        ) : null}
      </FormDialog>

      <FormDialog
        open={Boolean(selectedPayment)}
        onOpenChange={(open) => { if (!open && !submitting) setSelectedPayment(null); }}
        title={selectedPayment?.referenceNumber ?? "Review payment"}
        description={selectedPayment ? `${paymentPurposeLabel(selectedPayment.paymentPurpose)} / ${paymentMethodLabel(selectedPayment)}` : undefined}
        contentClassName="w-[min(52rem,calc(100vw-2rem))]"
      >
        {selectedPayment ? (
          <div className="grid gap-4 pt-3">
            {modalError ? <div role="alert" aria-live="assertive" className="rounded-md border border-[#D9A99F] bg-[#FFF4F1] p-3 text-sm font-semibold text-[#7A3023]">{modalError}</div> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoBox label="Payer" value={safe(selectedPayment.payerName)} sub={safe(selectedPayment.payerContact)} />
              <InfoBox label="Payment for" value={paymentPurposeLabel(selectedPayment.paymentPurpose)} sub={safe(selectedPayment.applicationCode ?? selectedPayment.memberCode)} />
              <InfoBox label="Amount paid" value={money(selectedPayment.amount)} sub={selectedPayment.referenceNumber} />
              <InfoBox label="Status" value={statusLabel(selectedPayment.validationStatus)} sub={paymentMethodLabel(selectedPayment)} />
            </div>

            {selectedPayment.proofFilePath ? (
              <a
                href={paymentReferenceProofUrl(selectedPayment.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 border-[#1F6B43] bg-white px-5 font-bold text-[#123D2A] hover:bg-[#EEF7EF]"
              >
                <Eye className="size-5" />Open payment proof
              </a>
            ) : selectedPayment.paymentChannel !== "PayMongo" ? (
              <div className="rounded-md border border-[#F3D08A] bg-[#FFF8E8] p-3 text-sm text-[#775200]">
                No proof was uploaded. Check the cash book, GCash record, or bank record before approving.
              </div>
            ) : null}

            {selectedPayment.paymentChannel === "PayMongo" ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void refreshPaymongo()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white disabled:opacity-50"
              >
                <RefreshCcw className="size-4" />Check PayMongo status
              </button>
            ) : selectedPayment.validationStatus !== "Validated" ? (
              <div className="grid gap-3 rounded-lg border border-[#CAD8CB] bg-[#F7F8F3] p-4">
                <CheckBox checked={moneyChecked} onChange={setMoneyChecked} label="I checked the actual payment record." />
                <CheckBox checked={detailsChecked} onChange={setDetailsChecked} label="The payer, amount, reference, and purpose all match." />
                <button
                  type="button"
                  disabled={submitting || !moneyChecked || !detailsChecked}
                  onClick={() => void approveExistingManualPayment()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#CAD8CB] disabled:text-[#5D6D63]"
                >
                  <BadgeCheck className="size-4" />Approve payment
                </button>
              </div>
            ) : (
              <StatusBadge tone="success">Already approved</StatusBadge>
            )}

            {selectedPayment.validationStatus !== "Validated" ? (
              <div className="grid gap-3 border-t border-[#E2E8E2] pt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAction("clarification")}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#1F6B43] bg-white px-4 text-sm font-bold text-[#123D2A]"
                  >
                    <Send className="size-4" />Ask for correction
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction("reject")}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D9A99F] bg-white px-4 text-sm font-bold text-[#7A3023]"
                  >
                    <X className="size-4" />Reject
                  </button>
                </div>
                {action ? (
                  <div className="grid gap-3">
                    <FormField label={action === "clarification" ? "What should be corrected?" : "Reason"} required>
                      <textarea
                        value={correctionNote}
                        onChange={(event) => setCorrectionNote(event.target.value)}
                        rows={3}
                        className="rounded-md border border-[#CAD8CB] bg-white p-3 text-sm"
                      />
                    </FormField>
                    <button
                      type="button"
                      disabled={submitting || correctionNote.trim().length < 8}
                      onClick={() => void sendPaymentAction()}
                      className="h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#CAD8CB] disabled:text-[#5D6D63]"
                    >
                      {submitting ? "Saving..." : action === "clarification" ? "Send correction request" : "Reject payment"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </FormDialog>
    </div>
  );
}
