"use client";

import {
  BadgeCheck,
  CircleDollarSign,
  ReceiptText,
  RefreshCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/portal/PageHeader";
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { env } from "@/config/env";
import { ApiClientError } from "@/lib/api-client";
import {
  listMembershipPayments,
  validateMembershipPayment,
  type MembershipPayment,
} from "./membership-api";

function tone(status: string) {
  if (status === "VERIFIED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

export function MembershipPaymentsView() {
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<MembershipPayment | null>(null);
  const [decision, setDecision] = useState<
    "VERIFIED" | "REJECTED" | "NEEDS_CLARIFICATION"
  >("VERIFIED");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPayments(await listMembershipPayments());
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
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const counts = useMemo(
    () => ({
      pending: payments.filter((payment) => payment.paymentStatus === "PENDING")
        .length,
      verified: payments.filter(
        (payment) => payment.paymentStatus === "VERIFIED",
      ).length,
      clarification: payments.filter(
        (payment) => payment.paymentStatus === "NEEDS_CLARIFICATION",
      ).length,
    }),
    [payments],
  );

  async function validate() {
    if (!selected || pending || note.trim().length < 2) return;
    if (
      !window.confirm(
        `Mark ${selected.applicationReference} payment as ${decision}? This does not change the authorized membership classification.`,
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      await validateMembershipPayment(selected.id, decision, note);
      setSelected(null);
      setNote("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Payment validation failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Payments"
        title="Membership Payment Validation"
        description="Validate associate membership fees, initial share-capital payments, GCash references, and uploaded payment proof for approved applications."
        actions={<StatusBadge tone="success">Bookkeeper workflow</StatusBadge>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Payment Pending"
          value={String(counts.pending)}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Verified"
          value={String(counts.verified)}
          icon={BadgeCheck}
        />
        <StatCard
          label="Needs Clarification"
          value={String(counts.clarification)}
          icon={RefreshCcw}
        />
      </div>
      {error ? <ErrorState message={error} /> : null}
      {loading ? (
        <LoadingSkeleton />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No membership payments"
          description="Approved applicants' submitted payment proofs will appear here."
        />
      ) : (
        <DataTable>
          <table className="min-w-[1000px] divide-y divide-[#E2E8E2] text-left text-sm">
            <thead className="bg-[#F7F8F3] text-xs uppercase tracking-[0.14em] text-[#5D6D63]">
              <tr>
                <th className="px-5 py-4">Application</th>
                <th className="px-5 py-4">Applicant</th>
                <th className="px-5 py-4">Membership</th>
                <th className="px-5 py-4">Amount</th>
                <th className="px-5 py-4">Method / Reference</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Receipt</th>
                <th className="px-5 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2EC] text-[#294B39]">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-[#F7F8F3]">
                  <td className="px-5 py-4 font-bold text-[#123D2A]">
                    {payment.applicationReference}
                  </td>
                  <td className="px-5 py-4">{payment.applicantName}</td>
                  <td className="px-5 py-4">
                    {payment.approvedMembershipType.replaceAll("_", " ")}
                  </td>
                  <td className="px-5 py-4 font-bold">
                    ₱
                    {Number(payment.amount).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-4">
                    {payment.provider}
                    <br />
                    <span className="text-xs text-[#6C7A70]">
                      {payment.referenceNumber}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={tone(payment.paymentStatus)}>
                      {payment.paymentStatus.replaceAll("_", " ")}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4">{payment.receiptNumber ?? "—"}</td>
                  <td className="px-5 py-4">
                    {payment.paymentStatus !== "VERIFIED" ? (
                      <div className="flex gap-2">
                        <a
                          href={`${env.apiUrl}/api/membership/payments/${payment.id}/proof`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-11 items-center rounded-md border border-[#CAD8CB] px-3 text-xs font-bold text-[#123D2A]"
                        >
                          Proof
                        </a>
                        <button
                          type="button"
                          onClick={() => setSelected(payment)}
                          className="min-h-11 rounded-md bg-[#123D2A] px-4 text-xs font-bold text-white"
                        >
                          Review Payment
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-[#1F6B43]">
                        Validated
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
      {selected ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#061B11]/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"
          >
            <h2 className="text-xl font-black text-[#123D2A]">
              Review {selected.applicationReference}
            </h2>
            <p className="mt-2 text-sm text-[#5D6D63]">
              {selected.applicantName} · ₱
              {Number(selected.amount).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
            <label className="mt-5 grid gap-2 text-sm font-semibold text-[#294B39]">
              Decision
              <select
                value={decision}
                onChange={(event) =>
                  setDecision(event.target.value as typeof decision)
                }
                className="h-11 rounded-md border border-[#CAD8CB] px-3"
              >
                <option value="VERIFIED">Verify Payment</option>
                <option value="NEEDS_CLARIFICATION">
                  Request Clarification
                </option>
                <option value="REJECTED">Reject Payment</option>
              </select>
            </label>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-[#294B39]">
              Validation note
              <textarea
                required
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="rounded-md border border-[#CAD8CB] p-3"
              />
            </label>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={pending}
                className="min-h-11 rounded-md border border-[#CAD8CB] font-bold text-[#294B39]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void validate()}
                disabled={pending || note.trim().length < 2}
                className="min-h-11 rounded-md bg-[#123D2A] font-bold text-white disabled:opacity-50"
              >
                {pending ? "Updating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
