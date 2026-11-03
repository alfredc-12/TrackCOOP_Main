import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { readProtectedFile } from "../../storage/protected-storage";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { getEmailConfig, type EmailConfig } from "./email-config";
import { verifyReceiptToken } from "./email-crypto";

/**
 * GET /api/public/receipts/:token. The link in a receipt email. The token proves the link was issued by us and has
 * not expired; the database then decides whether the receipt can still be shown (Generated, not reversed, document
 * active). The PDF is streamed through the API, so no storage address is ever revealed, and nothing is cached.
 * Every failure looks the same, so a guessed link learns nothing.
 */
export type ReceiptRouteDeps = {
  config?: EmailConfig;
  pool?: Pick<Pool, "execute">;
  readFile?: (filePath: string) => Promise<Buffer>;
  now?: () => Date;
};

const invalid = () => new AppError("This receipt link is invalid or has expired.", 404, "RECEIPT_LINK_INVALID");

function safeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "receipt";
}

export function createPublicReceiptRouter(deps: ReceiptRouteDeps = {}) {
  const router = Router();
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false }));

  router.get(
    "/:token",
    asyncHandler(async (request: Request, response) => {
      const config = deps.config ?? getEmailConfig();
      const now = (deps.now ?? (() => new Date()))();
      if (!config.secretKey) throw invalid();
      const verified = verifyReceiptToken(String(request.params.token ?? ""), config.secretKey, Math.floor(now.getTime() / 1000));
      if (!verified) throw invalid();

      const pool = deps.pool ?? getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT r.receipt_number AS receiptNumber, r.processing_status AS status, r.reversed_at AS reversedAt,
                d.file_path AS filePath, d.document_status AS documentStatus
           FROM payment_receipts r JOIN documents d ON d.document_id = r.document_id
          WHERE r.payment_receipt_id = ? LIMIT 1`,
        [verified.receiptId],
      );
      const receipt = rows[0];
      if (!receipt || receipt.status !== "Generated" || receipt.reversedAt || receipt.documentStatus !== "Active") throw invalid();

      const pdf = await (deps.readFile ?? readProtectedFile)(String(receipt.filePath));
      await pool.execute(
        `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, ip_address)
         VALUES (NULL, 'payment_receipt.link_accessed', 'payment_receipts', ?, 'A receipt was opened from an emailed link.', ?)`,
        [verified.receiptId, (request.ip ?? "").slice(0, 45) || null],
      ).catch(() => undefined);

      response
        .status(200)
        .set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeFileName(String(receipt.receiptNumber))}.pdf"`,
          "Content-Length": String(pdf.length),
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex",
        })
        .send(pdf);
    }),
  );
  return router;
}
