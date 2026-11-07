import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import PDFDocument from "pdfkit";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { createCentralDocument } from "../../records/central-document";
import { normalizeProtectedStoragePath } from "../../storage/protected-storage";
import { storageProvider } from "../../storage";
import { enqueuePosReceipt } from "../pos/pos-outbox";
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
  payerEmail: string | null;
  receiptId: string;
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
            p.payer_name AS payerName, p.payer_email AS payerEmail, CAST(r.payment_receipt_id AS CHAR) AS receiptId,
            p.payment_purpose AS paymentPurpose,
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

function receiptAttemptKey(row: ReceiptRow) {
  const year = String((row.validatedAt ?? new Date()).getUTCFullYear());
  return `generated/receipts/${year}/payment-${row.paymentReferenceId}-${randomUUID()}.pdf`;
}

async function writeReceiptAttempt(row: ReceiptRow, key: string) {
  const buffer = await renderReceipt(row);
  // Concurrent attempts must never overwrite the bytes of an already linked
  // receipt. The winning transaction records its own attempt's unique key.
  const storagePath = normalizeProtectedStoragePath(key);
  await storageProvider().put({
    key,
    visibility: "protected",
    body: buffer,
    contentType: "application/pdf",
    ifAbsent: true,
  });
  return { buffer, storagePath };
}

async function finishAttempt(connection: PoolConnection, attemptId: string, state: "FINALIZED" | "FAILED" | "SUPERSEDED", documentId: string | null = null) {
  const [result] = await connection.execute<ResultSetHeader>("UPDATE payment_receipt_attempts SET attempt_state=?,document_id=? WHERE attempt_id=? AND attempt_state IN ('PREPARED','STORED')",[state,documentId,attemptId]);
  if (result.affectedRows !== 1) throw new Error("Receipt attempt changed");
  await connection.execute("INSERT INTO payment_receipt_attempt_events(attempt_id,event_type) VALUES(?,?)",[attemptId,state]);
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
      const {
        memberId,
        issuedBy,
        amount,
        paymentChannel,
        provider,
        validationSource,
        subjectReference,
        paymentDate,
        validatedAt,
        payerName,
        paymentPurpose,
        trackcoopReference,
        ...status
      } = row;
      void memberId;
      void issuedBy;
      void amount;
      void paymentChannel;
      void provider;
      void validationSource;
      void subjectReference;
      void paymentDate;
      void validatedAt;
      void payerName;
      void paymentPurpose;
      void trackcoopReference;
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
        const key=receiptAttemptKey(row);
        const [attempt]=await connection.execute<ResultSetHeader>("INSERT INTO payment_receipt_attempts(payment_receipt_id,attempt_number,object_key) VALUES(?,?,?)",[row.receiptId,Number(row.attemptCount)+1,key]);
        await connection.execute("INSERT INTO payment_receipt_attempt_events(attempt_id,event_type) VALUES(?,'PREPARED')",[attempt.insertId]);
        // The row lock serializes claims; attempt_count is the durable generation.
        return { ...row, attemptCount: Number(row.attemptCount) + 1, processingStatus: "Processing" as const, attemptId:String(attempt.insertId), objectKey:key };
      }, databasePool());
      if (!claimed || claimed.processingStatus === "Generated" || !("attemptId" in claimed)) return claimed;
      try {
        const file = await writeReceiptAttempt(claimed,claimed.objectKey);
        await withTransaction(async (connection) => {
          const [stored]=await connection.execute<ResultSetHeader>("UPDATE payment_receipt_attempts SET attempt_state='STORED',upload_checksum=?,upload_size=? WHERE attempt_id=? AND attempt_state='PREPARED'",[createHash("sha256").update(file.buffer).digest("hex"),file.buffer.length,claimed.attemptId]);
          if(stored.affectedRows!==1) throw new Error("Receipt attempt changed");
          await connection.execute("INSERT INTO payment_receipt_attempt_events(attempt_id,event_type) VALUES(?,'STORED')",[claimed.attemptId]);
        },databasePool());
        await withTransaction(async (connection) => {
          const current = await selectReceipt(connection, paymentReferenceId, true);
          if (!current || current.processingStatus !== "Processing" || current.documentId || Number(current.attemptCount) !== claimed.attemptCount) {
            await finishAttempt(connection,claimed.attemptId,"SUPERSEDED");
            return;
          }
          // Do not infer historical provenance from matching document metadata.
          // The locked receipt row is the sole authority for its linked document.
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
          const documentId = String(document.documentId);
          const [generated] = await connection.execute<ResultSetHeader>(
            `UPDATE payment_receipts SET document_id = ?, processing_status = 'Generated',
                    generated_at = UTC_TIMESTAMP(), last_error_code = NULL,
                    last_error_message = NULL WHERE payment_reference_id = ? AND processing_status = 'Processing' AND document_id IS NULL AND attempt_count = ?`,
            [documentId, paymentReferenceId, claimed.attemptCount],
          );
          if (generated.affectedRows !== 1) throw new Error("Receipt attempt no longer owns finalization");
          await finishAttempt(connection,claimed.attemptId,"FINALIZED",documentId);
          if (current.paymentPurpose === "POS/Product" && current.paymentChannel === "Cash" && current.memberId) {
            await connection.execute(
              `INSERT INTO notifications
                 (user_id, notification_type, title, message, related_entity_type, related_entity_id)
               SELECT mp.user_id, 'Document', 'POS receipt available',
                      CONCAT(?, ' is available in Documents.'), 'Document', ?
                 FROM member_profiles mp
                WHERE mp.member_id = ? AND mp.user_id IS NOT NULL`,
              [current.receiptNumber, documentId, current.memberId],
            );
          }
          // A receipt becomes Generated once, so the customer's email is queued once, and only for a receipt that exists.
          if (current.paymentPurpose === "POS/Product" && !current.reversedAt) {
            await enqueuePosReceipt(connection, {
              paymentReferenceId,
              receiptId: current.receiptId,
              email: current.payerEmail,
              name: current.payerName,
            });
          }
        }, databasePool());
      } catch (error) {
        const safe = safeError(error);
        await withTransaction(async (connection) => {
        const current = await selectReceipt(connection, paymentReferenceId, true);
        await finishAttempt(connection,claimed.attemptId,"FAILED");
        if (!current || current.processingStatus !== "Processing" || current.documentId || Number(current.attemptCount) !== claimed.attemptCount) return;
        const [failed] = await connection.execute<ResultSetHeader>(
          `UPDATE payment_receipts SET processing_status = 'Failed',
                  last_error_code = ?, last_error_message = ?
            WHERE payment_reference_id = ? AND processing_status = 'Processing' AND document_id IS NULL AND attempt_count = ?`,
          [safe.code, safe.message, paymentReferenceId, claimed.attemptCount],
        );
        if (failed.affectedRows && claimed.attemptCount >= 3) {
          await connection.execute(
            `INSERT INTO notifications
               (user_id, notification_type, title, message, related_entity_type, related_entity_id)
             SELECT u.user_id, 'Payment', 'Payment receipt could not be generated',
                    CONCAT('Receipt ', ?, ' has not been generated after several attempts. Open the payment and use Retry receipt.'),
                    'payment_references', ?
               FROM users u JOIN roles r ON r.role_id = u.role_id
              WHERE r.role_slug = 'bookkeeper' AND u.account_status = 'Active'
                AND NOT EXISTS (
                  SELECT 1 FROM notifications n
                   WHERE n.user_id = u.user_id AND n.title = 'Payment receipt could not be generated'
                     AND n.related_entity_type = 'payment_references' AND n.related_entity_id = ?
                     AND n.created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY))`,
            [claimed.receiptNumber, paymentReferenceId, paymentReferenceId],
          ).catch(() => undefined);
        }
        }, databasePool());
      }
      return this.getStatus(paymentReferenceId);
    },
  };
}
