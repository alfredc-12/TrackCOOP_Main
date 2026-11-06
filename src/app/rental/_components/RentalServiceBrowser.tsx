"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useRental } from "../_context/RentalProvider";
import { RentalServiceCard } from "./RentalServiceCard";
import { RentalEmptyState, RentalErrorState, RentalLoadingState } from "./RentalStates";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { RentalPublicCatalog } from "./RentalPublicCatalog";
import { PaginationControls } from "@/components/portal/PortalPrimitives";

export function RentalServiceBrowser({ compact = false }: { compact?: boolean }) {
  const { services, loading, error, refreshServices } = useRental();
  const today = new Date().toISOString().slice(0, 10);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [availability, setAvailability] = useState("All availability");
  const [use, setUse] = useState("All intended uses");
  const [preferredDate, setPreferredDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const categories = useMemo(() => ["All categories", ...new Set(services.map((item) => item.category))], [services]);
  const uses = useMemo(() => ["All intended uses", ...new Set(services.map((item) => item.suitableActivity))], [services]);
  const filtered = services.filter((service) => {
    const text = `${service.name} ${service.category} ${service.description} ${service.suitableActivity}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (category === "All categories" || service.category === category) && (availability === "All availability" || service.availability === availability) && (use === "All intended uses" || service.suitableActivity === use);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleServices = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const resetPage = () => setPage(1);
  if (!compact) return <RentalPublicCatalog services={services} loading={loading} error={error} refresh={refreshServices} />;
  return <section aria-labelledby="rental-services-title" className={`mx-auto max-w-7xl ${compact ? "px-4 py-4 sm:px-5" : "px-4 py-12 sm:px-6"}`}><div className={`${compact ? "mb-4" : "mb-6"} flex items-end justify-between gap-4`}><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#497158]">Available services</p><h2 id="rental-services-title" className={`mt-1 ${compact ? "text-xl" : "text-3xl"} font-extrabold text-[#123d2a]`}>Find the right equipment</h2></div><span className="hidden text-sm font-semibold text-[#607067] sm:block">{filtered.length} service{filtered.length === 1 ? "" : "s"}</span></div><div className={`${compact ? "mb-4" : "mb-8"} grid gap-3 rounded-2xl border border-[#d8e4d3] bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5`}><label className="relative xl:col-span-2"><span className="sr-only">Search equipment</span><Search className="absolute left-3 top-3.5 size-4 text-[#6c7c72]" /><input value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} type="search" placeholder="Search equipment or activity" className="h-11 w-full rounded-xl border border-[#d5e1d0] pl-9 pr-3 text-sm outline-none focus:border-[#1f6b43] focus:ring-4 focus:ring-[#1f6b43]/10" /></label><FilterSelect label="Equipment category" value={category} onChange={(value) => { setCategory(value); resetPage(); }} options={categories} /><FilterSelect label="Availability" value={availability} onChange={(value) => { setAvailability(value); resetPage(); }} options={["All availability", "Available", "Limited Availability", "Unavailable", "By Schedule Only"]} /><FilterSelect label="Intended use" value={use} onChange={(value) => { setUse(value); resetPage(); }} options={uses} /><DatePicker label="Preferred date" value={preferredDate} min={today} max="2100-12-31" placeholder="Select preferred date" hideLabel triggerClassName="h-11 rounded-xl border-[#d5e1d0] bg-white text-[#53675a]" onChange={(value) => { setPreferredDate(value); resetPage(); }} /><p className="flex items-center gap-2 text-xs text-[#6c7c72] md:col-span-2 xl:col-span-4"><SlidersHorizontal className="size-4" />Preferred dates help guide an inquiry; NFFAC confirms final availability.</p></div>{loading ? <RentalLoadingState label="Loading rental services" /> : error ? <RentalErrorState message={error} retry={() => void refreshServices()} /> : filtered.length ? <><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visibleServices.map((service) => <RentalServiceCard key={service.serviceId} service={service} />)}</div><PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} itemName="services" onPageChange={setPage} pageSize={pageSize} pageSizeOptions={[6, 10, 20, 50]} onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }} className="mt-5 border-t border-[#d8e4d3] pt-4" /></> : <RentalEmptyState title="No equipment matches these filters" />}</section>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <div aria-label={label}><StyledSelect value={value} options={options} onChange={onChange} /> <span className="sr-only">{label}</span></div>;
}
