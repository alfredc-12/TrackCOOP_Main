"use client";

import { ArrowLeft, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/rental", label: "Rental Services" },
  { href: "/rental/inquiry/status", label: "Inquiry Status" },
  { href: "/rental/inquiry", label: "Submit Inquiry" },
];

export function RentalPublicHeader() {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-40 border-b border-[#d5e1d0] bg-white/95 backdrop-blur-xl"><div className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-4 sm:px-6"><Link href="/rental" className="flex min-w-0 items-center gap-3"><Image src="/trackcoop-logo.svg" alt="TrackCOOP logo" width={46} height={46} className="rounded-lg" /><span className="min-w-0"><span className="block text-lg font-extrabold text-[#123d2a]">TrackCOOP</span><span className="block truncate text-[11px] font-semibold text-[#5f7466]">NFFAC Equipment Rental</span></span></Link><nav className="ml-auto hidden items-center gap-1 md:flex">{links.map((item) => <Link key={item.href} href={item.href} className={`min-h-11 rounded-xl px-4 py-3 text-sm font-bold transition ${item.label === "Submit Inquiry" ? "bg-[#1f6b43] text-white hover:bg-[#174e33]" : "text-[#365f4a] hover:bg-[#eaf3e8]"}`}>{item.label}</Link>)}<Link href="/" className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d5e1d0] px-4 py-3 text-sm font-bold text-[#365f4a]"><ArrowLeft className="size-4" />Back to TrackCOOP</Link></nav><button type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((value) => !value)} className="ml-auto grid size-11 place-items-center rounded-xl border border-[#d5e1d0] text-[#123d2a] md:hidden">{open ? <X className="size-5" /> : <Menu className="size-5" />}</button></div>{open && <nav className="grid gap-1 border-t border-[#d5e1d0] bg-white p-4 md:hidden">{links.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-4 py-3 text-sm font-bold text-[#123d2a] hover:bg-[#eaf3e8]">{item.label}</Link>)}<Link href="/" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-4 py-3 text-sm font-bold text-[#365f4a]">← Back to TrackCOOP</Link></nav>}</header>;
}
