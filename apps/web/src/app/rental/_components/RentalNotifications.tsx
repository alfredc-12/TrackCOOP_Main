"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatRentalDate } from "../_lib/rentalFormatting";
import { rentalRepository } from "../_lib/rentalRepository";
import type { RentalNotification } from "../_types/rental";
import { useRentalData } from "../_hooks/useRentalData";
import { RentalEmptyState, RentalLoadingState } from "./RentalStates";
import { RentalPageHeader } from "./RentalPageHeader";

export function RentalNotifications() {
  const { data = [], loading } = useRentalData(() => rentalRepository.getRentalNotifications(), []);
  const [read, setRead] = useState<string[]>([]);
  const notifications = data.map((item) => ({ ...item, read: item.read || read.includes(item.notificationId) }));
  const markRead = (item: RentalNotification) => setRead((current) => [...current, item.notificationId]);
  return <><RentalPageHeader title="Rental notifications" description="Updates about inquiry review, schedules, payments, operations, receipts, availability, and maintenance." />{loading ? <RentalLoadingState /> : notifications.length ? <div className="grid gap-3">{notifications.map((item) => <article key={item.notificationId} className={`flex gap-4 rounded-2xl border p-5 ${item.read ? "border-[#dce7d6] bg-white" : "border-[#a9c9a5] bg-[#eff7eb]"}`}><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${item.read ? "bg-[#f0f3ee] text-[#66756c]" : "bg-[#1f6b43] text-white"}`}><Bell className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-[#65806d]">{item.type}</p><h2 className="mt-1 font-extrabold text-[#123d2a]">{item.title}</h2></div><time className="text-xs text-[#75837a]">{formatRentalDate(item.createdAt)}</time></div><p className="mt-2 text-sm leading-6 text-[#5d6d62]">{item.message}</p><div className="mt-3 flex flex-wrap gap-2">{item.href && <Link href={item.href} onClick={() => markRead(item)} className="inline-flex min-h-10 items-center rounded-lg bg-[#123d2a] px-4 text-xs font-bold text-white">Open {item.rentalId ?? "update"}</Link>}{!item.read && <button onClick={() => markRead(item)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-xs font-bold"><CheckCheck className="size-4" />Mark read</button>}</div></div></article>)}</div> : <RentalEmptyState title="No rental notifications" />}</>;
}
