import { ArrowRight, Clock3, Droplets, MapPin, Sprout, Tractor, Truck, Wrench } from "lucide-react";
import Link from "next/link";
import { cssUploadUrl } from "@/lib/upload-url";
import { getRentalServiceImages } from "../_lib/rentalPhotos";
import type { RentalService } from "../_types/rental";
import { BookRentalModal } from "./BookRentalModal";
import { RentalEquipmentImage } from "./RentalEquipmentImage";

const iconForCategory = (category: string) => {
  const props = { className: "size-20 text-[#1f6b43]", strokeWidth: 1.4, "aria-hidden": true } as const;
  if (category === "Irrigation") return <Droplets {...props} />;
  if (category === "Transport") return <Truck {...props} />;
  if (category === "Crop Care") return <Sprout {...props} />;
  if (category === "Field Maintenance") return <Wrench {...props} />;
  return <Tractor {...props} />;
};

export function RentalServiceCard({ service, publicStyle = false }: { service: RentalService; publicStyle?: boolean }) {
  const icon = iconForCategory(service.category);
  const mainImage = getRentalServiceImages(service)[0];
  const requestable =
    service.availability !== "Unavailable" &&
    !["Under Maintenance", "Out of Service", "Archived"].includes(
      service.operationalStatus,
    );
  const publicAvailability = requestable ? service.availability : "Unavailable";
  if (publicStyle) return (
    <article className="rental-public-equipment group grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-3 rounded-xl border border-[#D3DFCE] bg-white p-3 shadow-[0_3px_12px_rgba(18,61,42,.05)] sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4 sm:p-4">
      <Link href={`/rental/services/${service.serviceId}`} aria-label={`View ${service.publicTitle || service.name}`} className="self-start rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]"><RentalEquipmentImage path={mainImage} name={service.publicTitle || service.name} /></Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-[#365F4A]"><span>{service.category}</span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${requestable ? "bg-[#E6F2E2] text-[#1F6B43]" : "bg-[#F6EDD6] text-[#795B21]"}`}><span aria-hidden="true" className={`size-1.5 rounded-full ${requestable ? "bg-[#1F6B43]" : "bg-[#8B7443]"}`} />{publicAvailability}</span></div>
        <h3 className="mt-1 break-words text-lg font-bold leading-snug text-[#123D2A] sm:text-xl">{service.publicTitle || service.name}</h3>
        <p className="mt-1 line-clamp-1 text-sm leading-6 text-[#365F4A]">{service.publicDescription || service.shortDescription}</p>
        {service.publicAvailabilityMessage ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#795B21]">{service.publicAvailabilityMessage}</p> : null}
        <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-sm leading-5 text-[#365F4A]">
          <div><dt className="sr-only">Unit of use</dt><dd>{service.unitOfUsage}</dd></div>
          {service.suitableActivity !== service.category ? <div><dt className="sr-only">Suitable activity</dt><dd>{service.suitableActivity}</dd></div> : null}
          <div className="min-w-0"><dt className="sr-only">Service area</dt><dd className="line-clamp-1" title={service.serviceArea}>{service.serviceArea}</dd></div>
        </dl>
      </div>
        <div className="rental-equipment-actions col-span-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {requestable ? <BookRentalModal serviceId={service.serviceId} trigger={<button type="button" className="rental-public-action inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-[#123D2A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1F6B43]">Book a Rental<ArrowRight aria-hidden="true" className="size-3.5 shrink-0" /></button>} /> : null}
          <Link href={`/rental/services/${service.serviceId}`} className="rental-public-action inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-[#123D2A] underline decoration-[#8AA58D] underline-offset-4 hover:decoration-[#123D2A]">View Details</Link>
        </div>
    </article>
  );
  return <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#d8e4d3] bg-white shadow-[0_12px_30px_rgba(18,61,42,0.07)] transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(18,61,42,0.12)] motion-reduce:transform-none"><div className="relative grid h-44 place-items-center overflow-hidden bg-[linear-gradient(135deg,#e4efdf,#f5efda)] bg-cover bg-center" style={mainImage ? { backgroundImage: cssUploadUrl(mainImage) } : undefined}>{mainImage ? <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" /> : <><div className="absolute -right-12 -top-12 size-36 rounded-full border-[24px] border-white/35" />{icon}</>}<span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#365f4a]">{service.category}</span></div><div className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-3"><h2 className="text-xl font-extrabold text-[#123d2a]">{service.publicTitle || service.name}</h2><span className="rounded-full border border-[#c9ddc4] bg-[#edf6e9] px-2.5 py-1 text-[11px] font-bold text-[#2e6a46]">{service.availability}</span></div><p className="mt-3 text-sm leading-6 text-[#607067]">{service.publicDescription || service.shortDescription}</p>{service.publicAvailabilityMessage ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{service.publicAvailabilityMessage}</p> : null}<dl className="mt-4 grid gap-2 text-xs text-[#53675a]"><div className="flex gap-2"><Clock3 className="size-4 shrink-0 text-[#1f6b43]" /><dt className="sr-only">Unit of use</dt><dd>{service.unitOfUsage}</dd></div><div className="flex gap-2"><Sprout className="size-4 shrink-0 text-[#1f6b43]" /><dt className="sr-only">Suitable activity</dt><dd>{service.suitableActivity}</dd></div><div className="flex gap-2"><MapPin className="size-4 shrink-0 text-[#1f6b43]" /><dt className="sr-only">Service area</dt><dd>{service.serviceArea}</dd></div></dl><div className="mt-auto grid grid-cols-2 gap-2 pt-5"><Link href={`/rental/services/${service.serviceId}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cbdac6] px-3 text-sm font-bold text-[#123d2a] hover:bg-[#eef5eb]">View Details</Link>{requestable ? <BookRentalModal serviceId={service.serviceId} trigger={<button className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#1f6b43] px-3 text-sm font-bold text-white hover:bg-[#174e33]">Book a Rental<ArrowRight className="size-4" /></button>} /> : <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#EEF2EC] px-3 text-center text-xs font-bold text-[#5D6D63]">Temporarily unavailable</span>}</div></div></article>;
}
