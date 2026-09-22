import { apiRequest } from "@/lib/api-client";

export type LandingCollection =
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

export async function uploadPartnerCertificationFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<{ url: string; originalName: string; mimeType: string }>("/api/landing/partners/upload", {
    method: "POST",
    body: formData,
  });
}

export async function uploadGalleryImages(files: File[]) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }
  return apiRequest<{
    url: string;
    urls: string[];
    files: Array<{ url: string; originalName: string; mimeType: string }>;
  }>("/api/landing/gallery/upload", {
    method: "POST",
    body: formData,
  });
}

export async function saveGalleryLandingSlot(
  slotKey: string,
  input: { galleryGroupId?: string | null; galleryImageId?: string | null; displayOrder: number },
) {
  return apiRequest<LandingRecord>(`/api/landing/gallery-slots/${encodeURIComponent(slotKey)}`, {
    method: "PUT",
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
