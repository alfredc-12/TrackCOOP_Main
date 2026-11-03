"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { apiRequest } from "@/lib/api-client";
import { env } from "@/config/env";
import type {
  OverviewRepository,
  OverviewReport,
  ActivityRecord,
  CategoryTotal,
  SourceTotal,
  TrendPoint,
} from "../../../server/src/modules/financial-overview/overview.repository";
export type {
  OverviewReport,
  ActivityRecord,
  CategoryTotal,
  SourceTotal,
  TrendPoint,
};
export type ActivityPage = Awaited<ReturnType<OverviewRepository["activity"]>>;
export type RecordDetail = Awaited<ReturnType<OverviewRepository["detail"]>>;
export type OverviewOptions = {
  categories: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    active: boolean;
  }>;
  actors: Array<{ id: string; name: string }>;
  seasons: Array<{ id: string; name: string }>;
  capabilities: { seasons: boolean };
};
export type Query = Record<string, string>;
export const defaults: Query = {
  period: "this_month",
  compare: "previous",
  view: "posted",
  granularity: "month",
  page: "1",
  pageSize: "10",
  sortBy: "date",
  sortDirection: "desc",
};
const listen = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  window.addEventListener("overview-query", cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener("overview-query", cb);
  };
};
const current = () => window.location.search;
const activityKeys = [
  "view",
  "posting",
  "recordStatus",
  "sortBy",
  "sortDirection",
  "page",
  "pageSize",
  "focusCategoryId",
  "focusSource",
  "focusStart",
  "focusEnd",
  "reviewKind",
];
export function useOverviewQuery() {
  const search = useSyncExternalStore(listen, current, () => "");
  const query = useMemo(
    () => ({ ...defaults, ...Object.fromEntries(new URLSearchParams(search)) }),
    [search],
  );
  const apply = (next: Query) => {
    const p = new URLSearchParams(
      Object.entries(next).filter(([, v]) => v !== ""),
    );
    window.history.pushState(null, "", `${window.location.pathname}?${p}`);
    window.dispatchEvent(new Event("overview-query"));
  };
  return {
    query,
    apply,
    patch: (patch: Query) =>
      apply({ ...query, ...patch, page: patch.page ?? "1" }),
    reset: () => apply(defaults),
  };
}
export function useOverviewData<T>(
  endpoint: string,
  query: Query,
  revision = 0,
) {
  const params = useMemo(
    () =>
      new URLSearchParams(
        Object.entries(query).filter(
          ([k, v]) =>
            v !== "" && (endpoint !== "summary" || !activityKeys.includes(k)),
        ),
      ).toString(),
    [query, endpoint],
  );
  const key = `${params}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<T>(`/api/financial-overview/${endpoint}?${params}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: "" });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setState((s) => ({
            ...s,
            key,
            error:
              e instanceof Error
                ? e.message
                : "Financial records could not be loaded.",
          }));
      });
    return () => controller.abort();
  }, [endpoint, params, key]);
  return {
    data: state.data,
    error: state.key === key ? state.error : "",
    loading: state.key !== key,
  };
}
export async function exportOverview(query: Query, format: "pdf" | "xlsx") {
  const response = await fetch(
    `${env.apiUrl}/api/financial-overview/export?${new URLSearchParams({ ...query, format })}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Financial Overview export failed.");
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `trackcoop-financial-overview.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
export const rangeText = (r: {
  startDate: string | null;
  endDate: string | null;
}) => `${r.startDate ?? "All time"} – ${r.endDate ?? "present"}`;
export const count = (n: number | undefined) =>
  n === undefined ? "—" : n.toLocaleString("en-PH");
export const sourceLink = (r: ActivityRecord) =>
  r.paymentReferenceId
    ? `/portal/chairman/payments?paymentId=${r.paymentReferenceId}`
    : r.source === "POS"
      ? "/portal/chairman/pos"
      : r.source === "Rental"
        ? "/portal/chairman/rentals/bookings"
        : null;
