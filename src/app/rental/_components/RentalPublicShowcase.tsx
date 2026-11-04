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
    <section aria-labelledby="rental-heading" className="rental-showcase group relative isolate flex min-h-[31rem] flex-col overflow-hidden bg-[#123D2A] text-white lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] lg:min-h-[34rem]">
      <Image key={src} src={src} alt={src === fieldPhoto ? "Farm tractor working in a field" : equipment?.publicTitle || equipment?.name || "Farm equipment"} fill unoptimized priority sizes="(min-width:1024px) 43vw, 100vw" onError={() => { if (src !== fieldPhoto) setFailedPhoto(src); }} className="rental-showcase-image object-cover object-[55%_center]" />
      <div className="pointer-events-none absolute inset-0 bg-black/55" />
      <div className="relative flex flex-1 flex-col justify-between gap-16 p-6 sm:p-8 xl:p-10">
        <div>
          <h1 id="rental-heading" className="max-w-lg text-4xl font-black leading-[1.04] sm:text-5xl xl:text-6xl">Equipment<br />rental.</h1>
          <p className="mt-4 max-w-sm text-base leading-7 text-white">Find farm equipment and facilities from your cooperative. Choose a service to start your booking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <BookRentalModal trigger={<button type="button" className="rental-public-action inline-flex min-h-12 items-center justify-between gap-3 rounded-md bg-[#F2C94C] px-5 py-3 text-base font-bold text-[#123D2A] hover:bg-[#FFDA68]">Book a Rental<ArrowRight aria-hidden="true" className="size-5" /></button>} />
          <Modal title="Check Booking Status" description="Enter your Booking ID to check the current status." maxWidth="max-w-2xl" trigger={<button type="button" className="rental-public-action inline-flex min-h-11 items-center text-base font-semibold text-white underline decoration-white/60 underline-offset-4 hover:decoration-white">Check Booking Status</button>}><RentalStatusLookup /></Modal>
        </div>
      </div>
    </section>
  );
}
