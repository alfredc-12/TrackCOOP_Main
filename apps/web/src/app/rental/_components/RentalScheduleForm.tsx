"use client";

import { AlertTriangle, CalendarCheck, SearchCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRental } from "../_context/RentalProvider";
import { rentalRepository } from "../_lib/rentalRepository";
import type { RentalInquiry, RentalSchedule, ScheduleConflict, ScheduleStatus } from "../_types/rental";
import { useRentalData } from "../_hooks/useRentalData";
import { RentalAccessGate } from "./RentalAccessGate";
import { RentalConflictModal } from "./RentalConflictModal";
import { RentalPageHeader } from "./RentalPageHeader";

const blank: RentalSchedule = { scheduleId: "", inquiryId: "", rentalId: "", serviceId: "", equipmentName: "", requesterName: "", requesterType: "Member", date: "", startTime: "08:00", endTime: "10:00", assignedOperator: "", serviceLocation: "", barangay: "", preparationMinutes: 30, travelMinutes: 30, bufferMinutes: 30, specialInstructions: "", status: "Proposed", paymentStatus: "Pending" };

function scheduleWithInquiry(current: RentalSchedule, inquiry: RentalInquiry): RentalSchedule {
  return { ...current, inquiryId: inquiry.inquiryId, rentalId: inquiry.rentalId, serviceId: inquiry.serviceId, equipmentName: inquiry.equipmentName, requesterName: inquiry.requester.fullName, requesterType: inquiry.requester.requesterType, date: inquiry.preferredDate, serviceLocation: inquiry.serviceLocation, barangay: inquiry.serviceBarangay, paymentStatus: inquiry.paymentStatus };
}

function scheduleCandidate(form: RentalSchedule): Omit<RentalSchedule, "scheduleId" | "status" | "paymentStatus"> {
  return { inquiryId: form.inquiryId, rentalId: form.rentalId, serviceId: form.serviceId, equipmentName: form.equipmentName, requesterName: form.requesterName, requesterType: form.requesterType, date: form.date, startTime: form.startTime, endTime: form.endTime, assignedOperator: form.assignedOperator, serviceLocation: form.serviceLocation, barangay: form.barangay, preparationMinutes: form.preparationMinutes, travelMinutes: form.travelMinutes, bufferMinutes: form.bufferMinutes, specialInstructions: form.specialInstructions };
}

function schedulePayload(form: RentalSchedule, status: ScheduleStatus): Omit<RentalSchedule, "scheduleId"> {
  return { ...scheduleCandidate(form), status, paymentStatus: form.paymentStatus };
}

export function RentalScheduleForm({ scheduleId }: { scheduleId?: string }) {
  const router = useRouter();
  const { services } = useRental();
  const { data } = useRentalData(async () => ({ inquiries: await rentalRepository.getRentalInquiries(), schedules: await rentalRepository.getRentalSchedules() }), []);
  const [form, setForm] = useState(blank);
  const [conflict, setConflict] = useState<ScheduleConflict>();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!data) return;
    const initial = scheduleId
      ? data.schedules.find((item) => item.scheduleId === scheduleId)
      : data.inquiries.find((item) => item.inquiryId === new URLSearchParams(window.location.search).get("inquiry"));
    if (!initial) return;
    const timer = window.setTimeout(() => {
      setForm((current) => "scheduleId" in initial ? initial : scheduleWithInquiry(current, initial));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data, scheduleId]);
  const update = <K extends keyof RentalSchedule>(key: K, value: RentalSchedule[K]) => { setForm((current) => ({ ...current, [key]: value })); setChecked(false); };
  const selectInquiry = (inquiry: RentalInquiry) => setForm((current) => scheduleWithInquiry(current, inquiry));
  const candidate = () => scheduleCandidate(form);
  const check = async () => { const result = await rentalRepository.checkScheduleConflict(candidate()); setChecked(!result.hasConflict); if (result.hasConflict) setConflict(result); else window.alert("No schedule conflict was detected for the proposed time."); };
  const save = async (status: ScheduleStatus) => {
    if (!form.inquiryId || !form.serviceId || !form.date || !form.startTime || !form.endTime) { window.alert("Inquiry, equipment, date, start time, and end time are required."); return; }
    const result = await rentalRepository.checkScheduleConflict(candidate()); if (result.hasConflict) { setConflict(result); return; }
    setSaving(true); if (scheduleId) await rentalRepository.updateRentalSchedule(scheduleId, { ...form, status }); else await rentalRepository.createRentalSchedule(schedulePayload(form, status)); router.push("/rental/schedule");
  };
  return <RentalAccessGate capability="schedule"><RentalPageHeader title={scheduleId ? "Edit rental schedule" : "Create rental schedule"} description="Preparation and buffer times are included in overlap detection." /><form onSubmit={(event) => { event.preventDefault(); void save("Proposed"); }} className="grid gap-5 xl:grid-cols-[1fr_.72fr]"><section className="rounded-2xl border border-[#dce7d6] bg-white p-5"><h2 className="text-lg font-extrabold text-[#123d2a]">Schedule details</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><ScheduleField label="Inquiry ID" wide><select value={form.inquiryId} onChange={(event) => { const inquiry = data?.inquiries.find((item) => item.inquiryId === event.target.value); if (inquiry) selectInquiry(inquiry); }}><option value="">Select inquiry</option>{data?.inquiries.map((item) => <option key={item.inquiryId} value={item.inquiryId}>{item.inquiryId} · {item.requester.fullName}</option>)}</select></ScheduleField><ScheduleField label="Requester"><input value={form.requesterName} readOnly /></ScheduleField><ScheduleField label="Equipment"><select value={form.serviceId} onChange={(event) => { const service = services.find((item) => item.serviceId === event.target.value); update("serviceId", event.target.value); update("equipmentName", service?.name ?? ""); }}><option value="">Select equipment</option>{services.map((item) => <option value={item.serviceId} key={item.serviceId}>{item.name}</option>)}</select></ScheduleField><ScheduleField label="Schedule date"><input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} /></ScheduleField><ScheduleField label="Start time"><input type="time" value={form.startTime} onChange={(event) => update("startTime", event.target.value)} /></ScheduleField><ScheduleField label="End time"><input type="time" value={form.endTime} onChange={(event) => update("endTime", event.target.value)} /></ScheduleField><ScheduleField label="Assigned operator"><input value={form.assignedOperator ?? ""} onChange={(event) => update("assignedOperator", event.target.value)} /></ScheduleField><ScheduleField label="Service location" wide><input value={form.serviceLocation} onChange={(event) => update("serviceLocation", event.target.value)} /></ScheduleField><ScheduleField label="Barangay"><input value={form.barangay} onChange={(event) => update("barangay", event.target.value)} /></ScheduleField><ScheduleField label="Preparation time (minutes)"><input type="number" min="0" value={form.preparationMinutes} onChange={(event) => update("preparationMinutes", Number(event.target.value))} /></ScheduleField><ScheduleField label="Travel time (minutes)"><input type="number" min="0" value={form.travelMinutes} onChange={(event) => update("travelMinutes", Number(event.target.value))} /></ScheduleField><ScheduleField label="Buffer time (minutes)"><input type="number" min="0" value={form.bufferMinutes} onChange={(event) => update("bufferMinutes", Number(event.target.value))} /></ScheduleField><ScheduleField label="Special instructions" wide><textarea rows={3} value={form.specialInstructions ?? ""} onChange={(event) => update("specialInstructions", event.target.value)} /></ScheduleField></div></section><aside className="grid content-start gap-5"><section className="rounded-2xl border border-[#dce7d6] bg-white p-5"><h2 className="text-lg font-extrabold text-[#123d2a]">Availability checks</h2><ul className="mt-4 grid gap-3 text-sm">{["Equipment availability", "Existing bookings", "Maintenance conflicts", "Operator availability", "Preparation and buffer overlap"].map((item) => <li key={item} className="flex items-center gap-3 rounded-xl bg-[#f7f9f5] p-3"><SearchCheck className={`size-5 ${checked ? "text-[#1f6b43]" : "text-[#75837a]"}`} />{item}</li>)}</ul><button type="button" onClick={() => void check()} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#9fbea2] bg-[#eef5eb] px-4 text-sm font-bold text-[#365f4a]"><AlertTriangle className="size-4" />Check Conflict</button></section><section className="rounded-2xl border border-[#dce7d6] bg-white p-5"><div className="grid gap-2"><button disabled={saving} className="min-h-11 rounded-xl border px-4 text-sm font-bold">Save Proposed Schedule</button><button type="button" onClick={() => void save("Confirmed")} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1f6b43] px-4 text-sm font-bold text-white"><CalendarCheck className="size-4" />Confirm Schedule</button><button type="button" className="min-h-11 rounded-xl border px-4 text-sm font-bold">Send to Requester</button><button type="button" onClick={() => router.back()} className="min-h-11 rounded-xl px-4 text-sm font-bold text-[#66756c]">Cancel</button></div></section></aside></form>{conflict && <RentalConflictModal conflict={conflict} onClose={() => setConflict(undefined)} onSelect={(slot) => { const [start, end] = slot.split("–"); update("startTime", start); update("endTime", end); setConflict(undefined); }} />}</RentalAccessGate>;
}
function ScheduleField({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactElement }) { return <label className={`grid gap-1.5 text-sm font-bold text-[#365f4a] ${wide ? "sm:col-span-2" : ""}`}>{label}<span className="[&>*]:min-h-11 [&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:border-[#d5e1d0] [&>*]:bg-white [&>*]:p-3 [&>*]:text-sm [&>*]:font-normal">{children}</span></label>; }
