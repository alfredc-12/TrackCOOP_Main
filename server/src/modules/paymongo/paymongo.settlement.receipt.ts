import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import PDFDocument from "pdfkit";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { createCentralDocument } from "../../records/central-document";
import { normalizeProtectedStoragePath, protectedUploadRoot } from "../../storage/protected-storage";
import type { PaymentValidationSource } from "./paymongo.settlement.types";

export type ReceiptProcessingStatus = "Pending" | "Processing" | "Generated" | "Failed";
export type PaymentReceiptStatus = {
  paymentReferenceId: string;
  receiptNumber: string;
  processingStatus: ReceiptProcessingStatus;
  documentId: string | null;
  attemptCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  reversedAt: Date | null;
  reversalNote: string | null;
};

type ReceiptRow = RowDataPacket & PaymentReceiptStatus & {
  memberId: string | null;
  issuedBy: string;
  amount: string | number;
  paymentChannel: string;
  provider: string;
  validationSource: PaymentValidationSource;
  subjectReference: string | null;
  paymentDate: Date | null;
  validatedAt: Date | null;
  payerName: string | null;
  paymentPurpose: string;
  trackcoopReference: string;
};

function safeError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "RECEIPT_GENERATION_FAILED")
    : "RECEIPT_GENERATION_FAILED";
  const message = error instanceof Error ? error.message : "Receipt generation failed";
  return { code: code.slice(0, 120), message: message.slice(0, 1000) };
}

function mysqlDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}
function mysqlDateTime(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 19).replace("T", " ") : null;
}

export async function queuePaymentReceipt(connection: PoolConnection, input: {
  paymentReferenceId: string;
  memberId: string | null;
  actorUserId: string;
  amount: number;
  paymentChannel: string;
  provider: string;
  validationSource: PaymentValidationSource;
  subjectReference: string;
  paymentDate: Date | null;
  validatedAt: Date | null;
}) {
  const receiptNumber = `PAY-RCPT-${new Date().getUTCFullYear()}-${input.paymentReferenceId.padStart(6, "0")}`;
  await connection.execute(
    `INSERT INTO payment_receipts
       (payment_reference_id, member_id, document_id, receipt_number, amount,
        payment_channel, provider, validation_source, subject_reference,
        payment_date, validated_at, processing_status, issued_by, issued_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       member_id = COALESCE(member_id, VALUES(member_id)),
       validation_source = VALUES(validation_source),
       subject_reference = VALUES(subject_reference),
       payment_date = COALESCE(payment_date, VALUES(payment_date)),
       validated_at = COALESCE(validated_at, VALUES(validated_at)),
       processing_status = CASE WHEN document_id IS NULL THEN 'Pending' ELSE 'Generated' END`,
    [input.paymentReferenceId, input.memberId, receiptNumber, input.amount,
      input.paymentChannel, input.provider, input.validationSource, input.subjectReference,
      mysqlDate(input.paymentDate), mysqlDateTime(input.validatedAt), input.actorUserId],
  );
}

async function selectReceipt(connection: Pool | PoolConnection, paymentReferenceId: string, lock = false) {
  const [rows] = await connection.execute<ReceiptRow[]>(
    `SELECT CAST(r.payment_reference_id AS CHAR) AS paymentReferenceId,
            r.receipt_number AS receiptNumber,
            r.processing_status AS processingStatus,
            CAST(r.document_id AS CHAR) AS documentId,
            r.attempt_count AS attemptCount,
            r.last_error_code AS lastErrorCode,
            r.last_error_message AS lastErrorMessage,
            r.reversed_at AS reversedAt,
            r.reversal_note AS reversalNote,
            CAST(r.member_id AS CHAR) AS memberId,
            CAST(r.issued_by AS CHAR) AS issuedBy,
            r.amount, r.payment_channel AS paymentChannel, r.provider,
            r.validation_source AS validationSource,
            r.subject_reference AS subjectReference,
            r.payment_date AS paymentDate, r.validated_at AS validatedAt,
            p.payer_name AS payerName, p.payment_purpose AS paymentPurpose,
            p.reference_number AS trackcoopReference
       FROM payment_receipts r
       JOIN payment_references p ON p.payment_reference_id = r.payment_reference_id
      WHERE r.payment_reference_id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [paymentReferenceId],
  );
  return rows[0] ?? null;
}

function renderReceipt(row: ReceiptRow) {
  const document = new PDFDocument({ size: "A4", margin: 52 });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  document.fillColor("#174a32").fontSize(11).text("Nasugbu Farmers and Fisherfolks Agriculture Cooperative");
  document.fillColor("#52675a").fontSize(9).text("TrackCOOP Records System");
  document.moveDown(1.25).fillColor("#173d2c").fontSize(20).text("Validated Payment Receipt");
  document.moveDown(1);
  const lines = [
    ["Receipt / reference number", row.receiptNumber],
    ["Payer", row.payerName ?? "Not recorded"],
    ["Member or application reference", row.subjectReference ?? "Not recorded"],
    ["Purpose", row.paymentPurpose],
    ["Amount", `PHP ${Number(row.amount).toFixed(2)}`],
    ["Channel", row.paymentChannel],
    ["Provider", row.provider],
    ["Validation source", row.validationSource],
    ["Payment date", row.paymentDate ? new Date(row.paymentDate).toISOString().slice(0, 10) : "Not recorded"],
    ["Validation date", row.validatedAt ? new Date(row.validatedAt).toISOString() : "Not recorded"],
    ["TrackCOOP payment reference", row.trackcoopReference],
  ];
  for (const [label, value] of lines) {
    document.fillColor("#52675a").fontSize(9).text(label.toUpperCase());
    document.fillColor("#17251d").fontSize(11).text(value);
    document.moveDown(0.6);
  }
  document.moveDown(1).fillColor("#6b766f").fontSize(8)
    .text("This protected system receipt reflects a validated TrackCOOP payment record.");
  document.end();
  return complete;
}

async function writeDeterministicReceipt(row: ReceiptRow) {
  const buffer = await renderReceipt(row);
  const year = String((row.validatedAt ?? new Date()).getUTCFullYear());
  const storagePath = normalizeProtectedStoragePath(`generated/receipts/${year}/payment-${row.paymentReferenceId}.pdf`);
  const absolutePath = path.join(protectedUploadRoot, "generated", "receipts", year, `payment-${row.paymentReferenceId}.pdf`);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer, { flag: "w" });
  return { buffer, storagePath };
}

export interface PaymentReceiptService {
  getStatus(paymentReferenceId: string): Promise<PaymentReceiptStatus | null>;
  process(paymentReferenceId: string): Promise<PaymentReceiptStatus | null>;
}

export function createPaymentReceiptService(pool?: Pool): PaymentReceiptService {
  const databasePool = () => pool ?? getPool();
  return {
    async getStatus(paymentReferenceId) {
      const row = await selectReceipt(databasePool(), paymentReferenceId);
      if (!row) return null;
      const { memberId: _m, issuedBy: _i, amount: _a, paymentChannel: _c, provider: _p,
        validationSource: _v, subjectReference: _s, paymentDate: _pd, validatedAt: _va,
        payerName: _pn, paymentPurpose: _pp, trackcoopReference: _tr, ...status } = row;
      return status;
    },
    async process(paymentReferenceId) {
      const claimed = await withTransaction(async (connection) => {
        const row = await selectReceipt(connection, paymentReferenceId, true);
        if (!row || row.processingStatus === "Generated") return row;
        await connection.execute(
          `UPDATE payment_receipts SET processing_status = 'Processing',
                  attempt_count = attempt_count + 1, last_attempt_at = UTC_TIMESTAMP(),
                  last_error_code = NULL, last_error_message = NULL
            WHERE payment_reference_id = ?`,
          [paymentReferenceId],
        );
        return { ...row, processingStatus: "Processing" as const };
      }, databasePool());
      if (!claimed || claimed.processingStatus === "Generated") return claimed;
      try {
        const file = await writeDeterministicReceipt(claimed);
        await withTransaction(async (connection) => {
          const current = await selectReceipt(connection, paymentReferenceId, true);
          if (!current || current.processingStatus === "Generated") return;
          const [documentRows] = await connection.execute<(RowDataPacket & { id: string })[]>(
            `SELECT CAST(document_id AS CHAR) AS id FROM documents
              WHERE related_module = 'Payment' AND related_record_id = ?
                AND relationship_type = 'Payment Receipt' LIMIT 1 FOR UPDATE`,
            [paymentReferenceId],
          );
          let documentId = documentRows[0]?.id;
          if (!documentId) {
            const document = await createCentralDocument(connection, {
              uploadedBy: current.issuedBy,
              uploaderRole: "system",
              memberId: current.memberId,
              title: `Payment Receipt ${current.receiptNumber}`,
              description: `Validated ${current.paymentPurpose} receipt for ${current.trackcoopReference}.`,
              category: "Payment Receipt",
              documentType: "Receipt",
              accessLevel: current.memberId ? "Member-only" : "Bookkeeper-only",
              storagePath: file.storagePath,
              originalFileName: `${current.receiptNumber}.pdf`,
              mimeType: "application/pdf",
              fileSizeBytes: file.buffer.length,
              checksum: createHash("sha256").update(file.buffer).digest("hex"),
              relatedModule: "Payment",
              relatedRecordId: paymentReferenceId,
              relatedRecordReference: current.trackcoopReference,
              relationshipType: "Payment Receipt",
            });
            documentId = String(document.documentId);
          }
          await connection.execute(
            `UPDATE payment_receipts SET document_id = ?, processing_status = 'Generated',
                    generated_at = UTC_TIMESTAMP(), last_error_code = NULL,
                    last_error_message = NULL WHERE payment_reference_id = ?`,
            [documentId, paymentReferenceId],
          );
        }, databasePool());
      } catch (error) {
        const safe = safeError(error);
        await databasePool().execute(
          `UPDATE payment_receipts SET processing_status = 'Failed',
                  last_error_code = ?, last_error_message = ?
            WHERE payment_reference_id = ?`,
          [safe.code, safe.message, paymentReferenceId],
        );
      }
      return this.getStatus(paymentReferenceId);
    },
  };
}
