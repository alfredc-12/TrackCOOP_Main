import { createHash, randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type { AuthorizedUser } from "@/lib/next-api-auth";
import { db } from "@/lib/db";
import {
  DOCUMENT_ACCESS_LEVELS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPES,
} from "../record-constants";
import type {
  DocumentAccessLevel,
  DocumentDetail,
  DocumentListResponse,
  DocumentRecord,
  DocumentStatus,
} from "../records-types";
import {
  canAccessDocument,
  canManageDocument,
  canUploadDocument,
  type DocumentPolicyActor,
  type DocumentPolicyRecord,
} from "./document-policy";
import {
  resolveProtectedDocumentPath,
  storeProtectedDocument,
  validateDocumentFile,
  type UploadedFileLike,
} from "./document-security";
import { RecordsError } from "./records-error";

type DocumentRow = RowDataPacket & {
  id: string;
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
type ChecksumRow = RowDataPacket & { id: string; checksum: string | null };

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
  expirationDate?: string;
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

export function calculateDocumentStatus(
  databaseStatus: string,
  expirationDate: string | null,
  now = new Date(),
): DocumentStatus {
  if (databaseStatus === "Archived") return "ARCHIVED";
  if (!expirationDate) return "ACTIVE";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiration = new Date(`${expirationDate.slice(0, 10)}T00:00:00`);
  if (expiration < today) return "EXPIRED";
  const warning = new Date(today);
  warning.setDate(warning.getDate() + 30);
  return expiration <= warning ? "EXPIRING_SOON" : "ACTIVE";
}

function mapDocument(row: DocumentRow): DocumentRecord {
  const expirationDate = dateKey(row.expirationDate);
  return {
    id: row.id,
    reference: row.reference ?? `DOC-${row.id}`,
    title: row.title,
    description: row.description,
    category: row.category ?? "OTHER",
    documentType: row.documentType,
    accessLevel: apiAccess(row.accessLevel),
    status: calculateDocumentStatus(row.databaseStatus, expirationDate),
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
           u.display_name AS uploadedBy,
           CAST(d.uploaded_by AS CHAR) AS uploadedById,
           d.uploaded_at AS uploadedAt,
           d.updated_at AS updatedAt
      FROM documents d
      LEFT JOIN users u ON u.user_id = d.uploaded_by`;
}

async function getActor(user: AuthorizedUser): Promise<DocumentPolicyActor> {
  let memberId: number | null = null;
  if (user.role === "member") {
    const [rows] = await db.query<IdRow[]>(
      "SELECT CAST(member_id AS CHAR) AS id FROM member_profiles WHERE user_id = ? LIMIT 1",
      [user.numericId],
    );
    memberId = rows[0] ? Number(rows[0].id) : null;
  }
  return { role: user.role, userId: user.numericId, memberId };
}

function policyRecord(document: DocumentRecord): DocumentPolicyRecord {
  return {
    accessLevel: document.accessLevel,
    category: document.category,
    documentType: document.documentType,
  };
}

function visibilitySql(actor: DocumentPolicyActor | null) {
  if (actor?.role === "chairman") return { sql: "1 = 1", values: [] };
  if (actor?.role === "bookkeeper") {
    return {
      sql: `(d.access_level IN ('Public', 'Bookkeeper-only')
             OR (d.access_level <> 'Admin-only' AND (
               d.category IN ('FINANCIAL','RECEIPT','RENTAL','POS_AND_SALES','INVENTORY')
               OR d.document_type IN ('Receipt','Financial Document')
             )))`,
      values: [],
    };
  }
  if (actor?.role === "member" && actor.memberId) {
    return {
      sql: "(d.access_level = 'Public' OR (d.access_level = 'Member-only' AND (d.member_id IS NULL OR d.member_id = ?)))",
      values: [actor.memberId],
    };
  }
  return { sql: "d.access_level = 'Public'", values: [] };
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
  };
}

export async function listDocuments(
  input: DocumentListInput,
  user: AuthorizedUser,
): Promise<DocumentListResponse> {
  const actor = await getActor(user);
  const visibility = visibilitySql(actor);
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
  if (input.status === "ARCHIVED") {
    where.push("d.document_status = 'Archived'");
  } else if (input.status === "EXPIRED") {
    where.push("1 = 0");
  } else if (input.status === "EXPIRING_SOON") {
    where.push("1 = 0");
  } else if (input.status === "ACTIVE") {
    where.push("d.document_status <> 'Archived'");
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
  const summaryVisibility = visibilitySql(actor);
  const [summaryRows] = await db.query<SummaryRow[]>(
    `SELECT COUNT(*) AS total,
            SUM(d.uploaded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS recentlyUploaded,
            0 AS expiringSoon,
            SUM(d.document_status = 'Archived') AS archived,
            SUM(d.access_level <> 'Public') AS restricted
       FROM documents d
      WHERE ${summaryVisibility.sql}`,
    summaryVisibility.values,
  );
  const [uploaderRows] = await db.query<
    (RowDataPacket & { id: string; name: string })[]
  >(
    `SELECT DISTINCT CAST(u.user_id AS CHAR) AS id, u.display_name AS name
       FROM users u JOIN documents d ON d.uploaded_by = u.user_id
      ORDER BY u.display_name`,
  );
  const summary = summaryRows[0];
  return {
    documents: rows.map(mapDocument),
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
  if (!canAccessDocument(actor, policyRecord(document))) {
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
  // The checksum duplicate check has been removed because the checksum_sha256 column was dropped during database simplification.

  const stored = await storeProtectedDocument(validated);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const temporaryReference = `DOC-TMP-${randomUUID()}`;
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO documents (
        document_reference, uploaded_by, title, category, document_type,
        access_level, document_status, file_path, original_file_name, mime_type,
        file_size_bytes, description
      ) VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?)`,
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
      },
      metadata,
    );
    await connection.commit();
    return { id: String(documentId), reference };
  } catch (error) {
    await connection.rollback();
    await unlink(stored.absolutePath).catch(() => undefined);
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
  if (!canManageDocument(actor, policyRecord(existing))) {
    throw new RecordsError(
      "You cannot edit this document.",
      403,
      "DOCUMENT_EDIT_FORBIDDEN",
    );
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
              access_level = ?
        WHERE document_id = ?`,
      [
        details.title,
        details.description,
        details.category,
        details.documentType,
        databaseAccess[details.accessLevel],
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
      },
      {
        title: details.title,
        category: details.category,
        accessLevel: details.accessLevel,
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
  if (!canManageDocument(actor, policyRecord(document))) {
    throw new RecordsError(
      "You cannot change this document.",
      403,
      "DOCUMENT_EDIT_FORBIDDEN",
    );
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
  if (!canAccessDocument(actor, policyRecord(document))) {
    throw new RecordsError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  }

  const [files] = await db.query<(RowDataPacket & { storagePath: string })[]>(
    `SELECT file_path AS storagePath FROM documents WHERE document_id = ? LIMIT 1`,
    [documentId],
  );
  if (!files[0]) {
    throw new RecordsError("Document file not found.", 404, "DOCUMENT_FILE_MISSING");
  }

  let contents: Buffer;
  try {
    const absolutePath = resolveProtectedDocumentPath(files[0].storagePath);
    contents = await readFile(/* turbopackIgnore: true */ absolutePath);
  } catch {
    throw new RecordsError(
      "The stored file is unavailable. Its metadata has been preserved.",
      404,
      "DOCUMENT_FILE_MISSING",
    );
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
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
        document.accessLevel !== "PUBLIC")
    ) {
      await insertAudit(
        connection,
        user.numericId,
        `document.${action.toLowerCase()}`,
        documentId,
        `Document was ${action.toLowerCase()}ed.`,
        null,
        { accessLevel: document.accessLevel },
        metadata,
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return {
    contents,
    fileName: document.fileName.replaceAll('"', ""),
    mimeType: document.mimeType,
  };
}
