import type { RentalService } from "../_types/rental";

export type RentalCatalogFilters = {
  search: string;
  category: string;
  availability: string;
  rentalUnit: string;
  activity: string;
  area: string;
  sort: string;
};

export const emptyRentalCatalogFilters: RentalCatalogFilters = {
  search: "", category: "", availability: "", rentalUnit: "", activity: "", area: "", sort: "recommended",
};

export function rentalSearchText(value: string) {
  return value.replace(/<[^>]*>/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isRentalBookable(service: RentalService) {
  return service.availability !== "Unavailable" && !["Under Maintenance", "Out of Service", "Archived"].includes(service.operationalStatus);
}

export function rentalUnitLabel(value: string) {
  const unit = rentalSearchText(value).replace(/^per /, "");
  const labels: Record<string, string> = { day: "Per day", daily: "Per day", hour: "Per hour", hourly: "Per hour", use: "Per use", trip: "Per trip", hectare: "Per hectare" };
  return labels[unit] ?? value.trim();
}

export function filterRentalCatalog(services: RentalService[], filters: RentalCatalogFilters) {
  const terms = rentalSearchText(filters.search).split(" ").filter(Boolean);
  const matches = services.filter((service) => {
    const searchable = rentalSearchText([service.name, service.publicTitle, service.description, service.shortDescription, service.publicDescription, service.category, service.suitableActivity, service.serviceArea, service.unitOfUsage, service.capacity].filter(Boolean).join(" "));
    if (!terms.every((term) => searchable.includes(term))) return false;
    if (filters.category && service.category.trim() !== filters.category) return false;
    if (filters.activity && service.suitableActivity.trim() !== filters.activity) return false;
    if (filters.area && service.serviceArea.trim() !== filters.area) return false;
    if (filters.rentalUnit && rentalUnitLabel(service.unitOfUsage) !== filters.rentalUnit) return false;
    if (filters.availability === "bookable" && !isRentalBookable(service)) return false;
    if (filters.availability === "unavailable" && isRentalBookable(service)) return false;
    if (["Available", "Limited Availability", "By Schedule Only"].includes(filters.availability) && (!isRentalBookable(service) || service.availability !== filters.availability)) return false;
    return true;
  });
  const nameOf = (service: RentalService) => service.publicTitle || service.name;
  const nameCompare = (a: RentalService, b: RentalService) => nameOf(a).localeCompare(nameOf(b), "en", { numeric: true, sensitivity: "base" }) || a.serviceId.localeCompare(b.serviceId);
  const relevance = (service: RentalService) => {
    const name = rentalSearchText(nameOf(service));
    return terms.reduce((score, term) => score + (name.startsWith(term) ? 3 : name.includes(term) ? 2 : 0), 0);
  };
  return matches.sort((a, b) => {
    if (filters.sort === "name-asc") return nameCompare(a, b);
    if (filters.sort === "name-desc") return -nameCompare(a, b);
    const availability = Number(isRentalBookable(b)) - Number(isRentalBookable(a));
    if (filters.sort === "availability") return availability || nameCompare(a, b);
    return relevance(b) - relevance(a) || availability || Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || nameCompare(a, b);
  });
}
