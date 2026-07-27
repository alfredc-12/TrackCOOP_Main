import { randomUUID } from "node:crypto";
import path from "node:path";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";

export type CentralDocumentInput = {
  uploadedBy?: string | number | null;
  uploaderRole?: string | null;
  memberId?: string | number | null;
  title: string;
  description?: string | null;
  category: string;
  documentType:
    | "Receipt"
    | "Certificate"
    | "Waiver"
    | "Financial Document"
    | "Annual Plan"
    | "Business Plan"
    | "Agency Report"
    | "Public Document"
    | "Other";
  accessLevel: "Public" | "Member-only" | "Admin-only" | "Bookkeeper-only";
  storagePath: string;
  originalFileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  checksum?: string | null;
  relatedModule: string;
  relatedRecordId: string | number;
  relatedRecordReference?: string | null;
  relationshipType: string;
};

export async function createCentralDocument(
  connection: PoolConnection,
  input: CentralDocumentInput,
) {
  const originalFileName =
    input.originalFileName ??
    path.basename(input.storagePath.replaceAll("\\", "/"));
  const storedFileName = path.basename(input.storagePath.replaceAll("\\", "/"));
  const extension = path.extname(originalFileName).slice(1).toLowerCase();
  const temporaryReference = `DOC-TMP-${randomUUID()}`;
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO documents (
      document_reference, uploaded_by, member_id, title, category, document_type,
      access_level, document_status, file_path, original_file_name, mime_type,
      file_size_bytes, checksum_sha256, description, related_module,
      related_record_id, related_record_reference, relationship_type, current_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      temporaryReference,
      input.uploadedBy ?? null,
      input.memberId ?? null,
      input.title,
      input.category,
      input.documentType,
      input.accessLevel,
      input.storagePath,
      originalFileName,
      input.mimeType ?? "application/octet-stream",
      input.fileSizeBytes ?? null,
      input.checksum ?? null,
      input.description ?? null,
      input.relatedModule,
      input.relatedRecordId,
      input.relatedRecordReference ?? null,
      input.relationshipType,
    ],
  );
  const reference = `DOC-${new Date().getUTCFullYear()}-${String(result.insertId).padStart(6, "0")}`;
  await connection.execute(
    "UPDATE documents SET document_reference = ? WHERE document_id = ?",
    [reference, result.insertId],
  );
  const [versionResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO document_versions (
      document_id, version_number, original_file_name, stored_file_name,
      storage_path, mime_type, file_extension, file_size_bytes, checksum_sha256,
      change_note, uploaded_by
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.insertId,
      originalFileName,
      storedFileName,
      input.storagePath,
      input.mimeType ?? "application/octet-stream",
      extension,
      input.fileSizeBytes ?? null,
      input.checksum ?? null,
      "Initial version linked from the source module.",
      input.uploadedBy ?? null,
    ],
  );
  await connection.execute(
    `INSERT INTO document_access_logs
       (document_id, document_version_id, user_id, user_role, access_action)
     VALUES (?, ?, ?, ?, 'Upload')`,
    [
      result.insertId,
      versionResult.insertId,
      input.uploadedBy ?? null,
      input.uploaderRole ?? (input.uploadedBy ? "authenticated" : "public"),
    ],
  );
  await connection.execute(
    `INSERT INTO audit_logs
       (user_id, action, entity_table, record_id, description, new_values)
     VALUES (?, 'document.module_linked', 'documents', ?,
             'A source-module file was linked to the central Documents register.', ?)`,
    [
      input.uploadedBy ?? null,
      result.insertId,
      JSON.stringify({
        sourceModule: input.relatedModule,
        sourceRecordId: input.relatedRecordId,
        documentReference: reference,
      }),
    ],
  );
  return { documentId: result.insertId, documentReference: reference };
}
