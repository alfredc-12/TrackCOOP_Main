import { apiRequest } from "@/lib/api-client";

export type LandingCollection =
  | "content-blocks"
  | "services"
  | "programs"
  | "partners"
  | "gallery";

export type LandingRecord = Record<string, unknown> & {
  id: string;
};

export async function listLandingRecords(collection: LandingCollection, search = "") {
  const params = new URLSearchParams({ pageSize: "100" });
  if (search.trim()) params.set("search", search.trim());
  return apiRequest<LandingRecord[]>(`/api/landing/${collection}?${params.toString()}`);
}

export async function createLandingRecord(collection: LandingCollection, input: Record<string, unknown>) {
  return apiRequest<LandingRecord>(`/api/landing/${collection}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateLandingRecord(collection: LandingCollection, id: string, input: Record<string, unknown>) {
  return apiRequest<LandingRecord>(`/api/landing/${collection}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function listSystemSettings(search = "") {
  const params = new URLSearchParams({ pageSize: "100" });
  if (search.trim()) params.set("search", search.trim());
  return apiRequest<LandingRecord[]>(`/api/system-settings?${params.toString()}`);
}

export async function saveSystemSetting(input: Record<string, unknown>) {
  return apiRequest<LandingRecord>("/api/system-settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function listAuditLogs(search = "") {
  const params = new URLSearchParams({ pageSize: "100" });
  if (search.trim()) params.set("search", search.trim());
  return apiRequest<LandingRecord[]>(`/api/audit-logs?${params.toString()}`);
}
