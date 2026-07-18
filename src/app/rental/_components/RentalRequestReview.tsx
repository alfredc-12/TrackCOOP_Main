"use client";

import { AlertTriangle, CheckCircle2, CircleHelp, MapPin, ShieldCheck, Tractor } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { rentalRepository } from "../_lib/rentalRepository";
import type { RentalStatus } from "../_types/rental";
import { useRentalData } from "../_hooks/useRentalData";
import { RentalAccessGate } from "./RentalAccessGate";
import { RentalLoadingState } from "./RentalStates";
import { RentalPageHeader } from "./RentalPageHeader";

const decisions: Array<{ label: string; status: RentalStatus }> = [
  { label: "Approve for Scheduling", status: "Approved for Scheduling" },
  { label: "Request More Information", status: "Awaiting Information" },
  { label: "Place on Hold", status: "On Hold" },
  { label: "Reject Request", status: "Rejected" },
  { label: "Suggest Alternative Date", status: "Awaiting Confirmation" },
  { label: "Suggest Alternative Equipment", status: "Awaiting Confirmation" },
];

export function RentalRequestReview({ inquiryId }: { inquiryId: string }) {
  const router = useRouter();
  const { data, loading } = useRentalData(() => rentalRepository.getRentalInquiryById(inquiryId), [inquiryId]);
  const [decision, setDecision] = useState(decisions[0]);
  const [reviewerNote, setReviewerNote] = useState("");
  const [publicResponse, setPublicResponse] = useState("NFFAC reviewed your request and will contact you about the next step.");
  const [internalNote, setInternalNote] = useState("");
  const [suggestedDate, setSuggestedDate] = useState("");
  const [suggestedEquipment, setSuggestedEquipment] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);
  if (loading) return <RentalLoadingState />;
  if (!data) return <div>Inquiry not found.</div>;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!window.confirm(`Save decision: ${decision.label}?`)) return; setSaving(true); await rentalRepository.reviewRentalInquiry(inquiryId, decision.status, publicResponse, `${reviewerNote}\n${internalNote}`.trim()); router.push(`/rental/inquiries/${inquiryId}`); };
  const checks = [
    ["Equipment availability", data.status !== "Cancelled", Tractor], ["Schedule conflict", true, AlertTriangle], ["Service-location coverage", data.requester.municipality === "Nasugbu", MapPin], ["Request completeness", Boolean(data.requestDescription && data.preferredDate), CheckCircle2], ["Requester type / member match", Boolean(data.requester.requesterType), ShieldCheck], ["Estimated usage", Boolean(data.estimatedUsage), CircleHelp], ["Operator requirement", true, ShieldCheck], ["Maintenance conflict", true, AlertTriangle],
  ] as const;
  return <RentalAccessGate capability="inquiries"><RentalPageHeader eyebrow={inquiryId} title="Review rental request" description={`${data.requester.fullName} requested ${data.equipmentName} for ${data.preferredDate}. Complete the operational checks before saving a decision.`} /><div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]"><section className="rounded-2xl border border-[#dce7d6] bg-white p-5"><h2 className="text-lg font-extrabold text-[#123d2a]">Review checks</h2><div className="mt-4 grid gap-3">{checks.map(([label, passed, Icon]) => <div key={label} className="flex min-h-12 items-center gap-3 rounded-xl bg-[#f7f9f5] p-3"><Icon className={`size-5 ${passed ? "text-[#1f6b43]" : "text-amber-700"}`} /><span className="flex-1 text-sm font-semibold">{label}</span><span className={`text-xs font-bold ${passed ? "text-[#1f6b43]" : "text-amber-700"}`}>{passed ? "Checked" : "Review"}</span></div>)}</div></section><form onSubmit={submit} className="rounded-2xl border border-[#dce7d6] bg-white p-5"><h2 className="text-lg font-extrabold text-[#123d2a]">Review decision</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><ReviewField label="Decision"><select value={decision.label} onChange={(event) => setDecision(decisions.find((item) => item.label === event.target.value) ?? decisions[0])}>{decisions.map((item) => <option key={item.label}>{item.label}</option>)}</select></ReviewField><ReviewField label="Follow-up deadline"><input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></ReviewField><ReviewField label="Suggested date"><input type="date" value={suggestedDate} onChange={(event) => setSuggestedDate(event.target.value)} /></ReviewField><ReviewField label="Suggested equipment"><input value={suggestedEquipment} onChange={(event) => setSuggestedEquipment(event.target.value)} /></ReviewField><ReviewField label="Reviewer note" wide><textarea rows={3} value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value)} /></ReviewField><ReviewField label="Public response" wide><textarea required rows={3} value={publicResponse} onChange={(event) => setPublicResponse(event.target.value)} /></ReviewField><ReviewField label="Internal note" wide><textarea rows={3} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} /></ReviewField></div><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => router.back()} className="min-h-11 rounded-xl px-5 text-sm font-bold text-[#66756c]">Cancel</button><button disabled={saving} className="min-h-11 rounded-xl bg-[#1f6b43] px-6 text-sm font-bold text-white">{saving ? "Saving…" : "Confirm and Save Review"}</button></div></form></div></RentalAccessGate>;
}
function ReviewField({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactElement }) { return <label className={`grid gap-1.5 text-sm font-bold text-[#365f4a] ${wide ? "sm:col-span-2" : ""}`}>{label}<span className="[&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:border-[#d5e1d0] [&>*]:bg-white [&>*]:p-3 [&>*]:text-sm [&>*]:font-normal">{children}</span></label>; }
