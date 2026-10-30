"use client";

import { ArrowRight, Info, Tractor } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { PRICING_NOTICE } from "../_lib/rentalConstants";
import { BookRentalModal } from "./BookRentalModal";
import { RentalPolicyNotice } from "./RentalPolicyNotice";
import { RentalServiceBrowser } from "./RentalServiceBrowser";
import { RentalStatusLookup } from "./RentalStatusLookup";

export function MemberRentalSection() {
  return (
    <>
      <section aria-labelledby="member-rental-title" className="border-b border-[#d8e4d3] bg-[#123d2a] px-4 py-5 text-white sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Tractor className="hidden size-9 shrink-0 text-[#bde4c5] sm:block" aria-hidden="true" />
            <div>
              <h1 id="member-rental-title" className="text-2xl font-extrabold tracking-tight">Equipment Rental</h1>
              <p className="mt-1 text-sm text-white/80">Find farm equipment and request a rental.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <BookRentalModal trigger={<button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#e7efbd] px-4 text-sm font-bold text-[#123d2a] transition-colors hover:bg-white">Book a Rental<ArrowRight className="size-4" aria-hidden="true" /></button>} />
            <Modal title="Check Booking Status" description="Enter your Booking ID to check the current status." maxWidth="max-w-2xl" trigger={<button className="min-h-11 rounded-xl border border-white/30 px-4 text-sm font-bold transition-colors hover:bg-white/10">Check Booking Status</button>}>
              <RentalStatusLookup />
            </Modal>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-[#bde4c5]">Choose equipment → Submit booking → Cooperative review → Confirm schedule</p>
      </section>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#d8e4d3] bg-[#f1f5de] px-4 py-2 text-xs text-[#315a40] sm:px-5">
        <p className="flex flex-1 items-center gap-2"><Info className="size-4 shrink-0" aria-hidden="true" />{PRICING_NOTICE}</p>
        <Modal title="Rental pricing and policies" trigger={<button className="min-h-9 shrink-0 rounded-lg px-2 font-bold underline underline-offset-4 hover:bg-[#e4edcc]">View policies</button>}>
          <RentalPolicyNotice />
        </Modal>
      </div>
      <RentalServiceBrowser compact />
    </>
  );
}
