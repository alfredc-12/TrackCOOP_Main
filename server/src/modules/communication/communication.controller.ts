import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  archiveReportSchema,
  createAnnouncementSchema,
  createAuthenticatedRequestSchema,
  createDocumentSchema,
  createPublicRequestSchema,
  createReportSchema,
  documentAccessLogSchema,
  listAnnouncementsQuerySchema,
  listDocumentsQuerySchema,
  listNotificationsQuerySchema,
  listReportsQuerySchema,
  listRequestsQuerySchema,
  updateAnnouncementSchema,
  updateDocumentSchema,
  updateRequestStatusSchema,
} from "./communication.schema";
import type { CommunicationService } from "./communication.service";

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

function validationError(error: ZodError) {
  return new AppError(
    "The request payload is invalid",
    400,
    "VALIDATION_ERROR",
    error.issues.map((issue) => ({
      code: "VALIDATION_ERROR",
      field: issue.path.join("."),
      message: issue.message,
    })),
  );
}

function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) {
    throw new AppError(`Route parameter ${name} is required`, 400, "ROUTE_PARAM_REQUIRED");
  }
  return value;
}

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}

function requestContext(request: Parameters<Parameters<typeof asyncHandler>[0]>[0]) {
  return {
    ipAddress: request.ip || request.socket.remoteAddress || null,
    userAgent: request.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function sendList<T>(
  response: Parameters<typeof sendSuccess<T[]>>[0],
  result: { records: T[]; total: number; page: number; pageSize: number },
) {
  return sendSuccess(response, result.records, {
    meta: { total: result.total, page: result.page, pageSize: result.pageSize },
  });
}

export function createCommunicationController(service: CommunicationService) {
  return {
    listDocuments: asyncHandler(async (request, response) => {
      return sendList(response, await service.listDocuments(parse(listDocumentsQuerySchema, request.query), requireAuth(request.auth)));
    }),
    createDocument: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.createDocument(parse(createDocumentSchema, request.body), requireAuth(request.auth)),
        { statusCode: 201, message: "Document record created" },
      );
    }),
    detailDocument: asyncHandler(async (request, response) => {
      const document = await service.getDocument(requireParam(request.params.id, "id"), requireAuth(request.auth));
      if (!document) throw new AppError("Document was not found", 404, "DOCUMENT_NOT_FOUND");
      return sendSuccess(response, document);
    }),
    updateDocument: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.updateDocument(
          requireParam(request.params.id, "id"),
          parse(updateDocumentSchema, request.body),
          requireAuth(request.auth),
        ),
        { message: "Document record updated" },
      );
    }),
    logDocumentAccess: asyncHandler(async (request, response) => {
      const input = parse(documentAccessLogSchema, request.body);
      await service.logDocumentAccess(
        requireParam(request.params.id, "id"),
        input.accessAction,
        requireAuth(request.auth),
        requestContext(request),
      );
      return sendSuccess(response, { logged: true }, { message: "Document access logged" });
    }),

    listReports: asyncHandler(async (request, response) => {
      return sendList(response, await service.listReports(parse(listReportsQuerySchema, request.query)));
    }),
    createReport: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.createReport(parse(createReportSchema, request.body), requireAuth(request.auth)),
        { statusCode: 201, message: "Report record generated" },
      );
    }),
    archiveReport: asyncHandler(async (request, response) => {
      const input = parse(archiveReportSchema, request.body);
      return sendSuccess(
        response,
        await service.archiveReport(requireParam(request.params.id, "id"), input.reason, requireAuth(request.auth)),
        { message: "Report archived" },
      );
    }),

    listAnnouncements: asyncHandler(async (request, response) => {
      return sendList(response, await service.listAnnouncements(parse(listAnnouncementsQuerySchema, request.query), requireAuth(request.auth)));
    }),
    createAnnouncement: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.createAnnouncement(parse(createAnnouncementSchema, request.body), requireAuth(request.auth)),
        { statusCode: 201, message: "Announcement created" },
      );
    }),
    updateAnnouncement: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.updateAnnouncement(
          requireParam(request.params.id, "id"),
          parse(updateAnnouncementSchema, request.body),
          requireAuth(request.auth),
        ),
        { message: "Announcement updated" },
      );
    }),
    publishAnnouncement: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.publishAnnouncement(requireParam(request.params.id, "id"), requireAuth(request.auth)),
        { message: "Announcement published" },
      );
    }),
    archiveAnnouncement: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.archiveAnnouncement(requireParam(request.params.id, "id"), requireAuth(request.auth)),
        { message: "Announcement archived" },
      );
    }),

    listRequests: asyncHandler(async (request, response) => {
      return sendList(response, await service.listRequests(parse(listRequestsQuerySchema, request.query), requireAuth(request.auth)));
    }),
    createPublicRequest: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.createPublicRequest(parse(createPublicRequestSchema, request.body)),
        { statusCode: 201, message: "Request submitted" },
      );
    }),
    createAuthenticatedRequest: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.createAuthenticatedRequest(
          parse(createAuthenticatedRequestSchema, request.body),
          requireAuth(request.auth),
        ),
        { statusCode: 201, message: "Request submitted" },
      );
    }),
    detailRequest: asyncHandler(async (request, response) => {
      const result = await service.getRequest(requireParam(request.params.id, "id"), requireAuth(request.auth));
      if (!result) throw new AppError("Request was not found", 404, "REQUEST_NOT_FOUND");
      return sendSuccess(response, result);
    }),
    updateRequestStatus: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.updateRequestStatus(
          requireParam(request.params.id, "id"),
          parse(updateRequestStatusSchema, request.body),
          requireAuth(request.auth),
        ),
        { message: "Request status updated" },
      );
    }),

    listNotifications: asyncHandler(async (request, response) => {
      return sendList(response, await service.listNotifications(parse(listNotificationsQuerySchema, request.query), requireAuth(request.auth)));
    }),
    markNotificationRead: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.markNotificationRead(requireParam(request.params.id, "id"), requireAuth(request.auth)),
        { message: "Notification marked as read" },
      );
    }),
    markAllNotificationsRead: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.markAllNotificationsRead(requireAuth(request.auth)),
        { message: "Notifications marked as read" },
      );
    }),
  };
}
