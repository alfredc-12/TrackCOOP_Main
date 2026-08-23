export const requestSources = ["Member Portal", "Public Website", "Admin Entry"] as const;
export const requestTypes = [
  "Membership",
  "Payment",
  "Share Capital",
  "Rental",
  "Product/POS",
  "Document",
  "General",
] as const;
export const requestPriorities = ["Low", "Normal", "High", "Urgent"] as const;
export const requestStatuses = [
  "Submitted",
  "Under Review",
  "Assigned",
  "In Progress",
  "Waiting for Information",
  "Resolved",
  "Closed",
  "Rejected",
  "Cancelled",
] as const;

export type RequestSource = (typeof requestSources)[number];
export type RequestType = (typeof requestTypes)[number];
export type RequestPriority = (typeof requestPriorities)[number];
export type RequestStatus = (typeof requestStatuses)[number];

export type RequestRecord = {
  id: string;
  referenceCode: string;
  memberId: string | null;
  submittedBy: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  requestSource: RequestSource;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requesterBarangay: string | null;
  preferredContactMethod: "Email" | "Phone" | "SMS" | "Other" | null;
  requestType: RequestType;
  requestedService: string | null;
  preferredSchedule: string | null;
  subject: string | null;
  message: string;
  priority: RequestPriority;
  requestStatus: RequestStatus;
  adminNotes: string | null;
  publicResponse: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  submittedAt: string;
  updatedAt: string;
  isReadByAdmin: boolean;
  isReadByMember: boolean;
  replyCount?: number;
};

export type ListRequestsQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  requestType?: string;
  priority?: string;
  assignedTo?: string;
  sortBy: "submittedAt" | "resolvedAt" | "priority" | "requestStatus";
  sortDirection: "asc" | "desc";
};

export type ListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type RequestStatusHistoryRecord = {
  id: string;
  requestId: string;
  oldStatus: RequestStatus | null;
  newStatus: RequestStatus;
  internalNote: string | null;
  userVisibleMessage: string | null;
  changedBy: string;
  changedByName: string | null;
  changedAt: string;
};

export type UpdateRequestStatusInput = {
  requestStatus: RequestStatus;
  assignedTo?: string | null;
  adminNotes?: string | null;
  publicResponse?: string | null;
};

export type BaseRequestInput = {
  requesterName?: string | null;
  requesterEmail?: string | null;
  requesterPhone?: string | null;
  requesterBarangay?: string | null;
  preferredContactMethod?: "Email" | "Phone" | "SMS" | "Other" | null;
  requestType: RequestType;
  requestedService?: string | null;
  preferredSchedule?: string | null;
  subject?: string | null;
  message: string;
  priority?: RequestPriority;
};

export type CreatePublicRequestInput = BaseRequestInput & {
  consent: true;
};

export type CreateAuthenticatedRequestInput = BaseRequestInput & {
  memberId?: string | null;
};
