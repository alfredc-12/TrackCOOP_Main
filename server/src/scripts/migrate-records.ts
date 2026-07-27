import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "../db/pool";
import { createCentralDocument } from "../records/central-document";
import { createGeneratedPdfDocument } from "../records/generated-pdf-document";

type CountRow = RowDataPacket & { total: number };

const documentColumns: Array<[string, string]> = [
  ["document_reference", "VARCHAR(60) NULL"],
  ["category", "VARCHAR(80) NULL"],
  ["related_module", "VARCHAR(80) NULL"],
  ["related_record_id", "BIGINT UNSIGNED NULL"],
  ["related_record_reference", "VARCHAR(120) NULL"],
  ["relationship_type", "VARCHAR(80) NULL"],
  ["document_date", "DATE NULL"],
  ["expiration_date", "DATE NULL"],
  ["current_version", "INT UNSIGNED NOT NULL DEFAULT 1"],
  ["tags", "TEXT NULL"],
  ["internal_note", "TEXT NULL"],
  ["archived_by", "BIGINT UNSIGNED NULL"],
  ["archived_at", "DATETIME NULL"],
  ["archive_reason", "TEXT NULL"],
];

const reportColumns: Array<[string, string]> = [
  ["report_key", "VARCHAR(80) NULL"],
  ["report_title", "VARCHAR(255) NULL"],
  ["report_category", "VARCHAR(80) NULL"],
  ["summary_json", "LONGTEXT NULL"],
  ["output_format", "VARCHAR(20) NULL"],
  ["archived_at", "DATETIME NULL"],
  ["archive_reason", "TEXT NULL"],
];

async function exists(
  kind: "columns" | "statistics",
  tableName: string,
  name: string,
) {
  const pool = getPool();
  const nameColumn = kind === "columns" ? "column_name" : "index_name";
  const [rows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total
       FROM information_schema.${kind}
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND ${nameColumn} = ?`,
    [tableName, name],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function addColumns(tableName: string, columns: Array<[string, string]>) {
  const pool = getPool();
  for (const [name, definition] of columns) {
    if (!(await exists("columns", tableName, name))) {
      await pool.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${name}\` ${definition}`,
      );
      console.log(`Added ${tableName}.${name}`);
    }
  }
}

async function addIndex(tableName: string, indexName: string, sql: string) {
  if (!(await exists("statistics", tableName, indexName))) {
    await getPool().query(sql);
    console.log(`Added ${indexName}`);
  }
}

async function constraintExists(tableName: string, constraintName: string) {
  const [rows] = await getPool().execute<CountRow[]>(
    `SELECT COUNT(*) AS total
       FROM information_schema.table_constraints
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND constraint_name = ?`,
    [tableName, constraintName],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function migrate() {
  const pool = getPool();

  await addColumns("documents", documentColumns);
  await pool.query(
    "ALTER TABLE documents MODIFY uploaded_by BIGINT UNSIGNED NULL",
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_versions (
      document_version_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      document_id BIGINT UNSIGNED NOT NULL,
      version_number INT UNSIGNED NOT NULL,
      original_file_name VARCHAR(255) NOT NULL,
      stored_file_name VARCHAR(255) NOT NULL,
      storage_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      file_extension VARCHAR(20) NOT NULL,
      file_size_bytes BIGINT UNSIGNED NOT NULL,
      checksum_sha256 CHAR(64) NOT NULL,
      change_note TEXT NULL,
      uploaded_by BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_document_versions_number UNIQUE (document_id, version_number),
      CONSTRAINT fk_document_versions_document FOREIGN KEY (document_id)
        REFERENCES documents(document_id) ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT fk_document_versions_uploader FOREIGN KEY (uploaded_by)
        REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
      INDEX idx_document_versions_created (document_id, created_at)
    ) ENGINE=InnoDB
  `);
  await pool.query(
    "ALTER TABLE document_versions MODIFY uploaded_by BIGINT UNSIGNED NULL",
  );
  await pool.query(
    "ALTER TABLE document_versions MODIFY file_size_bytes BIGINT UNSIGNED NULL",
  );
  await pool.query(
    "ALTER TABLE document_versions MODIFY checksum_sha256 CHAR(64) NULL",
  );

  await addColumns("document_access_logs", [
    ["document_version_id", "BIGINT UNSIGNED NULL"],
    ["user_role", "VARCHAR(40) NULL"],
  ]);
  await pool.query(`
    ALTER TABLE document_access_logs
    MODIFY access_action
      ENUM('View','Preview','Download','Print','Upload','Replace','Permission Change','Archive','Restore') NOT NULL
  `);
  await addIndex(
    "document_access_logs",
    "idx_document_access_version",
    "ALTER TABLE document_access_logs ADD INDEX idx_document_access_version (document_version_id, accessed_at)",
  );
  if (
    !(await constraintExists(
      "document_access_logs",
      "fk_document_access_version",
    ))
  ) {
    await pool.query(
      `ALTER TABLE document_access_logs
         ADD CONSTRAINT fk_document_access_version
         FOREIGN KEY (document_version_id)
         REFERENCES document_versions(document_version_id)
         ON UPDATE CASCADE ON DELETE SET NULL`,
    );
    console.log("Added fk_document_access_version");
  }

  await pool.query(`
    UPDATE documents
       SET document_reference = CONCAT('DOC-', YEAR(uploaded_at), '-', LPAD(document_id, 6, '0'))
     WHERE document_reference IS NULL OR document_reference = ''
  `);
  await pool.query(`
    UPDATE documents
       SET category = CASE document_type
         WHEN 'Receipt' THEN 'RECEIPT'
         WHEN 'Certificate' THEN 'CERTIFICATE'
         WHEN 'Waiver' THEN 'WAIVER'
         WHEN 'Financial Document' THEN 'FINANCIAL'
         WHEN 'Annual Plan' THEN 'ANNUAL_PLAN'
         WHEN 'Business Plan' THEN 'BUSINESS_PLAN'
         WHEN 'Agency Report' THEN 'AGENCY_REPORT'
         WHEN 'Public Document' THEN 'ANNOUNCEMENT'
         ELSE 'OTHER'
       END
     WHERE category IS NULL OR category = ''
  `);
  await addIndex(
    "documents",
    "uq_documents_reference",
    "ALTER TABLE documents ADD UNIQUE INDEX uq_documents_reference (document_reference)",
  );
  await addIndex(
    "documents",
    "idx_documents_records_filters",
    "ALTER TABLE documents ADD INDEX idx_documents_records_filters (category, related_module, expiration_date)",
  );
  await pool.query(`
    INSERT INTO document_versions (
      document_id, version_number, original_file_name, stored_file_name,
      storage_path, mime_type, file_extension, file_size_bytes, checksum_sha256,
      change_note, uploaded_by, created_at
    )
    SELECT d.document_id,
           1,
           COALESCE(d.original_file_name, CONCAT('document-', d.document_id)),
           SUBSTRING_INDEX(REPLACE(d.file_path, '\\\\', '/'), '/', -1),
           d.file_path,
           COALESCE(d.mime_type, 'application/octet-stream'),
           LOWER(TRIM(LEADING '.' FROM SUBSTRING_INDEX(COALESCE(d.original_file_name, d.file_path), '.', -1))),
           COALESCE(d.file_size_bytes, 0),
           COALESCE(d.checksum_sha256, REPEAT('0', 64)),
           'Initial version migrated from the existing document record.',
           d.uploaded_by,
           d.uploaded_at
      FROM documents d
     WHERE NOT EXISTS (
       SELECT 1
         FROM document_versions v
        WHERE v.document_id = d.document_id AND v.version_number = 1
     )
  `);

  await addColumns("reports", reportColumns);
  await pool.query(`
    UPDATE reports
       SET report_key = COALESCE(NULLIF(report_key, ''), LOWER(REPLACE(report_type, ' ', '-'))),
           report_title = COALESCE(NULLIF(report_title, ''), report_type),
           report_category = COALESCE(NULLIF(report_category, ''),
             CASE
               WHEN report_type IN ('Financial Summary', 'Transaction Ledger', 'Share Capital Summary', 'Payment Validation') THEN 'FINANCIAL'
               WHEN report_type = 'Rental' THEN 'RENTAL'
               WHEN report_type IN ('POS Sales', 'Inventory Movement') THEN 'SALES_INVENTORY'
               WHEN report_type IN ('Member Master List', 'Member Engagement', 'Barangay Distribution') THEN 'MEMBERSHIP'
               WHEN report_type = 'Documents' THEN 'DOCUMENTS'
               ELSE 'AUDIT_ADMINISTRATION'
             END),
           output_format = COALESCE(NULLIF(output_format, ''), CASE WHEN file_path IS NULL THEN 'PREVIEW' ELSE 'PDF' END)
  `);
  await addIndex(
    "reports",
    "idx_reports_register",
    "ALTER TABLE reports ADD INDEX idx_reports_register (report_category, generation_status, generated_at)",
  );

  const applicationReferenceColumn = (await exists(
    "columns",
    "membership_applications",
    "application_reference",
  ))
    ? "ma.application_reference"
    : "ma.application_code";
  const applicationDocumentUploaderColumn = (await exists(
    "columns",
    "membership_application_documents",
    "uploaded_by_user_id",
  ))
    ? "CAST(mad.uploaded_by_user_id AS CHAR)"
    : "NULL";

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [applicationDocuments] = await connection.query<
      (RowDataPacket & {
        id: string;
        applicationId: string;
        applicationReference: string;
        documentType: string;
        originalFileName: string;
        storagePath: string;
        mimeType: string;
        fileSizeBytes: number;
        uploadedBy: string | null;
      })[]
    >(
      `SELECT CAST(mad.membership_application_document_id AS CHAR) AS id,
              CAST(mad.membership_application_id AS CHAR) AS applicationId,
              ${applicationReferenceColumn} AS applicationReference,
              mad.document_type AS documentType,
              mad.original_file_name AS originalFileName,
              mad.stored_file_path AS storagePath,
              mad.mime_type AS mimeType,
              mad.file_size_bytes AS fileSizeBytes,
              ${applicationDocumentUploaderColumn} AS uploadedBy
         FROM membership_application_documents mad
         JOIN membership_applications ma
           ON ma.membership_application_id = mad.membership_application_id
        WHERE NOT EXISTS (
          SELECT 1 FROM documents d
           WHERE d.related_module = 'MEMBERSHIP_APPLICATION'
             AND d.related_record_id = mad.membership_application_id
             AND d.relationship_type = CONCAT('MIGRATED_ATTACHMENT_', mad.membership_application_document_id)
        )`,
    );
    for (const document of applicationDocuments) {
      await createCentralDocument(connection, {
        uploadedBy: document.uploadedBy,
        title: `${document.applicationReference} – ${document.documentType}`,
        description:
          "Existing protected membership attachment linked during the records migration.",
        category: "MEMBERSHIP",
        documentType: "Other",
        accessLevel: "Admin-only",
        storagePath: document.storagePath,
        originalFileName: document.originalFileName,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
        relatedModule: "MEMBERSHIP_APPLICATION",
        relatedRecordId: document.applicationId,
        relatedRecordReference: document.applicationReference,
        relationshipType: `MIGRATED_ATTACHMENT_${document.id}`,
      });
    }

    const [paymentProofs] = await connection.query<
      (RowDataPacket & {
        id: string;
        memberId: string | null;
        uploadedBy: string | null;
        storagePath: string;
        purpose: string;
      })[]
    >(
      `SELECT CAST(pr.payment_reference_id AS CHAR) AS id,
              CAST(pr.member_id AS CHAR) AS memberId,
              CAST(pr.submitted_by AS CHAR) AS uploadedBy,
              pr.proof_file_path AS storagePath,
              pr.payment_purpose AS purpose
         FROM payment_references pr
        WHERE pr.proof_file_path IS NOT NULL
          AND pr.proof_file_path <> ''
          AND NOT EXISTS (
            SELECT 1 FROM documents d
             WHERE d.related_module = 'PAYMENT'
               AND d.related_record_id = pr.payment_reference_id
               AND d.relationship_type = 'PAYMENT_PROOF'
          )`,
    );
    for (const proof of paymentProofs) {
      const extension = proof.storagePath.split(".").pop()?.toLowerCase();
      await createCentralDocument(connection, {
        uploadedBy: proof.uploadedBy,
        memberId: proof.memberId,
        title: `Payment Proof – PAY-${proof.id.padStart(6, "0")}`,
        description: `Existing protected ${proof.purpose} payment proof linked during the records migration.`,
        category: "FINANCIAL",
        documentType: "Financial Document",
        accessLevel: proof.memberId ? "Member-only" : "Bookkeeper-only",
        storagePath: proof.storagePath,
        mimeType:
          extension === "pdf"
            ? "application/pdf"
            : extension === "png"
              ? "image/png"
              : "image/jpeg",
        relatedModule: "PAYMENT",
        relatedRecordId: proof.id,
        relatedRecordReference: `PAY-${proof.id.padStart(6, "0")}`,
        relationshipType: "PAYMENT_PROOF",
      });
    }

    const [validatedPayments] = await connection.query<
      (RowDataPacket & {
        id: string;
        memberId: string | null;
        validatedBy: string | null;
        validatorRole: string | null;
        payerName: string | null;
        provider: string;
        referenceNumber: string;
        purpose: string;
        amount: string;
        validatedAt: string | null;
      })[]
    >(
      `SELECT CAST(pr.payment_reference_id AS CHAR) AS id,
              CAST(pr.member_id AS CHAR) AS memberId,
              CAST(pr.validated_by AS CHAR) AS validatedBy,
              r.role_slug AS validatorRole,
              pr.payer_name AS payerName,
              pr.provider,
              pr.reference_number AS referenceNumber,
              pr.payment_purpose AS purpose,
              CAST(pr.amount AS CHAR) AS amount,
              CAST(pr.validated_at AS CHAR) AS validatedAt
         FROM payment_references pr
         LEFT JOIN users u ON u.user_id = pr.validated_by
         LEFT JOIN roles r ON r.role_id = u.role_id
        WHERE pr.validation_status = 'Validated'
          AND NOT EXISTS (
            SELECT 1 FROM documents d
             WHERE d.related_module = 'PAYMENT'
               AND d.related_record_id = pr.payment_reference_id
               AND d.relationship_type = 'SYSTEM_RECEIPT'
          )`,
    );
    for (const payment of validatedPayments) {
      const receiptReference = `RCP-${new Date().getUTCFullYear()}-${payment.id.padStart(6, "0")}`;
      await createGeneratedPdfDocument(connection, {
        uploadedBy: payment.validatedBy,
        uploaderRole: payment.validatorRole,
        memberId: payment.memberId,
        title: `Payment Receipt ${receiptReference}`,
        description:
          "System-generated receipt reconstructed from an existing validated payment record.",
        category: "RECEIPT",
        documentType: "Receipt",
        accessLevel: payment.memberId ? "Member-only" : "Bookkeeper-only",
        relatedModule: "PAYMENT",
        relatedRecordId: payment.id,
        relatedRecordReference: `PAY-${payment.id.padStart(6, "0")}`,
        relationshipType: "SYSTEM_RECEIPT",
        fileBaseName: receiptReference,
        heading: "Validated Payment Receipt",
        lines: [
          { label: "Receipt number", value: receiptReference },
          { label: "Payer", value: payment.payerName },
          { label: "Payment purpose", value: payment.purpose },
          { label: "Amount paid", value: `PHP ${payment.amount}` },
          { label: "Payment provider", value: payment.provider },
          { label: "Payment reference", value: payment.referenceNumber },
          { label: "Validated at", value: payment.validatedAt },
          { label: "Validation status", value: "Validated" },
        ],
      });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [counts] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM documents) AS documents,
      (SELECT COUNT(*) FROM document_versions) AS versions,
      (SELECT COUNT(*) FROM reports) AS reports
  `);
  console.log("Records migration completed:", counts[0]);
  await pool.end();
}

migrate().catch(async (error) => {
  console.error("Records migration failed:", error);
  process.exitCode = 1;
  await getPool().end();
});
