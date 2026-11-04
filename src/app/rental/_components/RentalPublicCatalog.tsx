"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useId, useState } from "react";
import type { RentalService } from "../_types/rental";
import { emptyRentalCatalogFilters, filterRentalCatalog, rentalUnitLabel, type RentalCatalogFilters } from "../_lib/rentalCatalog";
import { RentalServiceCard } from "./RentalServiceCard";
import { RentalErrorState, RentalLoadingState } from "./RentalStates";

type Option = { value: string; label: string };
const availabilityOptions: Option[] = [
  { value: "", label: "All services" }, { value: "bookable", label: "Open for booking" },
  { value: "Available", label: "Available" }, { value: "Limited Availability", label: "Limited availability" },
  { value: "By Schedule Only", label: "By schedule only" }, { value: "unavailable", label: "Temporarily unavailable" },
];
const sortOptions: Option[] = [
  { value: "recommended", label: "Recommended" }, { value: "availability", label: "Bookable first" },
  { value: "name-asc", label: "Name: A–Z" }, { value: "name-desc", label: "Name: Z–A" },
];

export function RentalPublicCatalog({ services, loading, error, refresh }: { services: RentalService[]; loading: boolean; error?: string; refresh: () => Promise<void> }) {
  const [filters, setFilters] = useState<RentalCatalogFilters>(emptyRentalCatalogFilters);
  const filtered = filterRentalCatalog(services, filters);
  const optionsFor = (values: string[], allLabel: string): Option[] => [{ value: "", label: allLabel }, ...[...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }))];
  const categories = optionsFor(services.map((service) => service.category), "All categories");
  const activities = optionsFor(services.map((service) => service.suitableActivity), "All activities");
  const units = optionsFor(services.map((service) => rentalUnitLabel(service.unitOfUsage)), "Any rental unit");
  const areas = optionsFor(services.map((service) => service.serviceArea), "All service areas");
  const update = (key: keyof RentalCatalogFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const activeFilters = (Object.entries(filters) as [keyof RentalCatalogFilters, string][]).filter(([key, value]) => key !== "sort" && key !== "search" && Boolean(value));
  const hasFilters = Boolean(filters.search.trim() || activeFilters.length || filters.sort !== "recommended");

  return (
    <section id="rental-catalog" aria-labelledby="rental-services-title" className="min-w-0 scroll-mt-20 px-4 pb-12 pt-5 sm:px-6 lg:px-5 xl:px-7">
      <div className="rental-results mx-auto max-w-3xl">
        <div className="rental-filter-card mb-4 overflow-hidden rounded-2xl border border-[#C8D9C8] bg-white shadow-[0_6px_20px_rgba(18,61,42,.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#174B35] px-4 py-4 sm:px-5">
            <h2 id="rental-services-title" className="text-2xl font-bold leading-tight text-white">Find your equipment</h2>
            <p role="status" className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-[#F5D66D]">{loading ? "Loading..." : `${filtered.length} of ${services.length} services`}</p>
          </div>
          <div className="p-4 sm:p-5">
            <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <label className="min-w-0 text-sm font-semibold text-[#123D2A]">Search equipment
                <span className="relative mt-1.5 block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#1F6B43]" /><input type="search" value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Name, activity, or service area" className="h-11 w-full min-w-0 rounded-lg border border-[#C8D9C8] bg-[#F7FAF5] pl-9 pr-3 text-base font-normal text-[#123D2A] outline-none placeholder:text-[#627468] focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/15" /></span>
              </label>
              <CatalogSelect label="Sort by" value={filters.sort} options={sortOptions} onChange={(value) => update("sort", value)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <CatalogSelect label="Equipment category" value={filters.category} options={categories} onChange={(value) => update("category", value)} />
              <CatalogSelect label="Booking availability" value={filters.availability} options={availabilityOptions} onChange={(value) => update("availability", value)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <CatalogSelect label="Rental unit" value={filters.rentalUnit} options={units} onChange={(value) => update("rentalUnit", value)} />
              <CatalogSelect label="Intended use" value={filters.activity} options={activities} onChange={(value) => update("activity", value)} />
              {areas.length > 2 ? <CatalogSelect label="Service area" value={filters.area} options={areas} onChange={(value) => update("area", value)} /> : null}
            </div>
            {hasFilters ? <button type="button" onClick={() => setFilters(emptyRentalCatalogFilters)} className="mt-2 min-h-11 rounded-md px-1 text-sm font-semibold text-[#1F6B43] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]">Clear filters</button> : null}
            {activeFilters.length ? <div aria-label="Active filters" className="mt-1 flex flex-wrap gap-2">{activeFilters.map(([key, value]) => {
              const label = key === "availability" ? availabilityOptions.find((option) => option.value === value)?.label ?? value : value;
              return <button key={key} type="button" onClick={() => update(key, "")} aria-label={`Remove filter: ${label}`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#E6F0E2] px-3 text-sm font-semibold text-[#174B35] hover:bg-[#D4E6CE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]">{label}<X aria-hidden="true" className="size-3.5" /></button>;
            })}</div> : null}
          </div>
        </div>
        {loading ? <RentalLoadingState label="Loading rental services" /> : error ? <RentalErrorState message={error} retry={() => void refresh()} /> : filtered.length ? <div className="grid gap-3">{filtered.map((service) => <RentalServiceCard key={service.serviceId} service={service} publicStyle />)}</div> : <div className="rounded-xl border border-[#C8D9C8] bg-white p-6 text-center"><h3 className="text-xl font-bold text-[#123D2A]">No equipment matches these filters</h3><p className="mt-2 text-base leading-7 text-[#365F4A]">Try a shorter search or remove a filter.</p>{hasFilters ? <button type="button" onClick={() => setFilters(emptyRentalCatalogFilters)} className="mt-4 min-h-11 rounded-md bg-[#123D2A] px-4 text-base font-semibold text-white">Show all equipment</button> : null}</div>}
      </div>
    </section>
  );
}

function CatalogSelect({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  const id = useId();
  return <div className="min-w-0"><label htmlFor={id} className="block text-sm font-semibold text-[#123D2A]">{label}</label><div className="relative mt-1.5"><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full min-w-0 appearance-none truncate rounded-lg border border-[#C8D9C8] bg-[#F7FAF5] pl-3 pr-9 text-base text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/15">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#1F6B43]" /></div></div>;
}
