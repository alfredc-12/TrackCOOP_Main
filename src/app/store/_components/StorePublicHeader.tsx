"use client";

import { ArrowLeft, Menu, X, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";



export function StorePublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-[#d5e1d0] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/store" className="flex min-w-0 items-center gap-3">
          <Image src="/trackcoop-logo.svg" alt="TrackCOOP logo" width={46} height={46} className="rounded-lg" />
          <span className="min-w-0">
            <span className="block text-lg font-extrabold text-[#123d2a]">TrackCOOP</span>
            <span className="block truncate text-[11px] font-semibold text-[#5f7466]">NFFAC Cooperative Store</span>
          </span>
        </Link>
        
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <div id="store-header-cart-slot" className="flex items-center"></div>
          <Link href="/" className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d5e1d0] px-4 py-3 text-sm font-bold text-[#365f4a] hover:bg-[#eaf3e8]">
            <ArrowLeft className="size-4" />
            Back to TrackCOOP
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <div id="store-header-cart-slot-mobile" className="flex items-center"></div>
          <button type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((value) => !value)} className="grid size-11 place-items-center rounded-xl border border-[#d5e1d0] text-[#123d2a]">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      
      {open && (
        <nav className="grid gap-1 border-t border-[#d5e1d0] bg-white p-4 md:hidden">
          <Link href="/" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-4 py-3 text-sm font-bold text-[#365f4a]">
            ← Back to TrackCOOP
          </Link>
        </nav>
      )}
    </header>
  );
}
