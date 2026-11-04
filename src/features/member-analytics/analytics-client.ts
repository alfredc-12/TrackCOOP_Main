import type { AnalyticsFilters, AnalyticsResult, AnalyticsSelection } from "../../../server/src/modules/member-analytics/member-analytics.types";
import { apiPaginatedRequest, apiRequest } from "@/lib/api-client";
import { env } from "@/config/env";
import type { MemberListQuery, MemberProfile } from "@/features/chairman/people-api";
export type { AnalyticsFilters, AnalyticsResult, AnalyticsSelection };
export const sectors = ["Rice", "Corn", "Fishery", "Livestock", "High-value crops (gulayan)"];
export const labels = ["Active", "Needs Monitoring", "Inactive", "Not Yet Scored"];
export const stages = ["Zero balance", "Below required", "Required to maximum", "At maximum", "Above maximum", "Unknown ledger"];
export function defaultAnalyticsFilters(today: string): AnalyticsFilters {
  return { start: `${today.slice(0, 4)}-01-01`, end: today, asOf: today, barangays: [], sectors: [], membershipType: "", engagement: "", officialStatus: "", capitalStage: "", source: "" };
}
export function filtersFromParams(params: URLSearchParams, today: string): AnalyticsFilters {
  const result = defaultAnalyticsFilters(today);
  for (const key of Object.keys(result) as Array<keyof AnalyticsFilters>) {
    const value = params.get(key);
    if (value !== null) { if (key === "barangays" || key === "sectors") result[key] = value.split("|").filter(Boolean); else result[key] = value; }
  }
  return result;
}
export function analyticsParams(filters: AnalyticsFilters, selection: AnalyticsSelection = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { const text = Array.isArray(value) ? value.join("|") : value; if (text) params.set(key, text); });
  if (selection.kind) params.set("selection", selection.kind);
  if (selection.value) params.set("value", selection.value);
  if (selection.sector) params.set("cellSector", selection.sector);
  return params;
}
export function analyticsMemberLink(filters: AnalyticsFilters, selection: AnalyticsSelection = {}) {
  const params = analyticsParams(filters, selection);
  params.set("tab", "directory"); params.set("analytics", "1");
  return `/portal/chairman/members?${params}`;
}
export function getMemberAnalytics(filters: AnalyticsFilters, signal?: AbortSignal) {
  return apiRequest<AnalyticsResult>(`/api/chairman/member-analytics?${analyticsParams(filters)}`, { signal });
}
export async function getAnalyticsMembers(context: string, query: MemberListQuery) {
  const params = new URLSearchParams(context);
  const directoryKeys: Record<string, string> = { membershipType: "directoryMembershipType", barangay: "directoryBarangay", approvalStatus: "directoryApprovalStatus", officialMemberStatus: "directoryOfficialStatus" };
  Object.entries(query).forEach(([key, value]) => { const parameter = directoryKeys[key] ?? key; if (value !== undefined && value !== "All" && value !== "") params.set(parameter, String(value)); else params.delete(parameter); });
  const result = await apiPaginatedRequest<MemberProfile[]>(`/api/chairman/member-analytics/matching-members?${params}`);
  return { members: result.items, total: Number(result.meta.total), page: Number(result.meta.page), pageSize: Number(result.meta.pageSize) };
}
export async function downloadAnalytics(filters: AnalyticsFilters) {
  const response = await fetch(`${env.apiUrl}/api/chairman/member-analytics/export?${analyticsParams(filters)}`, { credentials: "include" });
  if (!response.ok) throw new Error("The analytics export could not be created. Please try again.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = `member-analytics-${filters.asOf}.xlsx`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const formatNumber = (n: number | null) => n === null ? "N/A" : n.toLocaleString("en-PH", { maximumFractionDigits: 1 });
export const percent = (n: number | null) => n === null ? "N/A" : `${formatNumber(n)}%`;
export const peso = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);
export function compareAnalyticsCells(a: unknown, b: unknown) {
  const numeric = (value: unknown) => typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.replace(/[₱,%\s]/g, "")) : NaN;
  const first = numeric(a), second = numeric(b);
  return Number.isFinite(first) && Number.isFinite(second) ? first - second : String(a ?? "").localeCompare(String(b ?? ""), "en", { numeric: true });
}
