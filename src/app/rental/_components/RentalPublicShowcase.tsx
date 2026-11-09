"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRental } from "../_context/RentalProvider";
import { getRentalServiceImages } from "../_lib/rentalPhotos";
import { resolveUploadUrl } from "@/lib/upload-url";
import { Modal } from "@/components/ui/Modal";
import { BookRentalModal } from "./BookRentalModal";
import { RentalStatusLookup } from "./RentalStatusLookup";

const fieldPhoto = "/images/rental/tractor-field.jpg";

export function RentalPublicShowcase() {
  const { services } = useRental();
  const [failedPhoto, setFailedPhoto] = useState("");
  const equipment = services.find((service) => /tractor/i.test(service.name) && getRentalServiceImages(service).length > 0);
  const photo = equipment ? resolveUploadUrl(getRentalServiceImages(equipment)[0]) : fieldPhoto;
  const src = photo === failedPhoto ? fieldPhoto : photo;

  return (
    <section aria-labelledby="rental-heading" className="rental-showcase group relative isolate flex min-h-[25rem] flex-col overflow-hidden bg-[#123D2A] text-white lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] lg:min-h-[34rem]">
      <Image key={src} src={src} alt={src === fieldPhoto ? "Farm tractor working in a field" : equipment?.publicTitle || equipment?.name || "Farm equipment"} fill unoptimized priority sizes="(min-width:1024px) 43vw, 100vw" onError={() => { if (src !== fieldPhoto) setFailedPhoto(src); }} className="rental-showcase-image object-cover object-[55%_center]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a2418]/90 via-[#123D2A]/35 to-[#0a2418]/60" />
      <div className="relative flex flex-1 flex-col justify-between gap-16 p-6 sm:p-8 xl:p-10">
        <div>
          <p className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#F5D66D]"><span aria-hidden="true" className="h-px w-8 bg-[#F2C94C]" />NFFAC rental services</p>
          <h1 id="rental-heading" className="max-w-lg text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl xl:text-[3.5rem]">Equipment<br />rental.</h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-white/90">Find farm equipment and facilities from your cooperative. Choose a service to start your booking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <BookRentalModal trigger={<button type="button" className="rental-public-action inline-flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[#F2C94C] px-5 py-3 text-base font-bold text-[#123D2A] hover:bg-[#FFDA68]">Book a Rental<ArrowRight aria-hidden="true" className="size-5" /></button>} />
          <Modal title="Check Booking Status" description="Enter your Booking ID to check the current status." maxWidth="max-w-2xl" trigger={<button type="button" className="rental-public-action inline-flex min-h-12 items-center justify-center rounded-xl border border-white/35 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15">Check Booking Status</button>}><RentalStatusLookup /></Modal>
        </div>
      </div>
    </section>
  );
}
