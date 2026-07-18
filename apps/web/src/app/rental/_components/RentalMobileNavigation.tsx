"use client";

import { CalendarDays, Gauge, ListChecks, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/rental/dashboard", label: "Overview", icon: Gauge },
  { href: "/rental/inquiries", label: "Requests", icon: ListChecks },
  { href: "/rental/schedule", label: "Schedule", icon: CalendarDays },
];

export function RentalMobileNavigation({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  return <nav aria-label="Rental mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#d5e1d0] bg-white px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">{items.map((item) => { const active = pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold ${active ? "text-[#1f6b43]" : "text-[#68766e]"}`}><item.icon className="size-5" />{item.label}</Link>; })}<button type="button" onClick={onMore} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold text-[#68766e]"><MoreHorizontal className="size-5" />More</button></nav>;
}
