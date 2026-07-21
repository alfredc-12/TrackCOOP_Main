import { z } from "zod";
import {
  accessActions,
  announcementAudiences,
  announcementStatuses,
  documentAccessLevels,
  documentStatuses,
  documentTypes,
  notificationTypes,
  reportStatuses,
  reportTypes,
  requestPriorities,
  requestStatuses,
  requestTypes,
} from "./communication.types";

const optionalDateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .nullable()
  .optional();

const optionalDateTimeString = z
  .string()
  .trim()
  .max(40)
  .nullable()
  .optional();

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(190).optional(),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const listDocumentsQuerySchema = paginationSchema.extend({
  documentType: z.enum(documentTypes).optional(),
  accessLevel: z.enum(documentAccessLevels).optional(),
  status: z.enum(documentStatuses).optional(),
  sortBy: z.enum(["uploadedAt", "title", "documentType", "accessLevel"]).default("uploadedAt"),
});

export const createDocumentSchema = z.object({
  title: z.string().trim().min(2).max(255),
  documentType: z.enum(documentTypes),
  accessLevel: z.enum(documentAccessLevels),
  filePath: z.string().trim().min(1).max(500),
  memberId: z.string().trim().regex(/^\d+$/).nullable().optional(),
  originalFileName: z.string().trim().max(255).nullable().optional(),
  mimeType: z.string().trim().max(120).nullable().optional(),
  fileSizeBytes: z.coerce.number().int().nonnegative().nullable().optional(),
  checksumSha256: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{64}$/)
    .nullable()
    .optional(),
  replacementOfDocumentId: z.string().trim().regex(/^\d+$/).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
});

export const updateDocumentSchema = createDocumentSchema
  .partial()
  .extend({
    documentStatus: z.enum(documentStatuses).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one document field is required",
  });

export const documentAccessLogSchema = z.object({
  accessAction: z.enum(accessActions),
});

export const listReportsQuerySchema = paginationSchema.extend({
  reportType: z.enum(reportTypes).optional(),
  status: z.enum(reportStatuses).optional(),
  sortBy: z.enum(["generatedAt", "reportNumber", "reportType", "generationStatus"]).default("generatedAt"),
});

export const createReportSchema = z.object({
  reportNumber: z.string().trim().min(3).max(60).optional(),
  documentId: z.string().trim().regex(/^\d+$/).nullable().optional(),
  reportType: z.enum(reportTypes),
  reportPeriodStart: optionalDateString,
  reportPeriodEnd: optionalDateString,
  reportPeriodLabel: z.string().trim().max(120).nullable().optional(),
  filters: z.unknown().optional(),
  generationStatus: z.enum(reportStatuses).default("Generated"),
  filePath: z.string().trim().max(500).nullable().optional(),
});

export const archiveReportSchema = z.object({
  reason: z.string().trim().max(1000).nullable().optional(),
});

export const listAnnouncementsQuerySchema = paginationSchema.extend({
  audienceType: z.enum(announcementAudiences).optional(),
  status: z.enum(announcementStatuses).optional(),
  sortBy: z.enum(["createdAt", "publishAt", "title", "announcementStatus"]).default("createdAt"),
});

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(255),
  slug: z.string().trim().min(2).max(255).nullable().optional(),
  message: z.string().trim().min(1),
  excerpt: z.string().trim().max(500).nullable().optional(),
  audienceType: z.enum(announcementAudiences).default("Public"),
  audienceValue: z.string().trim().max(190).nullable().optional(),
  announcementStatus: z.enum(announcementStatuses).default("Draft"),
  featuredImagePath: z.string().trim().max(500).nullable().optional(),
  publishAt: optionalDateTimeString,
  expiresAt: optionalDateTimeString,
  recipientUserIds: z.array(z.string().trim().regex(/^\d+$/)).max(500).optional(),
});

export const updateAnnouncementSchema = createAnnouncementSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one announcement field is required",
  });

export const listRequestsQuerySchema = paginationSchema.extend({
  requestType: z.enum(requestTypes).optional(),
  status: z.enum(requestStatuses).optional(),
  priority: z.enum(requestPriorities).optional(),
  assignedTo: z.string().trim().regex(/^\d+$/).optional(),
  sortBy: z.enum(["submittedAt", "priority", "requestStatus", "requestType"]).default("submittedAt"),
});

const baseRequestSchema = z.object({
  requesterName: z.string().trim().max(190).nullable().optional(),
  requesterEmail: z.email().max(190).nullable().optional(),
  requesterPhone: z.string().trim().max(40).nullable().optional(),
  requesterBarangay: z.string().trim().max(120).nullable().optional(),
  preferredContactMethod: z.enum(["Email", "Phone", "SMS", "Other"]).nullable().optional(),
  requestType: z.enum(requestTypes),
  requestedService: z.string().trim().max(190).nullable().optional(),
  preferredSchedule: optionalDateTimeString,
  subject: z.string().trim().max(255).nullable().optional(),
  message: z.string().trim().min(1).max(8000),
  priority: z.enum(requestPriorities).default("Normal"),
});

export const createPublicRequestSchema = baseRequestSchema.extend({
  consent: z.literal(true),
});

export const createAuthenticatedRequestSchema = baseRequestSchema.extend({
  memberId: z.string().trim().regex(/^\d+$/).nullable().optional(),
  assignedTo: z.string().trim().regex(/^\d+$/).nullable().optional(),
  adminNotes: z.string().trim().max(8000).nullable().optional(),
});

export const updateRequestStatusSchema = z.object({
  requestStatus: z.enum(requestStatuses),
  assignedTo: z.string().trim().regex(/^\d+$/).nullable().optional(),
  adminNotes: z.string().trim().max(8000).nullable().optional(),
  publicResponse: z.string().trim().max(8000).nullable().optional(),
  internalNote: z.string().trim().max(8000).nullable().optional(),
  userVisibleMessage: z.string().trim().max(8000).nullable().optional(),
});

export const listNotificationsQuerySchema = paginationSchema.extend({
  notificationType: z.enum(notificationTypes).optional(),
  read: z.coerce.boolean().optional(),
  sortBy: z.enum(["createdAt", "notificationType", "isRead"]).default("createdAt"),
});
