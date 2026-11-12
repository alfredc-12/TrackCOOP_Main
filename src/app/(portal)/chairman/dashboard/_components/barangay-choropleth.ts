import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { BATANGAS_MUNICIPALITIES, normalizeMunicipality } from "../../../../../lib/batangas-municipalities";

export type BarangayProperties = { adm4_en: string; adm4_psgc: number | string; adm3_psgc: number; adm2_psgc: number; municipality?: string };
export type BarangayBoundary = Feature<Polygon | MultiPolygon, BarangayProperties>;
export type BarangayBoundaries = FeatureCollection<Polygon | MultiPolygon, BarangayProperties>;
export type BarangayMembers = { barangay: string; municipality?: string | null; province?: string | null; totalMembers: number; sectorCounts?: { sector: string; count: number }[] };
export type HeatBin = { min: number; max: number; color: string };

export const zeroMemberColor = "#eef2ec";
const heatColors = ["#e3f7e7", "#82e6a7", "#4d8f5b", "#1f6b43", "#123d2a"];
const count = (value: number) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;

export function normalizeBarangayName(value: string) {
  const name = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
    .replace(/\(\s*poblacion\s*\)/g, " ").replace(/^(?:barangay|baranggay|brgy|brg)\.?(?=\s|\d|$)\s*/i, "")
    .replace(/[.,-]/g, " ").replace(/\s+/g, " ").trim();
  const numbered = /^(?:poblacion\s*)?(\d{1,2})(?:\s*poblacion)?$/.exec(name);
  if (numbered) return String(Number(numbered[1]));
  if (name === "munting indang") return "munting indan";
  return name;
}

export function isBarangayBoundaries(value: unknown): value is BarangayBoundaries {
  if (!value || typeof value !== "object" || !("type" in value) || value.type !== "FeatureCollection" || !("features" in value) || !Array.isArray(value.features) || value.features.length === 0) return false;
  return value.features.every((feature) => feature?.type === "Feature" &&
    ["Polygon", "MultiPolygon"].includes(feature.geometry?.type) && Array.isArray(feature.geometry?.coordinates) &&
    typeof feature.properties?.adm4_en === "string" && feature.properties.adm4_en.trim() &&
    feature.properties.adm4_psgc != null && Number(feature.properties.adm2_psgc) === 401000000 &&
    BATANGAS_MUNICIPALITIES[Number(feature.properties.adm3_psgc)] != null);
}

export function boundaryMunicipality(feature: BarangayBoundary) {
  return BATANGAS_MUNICIPALITIES[Number(feature.properties.adm3_psgc)];
}

export function boundaryLabel(feature: BarangayBoundary) {
  return `${feature.properties.adm4_en}, ${boundaryMunicipality(feature)}`;
}

export function resolveBarangayId(boundaries: BarangayBoundaries, row: Pick<BarangayMembers, "barangay" | "municipality" | "province">) {
  if (row.province?.trim() && normalizeMunicipality(row.province) !== "batangas") return undefined;
  const matches = boundaries.features.filter(feature =>
    normalizeBarangayName(feature.properties.adm4_en) === normalizeBarangayName(row.barangay) &&
    (!row.municipality?.trim() || normalizeMunicipality(boundaryMunicipality(feature)) === normalizeMunicipality(row.municipality)));
  // Never copy a name-only count to multiple municipalities.
  return matches.length === 1 ? String(matches[0].properties.adm4_psgc) : undefined;
}

export function createHeatBins(maximum: number): HeatBin[] {
  const max = count(maximum);
  if (!max) return [];
  const length = Math.min(5, max);
  let minimum = 1;
  return Array.from({ length }, (_, index) => {
    const upper = Math.ceil(((index + 1) * max) / length);
    const colorIndex = length === 1 ? 4 : Math.round(index * 4 / (length - 1));
    const bin = { min: minimum, max: upper, color: heatColors[colorIndex] };
    minimum = upper + 1;
    return bin;
  });
}

export function barangayFill(totalMembers: number, bins: HeatBin[]) {
  const total = count(totalMembers);
  return total ? bins.find((bin) => total <= bin.max)?.color ?? heatColors[4] : zeroMemberColor;
}

export function joinBarangayMembers(boundaries: BarangayBoundaries, demographics: BarangayMembers[]) {
  const members = new Map<string, { totalMembers: number; sectors: Map<string, number> }>();
  const sectorNames = new Set<string>();
  for (const row of demographics) {
    const key = resolveBarangayId(boundaries, row);
    if (!key) continue;
    const aggregate = members.get(key) ?? { totalMembers: 0, sectors: new Map<string, number>() };
    aggregate.totalMembers += count(row.totalMembers);
    for (const sector of row.sectorCounts ?? []) {
      sectorNames.add(sector.sector);
      aggregate.sectors.set(sector.sector, (aggregate.sectors.get(sector.sector) ?? 0) + count(sector.count));
    }
    members.set(key, aggregate);
  }
  const sectors = [...sectorNames];
  const nameCounts = new Map<string, number>();
  for (const feature of boundaries.features) {
    const name = normalizeBarangayName(feature.properties.adm4_en);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const areas = boundaries.features.map((feature) => {
    const aggregate = members.get(String(feature.properties.adm4_psgc));
    return {
      feature,
      id: String(feature.properties.adm4_psgc),
      barangay: feature.properties.adm4_en,
      municipality: boundaryMunicipality(feature),
      label: boundaryLabel(feature),
      canDrilldown: nameCounts.get(normalizeBarangayName(feature.properties.adm4_en)) === 1,
      totalMembers: aggregate?.totalMembers ?? 0,
      sectorCounts: sectors.map((sector) => ({ sector, count: aggregate?.sectors.get(sector) ?? 0 })),
    };
  });
  const unmapped = demographics.filter((row) => !resolveBarangayId(boundaries, row));
  const maximum = Math.max(0, ...areas.map((area) => area.totalMembers));
  return { areas, bins: createHeatBins(maximum), unmapped, mappedMembers: areas.reduce((total, area) => total + area.totalMembers, 0) };
}

export type BarangayArea = ReturnType<typeof joinBarangayMembers>["areas"][number];
