"use client";

import { CheckCircle2, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { RentalInquiry } from "../_types/rental";
import { useRental } from "../_context/RentalProvider";
import { formatRentalDate, formatRentalDateRange } from "../_lib/rentalFormatting";
import { RentalStatusBadge } from "./RentalStatusBadge";

export function RentalInquirySuccess({ inModal, onDismiss }: { inModal?: boolean; onDismiss?: () => void }) {
  const { getLastInquiry } = useRental();
  const [inquiry, setInquiry] = useState<RentalInquiry>();
  useEffect(() => {
    const timer = window.setTimeout(() => setInquiry(getLastInquiry()), 0);
    return () => window.clearTimeout(timer);
  }, [getLastInquiry]);
  if (!inquiry) return <div className="mx-auto max-w-xl px-5 py-20 text-center"><h1 className="text-3xl font-bold text-[#123d2a]">No recent booking found</h1><Link href="/rental/inquiry" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#123d2a] px-5 font-bold text-white">Book a Rental</Link></div>;
  return <div className={`mx-auto max-w-3xl ${inModal ? "" : "px-4 py-12 sm:px-6"}`}><section data-rental-print className={`bg-white text-center ${inModal ? "px-2 py-6" : "rounded-3xl border border-[#cfe0ca] p-6 shadow-xl shadow-[#123d2a]/8 sm:p-10"}`}><CheckCircle2 className="mx-auto size-16 text-[#1f6b43]" /><p className="mt-5 text-sm font-extrabold uppercase tracking-[0.18em] text-[#497158]">Booking submitted successfully</p><h1 className="mt-2 text-4xl font-extrabold text-[#123d2a]">{inquiry.inquiryId}</h1><p className="mx-auto mt-4 max-w-xl leading-7 text-[#5d6d62]">NFFAC will review your request and contact you regarding availability, schedule, pricing, and rental conditions.</p><dl className="mt-8 grid gap-4 rounded-2xl bg-[#f5f8f1] p-5 text-left sm:grid-cols-2"><SuccessDetail term="Date submitted" value={formatRentalDate(inquiry.submittedAt, true)} /><SuccessDetail term="Requested equipment" value={inquiry.equipmentName} /><SuccessDetail term="Preferred period" value={formatRentalDateRange(inquiry.preferredDate, inquiry.preferredEndDate, true)} /><div><dt className="text-xs font-bold uppercase tracking-wide text-[#78857d]">Status</dt><dd className="mt-1"><RentalStatusBadge status={inquiry.status} /></dd></div></dl><div data-no-print className="mt-8 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cbdac6] px-5 text-sm font-bold text-[#365f4a]"><Printer className="size-4" />Print Booking Summary</button>{inModal ? <Link href="/portal/member/rentals" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1f6b43] px-5 text-sm font-bold text-white">View Rental History</Link> : <Link href="/rental/inquiry/status" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1f6b43] px-5 text-sm font-bold text-white">Check Booking Status</Link>}<button type="button" onClick={onDismiss} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cbdac6] px-5 text-sm font-bold text-[#365f4a]">{inModal ? "Close" : "Book Another Rental"}</button>{!inModal && <Link href="/rental" className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-[#365f4a]">Return to Rental Services</Link>}</div></section></div>;
}
function SuccessDetail({ term, value }: { term: string; value: string }) { return <div><dt className="text-xs font-bold uppercase tracking-wide text-[#78857d]">{term}</dt><dd className="mt-1 text-sm font-bold text-[#284735]">{value}</dd></div>; }
