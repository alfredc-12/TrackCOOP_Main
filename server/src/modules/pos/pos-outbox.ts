import { getEmailConfig, isResendMode, type EmailConfig } from "../email/email-config";
import { RECEIPT_LINK_DAYS } from "../email/email-crypto";
import { enqueueEmail, type SqlExecutor } from "../email/email-outbox.repository";

/** Queues the POS emails from inside the transaction that causes them (resend mode only). */

export async function enqueuePosCashInstructions(
  executor: SqlExecutor,
  input: { paymentReferenceId: string | number; email: string | null; name: string },
  config: EmailConfig = getEmailConfig(),
) {
  if (!isResendMode(config)) return;
  await enqueueEmail(executor, {
    eventKey: "pos.cash.instructions",
    dedupeKey: `pos.cash:payref:${input.paymentReferenceId}`,
    to: { email: input.email, name: input.name },
    // The worker reads the order when it sends, so the message reflects the order as it stands then.
    payload: { paymentReferenceId: String(input.paymentReferenceId) },
    related: { type: "payment_references", id: String(input.paymentReferenceId) },
  }, config);
}

/**
 * Called from the same transaction that marks the receipt Generated, so the email can only exist for a
 * receipt that really exists, and only once (a receipt becomes Generated once).
 */
export async function enqueuePosReceipt(
  executor: SqlExecutor,
  input: { paymentReferenceId: string | number; receiptId: string | number; email: string | null; name: string | null },
  config: EmailConfig = getEmailConfig(),
  now: Date = new Date(),
) {
  if (!isResendMode(config)) return;
  const linkExpiresAt = Math.floor(now.getTime() / 1000) + RECEIPT_LINK_DAYS * 86_400;
  await enqueueEmail(executor, {
    eventKey: "pos.payment.receipt",
    dedupeKey: `pos.receipt:payref:${input.paymentReferenceId}`,
    to: { email: input.email, name: input.name },
    payload: { paymentReferenceId: String(input.paymentReferenceId), receiptId: String(input.receiptId), linkExpiresAt },
    related: { type: "payment_references", id: String(input.paymentReferenceId) },
  }, config);
}
