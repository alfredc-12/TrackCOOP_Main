export const documentTypes = [
  "Receipt",
  "Certificate",
  "Waiver",
  "Financial Document",
  "Annual Plan",
  "Business Plan",
  "Agency Report",
  "Public Document",
  "Other",
] as const;

export const documentAccessLevels = [
  "Public",
  "Member-only",
  "Admin-only",
  "Bookkeeper-only",
] as const;

export const documentStatuses = ["Active", "Archived", "Replaced", "Restricted"] as const;
export const accessActions = ["View", "Download", "Print", "Replace", "Permission Change"] as const;

export const reportTypes = [
  "Financial Summary",
  "Transaction Ledger",
  "Share Capital Summary",
  "Payment Validation",
  "Rental",
  "POS Sales",
  "Inventory Movement",
  "Member Master List",
  "Member Engagement",
  "Barangay Distribution",
  "Documents",
  "Announcements",
  "Requests/Inquiries",
  "Audit Logs",
  "Other",
] as const;

export const reportStatuses = ["Queued", "Generated", "Failed", "Archived"] as const;

export const announcementAudiences = [
  "Public",
  "All Members",
  "Associate Members",
  "True Members",
  "Role",
  "Barangay",
  "Selected Users",
] as const;

export const announcementStatuses = [
  "Draft",
  "Scheduled",
  "Published",
  "Archived",
  "Cancelled",
] as const;

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

export const notificationTypes = [
  "Announcement",
  "Payment",
  "Share Capital",
  "Rental",
  "POS",
  "Document",
  "Request",
  "System",
] as const;

export type DocumentType = (typeof documentTypes)[number];
export type DocumentAccessLevel = (typeof documentAccessLevels)[number];
export type DocumentStatus = (typeof documentStatuses)[number];
export type AccessAction = (typeof accessActions)[number];
export type ReportType = (typeof reportTypes)[number];
export type ReportStatus = (typeof reportStatuses)[number];
export type AnnouncementAudience = (typeof announcementAudiences)[number];
export type AnnouncementStatus = (typeof announcementStatuses)[number];
export type RequestSource = (typeof requestSources)[number];
export type RequestType = (typeof requestTypes)[number];
export type RequestPriority = (typeof requestPriorities)[number];
export type RequestStatus = (typeof requestStatuses)[number];
export type NotificationType = (typeof notificationTypes)[number];

export type PageQuery<TSortBy extends string> = {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: TSortBy;
  sortDirection: "asc" | "desc";
};

export type DocumentRecord = {
  id: string;
  uploadedBy: string;
  uploaderName: string | null;
  memberId: string | null;
  title: string;
  documentType: DocumentType;
  accessLevel: DocumentAccessLevel;
  documentStatus: DocumentStatus;
  filePath: string;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  replacementOfDocumentId: string | null;
  description: string | null;
  uploadedAt: Date;
  updatedAt: Date;
};

export type ReportRecord = {
  id: string;
  reportNumber: string;
  generatedBy: string;
  generatorName: string | null;
  documentId: string | null;
  reportType: ReportType;
  reportPeriodStart: Date | null;
  reportPeriodEnd: Date | null;
  reportPeriodLabel: string | null;
  filters: unknown;
  generationStatus: ReportStatus;
  filePath: string | null;
  generatedAt: Date;
};

export type AnnouncementRecord = {
  id: string;
  postedBy: string;
  posterName: string | null;
  title: string;
  slug: string | null;
  message: string;
  excerpt: string | null;
  audienceType: AnnouncementAudience;
  audienceValue: string | null;
  announcementStatus: AnnouncementStatus;
  featuredImagePath: string | null;
  publishAt: Date | null;
  expiresAt: Date | null;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isAcknowledged?: boolean;
  acknowledgmentCount?: number;
};

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
  preferredSchedule: Date | null;
  subject: string | null;
  message: string;
  priority: RequestPriority;
  requestStatus: RequestStatus;
  adminNotes: string | null;
  publicResponse: string | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  submittedAt: Date;
  updatedAt: Date;
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
  changedAt: Date;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};
