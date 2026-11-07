import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { getPool } from "../../db/pool";
import { manilaToday } from "../../utils/manila-calendar";
import type { AuthorizedUser } from "./records-auth";
import {
  DOCUMENT_ACCESS_LEVELS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPES,
} from "./record-constants";
import type {
  DocumentAccessLevel,
  DocumentDetail,
  DocumentListResponse,
  DocumentRecord,
  DocumentStatus,
} from "./records-types";
import {
  canAccessDocument,
  canManageDocument,
  canUploadDocument,
  documentVisibilitySql,
  type DocumentPolicyActor,
  type DocumentPolicyRecord,
} from "./document-policy";
import {
  readProtectedDocument,
  storeProtectedDocument,
  validateDocumentFile,
  type UploadedFileLike,
} from "./document-security";
import { deleteProtectedFile } from "../../storage/protected-storage";
import { RecordsError } from "./records-error";

const db = getPool();

type DocumentRow = RowDataPacket & {
  id: string;
  memberId: string | null;
  reference: string | null;
  title: string;
  description: string | null;
  category: string | null;
  documentType: string;
  accessLevel: string;
  databaseStatus: string;
  fileName: string | null;
  mimeType: string | null;
  fileExtension: string | null;
  fileSizeBytes: string | number | null;
  expirationDate: string | null;
  uploadedBy: string | null;
  uploadedById: string | null;
  uploadedAt: string;
  updatedAt: string;
};

type SummaryRow = RowDataPacket & {
  total: string | number;
  recentlyUploaded: string | number;
  expiringSoon: string | number;
  archived: string | number;
  restricted: string | number;
};

type CountRow = RowDataPacket & { total: string | number };
type IdRow = RowDataPacket & { id: string };
export type DocumentListInput = {
  search?: string;
  category?: string;
  documentType?: string;
  accessLevel?: DocumentAccessLevel;
  status?: DocumentStatus;
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  expirationFrom?: string;
  expirationTo?: string;
  fileType?: string;
  page?: number;
  pageSize?: number;
};

export type DocumentUploadInput = {
  title: string;
  description?: string;
  category: string;
  documentType: string;
  accessLevel: DocumentAccessLevel;
  expirationDate?: string | null;
  file: UploadedFileLike;
};

export type DocumentMetadataInput = Omit<DocumentUploadInput, "file">;

export type RequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

const databaseAccess: Record<DocumentAccessLevel, string> = {
  PUBLIC: "Public",
  MEMBER_ONLY: "Member-only",
  ADMIN_ONLY: "Admin-only",
  BOOKKEEPER_ONLY: "Bookkeeper-only",
};

function apiAccess(value: string): DocumentAccessLevel {
  const entry = Object.entries(databaseAccess).find(
    ([, database]) => database === value,
  );
  return (entry?.[0] ?? "ADMIN_ONLY") as DocumentAccessLevel;
}

function dateKey(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

// Operational warning only; this is not a document-retention period.
export const DOCUMENT_EXPIRY_WARNING_DAYS = 30;

function warningEndDate(today: string) {
  return new Date(Date.parse(`${today}T00:00:00Z`) + DOCUMENT_EXPIRY_WARNING_DAYS * 86_400_000)
    .toISOString().slice(0, 10);
}

function parseExpirationDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number(value.slice(0, 4)) < 1000) {
    throw new RecordsError("Expiration date must be a valid YYYY-MM-DD date.", 422, "INVALID_EXPIRATION_DATE");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RecordsError("Expiration date must be a valid YYYY-MM-DD date.", 422, "INVALID_EXPIRATION_DATE");
  }
  return value;
}

export function calculateDocumentStatus(databaseStatus: string, expirationDate: string | null, now = new Date()): DocumentStatus {
  if (databaseStatus === "Archived") return "ARCHIVED";
  if (databaseStatus === "Replaced") return "REPLACED";
  if (databaseStatus === "Restricted") return "RESTRICTED";
  // Fail closed on an unexpected stored state instead of portraying it as active.
  if (databaseStatus !== "Active") return "RESTRICTED";
  if (!expirationDate) return "ACTIVE";
  const today = manilaToday(now);
  if (expirationDate < today) return "EXPIRED";
  return expirationDate <= warningEndDate(today) ? "EXPIRING_SOON" : "ACTIVE";
}

function mapDocument(row: DocumentRow, now = new Date()): DocumentRecord {
  const expirationDate = dateKey(row.expirationDate);
  return {
    id: row.id,
    reference: row.reference ?? `DOC-${row.id}`,
    title: row.title,
    description: row.description,
    category: row.category ?? "OTHER",
    documentType: row.documentType,
    accessLevel: apiAccess(row.accessLevel),
    status: calculateDocumentStatus(row.databaseStatus, expirationDate, now),
    fileName: row.fileName ?? `document-${row.id}`,
    mimeType: row.mimeType ?? "application/octet-stream",
    fileExtension: row.fileExtension ?? "",
    fileSizeBytes: Number(row.fileSizeBytes ?? 0),
    expirationDate,
    uploadedBy: row.uploadedBy ?? "Public submission",
    uploadedById: row.uploadedById,
    uploadedAt: row.uploadedAt,
    updatedAt: row.updatedAt,
  };
}

function documentSelect() {
  return `
    SELECT CAST(d.document_id AS CHAR) AS id,
           CAST(d.member_id AS CHAR) AS memberId,
           d.document_reference AS reference,
           d.title,
           d.description,
           d.category,
           d.document_type AS documentType,
           d.access_level AS accessLevel,
           d.document_status AS databaseStatus,
           d.original_file_name AS fileName,
           d.mime_type AS mimeType,
           '' AS fileExtension,
           d.file_size_bytes AS fileSizeBytes,
           DATE_FORMAT(d.expiration_date, '%Y-%m-%d') AS expirationDate,
           u.display_name AS uploadedBy,
           CAST(d.uploaded_by AS CHAR) AS uploadedById,
           d.uploaded_at AS uploadedAt,
           d.updated_at AS updatedAt
      FROM documents d
      LEFT JOIN users u ON u.user_id = d.uploaded_by`;
}

async function getActor(user: AuthorizedUser): Promise<DocumentPolicyActor> {
  let memberId: string | null = null;
  if (user.role === "member") {
    const [rows] = await db.query<IdRow[]>(
      "SELECT CAST(member_id AS CHAR) AS id FROM member_profiles WHERE user_id = ? LIMIT 1",
      [user.numericId],
    );
    memberId = rows[0]?.id ?? null;
  }
  return { role: user.role, userId: user.numericId, memberId };
}

function policyRecord(row: DocumentRow): DocumentPolicyRecord {
  return {
    accessLevel: apiAccess(row.accessLevel),
    category: row.category ?? "OTHER",
    documentType: row.documentType,
    memberId: row.memberId,
  };
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function cleanText(value: string | undefined, maximum: number) {
  const clean = value?.trim();
  return clean ? clean.slice(0, maximum) : null;
}

function requireChoice(
  value: string,
  choices: readonly string[],
  label: string,
) {
  if (!choices.includes(value)) {
    throw new RecordsError(`Select a valid ${label}.`, 422, "VALIDATION_ERROR");
  }
  return value;
}

function validateMetadata(input: DocumentMetadataInput) {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 255) {
    throw new RecordsError(
      "Document title must contain 2 to 255 characters.",
      422,
      "VALIDATION_ERROR",
    );
  }
  requireChoice(input.category, DOCUMENT_CATEGORIES, "document category");
  requireChoice(input.documentType, DOCUMENT_TYPES, "document type");
  requireChoice(
    input.accessLevel,
    DOCUMENT_ACCESS_LEVELS.map((item) => item.value),
    "access level",
  );
  return {
    title,
    description: cleanText(input.description, 5000),
    category: input.category,
    documentType: input.documentType,
    accessLevel: input.accessLevel,
    expirationDate: parseExpirationDate(input.expirationDate),
  };
}

export async function listDocuments(
  input: DocumentListInput,
  user: AuthorizedUser,
  now = new Date(),
): Promise<DocumentListResponse> {
  const today = manilaToday(now);
  const warningEnd = warningEndDate(today);
  const actor = await getActor(user);
  const visibility = documentVisibilitySql(actor);
  const where = [visibility.sql];
  const values: Array<string | number> = [...visibility.values];

  const search = input.search?.trim();
  if (search) {
    const term = `%${search.slice(0, 120)}%`;
    where.push(`(d.title LIKE ? OR d.document_reference LIKE ? OR d.original_file_name LIKE ?
      OR d.description LIKE ?)`);
    values.push(term, term, term, term);
  }
  if (input.category) {
    where.push("d.category = ?");
    values.push(input.category);
  }
  if (input.documentType) {
    where.push("d.document_type = ?");
    values.push(input.documentType);
  }
  if (input.accessLevel) {
    where.push("d.access_level = ?");
    values.push(databaseAccess[input.accessLevel]);
  }

  if (input.uploadedBy && /^\d+$/.test(input.uploadedBy)) {
    where.push("d.uploaded_by = ?");
    values.push(input.uploadedBy);
  }
  if (validDate(input.dateFrom)) {
    where.push("DATE(d.uploaded_at) >= ?");
    values.push(input.dateFrom!);
  }
  if (validDate(input.dateTo)) {
    where.push("DATE(d.uploaded_at) <= ?");
    values.push(input.dateTo!);
  }
  if (input.fileType?.trim()) {
    where.push("d.original_file_name LIKE ?");
    values.push(`%.${input.fileType.trim().toLowerCase()}`);
  }
  const expirationFrom = parseExpirationDate(input.expirationFrom);
  const expirationTo = parseExpirationDate(input.expirationTo);
  if (expirationFrom && expirationTo && expirationFrom > expirationTo) {
    throw new RecordsError("Expiration date range is invalid.", 422, "INVALID_EXPIRATION_DATE");
  }
  if (expirationFrom) { where.push("d.expiration_date >= ?"); values.push(expirationFrom); }
  if (expirationTo) { where.push("d.expiration_date <= ?"); values.push(expirationTo); }
  if (input.status === "ARCHIVED") {
    where.push("d.document_status = 'Archived'");
  } else if (input.status === "REPLACED") {
    where.push("d.document_status = 'Replaced'");
  } else if (input.status === "RESTRICTED") {
    where.push("d.document_status = 'Restricted'");
  } else if (input.status === "EXPIRED") {
    where.push("d.document_status = 'Active' AND d.expiration_date < ?"); values.push(today);
  } else if (input.status === "EXPIRING_SOON") {
    where.push("d.document_status = 'Active' AND d.expiration_date >= ? AND d.expiration_date <= ?");
    values.push(today, warningEnd);
  } else if (input.status === "ACTIVE") {
    where.push("d.document_status = 'Active' AND (d.expiration_date IS NULL OR d.expiration_date > ?)");
    values.push(warningEnd);
  }

  const page = Math.max(1, Number(input.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const whereSql = where.join(" AND ");
  const [rows] = await db.query<DocumentRow[]>(
    `${documentSelect()}
      WHERE ${whereSql}
      ORDER BY d.updated_at DESC, d.document_id DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    values,
  );
  const [counts] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM documents d
      WHERE ${whereSql}`,
    values,
  );
  const summaryVisibility = documentVisibilitySql(actor);
  const [summaryRows] = await db.query<SummaryRow[]>(
    `SELECT COUNT(*) AS total,
            SUM(d.uploaded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS recentlyUploaded,
            SUM(CASE WHEN d.document_status = 'Active' AND d.expiration_date >= ? AND d.expiration_date <= ? THEN 1 ELSE 0 END) AS expiringSoon,
            SUM(d.document_status = 'Archived') AS archived,
            SUM(d.access_level <> 'Public') AS restricted
       FROM documents d
      WHERE ${summaryVisibility.sql}`,
    [today, warningEnd, ...summaryVisibility.values],
  );
  const [uploaderRows] = await db.query<
    (RowDataPacket & { id: string; name: string })[]
  >(
    `SELECT DISTINCT CAST(u.user_id AS CHAR) AS id, u.display_name AS name
       FROM users u JOIN documents d ON d.uploaded_by = u.user_id
      WHERE ${visibility.sql}
      ORDER BY u.display_name`,
    visibility.values,
  );
  const summary = summaryRows[0];
  return {
    documents: rows.map((row) => mapDocument(row, now)),
    total: Number(counts[0]?.total ?? 0),
    page,
    pageSize,
    summary: {
      total: Number(summary?.total ?? 0),
      recentlyUploaded: Number(summary?.recentlyUploaded ?? 0),
      expiringSoon: Number(summary?.expiringSoon ?? 0),
      archived: Number(summary?.archived ?? 0),
      restricted: Number(summary?.restricted ?? 0),
    },
    filterOptions: { uploaders: uploaderRows },
  };
}

async function findDocumentRow(
  documentId: string,
  connection?: PoolConnection,
) {
  if (!/^\d+$/.test(documentId)) return null;
  const executor = connection ?? db;
  const [rows] = await executor.query<DocumentRow[]>(
    `${documentSelect()} WHERE d.document_id = ? LIMIT 1`,
    [documentId],
  );
  return rows[0] ?? null;
}

export async function getDocumentDetail(
  documentId: string,
  user: AuthorizedUser,
): Promise<DocumentDetail> {
  const row = await findDocumentRow(documentId);
  if (!row)
    throw new RecordsError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  const document = mapDocument(row);
  const actor = await getActor(user);
  if (!canAccessDocument(actor, policyRecord(row))) {
    throw new RecordsError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  }
  const [access, audit] = await Promise.all([
    db.query<
      (RowDataPacket & {
        id: string;
        user: string;
        role: string | null;
        action: string;
        occurredAt: string;
      })[]
    >(
      `SELECT CAST(l.document_access_log_id AS CHAR) AS id,
              COALESCE(u.display_name, 'Public visitor') AS user,
              l.user_role AS role,
              l.access_action AS action,
              l.accessed_at AS occurredAt
         FROM document_access_logs l
         LEFT JOIN users u ON u.user_id = l.user_id
        WHERE l.document_id = ?
        ORDER BY l.accessed_at DESC
        LIMIT 100`,
      [documentId],
    ),
    db.query<
      (RowDataPacket & {
        id: string;
        action: string;
        description: string | null;
        actor: string;
        occurredAt: string;
      })[]
    >(
      `SELECT CAST(a.audit_log_id AS CHAR) AS id,
              a.action,
              a.description,
              COALESCE(u.display_name, 'System') AS actor,
              a.action_time AS occurredAt
         FROM audit_logs a
         LEFT JOIN users u ON u.user_id = a.user_id
        WHERE a.entity_table = 'documents' AND a.record_id = ?
        ORDER BY a.action_time DESC
        LIMIT 100`,
      [documentId],
    ),
  ]);
  return {
    ...document,
    accessHistory: actor.role === "chairman" ? access[0] : [],
    auditHistory: actor.role === "chairman" ? audit[0] : [],
  };
}

async function insertAudit(
  connection: PoolConnection,
  userId: number,
  action: string,
  documentId: string | number,
  description: string,
  oldValues?: object | null,
  newValues?: object | null,
  metadata?: RequestMetadata,
) {
  await connection.query(
    `INSERT INTO audit_logs
       (user_id, action, entity_table, record_id, description, old_values, new_values, ip_address, user_agent)
     VALUES (?, ?, 'documents', ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      action,
      documentId,
      description,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      metadata?.ipAddress ?? null,
      metadata?.userAgent?.slice(0, 500) ?? null,
    ],
  );
}

async function insertAccess(
  connection: PoolConnection,
  documentId: string | number,
  user: AuthorizedUser | null,
  action: string,
  metadata?: RequestMetadata,
) {
  await connection.query(
    `INSERT INTO document_access_logs
       (document_id, user_id, access_action, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    [
      documentId,
      user?.numericId ?? null,
      action,
      metadata?.ipAddress ?? null,
      metadata?.userAgent?.slice(0, 500) ?? null,
    ],
  );
}

export async function uploadDocument(
  input: DocumentUploadInput,
  user: AuthorizedUser,
  metadata?: RequestMetadata,
) {
  const details = validateMetadata(input);
  const actor = await getActor(user);
  if (
    !canUploadDocument(actor, {
      accessLevel: details.accessLevel,
      category: details.category,
      documentType: details.documentType,
    })
  ) {
    throw new RecordsError(
      "You cannot upload a document with those access settings.",
      403,
      "DOCUMENT_UPLOAD_FORBIDDEN",
    );
  }
  const validated = await validateDocumentFile(input.file).catch(
    (error: unknown) => {
      throw new RecordsError(
        error instanceof Error
          ? error.message
          : "The document file is invalid.",
        422,
        "INVALID_DOCUMENT_FILE",
      );
    },
  );
  // Persist the digest of the validated upload. This is metadata, not proof of
  // immutable storage and not, by itself, verified financial evidence.

  const stored = await storeProtectedDocument(validated);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const temporaryReference = `DOC-TMP-${randomUUID()}`;
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO documents (
        document_reference, uploaded_by, title, category, document_type,
        access_level, document_status, file_path, original_file_name, mime_type,
        file_size_bytes, description, expiration_date, checksum_sha256
      ) VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?, ?)`,
      [
        temporaryReference,
        user.numericId,
        details.title,
        details.category,
        details.documentType,
        databaseAccess[details.accessLevel],
        stored.storagePath,
        validated.originalFileName,
        validated.mimeType,
        validated.size,
        details.description,
        details.expirationDate ?? null,
        validated.checksum,
      ],
    );
    const documentId = result.insertId;
    const reference = `DOC-${new Date().getFullYear()}-${String(documentId).padStart(6, "0")}`;
    await connection.query(
      "UPDATE documents SET document_reference = ? WHERE document_id = ?",
      [reference, documentId],
    );
    await insertAccess(
      connection,
      documentId,
      user,
      "Upload",
      metadata,
    );
    await insertAudit(
      connection,
      user.numericId,
      "document.uploaded",
      documentId,
      "A protected cooperative document was uploaded.",
      null,
      {
        title: details.title,
        category: details.category,
        accessLevel: details.accessLevel,
        expirationDate: details.expirationDate ?? null,
      },
      metadata,
    );
    await connection.commit();
    return { id: String(documentId), reference };
  } catch (error) {
    await connection.rollback();
    await deleteProtectedFile(stored.storagePath).catch(() => unlink(stored.absolutePath).catch(() => undefined));
    throw error;
  } finally {
    connection.release();
  }
}

export async function recordDocumentRegisterExport(
  user: AuthorizedUser,
  metadata?: RequestMetadata,
) {
  await db.query(
    `INSERT INTO audit_logs
       (user_id, action, entity_table, description, ip_address, user_agent)
     VALUES (?, 'document.register_exported', 'documents',
             'The authorized document register was exported.', ?, ?)`,
    [
      user.numericId,
      metadata?.ipAddress ?? null,
      metadata?.userAgent?.slice(0, 500) ?? null,
    ],
  );
}

export async function updateDocumentMetadata(
  documentId: string,
  input: DocumentMetadataInput,
  user: AuthorizedUser,
  metadata?: RequestMetadata,
) {
  const details = validateMetadata(input);
  const actor = await getActor(user);
  const existingRow = await findDocumentRow(documentId);
  if (!existingRow)
    throw new RecordsError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  const existing = mapDocument(existingRow);
  if (!canManageDocument(actor, policyRecord(existingRow))) {
    throw new RecordsError(
      "You cannot edit this document.",
      403,
      "DOCUMENT_EDIT_FORBIDDEN",
    );
  }
  if (details.expirationDate !== undefined && details.accessLevel !== existing.accessLevel) {
    throw new RecordsError("Change document access separately from its expiration date.", 422, "DOCUMENT_ACCESS_CHANGE_REQUIRES_SEPARATE_UPDATE");
  }
  if (
    !canUploadDocument(actor, {
      accessLevel: details.accessLevel,
      category: details.category,
      documentType: details.documentType,
    })
  ) {
    throw new RecordsError(
      "Those access settings are not allowed.",
      403,
      "ACCESS_FORBIDDEN",
    );
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE documents
          SET title = ?, description = ?, category = ?, document_type = ?,
              access_level = ?, expiration_date = CASE WHEN ? THEN ? ELSE expiration_date END
        WHERE document_id = ?`,
      [
        details.title,
        details.description,
        details.category,
        details.documentType,
        databaseAccess[details.accessLevel],
        details.expirationDate !== undefined,
        details.expirationDate ?? null,
        documentId,
      ],
    );
    const accessChanged = existing.accessLevel !== details.accessLevel;
    if (accessChanged) {
      await insertAccess(
        connection,
        documentId,
        user,
        "Permission Change",
        metadata,
      );
    }
    await insertAudit(
      connection,
      user.numericId,
      accessChanged ? "document.access_changed" : "document.metadata_updated",
      documentId,
      accessChanged
        ? "Document access level and metadata were updated."
        : "Document metadata was updated.",
      {
        title: existing.title,
        category: existing.category,
        accessLevel: existing.accessLevel,
        expirationDate: existing.expirationDate,
      },
      {
        title: details.title,
        category: details.category,
        accessLevel: details.accessLevel,
        expirationDate: details.expirationDate === undefined ? existing.expirationDate : details.expirationDate,
      },
      metadata,
    );
    await connection.commit();
    return { updated: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}



export async function setDocumentArchived(
  documentId: string,
  archived: boolean,
  reason: string | undefined,
  user: AuthorizedUser,
  metadata?: RequestMetadata,
) {
  if (archived && (!reason || reason.trim().length < 3)) {
    throw new RecordsError(
      "Provide an archive reason.",
      422,
      "ARCHIVE_REASON_REQUIRED",
    );
  }
  const row = await findDocumentRow(documentId);
  if (!row)
    throw new RecordsError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  const document = mapDocument(row);
  const actor = await getActor(user);
  if (!canManageDocument(actor, policyRecord(row))) {
    throw new RecordsError(
      "You cannot change this document.",
      403,
      "DOCUMENT_EDIT_FORBIDDEN",
    );
  }
  if (row.databaseStatus === "Replaced" || row.databaseStatus === "Restricted") {
    throw new RecordsError("This document cannot be archived or restored in its current state.", 409, "DOCUMENT_STATUS_INVALID");
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      archived
        ? `UPDATE documents SET document_status = 'Archived' WHERE document_id = ?`
        : `UPDATE documents SET document_status = 'Active' WHERE document_id = ?`,
      [documentId],
    );
    await insertAccess(
      connection,
      documentId,
      user,
      archived ? "Archive" : "Restore",
      metadata,
    );
    await insertAudit(
      connection,
      user.numericId,
      archived ? "document.archived" : "document.restored",
      documentId,
      archived
        ? "The document was archived and preserved."
        : "The document was restored.",
      { status: document.status },
      { status: archived ? "ARCHIVED" : "ACTIVE", reason: reason ?? null },
      metadata,
    );
    await connection.commit();
    return { archived };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getDocumentFile(
  documentId: string,
  user: AuthorizedUser | null,
  action: "Preview" | "Download" | "Print",
  metadata?: RequestMetadata,
) {
  const row = await findDocumentRow(documentId);
  if (!row)
    throw new RecordsError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  const document = mapDocument(row);
  const actor = user ? await getActor(user) : null;
  if (!canAccessDocument(actor, policyRecord(row))) {
    throw new RecordsError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // Link writers must lock this same document row before adding a link.
    // Hold the lock until the file read and its access audit have completed.
    const [files] = await connection.query<(RowDataPacket & { storagePath:string; memberId:string|null; accessLevel:string; category:string|null; documentType:string; fileName:string|null; mimeType:string|null })[]>(
      `SELECT file_path AS storagePath, CAST(member_id AS CHAR) AS memberId, access_level AS accessLevel, category, document_type AS documentType, original_file_name AS fileName, mime_type AS mimeType FROM documents WHERE document_id = ? LIMIT 1 FOR UPDATE`,[documentId],
    );
    const file=files[0];
    if(!file || !canAccessDocument(actor,{accessLevel:apiAccess(file.accessLevel),category:file.category ?? "OTHER",documentType:file.documentType,memberId:file.memberId})) throw new RecordsError("Document file not found.",404,"DOCUMENT_FILE_MISSING");
    if (file.storagePath.startsWith("financial-evidence:")) throw new RecordsError("Document file not found.",404,"DOCUMENT_FILE_MISSING");
    for (const table of ["finance_manual_evidence_links","finance_evidence_upload_intents"] as const) {
      try {
        const [links] = await connection.query<RowDataPacket[]>(`SELECT 1 FROM ${table} WHERE document_id = ? LIMIT 1`,[documentId]);
        if (links.length) throw new RecordsError("Document file not found.",404,"DOCUMENT_FILE_MISSING");
      } catch (error) {
        if ((error as {code?:string}).code !== "ER_NO_SUCH_TABLE") throw error;
      }
    }
    let contents: Buffer;
    try { contents=await readProtectedDocument(file.storagePath); }
    catch { throw new RecordsError("The stored file is unavailable. Its metadata has been preserved.",404,"DOCUMENT_FILE_MISSING"); }
    await insertAccess(
      connection,
      documentId,
      user,
      action,
      metadata,
    );
    if (
      user &&
      (action === "Download" ||
        action === "Print" ||
        apiAccess(file.accessLevel) !== "PUBLIC")
    ) {
      await insertAudit(
        connection,
        user.numericId,
        `document.${action.toLowerCase()}`,
        documentId,
        `Document was ${action.toLowerCase()}ed.`,
        null,
        { accessLevel: apiAccess(file.accessLevel) },
        metadata,
      );
    }
    await connection.commit();
    return { contents, fileName:(file.fileName ?? document.fileName).replaceAll('"', ""), mimeType:file.mimeType ?? document.mimeType };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
