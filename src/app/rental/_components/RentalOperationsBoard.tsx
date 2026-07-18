"use client";

import { ArrowRight, Clock3, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { rentalRepository } from "../_lib/rentalRepository";
import type { RentalInquiry, RentalStatus } from "../_types/rental";
import { useRentalData } from "../_hooks/useRentalData";
import { RentalAccessGate } from "./RentalAccessGate";
import { RentalLoadingState } from "./RentalStates";
import { RentalPageHeader } from "./RentalPageHeader";
import { RentalPaymentStatusBadge } from "./RentalPaymentStatusBadge";

const columns = [
  { label: "Awaiting Confirmation", statuses: ["Awaiting Confirmation"] as RentalStatus[], next: "Scheduled" as RentalStatus, action: "Confirm / Schedule" },
  { label: "Scheduled Today", statuses: ["Scheduled"] as RentalStatus[], next: "In Progress" as RentalStatus, action: "Mark in Preparation" },
  { label: "In Preparation", statuses: ["Payment Confirmed"] as RentalStatus[], next: "In Progress" as RentalStatus, action: "Mark Started" },
  { label: "In Progress", statuses: ["In Progress"] as RentalStatus[], next: "Completed" as RentalStatus, action: "Mark Completed" },
  { label: "Awaiting Completion Review", statuses: ["Payment Pending"] as RentalStatus[], next: "Completed" as RentalStatus, action: "Complete Review" },
  { label: "Completed", statuses: ["Completed"] as RentalStatus[], next: undefined, action: "Completed" },
];

export function RentalOperationsBoard() {
  const { data = [], loading, refresh } = useRentalData(() => rentalRepository.getRentalInquiries(), []);
  const move = async (item: RentalInquiry, status: RentalStatus) => { if ((status === "Completed" || item.status === "In Progress") && !window.confirm(`Confirm moving ${item.rentalId} to ${status}?`)) return; const note = status === "Completed" ? window.prompt("Add a completion note:", "Rental operation completed.") : undefined; await rentalRepository.reviewRentalInquiry(item.inquiryId, status, note ?? `Rental operation moved to ${status}.`); refresh(); };
  return <RentalAccessGate capability="operations"><RentalPageHeader title="Rental operations" description="Use accessible status actions to move approved rentals through preparation, active operation, completion review, and completion." />{loading ? <RentalLoadingState /> : <div className="overflow-x-auto pb-3"><div className="grid min-w-[1400px] grid-cols-6 gap-3">{columns.map((column) => <section key={column.label} className="rounded-2xl bg-[#edf2e9] p-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-extrabold text-[#284735]">{column.label}</h2><span className="rounded-full bg-white px-2 py-1 text-xs font-bold">{data.filter((item) => column.statuses.includes(item.status)).length}</span></div><div className="grid gap-3">{data.filter((item) => column.statuses.includes(item.status)).map((item) => <article key={item.rentalId} className="rounded-xl border bg-white p-4 shadow-sm"><p className="font-mono text-[11px] text-[#75837a]">{item.rentalId}</p><h3 className="mt-1 font-extrabold text-[#123d2a]">{item.equipmentName}</h3><p className="mt-2 flex items-center gap-2 text-xs text-[#53675a]"><UserRound className="size-3.5" />{item.requester.fullName}</p><p className="mt-1 flex items-center gap-2 text-xs text-[#53675a]"><Clock3 className="size-3.5" />{item.preferredStartTime ?? "Time pending"}</p><p className="mt-1 flex items-center gap-2 text-xs text-[#53675a]"><MapPin className="size-3.5" />{item.serviceBarangay}</p><div className="mt-3"><RentalPaymentStatusBadge status={item.paymentStatus} /></div><p className="mt-3 rounded-lg bg-[#f7f9f5] p-2 text-xs text-[#66756c]">{item.publicNote}</p><Link href={`/rental/inquiries/${item.inquiryId}`} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border text-xs font-bold">Open Details</Link>{column.next && <button onClick={() => void move(item, column.next!)} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg bg-[#1f6b43] text-xs font-bold text-white">{column.action}<ArrowRight className="size-3.5" /></button>}</article>)}</div></section>)}</div></div>}</RentalAccessGate>;
}
