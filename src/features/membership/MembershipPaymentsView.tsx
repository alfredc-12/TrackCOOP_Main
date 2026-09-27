"use client";

import {
  BadgeCheck,
  Banknote,
  CircleDollarSign,
  Eye,
  ReceiptText,
  RefreshCcw,
  Search,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
const simpleStatuses = ["All", "Needs payment", "For checking", "Approved", "Needs correction"] as const;

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

function requirementOpen(
  detail: ChairmanApplicationDetail | null,
  type: "Associate Membership Fee" | "Initial Share Capital",
) {
  const requirement = detail?.requirements.find((item) => item.requirementType === type);
  return !requirement || !["Verified", "Waived"].includes(requirement.requirementStatus);
}

function paymentPurposeLabel(purpose: string) {
  if (purpose === "Associate Membership Fee") return "Membership fee";
  if (purpose === "Share Capital") return "Initial share capital";
  return purpose;
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
  const [manualPurpose, setManualPurpose] = useState<PaymentPurpose>("Associate Membership Fee");
  const [manualChannel, setManualChannel] = useState<ManualChannel>("Cash");
  const [manualReference, setManualReference] = useState("");
  const [manualAmount, setManualAmount] = useState("200");
  const [manualNote, setManualNote] = useState("");
  const [moneyChecked, setMoneyChecked] = useState(false);
  const [detailsChecked, setDetailsChecked] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");
  const [action, setAction] = useState<"clarification" | "reject" | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
    return () => window.clearTimeout(timer);
  }, [load]);

  const summary = useMemo(() => {
    const pendingManual = payments.filter(
      (payment) => payment.validationStatus !== "Validated" && payment.paymentChannel !== "PayMongo",
    ).length;
    const pendingPaymongo = payments.filter(
      (payment) => payment.validationStatus !== "Validated" && payment.paymentChannel === "PayMongo",
    ).length;
    const approved = payments.filter((payment) => payment.validationStatus === "Validated");
    return {
      needsPayment: applications.length,
      forChecking: pendingManual + pendingPaymongo,
      approved: approved.length,
      approvedAmount: approved.reduce((sum, payment) => sum + payment.amount, 0),
    };
  }, [applications, payments]);

  const filteredApplications = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (statusFilter !== "All" && statusFilter !== "Needs payment") return [];
    if (!term) return applications;
    return applications.filter((application) =>
      [
        application.applicationCode,
        application.fullName,
        application.contactNumber,
        application.requestedMembershipType,
      ].some((value) => value?.toLowerCase().includes(term)),
    );
  }, [applications, search, statusFilter]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((payment) => {
      const simpleStatus = payment.validationStatus === "Validated"
        ? "Approved"
        : payment.validationStatus === "Needs Clarification"
          ? "Needs correction"
          : "For checking";
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

  async function openManualPayment(applicationId: string) {
    setSubmitting(true);
    setError("");
    try {
      const detail = await getChairmanApplication(applicationId);
      const purpose: PaymentPurpose = requirementOpen(detail, "Associate Membership Fee")
        ? "Associate Membership Fee"
        : "Share Capital";
      const channel: ManualChannel = "Cash";
      setSelectedApplication(detail);
      setManualPurpose(purpose);
      setManualChannel(channel);
      setManualAmount(purpose === "Associate Membership Fee" ? "200" : "3000");
      setManualReference(defaultReference(detail.applicationCode, purpose, channel));
      setManualNote("");
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
    try {
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

  function updateManualPurpose(nextPurpose: PaymentPurpose) {
    if (!selectedApplication) return;
    setManualPurpose(nextPurpose);
    setManualAmount(nextPurpose === "Associate Membership Fee" ? "200" : "3000");
    setManualReference(defaultReference(selectedApplication.applicationCode, nextPurpose, manualChannel));
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
    if (manualReference.trim().length < 2) {
      toast.error("Enter the receipt or reference number.");
      return;
    }
    if (!moneyChecked || !detailsChecked) {
      toast.error("Please tick both checks before approving.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createPaymentReference({
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
      });
      await validatePaymentReference(created.id);
      toast.success("Payment approved and posted.");
      setSelectedApplication(null);
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError
          ? caught.message
          : "Payment could not be approved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function approveExistingManualPayment() {
    if (!selectedPayment || submitting || !moneyChecked || !detailsChecked) return;
    setSubmitting(true);
    try {
      await validatePaymentReference(selectedPayment.id);
      toast.success("Payment approved and posted.");
      setSelectedPayment(null);
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError
          ? caught.message
          : "Payment could not be approved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshPaymongo() {
    if (!selectedPayment || submitting) return;
    setSubmitting(true);
    try {
      const status = await getPaymongoPaymentStatus(selectedPayment.id);
      toast.success(`PayMongo status: ${statusLabel(status.validationStatus)}.`);
      const detail = await getPaymentReferenceDetail(selectedPayment.id);
      setSelectedPayment(detail);
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError
          ? caught.message
          : "PayMongo status could not be checked.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function sendPaymentAction() {
    if (!selectedPayment || !action || correctionNote.trim().length < 8 || submitting) return;
    setSubmitting(true);
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
      toast.error(
        caught instanceof ApiClientError
          ? caught.message
          : "Payment action failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const availablePurposes = selectedApplication
    ? [
        ...(requirementOpen(selectedApplication, "Associate Membership Fee")
          ? [{ value: "Associate Membership Fee" as const, label: "Membership fee" }]
          : []),
        ...(selectedApplication.requestedMembershipType === "True Member"
          && requirementOpen(selectedApplication, "Initial Share Capital")
          ? [{ value: "Share Capital" as const, label: "Initial share capital" }]
          : []),
      ]
    : [];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Payments"
        title="Membership Payments"
        description="Check member application payments. PayMongo is confirmed online; cash, GCash, and bank payments are approved by the Bookkeeper after checking the money and details."
        actions={<StatusBadge tone="success">Bookkeeper</StatusBadge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Need Payment" value={String(summary.needsPayment)} icon={CircleDollarSign} />
        <StatCard label="For Checking" value={String(summary.forChecking)} icon={ReceiptText} />
        <StatCard label="Approved" value={String(summary.approved)} icon={BadgeCheck} />
        <StatCard label="Approved Amount" value={money(summary.approvedAmount)} icon={Banknote} />
      </div>

      <div className="rounded-lg border border-[#B7D7BD] bg-[#F2FAF3] p-4 text-sm leading-6 text-[#294B39]">
        <strong className="text-[#123D2A]">Simple rule:</strong> for PayMongo, click <strong>Check PayMongo</strong>.
        For cash, manual GCash, or bank transfer, check the money or reference number, then click <strong>Approve payment</strong>.
      </div>

      <div className="rounded-lg border border-[#CAD8CB] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6C7A70]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-md border border-[#CAD8CB] bg-[#F7F8F3] pl-10 pr-3 text-sm outline-none focus:border-[#1F6B43]"
              placeholder="Search applicant or reference"
              type="search"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm font-bold text-[#123D2A]"
            aria-label="Payment status filter"
          >
            {simpleStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#CAD8CB] bg-white px-4 text-sm font-bold text-[#123D2A] hover:bg-[#EEF2EC]"
          >
            <RefreshCcw className="size-4" />Refresh
          </button>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {loading ? <LoadingSkeleton /> : (
        <>
          {filteredApplications.length ? (
            <section className="grid gap-3">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">Applicants Needing Payment</h2>
              <DataTable>
                <table className="min-w-[900px] divide-y divide-[#E2E8E2] text-left text-sm">
                  <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
                    <tr>
                      <th className="px-5 py-4">Applicant</th>
                      <th className="px-5 py-4">Application</th>
                      <th className="px-5 py-4">Needs To Pay</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                    {filteredApplications.map((application) => (
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
                          {application.requestedMembershipType === "True Member"
                            ? "Membership fee and initial share capital"
                            : "Membership fee"}
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
                            <Banknote className="size-4" />Record cash/manual payment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            </section>
          ) : null}

          <section className="grid gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#5D6D63]">Recorded Membership Payments</h2>
            {filteredPayments.length ? (
              <DataTable>
                <table className="min-w-[950px] divide-y divide-[#E2E8E2] text-left text-sm">
                  <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.16em] text-[#5D6D63]">
                    <tr>
                      <th className="px-5 py-4">Payer</th>
                      <th className="px-5 py-4">Payment For</th>
                      <th className="px-5 py-4">Amount</th>
                      <th className="px-5 py-4">Paid Through</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
                    {filteredPayments.map((payment) => (
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
        contentClassName="w-[min(48rem,calc(100vw-2rem))]"
      >
        {selectedApplication ? (
          <div className="grid gap-4 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoBox label="Applicant" value={applicantName(selectedApplication)} sub={selectedApplication.contactNumber} />
              <InfoBox label="Application" value={selectedApplication.applicationCode} sub={selectedApplication.requestedMembershipType} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Payment for" required>
                <select
                  value={manualPurpose}
                  onChange={(event) => updateManualPurpose(event.target.value as PaymentPurpose)}
                  className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm"
                >
                  {availablePurposes.map((purpose) => (
                    <option key={purpose.value} value={purpose.value}>{purpose.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Paid through" required>
                <select
                  value={manualChannel}
                  onChange={(event) => updateManualChannel(event.target.value as ManualChannel)}
                  className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm"
                >
                  {manualChannels.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
                </select>
              </FormField>
              <FormField label="Amount paid" required>
                <input
                  value={manualAmount}
                  onChange={(event) => setManualAmount(event.target.value)}
                  inputMode="decimal"
                  className="h-11 rounded-md border border-[#CAD8CB] bg-white px-3 text-sm"
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
            <CheckBox checked={moneyChecked} onChange={setMoneyChecked} label="I checked the cash, GCash, or bank record." />
            <CheckBox checked={detailsChecked} onChange={setDetailsChecked} label="The applicant, amount, reference number, and payment purpose are correct." />
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
