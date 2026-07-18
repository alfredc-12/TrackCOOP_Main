"use client";

import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRental } from "../_context/RentalProvider";
import type { InquiryDraft } from "../_types/rental";
import { formatRentalDate } from "../_lib/rentalFormatting";
import { RentalPolicyNotice } from "./RentalPolicyNotice";

export function RentalInquiryReview({ member = false }: { member?: boolean }) {
  const router = useRouter();
  const { getInquiryDraft, submitInquiry, services } = useRental();
  const [draft, setDraft] = useState<InquiryDraft>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const timer = window.setTimeout(() => setDraft(getInquiryDraft()), 0);
    return () => window.clearTimeout(timer);
  }, [getInquiryDraft]);
  if (!draft) return <div className="rounded-3xl border border-[#d8e4d3] bg-white p-8 text-center"><h2 className="text-2xl font-bold text-[#123d2a]">No inquiry is ready for review</h2><p className="mt-2 text-[#66756c]">Complete the inquiry form before submitting.</p><Link href={member ? "/rental/member/requests/new" : "/rental/inquiry"} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#123d2a] px-5 font-bold text-white">Open inquiry form</Link></div>;
  const service = services.find((item) => item.serviceId === draft.serviceId)?.name ?? draft.serviceId;
  const submit = async () => {
    setSubmitting(true); setError(undefined);
    try { await submitInquiry(draft, member); router.push(member ? "/rental/member/requests" : "/rental/inquiry/success"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The inquiry could not be submitted."); setSubmitting(false); }
  };
  return <div className="space-y-5"><RentalPolicyNotice />{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}<ReviewSection title="Requester information" rows={[["Full name", draft.fullName], ["Requester type", draft.requesterType], ["Contact number", draft.contactNumber], ["Email", draft.email || "Not provided"], ["Address", draft.completeAddress], ["Barangay / Municipality", `${draft.barangay}, ${draft.municipality}`], ["Preferred contact", draft.preferredContactMethod]]} /><ReviewSection title="Rental request" rows={[["Equipment or service", service], ["Intended use", draft.intendedUse], ["Preferred date", formatRentalDate(draft.preferredDate, true)], ["Alternative date", draft.alternativeDate ? formatRentalDate(draft.alternativeDate, true) : "Not provided"], ["Preferred time", draft.preferredStartTime], ["Estimated duration", draft.estimatedDuration], ["Estimated usage", `${draft.estimatedUsage} ${draft.unitOfMeasurement}`], ["Service location", `${draft.serviceLocation}, ${draft.serviceBarangay}`], ["Request description", draft.requestDescription], ["Special instructions", draft.specialInstructions || "None"]]} /><ReviewSection title="Supporting information and consent" rows={[["Inquiry attachment", draft.attachmentName || "None"], ["Membership proof", draft.membershipProofName || "None"], ["Additional notes", draft.additionalNotes || "None"], ["Required consents", draft.dataPrivacyConsent && draft.accuracyConfirmation && draft.contactConsent ? "Confirmed" : "Incomplete"]]} /><div className="flex flex-col-reverse gap-3 rounded-2xl border border-[#d8e4d3] bg-white p-4 sm:flex-row sm:justify-end"><Link href={member ? "/rental/member/requests/new" : "/rental/inquiry"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cbdac6] px-5 text-sm font-bold text-[#365f4a]"><ArrowLeft className="size-4" />Edit Inquiry</Link><Link href="/rental" className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-[#66756c]">Cancel</Link><button type="button" disabled={submitting} onClick={() => void submit()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1f6b43] px-6 text-sm font-extrabold text-white disabled:opacity-60">{submitting ? "Submitting…" : "Submit Inquiry"}{submitting ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}</button></div></div>;
}

function ReviewSection({ title, rows }: { title: string; rows: string[][] }) { return <section className="rounded-3xl border border-[#d8e4d3] bg-white p-6"><h2 className="text-xl font-extrabold text-[#123d2a]">{title}</h2><dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">{rows.map(([term, value]) => <div key={term} className={value.length > 80 ? "sm:col-span-2" : ""}><dt className="text-xs font-bold uppercase tracking-wide text-[#78857d]">{term}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#365f4a]">{value}</dd></div>)}</dl></section>; }
