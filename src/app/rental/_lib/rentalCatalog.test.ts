import assert from "node:assert/strict";
import { test } from "node:test";
import type { RentalService } from "../_types/rental";
import { emptyRentalCatalogFilters, filterRentalCatalog, rentalUnitLabel } from "./rentalCatalog";

function service(overrides: Partial<RentalService>): RentalService {
  return { serviceId: "default", name: "Equipment", category: "Farm Machinery", description: "Agricultural equipment", shortDescription: "Farm equipment", imageUrls: [], availability: "Available", operationalStatus: "Ready for Use", visibility: "Public", unitOfUsage: "Per Day", suitableActivity: "Field preparation", capacity: "75 HP", serviceArea: "Nasugbu", operatorRequirement: "Confirm operator", operationalNotes: "", safetyReminders: [], upcomingBookings: 0, updatedAt: "2026-11-01T00:00:00.000Z", ...overrides };
}
const rows = [
  service({ serviceId: "tractor", name: "Four-Wheel Tractor", publicTitle: "Tráctor 75 HP", serviceArea: "Nasugbu North" }),
  service({ serviceId: "pump", name: "Water pump", category: "Irrigation", suitableActivity: "Water delivery", availability: "By Schedule Only", unitOfUsage: "day", serviceArea: "Nasugbu South" }),
  service({ serviceId: "hall", name: "Meeting Hall", category: "Facility", suitableActivity: "Meetings", unitOfUsage: "Per Use" }),
  service({ serviceId: "repair", name: "Repair Tractor", availability: "Available", operationalStatus: "Under Maintenance" }),
];

test("search supports multiple words, public/internal names, punctuation, accents and service areas", () => {
  assert.deepEqual(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, search: "  tractor NORTH 75 " }).map((row) => row.serviceId), ["tractor"]);
  assert.deepEqual(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, search: "four wheel" }).map((row) => row.serviceId), ["tractor"]);
  assert.deepEqual(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, search: "water south" }).map((row) => row.serviceId), ["pump"]);
  assert.equal(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, search: "pump north" }).length, 0);
});

test("booking status excludes maintenance even when the availability flag says Available", () => {
  assert.deepEqual(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, availability: "Available" }).map((row) => row.serviceId).sort(), ["hall", "tractor"]);
  assert.deepEqual(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, availability: "unavailable" }).map((row) => row.serviceId), ["repair"]);
  assert.deepEqual(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, availability: "By Schedule Only" }).map((row) => row.serviceId), ["pump"]);
});

test("rental units normalize aliases and combine with category, activity and service area", () => {
  assert.equal(rentalUnitLabel("day"), "Per day");
  assert.equal(rentalUnitLabel("Per Day"), "Per day");
  assert.deepEqual(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, rentalUnit: "Per day", availability: "bookable" }).map((row) => row.serviceId).sort(), ["pump", "tractor"]);
  assert.deepEqual(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, category: "Irrigation", rentalUnit: "Per day", activity: "Water delivery", area: "Nasugbu South" }).map((row) => row.serviceId), ["pump"]);
});

test("sort is deterministic, matches the displayed public name, and does not mutate the catalog", () => {
  const order = rows.map((row) => row.serviceId);
  assert.deepEqual(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, sort: "name-asc" }).map((row) => row.serviceId), ["hall", "repair", "tractor", "pump"]);
  assert.equal(filterRentalCatalog(rows, { ...emptyRentalCatalogFilters, sort: "availability" }).at(-1)?.serviceId, "repair");
  assert.deepEqual(rows.map((row) => row.serviceId), order);
  const ties = [service({ serviceId: "b", name: "Pump" }), service({ serviceId: "a", name: "Pump" })];
  assert.deepEqual(filterRentalCatalog(ties, emptyRentalCatalogFilters).map((row) => row.serviceId), ["a", "b"]);
});
