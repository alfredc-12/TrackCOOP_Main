import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { limitOffsetSql } from "../../db/pagination";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext, RoleSlug } from "../auth/auth.types";
import type {
  AnnouncementRecord,
  DocumentAccessLevel,
  DocumentRecord,
  NotificationRecord,
  ReportRecord,
  RequestRecord,
  RequestStatus,
  RequestStatusHistoryRecord,
} from "./communication.types";

type ListResult<T> = {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ListDocumentsQuery = {
  page: number;
  pageSize: number;
  search?: string;
  documentType?: string;
  accessLevel?: string;
  status?: string;
  sortBy: "uploadedAt" | "title" | "documentType" | "accessLevel";
  sortDirection: "asc" | "desc";
};

export type CreateDocumentInput = {
  title: string;
  documentType: string;
  accessLevel: DocumentAccessLevel;
  documentStatus?: string;
  filePath: string;
  memberId?: string | null;
  originalFileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  checksumSha256?: string | null;
  replacementOfDocumentId?: string | null;
  description?: string | null;
};

export type UpdateDocumentInput = Partial<CreateDocumentInput> & {
  documentStatus?: string;
};

export type ListReportsQuery = {
  page: number;
  pageSize: number;
  search?: string;
  reportType?: string;
  status?: string;
  sortBy: "generatedAt" | "reportNumber" | "reportType" | "generationStatus";
  sortDirection: "asc" | "desc";
};

export type CreateReportInput = {
  reportNumber: string;
  documentId?: string | null;
  reportType: string;
  reportPeriodStart?: string | null;
  reportPeriodEnd?: string | null;
  reportPeriodLabel?: string | null;
  filters?: unknown;
  generationStatus: string;
  filePath?: string | null;
};

export type ListAnnouncementsQuery = {
  page: number;
  pageSize: number;
  search?: string;
  audienceType?: string;
  status?: string;
  sortBy: "createdAt" | "publishAt" | "title" | "announcementStatus";
  sortDirection: "asc" | "desc";
};

export type CreateAnnouncementInput = {
  title: string;
  slug?: string | null;
  message: string;
  excerpt?: string | null;
  audienceType: string;
  audienceValue?: string | null;
  announcementStatus: string;
  featuredImagePath?: string | null;
  publishAt?: string | null;
  expiresAt?: string | null;
  recipientUserIds?: string[];
};

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput>;

export type ListRequestsQuery = {
  page: number;
  pageSize: number;
  search?: string;
  requestType?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  sortBy: "submittedAt" | "priority" | "requestStatus" | "requestType";
  sortDirection: "asc" | "desc";
};

export type CreateRequestInput = {
  memberId?: string | null;
  assignedTo?: string | null;
  requestSource: "Member Portal" | "Public Website" | "Admin Entry";
  requesterName?: string | null;
  requesterEmail?: string | null;
  requesterPhone?: string | null;
  requesterBarangay?: string | null;
  preferredContactMethod?: string | null;
  requestType: string;
  requestedService?: string | null;
  preferredSchedule?: string | null;
  subject?: string | null;
  message: string;
  priority: string;
  adminNotes?: string | null;
};

export type UpdateRequestStatusInput = {
  requestStatus: RequestStatus;
  assignedTo?: string | null;
  adminNotes?: string | null;
  publicResponse?: string | null;
  internalNote?: string | null;
  userVisibleMessage?: string | null;
};

export type ListNotificationsQuery = {
  page: number;
  pageSize: number;
  search?: string;
  notificationType?: string;
  read?: boolean;
  sortBy: "createdAt" | "notificationType" | "isRead";
  sortDirection: "asc" | "desc";
};

type CountRow = RowDataPacket & { total: number };
type MemberIdRow = RowDataPacket & { memberId: string };

type DocumentRow = RowDataPacket & {
  id: string;
  uploadedBy: string;
  uploaderName: string | null;
  memberId: string | null;
  title: string;
  documentType: DocumentRecord["documentType"];
  accessLevel: DocumentAccessLevel;
  documentStatus: DocumentRecord["documentStatus"];
  filePath: string;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: string | number | null;
  checksumSha256: string | null;
  replacementOfDocumentId: string | null;
  description: string | null;
  uploadedAt: Date;
  updatedAt: Date;
};

type ReportRow = RowDataPacket & {
  id: string;
  reportNumber: string;
  generatedBy: string;
  generatorName: string | null;
  documentId: string | null;
  reportType: ReportRecord["reportType"];
  reportPeriodStart: Date | null;
  reportPeriodEnd: Date | null;
  reportPeriodLabel: string | null;
  filtersJson: unknown;
  generationStatus: ReportRecord["generationStatus"];
  filePath: string | null;
  generatedAt: Date;
};

type AnnouncementRow = RowDataPacket & {
  id: string;
  postedBy: string;
  posterName: string | null;
  title: string;
  slug: string | null;
  message: string;
  excerpt: string | null;
  audienceType: AnnouncementRecord["audienceType"];
  audienceValue: string | null;
  announcementStatus: AnnouncementRecord["announcementStatus"];
  featuredImagePath: string | null;
  publishAt: Date | null;
  expiresAt: Date | null;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type RequestRow = RowDataPacket & {
  id: string;
  referenceCode: string;
  memberId: string | null;
  submittedBy: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  requestSource: RequestRecord["requestSource"];
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requesterBarangay: string | null;
  preferredContactMethod: RequestRecord["preferredContactMethod"];
  requestType: RequestRecord["requestType"];
  requestedService: string | null;
  preferredSchedule: Date | null;
  subject: string | null;
  message: string;
  priority: RequestRecord["priority"];
  requestStatus: RequestStatus;
  adminNotes: string | null;
  publicResponse: string | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  submittedAt: Date;
  updatedAt: Date;
};

type RequestStatusHistoryRow = RowDataPacket & {
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

type NotificationRow = RowDataPacket & {
  id: string;
  userId: string;
  notificationType: NotificationRecord["notificationType"];
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | number | null;
  isRead: number;
  readAt: Date | null;
  createdAt: Date;
};

const documentSortColumns: Record<ListDocumentsQuery["sortBy"], string> = {
  uploadedAt: "d.uploaded_at",
  title: "d.title",
  documentType: "d.document_type",
  accessLevel: "d.access_level",
};

const reportSortColumns: Record<ListReportsQuery["sortBy"], string> = {
  generatedAt: "r.generated_at",
  reportNumber: "r.report_number",
  reportType: "r.report_type",
  generationStatus: "r.generation_status",
};

const announcementSortColumns: Record<ListAnnouncementsQuery["sortBy"], string> = {
  createdAt: "a.created_at",
  publishAt: "a.publish_at",
  title: "a.title",
  announcementStatus: "a.announcement_status",
};

const requestSortColumns: Record<ListRequestsQuery["sortBy"], string> = {
  submittedAt: "ri.submitted_at",
  priority: "ri.priority",
  requestStatus: "ri.request_status",
  requestType: "ri.request_type",
};

const notificationSortColumns: Record<ListNotificationsQuery["sortBy"], string> = {
  createdAt: "n.created_at",
  notificationType: "n.notification_type",
  isRead: "n.is_read",
};

function documentSelect() {
  return `SELECT CAST(d.document_id AS CHAR) AS id,
                 CAST(d.uploaded_by AS CHAR) AS uploadedBy,
                 u.display_name AS uploaderName,
                 CAST(d.member_id AS CHAR) AS memberId,
                 d.title,
                 d.document_type AS documentType,
                 d.access_level AS accessLevel,
                 d.document_status AS documentStatus,
                 d.file_path AS filePath,
                 d.original_file_name AS originalFileName,
                 d.mime_type AS mimeType,
                 d.file_size_bytes AS fileSizeBytes,
                 d.checksum_sha256 AS checksumSha256,
                 CAST(d.replacement_of_document_id AS CHAR) AS replacementOfDocumentId,
                 d.description,
                 d.uploaded_at AS uploadedAt,
                 d.updated_at AS updatedAt
            FROM documents d
            JOIN users u ON u.user_id = d.uploaded_by`;
}

function reportSelect() {
  return `SELECT CAST(r.report_id AS CHAR) AS id,
                 r.report_number AS reportNumber,
                 CAST(r.generated_by AS CHAR) AS generatedBy,
                 u.display_name AS generatorName,
                 CAST(r.document_id AS CHAR) AS documentId,
                 r.report_type AS reportType,
                 r.report_period_start AS reportPeriodStart,
                 r.report_period_end AS reportPeriodEnd,
                 r.report_period_label AS reportPeriodLabel,
                 r.filters_json AS filtersJson,
                 r.generation_status AS generationStatus,
                 r.file_path AS filePath,
                 r.generated_at AS generatedAt
            FROM reports r
            JOIN users u ON u.user_id = r.generated_by`;
}

function announcementSelect() {
  return `SELECT CAST(a.announcement_id AS CHAR) AS id,
                 CAST(a.posted_by AS CHAR) AS postedBy,
                 u.display_name AS posterName,
                 a.title,
                 a.slug,
                 a.message,
                 a.excerpt,
                 a.audience_type AS audienceType,
                 a.audience_value AS audienceValue,
                 a.announcement_status AS announcementStatus,
                 a.featured_image_path AS featuredImagePath,
                 a.publish_at AS publishAt,
                 a.expires_at AS expiresAt,
                 a.posted_at AS postedAt,
                 a.created_at AS createdAt,
                 a.updated_at AS updatedAt
            FROM announcements a
            JOIN users u ON u.user_id = a.posted_by`;
}

function requestSelect() {
  return `SELECT CAST(ri.request_id AS CHAR) AS id,
                 ri.reference_code AS referenceCode,
                 CAST(ri.member_id AS CHAR) AS memberId,
                 CAST(ri.submitted_by AS CHAR) AS submittedBy,
                 CAST(ri.assigned_to AS CHAR) AS assignedTo,
                 assignee.display_name AS assigneeName,
                 ri.request_source AS requestSource,
                 ri.requester_name AS requesterName,
                 ri.requester_email AS requesterEmail,
                 ri.requester_phone AS requesterPhone,
                 ri.requester_barangay AS requesterBarangay,
                 ri.preferred_contact_method AS preferredContactMethod,
                 ri.request_type AS requestType,
                 ri.requested_service AS requestedService,
                 ri.preferred_schedule AS preferredSchedule,
                 ri.subject,
                 ri.message,
                 ri.priority,
                 ri.request_status AS requestStatus,
                 ri.admin_notes AS adminNotes,
                 ri.public_response AS publicResponse,
                 ri.resolved_at AS resolvedAt,
                 ri.closed_at AS closedAt,
                 ri.submitted_at AS submittedAt,
                 ri.updated_at AS updatedAt
            FROM requests_inquiries ri
       LEFT JOIN users assignee ON assignee.user_id = ri.assigned_to`;
}

function requestHistorySelect() {
  return `SELECT CAST(h.request_status_history_id AS CHAR) AS id,
                 CAST(h.request_id AS CHAR) AS requestId,
                 h.old_status AS oldStatus,
                 h.new_status AS newStatus,
                 h.internal_note AS internalNote,
                 h.user_visible_message AS userVisibleMessage,
                 CAST(h.changed_by AS CHAR) AS changedBy,
                 u.display_name AS changedByName,
                 h.changed_at AS changedAt
            FROM request_status_history h
            JOIN users u ON u.user_id = h.changed_by`;
}

function notificationSelect() {
  return `SELECT CAST(n.notification_id AS CHAR) AS id,
                 CAST(n.user_id AS CHAR) AS userId,
                 n.notification_type AS notificationType,
                 n.title,
                 n.message,
                 n.related_entity_type AS relatedEntityType,
                 CAST(n.related_entity_id AS CHAR) AS relatedEntityId,
                 n.is_read AS isRead,
                 n.read_at AS readAt,
                 n.created_at AS createdAt
            FROM notifications n`;
}

function mapDocument(row: DocumentRow): DocumentRecord {
  return { ...row, fileSizeBytes: row.fileSizeBytes === null ? null : Number(row.fileSizeBytes) };
}

function mapReport(row: ReportRow): ReportRecord {
  const filters = typeof row.filtersJson === "string" && row.filtersJson
    ? JSON.parse(row.filtersJson)
    : row.filtersJson;
  return { ...row, filters };
}

function mapAnnouncement(row: any): AnnouncementRecord {
  return { 
    ...row,
    isAcknowledged: row.isAcknowledged ? Boolean(Number(row.isAcknowledged)) : false,
    acknowledgmentCount: row.acknowledgmentCount ? Number(row.acknowledgmentCount) : 0
  };
}

function mapRequest(row: RequestRow): RequestRecord {
  return { ...row };
}

function mapRequestHistory(row: RequestStatusHistoryRow): RequestStatusHistoryRecord {
  return { ...row };
}

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    ...row,
    relatedEntityId: row.relatedEntityId === null ? null : String(row.relatedEntityId),
    isRead: Boolean(row.isRead),
  };
}

function countSql(baseTable: string, joins: string, whereSql: string) {
  return `SELECT COUNT(*) AS total FROM ${baseTable} ${joins} ${whereSql}`;
}

async function getMemberIdForUser(pool: Pool, userId: string) {
  const [rows] = await pool.execute<MemberIdRow[]>(
    `SELECT CAST(member_id AS CHAR) AS memberId
       FROM member_profiles
      WHERE user_id = ?
      LIMIT 1`,
    [userId],
  );
  return rows[0]?.memberId ?? null;
}

function applyDocumentAccess(
  where: string[],
  values: Array<string | number>,
  role: RoleSlug,
  userId: string,
  memberId: string | null,
) {
  if (role === "chairman") return;
  if (role === "bookkeeper") {
    where.push("(d.access_level IN ('Public', 'Member-only', 'Bookkeeper-only') OR d.uploaded_by = ?)");
    values.push(userId);
    return;
  }
  where.push("(d.access_level = 'Public' OR (d.access_level = 'Member-only' AND d.member_id = ?))");
  values.push(memberId ?? "0");
}

function canReadDocument(document: DocumentRecord, auth: AuthContext, memberId: string | null) {
  if (auth.user.role === "chairman") return true;
  if (document.accessLevel === "Public") return true;
  if (auth.user.role === "bookkeeper") {
    return document.accessLevel === "Bookkeeper-only" || document.accessLevel === "Member-only" || document.uploadedBy === auth.user.id;
  }
  return document.accessLevel === "Member-only" && document.memberId === memberId;
}

function applyAnnouncementAccess(
  where: string[],
  values: Array<string | number>,
  auth: AuthContext,
  memberId: string | null,
) {
  if (auth.user.role === "chairman") return;

  where.push("a.announcement_status = 'Published'");
  where.push("(a.expires_at IS NULL OR a.expires_at >= NOW())");

  if (auth.user.role === "bookkeeper") {
    where.push("(a.audience_type IN ('Public', 'Role') AND (a.audience_value IS NULL OR a.audience_value IN ('bookkeeper', 'Bookkeeper')))");
    return;
  }

  where.push(`(
    a.audience_type IN ('Public', 'All Members')
    OR (a.audience_type = 'Selected Users' AND EXISTS (
      SELECT 1 FROM announcement_recipients ar
       WHERE ar.announcement_id = a.announcement_id AND ar.user_id = ?
    ))
    OR (a.audience_type IN ('Associate Members', 'True Members') AND ? <> '0')
  )`);
  values.push(auth.user.id, memberId ?? "0");
}

function applyRequestAccess(
  where: string[],
  values: Array<string | number>,
  auth: AuthContext,
  memberId: string | null,
) {
  if (auth.user.role === "chairman") return;
  if (auth.user.role === "bookkeeper") {
    where.push("(ri.assigned_to = ? OR ri.request_type IN ('Payment', 'Document', 'General'))");
    values.push(auth.user.id);
    return;
  }
  where.push("(ri.submitted_by = ? OR ri.member_id = ?)");
  values.push(auth.user.id, memberId ?? "0");
}

export interface CommunicationRepository {
  listDocuments(query: ListDocumentsQuery, auth: AuthContext): Promise<ListResult<DocumentRecord>>;
  createDocument(input: CreateDocumentInput, auth: AuthContext): Promise<DocumentRecord>;
  updateDocument(id: string, input: UpdateDocumentInput, auth: AuthContext): Promise<DocumentRecord>;
  getDocument(id: string, auth: AuthContext): Promise<DocumentRecord | null>;
  logDocumentAccess(id: string, action: string, auth: AuthContext, context: { ipAddress: string | null; userAgent: string | null }): Promise<void>;
  listReports(query: ListReportsQuery): Promise<ListResult<ReportRecord>>;
  createReport(input: CreateReportInput, auth: AuthContext): Promise<ReportRecord>;
  archiveReport(id: string, reason: string | null | undefined, auth: AuthContext): Promise<ReportRecord>;
  listAnnouncements(query: ListAnnouncementsQuery, auth: AuthContext): Promise<ListResult<AnnouncementRecord>>;
  createAnnouncement(input: CreateAnnouncementInput, auth: AuthContext): Promise<AnnouncementRecord>;
  updateAnnouncement(id: string, input: UpdateAnnouncementInput, auth: AuthContext): Promise<AnnouncementRecord>;
  setAnnouncementStatus(id: string, status: "Published" | "Archived", auth: AuthContext): Promise<AnnouncementRecord>;
  acknowledgeAnnouncement(id: string, auth: AuthContext): Promise<void>;
  getAnnouncementAcknowledgments(id: string, auth: AuthContext): Promise<{ userId: string; fullName: string; acknowledgedAt: Date }[]>;
  listRequests(query: ListRequestsQuery, auth: AuthContext): Promise<ListResult<RequestRecord>>;
  createRequest(input: CreateRequestInput, auth?: AuthContext): Promise<RequestRecord>;
  getRequest(id: string, auth: AuthContext): Promise<{ request: RequestRecord; history: RequestStatusHistoryRecord[] } | null>;
  updateRequestStatus(id: string, input: UpdateRequestStatusInput, auth: AuthContext): Promise<{ request: RequestRecord; history: RequestStatusHistoryRecord[] }>;
  listNotifications(query: ListNotificationsQuery, auth: AuthContext): Promise<ListResult<NotificationRecord>>;
  markNotificationRead(id: string, auth: AuthContext): Promise<NotificationRecord>;
  markAllNotificationsRead(auth: AuthContext): Promise<{ updated: number }>;
}

export function createCommunicationRepository(pool?: Pool): CommunicationRepository {
  const databasePool = () => pool ?? getPool();

  async function findDocument(id: string) {
    const [rows] = await databasePool().execute<DocumentRow[]>(
      `${documentSelect()} WHERE d.document_id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? mapDocument(rows[0]) : null;
  }

  async function findAnnouncement(id: string) {
    const [rows] = await databasePool().execute<AnnouncementRow[]>(
      `${announcementSelect()} WHERE a.announcement_id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? mapAnnouncement(rows[0]) : null;
  }

  async function findRequest(id: string) {
    const [rows] = await databasePool().execute<RequestRow[]>(
      `${requestSelect()} WHERE ri.request_id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? mapRequest(rows[0]) : null;
  }

  async function listRequestHistory(id: string) {
    const [rows] = await databasePool().execute<RequestStatusHistoryRow[]>(
      `${requestHistorySelect()} WHERE h.request_id = ? ORDER BY h.changed_at DESC`,
      [id],
    );
    return rows.map(mapRequestHistory);
  }

  return {
    async listDocuments(query, auth) {
      const where: string[] = [];
      const values: Array<string | number> = [];
      const memberId = await getMemberIdForUser(databasePool(), auth.user.id);
      applyDocumentAccess(where, values, auth.user.role, auth.user.id, memberId);

      if (query.search) {
        where.push("(d.title LIKE ? OR d.description LIKE ? OR d.original_file_name LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search, search);
      }
      if (query.documentType) {
        where.push("d.document_type = ?");
        values.push(query.documentType);
      }
      if (query.accessLevel) {
        where.push("d.access_level = ?");
        values.push(query.accessLevel);
      }
      if (query.status) {
        where.push("d.document_status = ?");
        values.push(query.status);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;

      const [rows] = await databasePool().execute<DocumentRow[]>(
        `${documentSelect()}
         ${whereSql}
         ORDER BY ${documentSortColumns[query.sortBy]} ${orderDirection}, d.document_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [counts] = await databasePool().execute<CountRow[]>(
        countSql("documents d", "JOIN users u ON u.user_id = d.uploaded_by", whereSql),
        values,
      );

      return { records: rows.map(mapDocument), total: Number(counts[0]?.total ?? 0), page: query.page, pageSize: query.pageSize };
    },

    async createDocument(input, auth) {
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO documents
             (uploaded_by, member_id, title, document_type, access_level, document_status, file_path,
              original_file_name, mime_type, file_size_bytes, checksum_sha256, replacement_of_document_id, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            auth.user.id,
            input.memberId ?? null,
            input.title,
            input.documentType,
            input.accessLevel,
            input.documentStatus ?? "Active",
            input.filePath,
            input.originalFileName ?? null,
            input.mimeType ?? null,
            input.fileSizeBytes ?? null,
            input.checksumSha256 ?? null,
            input.replacementOfDocumentId ?? null,
            input.description ?? null,
          ],
        );
        const id = String(result.insertId);
        await connection.execute(
          `INSERT INTO document_access_logs
             (document_id, user_id, access_action)
           VALUES (?, ?, 'Permission Change')`,
          [id, auth.user.id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'document.created', 'documents', ?, 'A document was created.', CAST(? AS JSON))`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<DocumentRow[]>(
          `${documentSelect()} WHERE d.document_id = ? LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new AppError("Document was not found", 404, "DOCUMENT_NOT_FOUND");
        return mapDocument(rows[0]);
      }, databasePool());
    },

    async updateDocument(id, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await findDocument(id);
        if (!existing) throw new AppError("Document was not found", 404, "DOCUMENT_NOT_FOUND");

        await connection.execute(
          `UPDATE documents
              SET title = COALESCE(?, title),
                  document_type = COALESCE(?, document_type),
                  access_level = COALESCE(?, access_level),
                  document_status = COALESCE(?, document_status),
                  file_path = COALESCE(?, file_path),
                  member_id = ?,
                  original_file_name = ?,
                  mime_type = ?,
                  file_size_bytes = ?,
                  checksum_sha256 = ?,
                  replacement_of_document_id = ?,
                  description = ?
            WHERE document_id = ?`,
          [
            input.title ?? null,
            input.documentType ?? null,
            input.accessLevel ?? null,
            input.documentStatus ?? null,
            input.filePath ?? null,
            Object.prototype.hasOwnProperty.call(input, "memberId") ? input.memberId ?? null : existing.memberId,
            Object.prototype.hasOwnProperty.call(input, "originalFileName") ? input.originalFileName ?? null : existing.originalFileName,
            Object.prototype.hasOwnProperty.call(input, "mimeType") ? input.mimeType ?? null : existing.mimeType,
            Object.prototype.hasOwnProperty.call(input, "fileSizeBytes") ? input.fileSizeBytes ?? null : existing.fileSizeBytes,
            Object.prototype.hasOwnProperty.call(input, "checksumSha256") ? input.checksumSha256 ?? null : existing.checksumSha256,
            Object.prototype.hasOwnProperty.call(input, "replacementOfDocumentId") ? input.replacementOfDocumentId ?? null : existing.replacementOfDocumentId,
            Object.prototype.hasOwnProperty.call(input, "description") ? input.description ?? null : existing.description,
            id,
          ],
        );
        await connection.execute(
          `INSERT INTO document_access_logs
             (document_id, user_id, access_action)
           VALUES (?, ?, 'Permission Change')`,
          [id, auth.user.id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'document.updated', 'documents', ?, 'A document was updated.', CAST(? AS JSON))`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<DocumentRow[]>(
          `${documentSelect()} WHERE d.document_id = ? LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new AppError("Document was not found", 404, "DOCUMENT_NOT_FOUND");
        return mapDocument(rows[0]);
      }, databasePool());
    },

    async getDocument(id, auth) {
      const document = await findDocument(id);
      if (!document) return null;
      const memberId = await getMemberIdForUser(databasePool(), auth.user.id);
      if (!canReadDocument(document, auth, memberId)) {
        throw new AppError("You do not have permission to access this document", 403, "DOCUMENT_FORBIDDEN");
      }
      return document;
    },

    async logDocumentAccess(id, action, auth, context) {
      const document = await this.getDocument(id, auth);
      if (!document) throw new AppError("Document was not found", 404, "DOCUMENT_NOT_FOUND");
      await databasePool().execute(
        `INSERT INTO document_access_logs
           (document_id, user_id, access_action, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [id, auth.user.id, action, context.ipAddress, context.userAgent],
      );
    },

    async listReports(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];
      if (query.search) {
        where.push("(r.report_number LIKE ? OR r.report_period_label LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search);
      }
      if (query.reportType) {
        where.push("r.report_type = ?");
        values.push(query.reportType);
      }
      if (query.status) {
        where.push("r.generation_status = ?");
        values.push(query.status);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<ReportRow[]>(
        `${reportSelect()}
         ${whereSql}
         ORDER BY ${reportSortColumns[query.sortBy]} ${orderDirection}, r.report_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [counts] = await databasePool().execute<CountRow[]>(
        countSql("reports r", "JOIN users u ON u.user_id = r.generated_by", whereSql),
        values,
      );
      return { records: rows.map(mapReport), total: Number(counts[0]?.total ?? 0), page: query.page, pageSize: query.pageSize };
    },

    async createReport(input, auth) {
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO reports
             (report_number, generated_by, document_id, report_type, report_period_start,
              report_period_end, report_period_label, filters_json, generation_status, file_path)
           VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?)`,
          [
            input.reportNumber,
            auth.user.id,
            input.documentId ?? null,
            input.reportType,
            input.reportPeriodStart ?? null,
            input.reportPeriodEnd ?? null,
            input.reportPeriodLabel ?? null,
            JSON.stringify(input.filters ?? null),
            input.generationStatus,
            input.filePath ?? null,
          ],
        );
        const id = String(result.insertId);
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'report.generated', 'reports', ?, 'A report record was generated.', CAST(? AS JSON))`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<ReportRow[]>(
          `${reportSelect()} WHERE r.report_id = ? LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new AppError("Report was not found", 404, "REPORT_NOT_FOUND");
        return mapReport(rows[0]);
      }, databasePool());
    },

    async archiveReport(id, reason, auth) {
      return withTransaction(async (connection) => {
        await connection.execute(
          `UPDATE reports SET generation_status = 'Archived' WHERE report_id = ?`,
          [id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description)
           VALUES (?, 'report.archived', 'reports', ?, ?)`,
          [auth.user.id, id, reason ?? "A report record was archived."],
        );
        const [rows] = await connection.execute<ReportRow[]>(
          `${reportSelect()} WHERE r.report_id = ? LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new AppError("Report was not found", 404, "REPORT_NOT_FOUND");
        return mapReport(rows[0]);
      }, databasePool());
    },

    async listAnnouncements(query, auth) {
      const where: string[] = [];
      const values: Array<string | number> = [];
      const memberId = await getMemberIdForUser(databasePool(), auth.user.id);
      applyAnnouncementAccess(where, values, auth, memberId);
      if (query.search) {
        where.push("(a.title LIKE ? OR a.excerpt LIKE ? OR a.message LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search, search);
      }
      if (query.audienceType) {
        where.push("a.audience_type = ?");
        values.push(query.audienceType);
      }
      if (query.status) {
        where.push("a.announcement_status = ?");
        values.push(query.status);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;
      const queryValues = [auth.user.id, ...values];
      const baseSelect = announcementSelect();
      const fromIndex = baseSelect.indexOf("FROM");
      const selectPart = baseSelect.substring(0, fromIndex);
      const fromPart = baseSelect.substring(fromIndex);

      const [rows] = await databasePool().execute<any[]>(
        `${selectPart},
          EXISTS(SELECT 1 FROM announcement_acknowledgments ack WHERE ack.announcement_id = a.announcement_id AND ack.user_id = ?) AS isAcknowledged,
          (SELECT COUNT(*) FROM announcement_acknowledgments ack WHERE ack.announcement_id = a.announcement_id) AS acknowledgmentCount
         ${fromPart}
         ${whereSql}
         ORDER BY ${announcementSortColumns[query.sortBy]} ${orderDirection}, a.announcement_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        queryValues,
      );
      const [counts] = await databasePool().execute<CountRow[]>(
        countSql("announcements a", "JOIN users u ON u.user_id = a.posted_by", whereSql),
        values,
      );
      return { records: rows.map(mapAnnouncement), total: Number(counts[0]?.total ?? 0), page: query.page, pageSize: query.pageSize };
    },

    async createAnnouncement(input, auth) {
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO announcements
             (posted_by, title, slug, message, excerpt, audience_type, audience_value,
              announcement_status, featured_image_path, publish_at, expires_at, posted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'Published' THEN NOW() ELSE NULL END)`,
          [
            auth.user.id,
            input.title,
            input.slug ?? null,
            input.message,
            input.excerpt ?? null,
            input.audienceType,
            input.audienceValue ?? null,
            input.announcementStatus,
            input.featuredImagePath ?? null,
            input.publishAt ?? null,
            input.expiresAt ?? null,
            input.announcementStatus,
          ],
        );
        const id = String(result.insertId);
        for (const userId of input.recipientUserIds ?? []) {
          await connection.execute(
            `INSERT IGNORE INTO announcement_recipients (announcement_id, user_id)
             VALUES (?, ?)`,
            [id, userId],
          );
        }
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'announcement.created', 'announcements', ?, 'An announcement was created.', CAST(? AS JSON))`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<AnnouncementRow[]>(
          `${announcementSelect()} WHERE a.announcement_id = ? LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new AppError("Announcement was not found", 404, "ANNOUNCEMENT_NOT_FOUND");
        return mapAnnouncement(rows[0]);
      }, databasePool());
    },

    async updateAnnouncement(id, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await findAnnouncement(id);
        if (!existing) throw new AppError("Announcement was not found", 404, "ANNOUNCEMENT_NOT_FOUND");
        await connection.execute(
          `UPDATE announcements
              SET title = COALESCE(?, title),
                  slug = ?,
                  message = COALESCE(?, message),
                  excerpt = ?,
                  audience_type = COALESCE(?, audience_type),
                  audience_value = ?,
                  announcement_status = COALESCE(?, announcement_status),
                  featured_image_path = ?,
                  publish_at = ?,
                  expires_at = ?
            WHERE announcement_id = ?`,
          [
            input.title ?? null,
            Object.prototype.hasOwnProperty.call(input, "slug") ? input.slug ?? null : existing.slug,
            input.message ?? null,
            Object.prototype.hasOwnProperty.call(input, "excerpt") ? input.excerpt ?? null : existing.excerpt,
            input.audienceType ?? null,
            Object.prototype.hasOwnProperty.call(input, "audienceValue") ? input.audienceValue ?? null : existing.audienceValue,
            input.announcementStatus ?? null,
            Object.prototype.hasOwnProperty.call(input, "featuredImagePath") ? input.featuredImagePath ?? null : existing.featuredImagePath,
            Object.prototype.hasOwnProperty.call(input, "publishAt") ? input.publishAt ?? null : existing.publishAt,
            Object.prototype.hasOwnProperty.call(input, "expiresAt") ? input.expiresAt ?? null : existing.expiresAt,
            id,
          ],
        );
        if (input.recipientUserIds) {
          await connection.execute(`DELETE FROM announcement_recipients WHERE announcement_id = ?`, [id]);
          for (const userId of input.recipientUserIds) {
            await connection.execute(
              `INSERT IGNORE INTO announcement_recipients (announcement_id, user_id)
               VALUES (?, ?)`,
              [id, userId],
            );
          }
        }
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'announcement.updated', 'announcements', ?, 'An announcement was updated.', CAST(? AS JSON))`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<AnnouncementRow[]>(
          `${announcementSelect()} WHERE a.announcement_id = ? LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new AppError("Announcement was not found", 404, "ANNOUNCEMENT_NOT_FOUND");
        return mapAnnouncement(rows[0]);
      }, databasePool());
    },

    async setAnnouncementStatus(id, status, auth) {
      return withTransaction(async (connection) => {
        await connection.execute(
          `UPDATE announcements
              SET announcement_status = ?,
                  posted_at = CASE WHEN ? = 'Published' AND posted_at IS NULL THEN NOW() ELSE posted_at END
            WHERE announcement_id = ?`,
          [status, status, id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description)
           VALUES (?, 'announcement.status_changed', 'announcements', ?, 'Announcement status was updated to ${status}.')`,
          [auth.user.id, id],
        );
        const [rows] = await connection.execute<AnnouncementRow[]>(
          `${announcementSelect()} WHERE a.announcement_id = ? LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new AppError("Announcement was not found", 404, "ANNOUNCEMENT_NOT_FOUND");
        return mapAnnouncement(rows[0]);
      }, databasePool());
    },

    async acknowledgeAnnouncement(id, auth) {
      await databasePool().execute(
        `INSERT IGNORE INTO announcement_acknowledgments (announcement_id, user_id) VALUES (?, ?)`,
        [id, auth.user.id]
      );
    },

    async getAnnouncementAcknowledgments(id, auth) {
      const [rows] = await databasePool().execute<any[]>(
        `SELECT CAST(ack.user_id AS CHAR) AS userId,
                u.display_name AS fullName,
                ack.acknowledged_at AS acknowledgedAt
         FROM announcement_acknowledgments ack
         JOIN users u ON u.user_id = ack.user_id
         WHERE ack.announcement_id = ?
         ORDER BY ack.acknowledged_at DESC`,
        [id]
      );
      return rows.map(r => ({
        userId: r.userId,
        fullName: r.fullName,
        acknowledgedAt: r.acknowledgedAt
      }));
    },

    async listRequests(query, auth) {
      const where: string[] = [];
      const values: Array<string | number> = [];
      const memberId = await getMemberIdForUser(databasePool(), auth.user.id);
      applyRequestAccess(where, values, auth, memberId);
      if (query.search) {
        where.push("(ri.reference_code LIKE ? OR ri.requester_name LIKE ? OR ri.subject LIKE ? OR ri.message LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search, search, search);
      }
      if (query.requestType) {
        where.push("ri.request_type = ?");
        values.push(query.requestType);
      }
      if (query.status) {
        where.push("ri.request_status = ?");
        values.push(query.status);
      }
      if (query.priority) {
        where.push("ri.priority = ?");
        values.push(query.priority);
      }
      if (query.assignedTo) {
        where.push("ri.assigned_to = ?");
        values.push(query.assignedTo);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<RequestRow[]>(
        `${requestSelect()}
         ${whereSql}
         ORDER BY ${requestSortColumns[query.sortBy]} ${orderDirection}, ri.request_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [counts] = await databasePool().execute<CountRow[]>(
        countSql("requests_inquiries ri", "LEFT JOIN users assignee ON assignee.user_id = ri.assigned_to", whereSql),
        values,
      );
      return { records: rows.map(mapRequest), total: Number(counts[0]?.total ?? 0), page: query.page, pageSize: query.pageSize };
    },

    async createRequest(input, auth) {
      return withTransaction(async (connection) => {
        const referenceCode = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const submittedBy = auth?.user.id ?? null;
        const memberId = input.memberId ?? (auth?.user.role === "member" ? await getMemberIdForUser(databasePool(), auth.user.id) : null);
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO requests_inquiries
             (reference_code, member_id, submitted_by, request_source, requester_name, requester_email,
              requester_phone, requester_barangay, preferred_contact_method, request_type, requested_service,
              preferred_schedule, subject, message, priority, assigned_to, admin_notes, consent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'Public Website' THEN NOW() ELSE NULL END)`,
          [
            referenceCode,
            memberId,
            submittedBy,
            input.requestSource,
            input.requesterName ?? auth?.user.displayName ?? null,
            input.requesterEmail ?? null,
            input.requesterPhone ?? null,
            input.requesterBarangay ?? null,
            input.preferredContactMethod ?? null,
            input.requestType,
            input.requestedService ?? null,
            input.preferredSchedule ?? null,
            input.subject ?? null,
            input.message,
            input.priority,
            input.assignedTo ?? null,
            input.adminNotes ?? null,
            input.requestSource,
          ],
        );
        const id = String(result.insertId);
        if (auth) {
          await connection.execute(
            `INSERT INTO request_status_history
               (request_id, old_status, new_status, internal_note, user_visible_message, changed_by)
             VALUES (?, NULL, 'Submitted', ?, ?, ?)`,
            [id, input.adminNotes ?? null, "Request submitted.", auth.user.id],
          );
          await connection.execute(
            `INSERT INTO audit_logs
               (user_id, action, entity_table, record_id, description, new_values)
             VALUES (?, 'request.created', 'requests_inquiries', ?, 'A request was created.', CAST(? AS JSON))`,
            [auth.user.id, id, JSON.stringify(input)],
          );
        }
        const [rows] = await connection.execute<RequestRow[]>(
          `${requestSelect()} WHERE ri.request_id = ? LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new AppError("Request was not found", 404, "REQUEST_NOT_FOUND");
        return mapRequest(rows[0]);
      }, databasePool());
    },

    async getRequest(id, auth) {
      const request = await findRequest(id);
      if (!request) return null;
      const memberId = await getMemberIdForUser(databasePool(), auth.user.id);
      const where: string[] = [];
      const values: Array<string | number> = [];
      applyRequestAccess(where, values, auth, memberId);
      if (where.length) {
        const [allowed] = await databasePool().execute<CountRow[]>(
          `SELECT COUNT(*) AS total FROM requests_inquiries ri WHERE ri.request_id = ? AND ${where.join(" AND ")}`,
          [id, ...values],
        );
        if (!Number(allowed[0]?.total ?? 0)) {
          throw new AppError("You do not have permission to access this request", 403, "REQUEST_FORBIDDEN");
        }
      }
      return { request, history: await listRequestHistory(id) };
    },

    async updateRequestStatus(id, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await findRequest(id);
        if (!existing) throw new AppError("Request was not found", 404, "REQUEST_NOT_FOUND");
        await connection.execute(
          `UPDATE requests_inquiries
              SET request_status = ?,
                  assigned_to = ?,
                  admin_notes = ?,
                  public_response = ?,
                  resolved_at = CASE WHEN ? = 'Resolved' THEN NOW() ELSE resolved_at END,
                  closed_at = CASE WHEN ? = 'Closed' THEN NOW() ELSE closed_at END
            WHERE request_id = ?`,
          [
            input.requestStatus,
            Object.prototype.hasOwnProperty.call(input, "assignedTo") ? input.assignedTo ?? null : existing.assignedTo,
            Object.prototype.hasOwnProperty.call(input, "adminNotes") ? input.adminNotes ?? null : existing.adminNotes,
            Object.prototype.hasOwnProperty.call(input, "publicResponse") ? input.publicResponse ?? null : existing.publicResponse,
            input.requestStatus,
            input.requestStatus,
            id,
          ],
        );
        await connection.execute(
          `INSERT INTO request_status_history
             (request_id, old_status, new_status, internal_note, user_visible_message, changed_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, existing.requestStatus, input.requestStatus, input.internalNote ?? null, input.userVisibleMessage ?? input.publicResponse ?? null, auth.user.id],
        );
        if (input.assignedTo) {
          await connection.execute(
            `INSERT INTO notifications
               (user_id, notification_type, title, message, related_entity_type, related_entity_id)
             VALUES (?, 'Request', 'Request assigned', ?, 'requests_inquiries', ?)`,
            [input.assignedTo, `Request ${existing.referenceCode} was assigned to you.`, id],
          );
        }
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'request.status_updated', 'requests_inquiries', ?, 'A request status was updated.', CAST(? AS JSON))`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<RequestRow[]>(
          `${requestSelect()} WHERE ri.request_id = ? LIMIT 1`,
          [id],
        );
        const [historyRows] = await connection.execute<RequestStatusHistoryRow[]>(
          `${requestHistorySelect()} WHERE h.request_id = ? ORDER BY h.changed_at DESC`,
          [id],
        );
        if (!rows[0]) throw new AppError("Request was not found", 404, "REQUEST_NOT_FOUND");
        return { request: mapRequest(rows[0]), history: historyRows.map(mapRequestHistory) };
      }, databasePool());
    },

    async listNotifications(query, auth) {
      const where = ["n.user_id = ?"];
      const values: Array<string | number> = [auth.user.id];
      if (query.search) {
        where.push("(n.title LIKE ? OR n.message LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search);
      }
      if (query.notificationType) {
        where.push("n.notification_type = ?");
        values.push(query.notificationType);
      }
      if (typeof query.read === "boolean") {
        where.push("n.is_read = ?");
        values.push(query.read ? 1 : 0);
      }
      const whereSql = `WHERE ${where.join(" AND ")}`;
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<NotificationRow[]>(
        `${notificationSelect()}
         ${whereSql}
         ORDER BY ${notificationSortColumns[query.sortBy]} ${orderDirection}, n.notification_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [counts] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM notifications n ${whereSql}`,
        values,
      );
      return { records: rows.map(mapNotification), total: Number(counts[0]?.total ?? 0), page: query.page, pageSize: query.pageSize };
    },

    async markNotificationRead(id, auth) {
      await databasePool().execute(
        `UPDATE notifications
            SET is_read = 1,
                read_at = COALESCE(read_at, NOW())
          WHERE notification_id = ? AND user_id = ?`,
        [id, auth.user.id],
      );
      const [rows] = await databasePool().execute<NotificationRow[]>(
        `${notificationSelect()} WHERE n.notification_id = ? AND n.user_id = ? LIMIT 1`,
        [id, auth.user.id],
      );
      if (!rows[0]) throw new AppError("Notification was not found", 404, "NOTIFICATION_NOT_FOUND");
      return mapNotification(rows[0]);
    },

    async markAllNotificationsRead(auth) {
      const [result] = await databasePool().execute<ResultSetHeader>(
        `UPDATE notifications
            SET is_read = 1,
                read_at = COALESCE(read_at, NOW())
          WHERE user_id = ? AND is_read = 0`,
        [auth.user.id],
      );
      return { updated: result.affectedRows };
    },
  };
}
