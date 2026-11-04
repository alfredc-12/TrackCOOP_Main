import { apiRequest, apiPaginatedRequest } from "@/lib/api-client";
import type {
  ActivityItem,
  ActivityDetail,
} from "../../../server/src/modules/audit-logs/activity.repository";
export type { ActivityItem, ActivityDetail };
export type ActivityOptions = {
  categories: Array<{ id: string; label: string }>;
  users: Array<{ id: string; name: string }>;
  usersTruncated: boolean;
};
export const getActivity = (query: URLSearchParams, signal?: AbortSignal) =>
  apiPaginatedRequest<ActivityItem[]>(`/api/audit-logs?${query}`, { signal });
export const getActivityOptions = (search = "", signal?: AbortSignal) =>
  apiRequest<ActivityOptions>(
    `/api/audit-logs/options?${new URLSearchParams({ search })}`,
    { signal },
  );
export const getActivityDetail = (id: string, signal?: AbortSignal) =>
  apiRequest<ActivityDetail>(`/api/audit-logs/${encodeURIComponent(id)}`, {
    signal,
  });
export function localTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time not recorded"
    : new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(date);
}
