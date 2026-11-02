"use client";

import { env } from "@/config/env";
import { apiRequest } from "@/lib/api-client";
import type {
  RfmFilters,
  RfmHistory,
  RfmMemberRow,
  RfmPreview,
  RfmRecalculationInput,
  RfmRecalculationResult,
  RfmRun,
  RfmSnapshotMetadata,
  RfmWorkspace,
} from "../../../server/src/modules/member-indicators/member-indicator.workspace-types";
export type {
  RfmFilters,
  RfmHistory,
  RfmMemberRow,
  RfmPreview,
  RfmRecalculationInput,
  RfmRecalculationResult,
  RfmRun,
  RfmSnapshotMetadata,
  RfmWorkspace,
};
export type {
  RfmComponent,
  RfmSettings,
} from "../../../server/src/modules/member-indicators/member-indicator.workspace-types";

export function defaultFilters(): RfmFilters {
  return {
    page: 1,
    pageSize: 10,
    context: "current",
    sortBy: "computedAt",
    sortDirection: "desc",
  };
}
const numericKeys = [
  "page",
  "pageSize",
  "minScore",
  "maxScore",
  "recencyScore",
  "frequencyScore",
  "contributionScore",
  "minRecency",
  "maxRecency",
  "minFrequency",
  "maxFrequency",
  "minContribution",
  "maxContribution",
];
const keys = [
  "page",
  "pageSize",
  "search",
  "classification",
  "context",
  "basisEnd",
  "runId",
  "membershipType",
  "officialStatus",
  "barangay",
  "sector",
  "version",
  "quality",
  "minScore",
  "maxScore",
  "recencyScore",
  "frequencyScore",
  "contributionScore",
  "minRecency",
  "maxRecency",
  "minFrequency",
  "maxFrequency",
  "minContribution",
  "maxContribution",
  "sortBy",
  "sortDirection",
];
export function filtersFromParams(params: URLSearchParams): RfmFilters {
  const values: Record<string, unknown> = { ...defaultFilters() };
  keys.forEach((key) => {
    const value = params.get(key);
    if (value) values[key] = numericKeys.includes(key) ? Number(value) : value;
  });
  return values as RfmFilters;
}
export function rfmParams(filters: RfmFilters) {
  const params = new URLSearchParams();
  keys.forEach((key) => {
    const value = filters[key as keyof RfmFilters];
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params;
}
const path = "/api/member-indicators/workspace";
export function getWorkspace(filters: RfmFilters, signal?: AbortSignal) {
  return apiRequest<RfmWorkspace>(`${path}?${rfmParams(filters)}`, { signal });
}
export function getHistory(id: string, page = 1, signal?: AbortSignal) {
  return apiRequest<RfmHistory>(
    `${path}/${id}/history?page=${page}&pageSize=50`,
    { signal },
  );
}
export function getEvidence(row: RfmMemberRow, signal?: AbortSignal) {
  return apiRequest<{ metadata: RfmSnapshotMetadata | null; message: string }>(
    `${path}/${row.memberId}/evidence/${row.indicatorId}`,
    { signal },
  );
}
export function getRuns(page: number, signal?: AbortSignal) {
  return apiRequest<{ rows: RfmRun[]; total: number }>(
    `${path}/runs?page=${page}&pageSize=20`,
    { signal },
  );
}
export function previewCalculation(input: RfmRecalculationInput) {
  return apiRequest<RfmPreview>(`${path}/preview`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function commitCalculation(
  input: RfmRecalculationInput,
  previewFingerprint: string,
) {
  return apiRequest<RfmRecalculationResult>(`${path}/recalculate`, {
    method: "POST",
    body: JSON.stringify({ ...input, previewFingerprint, confirmed: true }),
  });
}
export async function downloadRfm(filters: RfmFilters, memberId?: string) {
  const response = await fetch(
    `${env.apiUrl}${path}${memberId ? `/${memberId}/history/export` : `/export?${rfmParams(filters)}`}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message ??
        "The Excel report could not be created. Retry the export.",
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = memberId
    ? "member-rfm-history.xlsx"
    : "member-indicators.xlsx";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function todayInManila() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const number = (value: number | null, digits = 1) =>
  value === null
    ? "—"
    : value.toLocaleString("en-PH", { maximumFractionDigits: digits });
export const percent = (value: number | null) =>
  value === null ? "—" : `${number(value)}%`;
export const peso = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
      }).format(value);
export const date = (value: string | null) =>
  value
    ? new Date(
        value.length === 10 ? `${value}T00:00:00Z` : value,
      ).toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "The request failed. Please retry.";
export function memberLink(row: RfmMemberRow, filters: RfmFilters) {
  return `/portal/chairman/members?tab=directory&search=${encodeURIComponent(row.memberCode)}&rfmMemberId=${encodeURIComponent(row.memberId)}&rfmReturn=${encodeURIComponent(`/portal/chairman/member-indicators?${rfmParams(filters)}`)}`;
}
