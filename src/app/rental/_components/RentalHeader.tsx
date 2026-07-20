"use client";

import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRental } from "../_context/RentalProvider";
import type { UserRole } from "../_types/rental";
import { titleForPath } from "../_lib/rentalNavigation";

const roles: UserRole[] = ["Chairman", "Admin", "Bookkeeper", "Member", "Public"];

export function RentalHeader({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { role, setRole, mode } = useRental();
  const title = titleForPath(pathname);
  return <header className="sticky top-0 z-30 border-b border-[#dce7d6] bg-[#f8f5eb]/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8"><div className="flex items-center gap-3"><button type="button" aria-label="Open rental navigation" onClick={onMenu} className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#d5e1d0] bg-white text-[#123d2a] lg:hidden"><Menu className="size-5" /></button><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-[#65806d]">TrackCOOP · Rental Desk</p><p className="truncate text-lg font-bold text-[#123d2a]">{title}</p></div><label className="relative hidden w-full max-w-xs xl:block"><span className="sr-only">Search rental records</span><Search className="pointer-events-none absolute left-3 top-3 size-4 text-[#718078]" /><input type="search" placeholder="Search rental records" className="h-11 w-full rounded-xl border border-[#d5e1d0] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#1f6b43] focus:ring-4 focus:ring-[#1f6b43]/10" /></label><Link href="/rental/notifications" aria-label="Rental notifications" className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-[#d5e1d0] bg-white text-[#123d2a]"><Bell className="size-4" /><span className="absolute right-2 top-2 size-2 rounded-full bg-[#d97706]" /></Link><label className="relative hidden sm:block"><span className="sr-only">Active rental role</span><select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="h-11 appearance-none rounded-xl border border-[#d5e1d0] bg-white pl-3 pr-9 text-sm font-bold text-[#123d2a] outline-none focus:border-[#1f6b43]" title={mode === "demo" ? "Demonstration role switcher" : "Current TrackCOOP role"}>{roles.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-4 text-[#65806d]" /></label></div>{mode === "demo" && <p className="mt-2 text-right text-[11px] font-semibold text-[#6b7e71]">Demonstration data · role preview enabled</p>}</header>;
}
