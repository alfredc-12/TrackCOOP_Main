import { apiRequest, apiPaginatedRequest } from "@/lib/api-client";
import type {
  ListRequestsQuery,
  ListResult,
  RequestRecord,
  UpdateRequestStatusInput,
  CreatePublicRequestInput,
  CreateAuthenticatedRequestInput,
  RequestStatusHistoryRecord,
} from "./communication-types";

export type RequestDetailResponse = {
  request: RequestRecord;
  history: RequestStatusHistoryRecord[];
};

export async function listRequests(query: ListRequestsQuery): Promise<ListResult<RequestRecord>> {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(query.page));
  searchParams.set("pageSize", String(query.pageSize));
  searchParams.set("sortBy", query.sortBy);
  searchParams.set("sortDirection", query.sortDirection);
  
  if (query.search) searchParams.set("search", query.search);
  if (query.status && query.status !== "All") searchParams.set("status", query.status);
  if (query.requestType && query.requestType !== "All") searchParams.set("requestType", query.requestType);
  if (query.priority && query.priority !== "All") searchParams.set("priority", query.priority);
  if (query.assignedTo) searchParams.set("assignedTo", query.assignedTo);

  const response = await apiPaginatedRequest<RequestRecord[]>(
    `/api/requests?${searchParams.toString()}`
  );
  
  return {
    items: response.items,
    total: (response.meta.total as number) ?? 0,
    page: (response.meta.page as number) ?? 1,
    pageSize: (response.meta.pageSize as number) ?? 20,
  };
}

export async function getRequestDetail(id: string): Promise<RequestDetailResponse> {
  return apiRequest<RequestDetailResponse>(`/api/requests/${id}`);
}

export async function updateRequestStatus(id: string, input: UpdateRequestStatusInput): Promise<RequestDetailResponse> {
  return apiRequest<RequestDetailResponse>(
    `/api/requests/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export async function createPublicRequest(input: CreatePublicRequestInput): Promise<RequestRecord> {
  return apiRequest<RequestRecord>("/api/requests/public", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function trackPublicRequest(referenceCode: string): Promise<RequestDetailResponse> {
  return apiRequest<RequestDetailResponse>(`/api/requests/track/${referenceCode}`);
}

export async function createAuthenticatedRequest(input: CreateAuthenticatedRequestInput): Promise<RequestRecord> {
  return apiRequest<RequestRecord>("/api/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addRequestReply(id: string, message: string): Promise<RequestDetailResponse> {
  return apiRequest<RequestDetailResponse>(
    `/api/requests/${id}/reply`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    }
  );
}

export async function addPublicRequestReply(referenceCode: string, message: string): Promise<RequestDetailResponse> {
  return apiRequest<RequestDetailResponse>(
    `/api/requests/track/${referenceCode}/reply`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    }
  );
}

