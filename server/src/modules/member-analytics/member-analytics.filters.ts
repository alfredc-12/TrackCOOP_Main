import { z } from "zod";
import { AppError } from "../../utils/app-error";
import { ANALYTICS_SECTORS, ENGAGEMENT_LABELS, type AnalyticsFilters } from "./member-analytics.types";

export function localDate(value: string | Date) {
  return new Date(new Date(value).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}
export function addDays(date: string, days: number) {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
export function endExclusive(date: string) { return new Date(`${addDays(date, 1)}T00:00:00+08:00`).toISOString(); }
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const list = z.preprocess(v => typeof v === "string" ? v.split("|").filter(Boolean) : v ?? [], z.array(z.string().max(120)).max(50));
export const capitalStages = ["Zero balance", "Below required", "Required to maximum", "At maximum", "Above maximum", "Unknown ledger"];
export function parseAnalyticsFilters(query: Record<string, unknown>, now = new Date()): AnalyticsFilters {
  const today = localDate(now);
  const parsed = z.object({
    start: dateSchema.default(`${today.slice(0, 4)}-01-01`), end: dateSchema.default(today), asOf: dateSchema.default(today),
    barangays: list, sectors: list.refine(v => v.every(s => (ANALYTICS_SECTORS as readonly string[]).includes(s))),
    membershipType: z.enum(["", "Associate", "True Member"]).default(""),
    engagement: z.enum(["", ...ENGAGEMENT_LABELS]).default(""),
    officialStatus: z.enum(["", "Pending", "Active", "Inactive", "Suspended", "Terminated"]).default(""),
    capitalStage: z.string().refine(v => !v || capitalStages.includes(v)).default(""),
    source: z.enum(["", "Public Website", "Chairman Entry", "Imported Paper Form"]).default(""),
  }).safeParse(query);
  if (!parsed.success) throw new AppError("Invalid analytics filters", 400, "VALIDATION_ERROR");
  const f = parsed.data;
  if (f.start > f.end || f.end > f.asOf || f.asOf > today || daysBetween(f.start, f.end) > 3660 || f.start < "1900-01-01") {
    throw new AppError("Use a reporting range of at most ten years ending on or before the as-of date; future snapshots are unavailable", 400, "VALIDATION_ERROR");
  }
  return f;
}
export function normalizeBarangay(value: string | null) {
  const normalized = (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\(\s*poblacion\s*\)/g, "").replace(/^(?:barangay|baranggay|brgy|brg)\.?(?=\s|\d|$)\s*/, "").replace(/[^a-z0-9]/g, "");
  if (/^(?:poblacion)?\d+$/.test(normalized)) return `poblacion${Number(normalized.replace("poblacion", ""))}`;
  return normalized === "muntingindang" ? "muntingindan" : normalized;
}
