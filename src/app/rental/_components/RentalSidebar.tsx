"use client";

import { ArrowLeft, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useRental } from "../_context/RentalProvider";
import { rentalNavigation } from "../_lib/rentalNavigation";
import { canAccessRental } from "../_lib/rentalPermissions";

function SidebarContent({ close }: { close: () => void }) {
  const pathname = usePathname();
  const { role } = useRental();
  const items = rentalNavigation.filter((item) => canAccessRental(role, item.capability));
  return <><div className="border-b border-white/10 pb-5"><Link href="/rental" onClick={close} className="flex items-center gap-3"><Image src="/trackcoop-logo.svg" alt="TrackCOOP" width={48} height={48} className="rounded-xl bg-white" /><span><span className="block text-xl font-extrabold tracking-tight text-white">TrackCOOP</span><span className="block text-xs text-[#a5d3b5]">NFFAC Rental</span></span></Link><span className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#9ee5b8]">{role} workspace</span></div><nav aria-label="Rental management" className="mt-5 grid gap-1">{items.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} onClick={close} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[#e8f4e8] text-[#123d2a]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}><item.icon className="size-4.5" />{item.label}</Link>; })}</nav><Link href="/" onClick={close} className="mt-auto flex min-h-11 items-center gap-3 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-bold text-white/75 hover:bg-white/10"><ArrowLeft className="size-4" />Back to TrackCOOP</Link></>;
}

export function RentalSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, open]);
  return <><aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col overflow-y-auto bg-[#0d2d1e] p-5 lg:flex"><SidebarContent close={onClose} /></aside>{open && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="Close rental navigation overlay" onClick={onClose} className="absolute inset-0 bg-black/50" /><aside role="dialog" aria-modal="true" aria-label="Rental navigation" className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col overflow-y-auto bg-[#0d2d1e] p-5 shadow-2xl"><button type="button" onClick={onClose} aria-label="Close rental navigation" className="absolute right-4 top-4 grid size-10 place-items-center rounded-xl bg-white/10 text-white"><X className="size-5" /></button><SidebarContent close={onClose} /></aside></div>}</>;
}
