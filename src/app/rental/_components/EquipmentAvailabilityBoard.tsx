"use client";

import { CalendarDays, Tractor, Wrench } from "lucide-react";
import Link from "next/link";
import { rentalRepository } from "../_lib/rentalRepository";
import type { EquipmentAvailability } from "../_types/rental";
import { formatRentalDate } from "../_lib/rentalFormatting";
import { useRentalData } from "../_hooks/useRentalData";
import { RentalAccessGate } from "./RentalAccessGate";
import { RentalLoadingState } from "./RentalStates";
import { RentalPageHeader } from "./RentalPageHeader";

const columns: EquipmentAvailability["status"][] = ["Available", "Reserved", "In Use", "Under Maintenance", "Unavailable"];

export function EquipmentAvailabilityBoard() {
  const { data = [], loading, refresh } = useRentalData(() => rentalRepository.getEquipmentAvailability(), []);
  const change = async (item: EquipmentAvailability, status: EquipmentAvailability["status"]) => { await rentalRepository.updateEquipmentAvailability(item.serviceId, status); refresh(); };
  return <RentalAccessGate capability="availability"><RentalPageHeader title="Equipment availability" description="See current readiness, reservations, in-use equipment, maintenance, and unavailable assets at a glance." />{loading ? <RentalLoadingState /> : <div className="grid gap-4 xl:grid-cols-5">{columns.map((status) => <section key={status} className="rounded-2xl bg-[#edf2e9] p-3"><div className="mb-3 flex items-center justify-between px-1"><h2 className="font-extrabold text-[#284735]">{status}</h2><span className="grid size-7 place-items-center rounded-full bg-white text-xs font-bold">{data.filter((item) => item.status === status).length}</span></div><div className="grid gap-3">{data.filter((item) => item.status === status).map((item) => <article key={item.serviceId} className="rounded-xl border border-[#dce7d6] bg-white p-4 shadow-sm"><div className="grid h-24 place-items-center rounded-xl bg-[#e8f0e3]"><Tractor className="size-12 text-[#1f6b43]" /></div><h3 className="mt-3 font-extrabold text-[#123d2a]">{item.equipmentName}</h3><p className="mt-1 text-xs text-[#66756c]">Next schedule: {formatRentalDate(item.nextSchedule)}</p>{item.maintenanceNote && <p className="mt-2 flex gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900"><Wrench className="size-4 shrink-0" />{item.maintenanceNote}</p>}<select aria-label={`Change availability for ${item.equipmentName}`} value={item.status} onChange={(event) => void change(item, event.target.value as EquipmentAvailability["status"])} className="mt-3 h-10 w-full rounded-lg border px-2 text-xs font-bold">{columns.map((option) => <option key={option}>{option}</option>)}</select><div className="mt-2 grid grid-cols-2 gap-2"><Link href={`/rental/schedule?equipment=${item.serviceId}`} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border text-xs font-bold"><CalendarDays className="size-3.5" />Schedule</Link><Link href={`/rental/services/${item.serviceId}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border text-xs font-bold">Details</Link></div></article>)}</div></section>)}</div>}</RentalAccessGate>;
}
