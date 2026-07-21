import { normalizeProtectedStoragePath } from "../../storage/protected-storage";
import type { AuthContext } from "../auth/auth.types";
import {
  createCommunicationRepository,
  type CommunicationRepository,
  type CreateAnnouncementInput,
  type CreateDocumentInput,
  type CreateReportInput,
  type CreateRequestInput,
  type ListAnnouncementsQuery,
  type ListDocumentsQuery,
  type ListNotificationsQuery,
  type ListReportsQuery,
  type ListRequestsQuery,
  type UpdateAnnouncementInput,
  type UpdateDocumentInput,
  type UpdateRequestStatusInput,
} from "./communication.repository";

function createReportNumber() {
  return `RPT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

type CreateReportServiceInput = Omit<CreateReportInput, "reportNumber"> & {
  reportNumber?: string;
};

function normalizeDocumentInput<T extends CreateDocumentInput | UpdateDocumentInput>(input: T): T {
  if (!Object.prototype.hasOwnProperty.call(input, "filePath") || !input.filePath) {
    return input;
  }

  return {
    ...input,
    filePath: normalizeProtectedStoragePath(input.filePath),
  };
}

function normalizeReportInput(input: CreateReportServiceInput): CreateReportInput {
  return {
    ...input,
    reportNumber: input.reportNumber || createReportNumber(),
    filePath: input.filePath ? normalizeProtectedStoragePath(input.filePath) : input.filePath,
  };
}

export interface CommunicationService {
  listDocuments(query: ListDocumentsQuery, auth: AuthContext): ReturnType<CommunicationRepository["listDocuments"]>;
  createDocument(input: CreateDocumentInput, auth: AuthContext): ReturnType<CommunicationRepository["createDocument"]>;
  updateDocument(id: string, input: UpdateDocumentInput, auth: AuthContext): ReturnType<CommunicationRepository["updateDocument"]>;
  getDocument(id: string, auth: AuthContext): ReturnType<CommunicationRepository["getDocument"]>;
  logDocumentAccess(id: string, action: string, auth: AuthContext, context: { ipAddress: string | null; userAgent: string | null }): ReturnType<CommunicationRepository["logDocumentAccess"]>;
  listReports(query: ListReportsQuery): ReturnType<CommunicationRepository["listReports"]>;
  createReport(input: CreateReportServiceInput, auth: AuthContext): ReturnType<CommunicationRepository["createReport"]>;
  archiveReport(id: string, reason: string | null | undefined, auth: AuthContext): ReturnType<CommunicationRepository["archiveReport"]>;
  listAnnouncements(query: ListAnnouncementsQuery, auth: AuthContext): ReturnType<CommunicationRepository["listAnnouncements"]>;
  createAnnouncement(input: CreateAnnouncementInput, auth: AuthContext): ReturnType<CommunicationRepository["createAnnouncement"]>;
  updateAnnouncement(id: string, input: UpdateAnnouncementInput, auth: AuthContext): ReturnType<CommunicationRepository["updateAnnouncement"]>;
  publishAnnouncement(id: string, auth: AuthContext): ReturnType<CommunicationRepository["setAnnouncementStatus"]>;
  archiveAnnouncement(id: string, auth: AuthContext): ReturnType<CommunicationRepository["setAnnouncementStatus"]>;
  listRequests(query: ListRequestsQuery, auth: AuthContext): ReturnType<CommunicationRepository["listRequests"]>;
  createPublicRequest(input: Omit<CreateRequestInput, "requestSource">): ReturnType<CommunicationRepository["createRequest"]>;
  createAuthenticatedRequest(input: Omit<CreateRequestInput, "requestSource">, auth: AuthContext): ReturnType<CommunicationRepository["createRequest"]>;
  getRequest(id: string, auth: AuthContext): ReturnType<CommunicationRepository["getRequest"]>;
  updateRequestStatus(id: string, input: UpdateRequestStatusInput, auth: AuthContext): ReturnType<CommunicationRepository["updateRequestStatus"]>;
  listNotifications(query: ListNotificationsQuery, auth: AuthContext): ReturnType<CommunicationRepository["listNotifications"]>;
  markNotificationRead(id: string, auth: AuthContext): ReturnType<CommunicationRepository["markNotificationRead"]>;
  markAllNotificationsRead(auth: AuthContext): ReturnType<CommunicationRepository["markAllNotificationsRead"]>;
}

export function createCommunicationService(
  repository: CommunicationRepository = createCommunicationRepository(),
): CommunicationService {
  return {
    listDocuments(query, auth) {
      return repository.listDocuments(query, auth);
    },
    createDocument(input, auth) {
      return repository.createDocument(normalizeDocumentInput(input), auth);
    },
    updateDocument(id, input, auth) {
      return repository.updateDocument(id, normalizeDocumentInput(input), auth);
    },
    getDocument(id, auth) {
      return repository.getDocument(id, auth);
    },
    logDocumentAccess(id, action, auth, context) {
      return repository.logDocumentAccess(id, action, auth, context);
    },
    listReports(query) {
      return repository.listReports(query);
    },
    createReport(input, auth) {
      return repository.createReport(normalizeReportInput(input), auth);
    },
    archiveReport(id, reason, auth) {
      return repository.archiveReport(id, reason, auth);
    },
    listAnnouncements(query, auth) {
      return repository.listAnnouncements(query, auth);
    },
    createAnnouncement(input, auth) {
      return repository.createAnnouncement(input, auth);
    },
    updateAnnouncement(id, input, auth) {
      return repository.updateAnnouncement(id, input, auth);
    },
    publishAnnouncement(id, auth) {
      return repository.setAnnouncementStatus(id, "Published", auth);
    },
    archiveAnnouncement(id, auth) {
      return repository.setAnnouncementStatus(id, "Archived", auth);
    },
    listRequests(query, auth) {
      return repository.listRequests(query, auth);
    },
    createPublicRequest(input) {
      return repository.createRequest({ ...input, requestSource: "Public Website" });
    },
    createAuthenticatedRequest(input, auth) {
      const requestSource = auth.user.role === "member" ? "Member Portal" : "Admin Entry";
      return repository.createRequest({ ...input, requestSource }, auth);
    },
    getRequest(id, auth) {
      return repository.getRequest(id, auth);
    },
    updateRequestStatus(id, input, auth) {
      return repository.updateRequestStatus(id, input, auth);
    },
    listNotifications(query, auth) {
      return repository.listNotifications(query, auth);
    },
    markNotificationRead(id, auth) {
      return repository.markNotificationRead(id, auth);
    },
    markAllNotificationsRead(auth) {
      return repository.markAllNotificationsRead(auth);
    },
  };
}
