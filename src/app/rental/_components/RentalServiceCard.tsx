import { ArrowRight, Clock3, Droplets, MapPin, Sprout, Tractor, Truck, Wrench } from "lucide-react";
import Link from "next/link";
import type { RentalService } from "../_types/rental";
import { BookRentalModal } from "./BookRentalModal";

const iconForCategory = (category: string) => {
  const props = { className: "size-20 text-[#1f6b43]", strokeWidth: 1.4, "aria-hidden": true } as const;
  if (category === "Irrigation") return <Droplets {...props} />;
  if (category === "Transport") return <Truck {...props} />;
  if (category === "Crop Care") return <Sprout {...props} />;
  if (category === "Field Maintenance") return <Wrench {...props} />;
  return <Tractor {...props} />;
};

export function RentalServiceCard({ service }: { service: RentalService }) {
  const icon = iconForCategory(service.category);
  const requestable =
    service.availability !== "Unavailable" &&
    !["Under Maintenance", "Out of Service", "Archived"].includes(
      service.operationalStatus,
    );
  return <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#d8e4d3] bg-white shadow-[0_12px_30px_rgba(18,61,42,0.07)] transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(18,61,42,0.12)] motion-reduce:transform-none"><div className="relative grid h-44 place-items-center overflow-hidden bg-[linear-gradient(135deg,#e4efdf,#f5efda)]"><div className="absolute -right-12 -top-12 size-36 rounded-full border-[24px] border-white/35" />{icon}<span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#365f4a]">{service.category}</span></div><div className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-3"><h2 className="text-xl font-extrabold text-[#123d2a]">{service.publicTitle || service.name}</h2><span className="rounded-full border border-[#c9ddc4] bg-[#edf6e9] px-2.5 py-1 text-[11px] font-bold text-[#2e6a46]">{service.availability}</span></div><p className="mt-3 text-sm leading-6 text-[#607067]">{service.publicDescription || service.shortDescription}</p>{service.publicAvailabilityMessage ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{service.publicAvailabilityMessage}</p> : null}<dl className="mt-4 grid gap-2 text-xs text-[#53675a]"><div className="flex gap-2"><Clock3 className="size-4 shrink-0 text-[#1f6b43]" /><dt className="sr-only">Unit of use</dt><dd>{service.unitOfUsage}</dd></div><div className="flex gap-2"><Sprout className="size-4 shrink-0 text-[#1f6b43]" /><dt className="sr-only">Suitable activity</dt><dd>{service.suitableActivity}</dd></div><div className="flex gap-2"><MapPin className="size-4 shrink-0 text-[#1f6b43]" /><dt className="sr-only">Service area</dt><dd>{service.serviceArea}</dd></div></dl><div className="mt-auto grid grid-cols-2 gap-2 pt-5"><Link href={`/rental/services/${service.serviceId}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cbdac6] px-3 text-sm font-bold text-[#123d2a] hover:bg-[#eef5eb]">View Details</Link>{requestable ? <BookRentalModal serviceId={service.serviceId} trigger={<button className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#1f6b43] px-3 text-sm font-bold text-white hover:bg-[#174e33]">Book a Rental<ArrowRight className="size-4" /></button>} /> : <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#EEF2EC] px-3 text-center text-xs font-bold text-[#5D6D63]">Temporarily unavailable</span>}</div></div></article>;
}
