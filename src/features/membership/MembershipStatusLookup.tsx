"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiClientError } from "@/lib/api-client";
import {
  lookupMembershipApplication,
  type PublicApplicationStatus,
} from "./membership-api";

const statusLabels: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  NEEDS_INFORMATION: "Additional Information Required",
  ON_HOLD: "On Hold",
  APPROVED_PENDING_PAYMENT: "Approved — Payment Required",
  PAYMENT_UNDER_REVIEW: "Payment Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ACCOUNT_PENDING_ACTIVATION: "Account Activation Pending",
  ACCOUNT_CREATED: "Member Account Created",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
};

function money(value: string | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value));
}

export function MembershipStatusLookup() {
  const [reference, setReference] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [application, setApplication] =
    useState<PublicApplicationStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setApplication(null);
    try {
      const result = await lookupMembershipApplication(
        reference,
        contactNumber,
      );
      setApplication(result);
      window.sessionStorage.setItem(
        "trackcoop-membership-status-verification",
        JSON.stringify({ reference, contactNumber }),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Application status could not be loaded.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <form
        onSubmit={lookup}
        className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
            Application reference
            <input
              required
              value={reference}
              onChange={(event) =>
                setReference(event.target.value.toUpperCase())
              }
              className="h-11 rounded-md border border-[#CAD8CB] px-3 outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/25"
              placeholder="MEM-APP-YYYY-####"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#294B39]">
            Contact number
            <input
              required
              value={contactNumber}
              onChange={(event) => setContactNumber(event.target.value)}
              className="h-11 rounded-md border border-[#CAD8CB] px-3 outline-none focus:border-[#1F6B43] focus:ring-4 focus:ring-[#82E6A7]/25"
              inputMode="tel"
            />
          </label>
        </div>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-[#9A392A]">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-5 min-h-11 w-full rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white hover:bg-[#1F6B43] disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Checking…" : "Check Status"}
        </button>
      </form>

      {application ? (
        <section className="rounded-xl border border-[#CAD8CB] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6C7A70]">
                {application.reference}
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#123D2A]">
                {statusLabels[application.status] ?? application.status}
              </h2>
            </div>
            <span className="rounded-full bg-[#FFF4D7] px-3 py-1.5 text-xs font-bold text-[#8A6200]">
              {application.paymentStatus.replaceAll("_", " ")}
            </span>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["Applicant", application.applicantName],
              [
                "Submitted",
                new Date(application.submittedAt).toLocaleDateString(),
              ],
              [
                "Preferred membership",
                application.preferredMembershipType.replaceAll("_", " "),
              ],
              [
                "Approved membership",
                application.approvedMembershipType?.replaceAll("_", " ") ??
                  "Pending review",
              ],
              [
                "Required payment",
                application.requiredPaymentType ?? "None currently requested",
              ],
              ["Amount", money(application.requiredPaymentAmount)],
              [
                "Last updated",
                new Date(application.updatedAt).toLocaleString(),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-bold uppercase tracking-[0.15em] text-[#6C7A70]">
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#294B39]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {application.publicResponse ? (
            <div className="mt-6 rounded-lg bg-[#F7F8F3] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#6C7A70]">
                NFFAC response
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#294B39]">
                {application.publicResponse}
              </p>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            {application.status === "NEEDS_INFORMATION" ? (
              <Link
                href={`/membership/application/${encodeURIComponent(application.reference)}/additional-information`}
                className="inline-flex min-h-11 items-center rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white"
              >
                Submit Additional Information
              </Link>
            ) : null}
            {application.status === "APPROVED_PENDING_PAYMENT" ||
            application.paymentStatus === "NEEDS_CLARIFICATION" ? (
              <Link
                href={`/membership/application/${encodeURIComponent(application.reference)}/payment`}
                className="inline-flex min-h-11 items-center rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white"
              >
                Submit Payment Proof
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
