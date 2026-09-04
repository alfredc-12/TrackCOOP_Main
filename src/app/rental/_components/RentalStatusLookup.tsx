"use client";

import { SearchCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  formatRentalDate,
  formatRentalDateRange,
} from "../_lib/rentalFormatting";
import { rentalRepository } from "../_lib/rentalRepository";
import type {
  PublicRentalInquiryStatus,
  RentalStatus,
} from "../_types/rental";

const publicStatusLabels: Record<RentalStatus, string> = {
  "New Inquiry": "Inquiry Received",
  "Under Review": "Under Review",
  "Awaiting Information": "Additional Information Required",
  "Awaiting Confirmation": "Schedule Awaiting Confirmation",
  "Approved for Scheduling": "Approved for Scheduling",
  Scheduled: "Scheduled",
  "Payment Pending": "Payment Pending",
  "Payment Under Review": "Payment Under Review",
  "Payment Confirmed": "Payment Confirmed",
  "In Progress": "Rental In Progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
  Rescheduled: "Rescheduling in Progress",
  Rejected: "Request Not Approved",
  "On Hold": "On Hold",
};

export function RentalStatusLookup() {
  const [reference, setReference] = useState("");
  const [contact, setContact] = useState("");
  const [result, setResult] = useState<PublicRentalInquiryStatus>();
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setSearched(false);
    try {
      setResult(
        await rentalRepository.lookupRentalInquiry(reference, ""),
      );
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  return (
    <div className="w-full">
      <form
        onSubmit={lookup}
        className="rounded-3xl border border-[#d8e4d3] bg-[#f8fbf5] p-6 shadow-sm"
      >
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-[#365f4a]">
            Booking reference number
            <input
              required
              value={reference}
              onChange={(event) =>
                setReference(event.target.value.toUpperCase())
              }
              placeholder="RNT-2026-0042"
              className="h-11 rounded-xl border border-[#d5e1d0] px-3 font-normal uppercase outline-none focus:border-[#1f6b43]"
            />
          </label>
        </div>
        <button
          disabled={loading}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f6b43] px-5 font-bold text-white disabled:opacity-60"
        >
          <SearchCheck className="size-5" />
          {loading ? "Checking…" : "Check Status"}
        </button>
      </form>
      {searched ? (
        result ? (
          <section
            aria-live="polite"
            className="mt-6 rounded-3xl border border-[#cfe0ca] bg-[#f8fbf5] p-6"
          >
            <h2 className="text-xl font-bold text-[#123d2a]">
              Booking status
            </h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <StatusDetail term="Booking reference" value={result.inquiryId} />
              <StatusDetail
                term="Requested equipment"
                value={result.equipmentName}
              />
              <StatusDetail
                term="Date submitted"
                value={formatRentalDate(result.submittedAt)}
              />
              <StatusDetail
                term="Current status"
                value={publicStatusLabels[result.status]}
              />
              <StatusDetail
                term="Payment status"
                value={result.paymentStatus}
              />
              <StatusDetail
                term="Schedule status"
                value={result.scheduleStatus}
              />
              {result.confirmedSchedule ? (
                <StatusDetail
                  term="Confirmed schedule"
                  value={`${formatRentalDateRange(result.confirmedSchedule.date, result.confirmedSchedule.endDate)} · ${result.confirmedSchedule.startTime}–${result.confirmedSchedule.endTime}`}
                />
              ) : null}
              <StatusDetail
                term="Last updated"
                value={formatRentalDate(result.updatedAt)}
              />
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wide text-[#78857d]">
                  Latest public note
                </dt>
                <dd className="mt-1 text-sm leading-6 text-[#365f4a]">
                  {result.publicNote}
                </dd>
              </div>
            </dl>
          </section>
        ) : (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 mt-6"
          >
            No matching booking was found.{" "}
            <span className="font-normal text-amber-800">
              Check the reference number and try again.
            </span>
          </div>
        )
      ) : null}
    </div>
  );
}

function StatusDetail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-[#78857d]">
        {term}
      </dt>
      <dd className="mt-1 text-sm font-bold text-[#365f4a]">{value}</dd>
    </div>
  );
}
