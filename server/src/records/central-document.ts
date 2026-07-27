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

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO documents (
      uploaded_by, member_id, title, document_type,
      access_level, document_status, file_path, original_file_name, mime_type,
      file_size_bytes, checksum_sha256, description
    ) VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?)`,
    [
      input.uploadedBy ?? null,
      input.memberId ?? null,
      input.title,
      input.documentType,
      input.accessLevel,
      input.storagePath,
      originalFileName,
      input.mimeType ?? "application/octet-stream",
      input.fileSizeBytes ?? null,
      input.checksum ?? null,
      input.description ?? null,
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
      }),
    ],
  );
  return { documentId: result.insertId };
}
