import type { Pool, RowDataPacket } from "mysql2/promise";
import { env } from "../../config/env";
import { getPool } from "../../db/pool";
import { logger } from "../../utils/logger";
import { sendSystemEmail } from "../email/email.service";

type PosOrderEmailRow = RowDataPacket & {
  saleId: string;
  saleNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  totalAmount: number | string;
  paymentChannel: string | null;
  receiptNumber: string | null;
  receiptStatus: string | null;
  receiptReversedAt: Date | null;
};

type PosOrderItemEmailRow = RowDataPacket & {
  name: string;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal: number | string;
};

export type PosOrderEmail = {
  saleNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  paymentMethod: "Cash" | "QRPH";
  receiptNumber: string | null;
  /** Generated, Pending, Failed, ... or null when no receipt row exists. */
  receiptStatus: string | null;
  receiptReversed: boolean;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

export type PosEmailMessage = { subject: string; text: string; html: string };

export const COOPERATIVE_STORE_ADDRESS = "Barangay 11, Nasugbu, Batangas 4231, Philippines";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAmount(value: number) {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function paymentMethod(channel: string | null): "Cash" | "QRPH" {
  return channel === "Cash" ? "Cash" : "QRPH";
}

export async function loadPosOrderEmail(
  paymentReferenceId: string,
  pool: Pick<Pool, "execute"> = getPool(),
): Promise<PosOrderEmail | null> {
  const [orders] = await pool.execute<PosOrderEmailRow[]>(
    `SELECT CAST(s.pos_sale_id AS CHAR) AS saleId,
            s.sale_number AS saleNumber,
            s.customer_name AS customerName,
            p.payer_email AS customerEmail,
            s.total_amount AS totalAmount,
            p.payment_channel AS paymentChannel,
            r.receipt_number AS receiptNumber,
            r.processing_status AS receiptStatus,
            r.reversed_at AS receiptReversedAt
       FROM payment_references p
       JOIN pos_sales s ON s.pos_sale_id = p.related_entity_id
       LEFT JOIN payment_receipts r ON r.payment_reference_id = p.payment_reference_id
      WHERE p.payment_reference_id = ?
        AND p.payment_purpose = 'POS/Product'
        AND p.related_entity_type = 'pos_sales'
      LIMIT 1`,
    [paymentReferenceId],
  );
  const order = orders[0];
  const email = order?.customerEmail?.trim();
  if (!order || !email) return null;

  const [items] = await pool.execute<PosOrderItemEmailRow[]>(
    `SELECT product_name_snapshot AS name, quantity,
            unit_price AS unitPrice, line_total AS lineTotal
       FROM pos_sale_items
      WHERE pos_sale_id = ?
      ORDER BY pos_sale_item_id`,
    [order.saleId],
  );

  return {
    saleNumber: order.saleNumber,
    customerName: order.customerName?.trim() || "Customer",
    customerEmail: email,
    totalAmount: Number(order.totalAmount),
    paymentMethod: paymentMethod(order.paymentChannel),
    receiptNumber: order.receiptNumber,
    receiptStatus: order.receiptStatus,
    receiptReversed: Boolean(order.receiptReversedAt),
    items: items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
  };
}

function itemLines(order: PosOrderEmail) {
  return order.items.map((item) =>
    `${item.quantity} x ${item.name} - ${formatAmount(item.lineTotal)}`,
  );
}

function itemTable(order: PosOrderEmail) {
  return order.items.map((item) => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #E1E9DF;">${escapeHtml(item.name)}</td>
      <td align="center" style="padding:9px 8px;border-bottom:1px solid #E1E9DF;">${item.quantity}</td>
      <td align="right" style="padding:9px 0;border-bottom:1px solid #E1E9DF;">${escapeHtml(formatAmount(item.lineTotal))}</td>
    </tr>`).join("");
}

function emailHtml(input: { title: string; body: string; order: PosOrderEmail; footer: string }) {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#F7F8F3;font-family:Arial,Helvetica,sans-serif;color:#123D2A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:auto;border-collapse:collapse;background:#FFFDF8;border:1px solid #DDE8D8;">
    <tr><td style="height:8px;background:#123D2A;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:30px 32px 12px;"><p style="margin:0;color:#B67A00;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">TrackCOOP Cooperative Store</p><h1 style="margin:12px 0 0;font-size:27px;line-height:1.2;">${escapeHtml(input.title)}</h1></td></tr>
    <tr><td style="padding:10px 32px 22px;font-size:15px;line-height:1.6;">${input.body}</td></tr>
    <tr><td style="padding:0 32px 12px;"><p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#5A7463;">ORDER ${escapeHtml(input.order.saleNumber)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;"><thead><tr><th align="left" style="padding:8px 0;border-bottom:2px solid #123D2A;">Item</th><th style="padding:8px;border-bottom:2px solid #123D2A;">Qty</th><th align="right" style="padding:8px 0;border-bottom:2px solid #123D2A;">Amount</th></tr></thead><tbody>${itemTable(input.order)}</tbody></table></td></tr>
    <tr><td style="padding:12px 32px 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#EEF5EB;"><tr><td style="padding:14px;font-weight:700;">Order total</td><td align="right" style="padding:14px;font-size:18px;font-weight:800;">${escapeHtml(formatAmount(input.order.totalAmount))}</td></tr></table></td></tr>
    <tr><td style="padding:18px 32px 30px;color:#536A5B;font-size:13px;line-height:1.55;">${input.footer}</td></tr>
  </table>
</body></html>`;
}

export function cashInstructionsMessage(order: PosOrderEmail): PosEmailMessage {
  const storeAddress = COOPERATIVE_STORE_ADDRESS;
  return {
    subject: `Cash payment instructions for ${order.saleNumber}`,
    text: [
      `Hello ${order.customerName},`,
      "",
      "We received your cooperative store order. Please pay in cash at the cooperative store:",
      storeAddress,
      "",
      `Order reference: ${order.saleNumber}`,
      "Items:",
      ...itemLines(order),
      `Total due: ${formatAmount(order.totalAmount)}`,
      "",
      "The Bookkeeper will verify your payment before the order can be released.",
    ].join("\n"),
    html: emailHtml({
      title: "Cash payment instructions",
      body: `Hello ${escapeHtml(order.customerName)},<br><br>Please pay in cash at:<br><strong>${escapeHtml(storeAddress)}</strong>.<br><br>The Bookkeeper will verify your payment before the order can be released.`,
      order,
      footer: "Bring your order reference when paying at the cooperative store.",
    }),
  };
}

/**
 * The payment receipt. With `receipt` it carries the official receipt number and a protected download link;
 * without it (the legacy path) it keeps its original wording.
 */
export function receiptMessage(order: PosOrderEmail, receipt?: { url: string; expiresOn: string }): PosEmailMessage {
  const receiptReference = order.receiptNumber ?? order.saleNumber;
  const linkText = receipt
    ? ["", `Download your official receipt (PDF): ${receipt.url}`, `This link works until ${receipt.expiresOn}.`]
    : [];
  const linkHtml = receipt
    ? `<br><br><a href="${escapeHtml(receipt.url)}" style="display:inline-block;background:#0F7654;color:#FFFFFF;text-decoration:none;border-radius:8px;padding:12px 20px;font-weight:700;">Download official receipt (PDF)</a><br><span style="font-size:12px;color:#536A5B;">This link works until ${escapeHtml(receipt.expiresOn)}. If the button does not work, copy this address: ${escapeHtml(receipt.url)}</span>`
    : "";
  return {
    subject: `Payment receipt for ${order.saleNumber}`,
    text: [
      `Hello ${order.customerName},`,
      "",
      "Your cooperative store payment has been confirmed.",
      `Receipt reference: ${receiptReference}`,
      `Payment method: ${order.paymentMethod}`,
      `Order reference: ${order.saleNumber}`,
      "Items:",
      ...itemLines(order),
      `Amount paid: ${formatAmount(order.totalAmount)}`,
      ...linkText,
      "",
      `Please pick up your items at ${COOPERATIVE_STORE_ADDRESS}. The store team will release the order when it is ready.`,
    ].join("\n"),
    html: emailHtml({
      title: "Payment receipt",
      body: `Hello ${escapeHtml(order.customerName)},<br><br>Your ${escapeHtml(order.paymentMethod)} payment has been confirmed.<br>Receipt reference: <strong>${escapeHtml(receiptReference)}</strong>.${linkHtml}<br><br>Please pick up your items at <strong>${escapeHtml(COOPERATIVE_STORE_ADDRESS)}</strong>. The store team will release the order when it is ready.`,
      order,
      footer: "Keep this email as your payment receipt and present your order reference when collecting your items.",
    }),
  };
}

// ------------------------------------------------------------------------------------------ legacy direct send
// Used only while EMAIL_DELIVERY is smtp. In resend mode the outbox renders and sends these messages.

export async function sendCashPaymentInstructions(paymentReferenceId: string) {
  if (env.EMAIL_DELIVERY === "resend") return "skipped" as const;
  try {
    const order = await loadPosOrderEmail(paymentReferenceId);
    if (!order || order.paymentMethod !== "Cash") return "skipped" as const;
    const message = cashInstructionsMessage(order);
    return await sendSystemEmail({
      to: { email: order.customerEmail, name: order.customerName },
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch (error) {
    logger.error("POS cash payment instruction email failed", {
      paymentReferenceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return "failed" as const;
  }
}

export async function sendPosPaymentReceipt(paymentReferenceId: string) {
  if (env.EMAIL_DELIVERY === "resend") return "skipped" as const;
  try {
    const order = await loadPosOrderEmail(paymentReferenceId);
    if (!order) return "skipped" as const;
    const message = receiptMessage(order);
    return await sendSystemEmail({
      to: { email: order.customerEmail, name: order.customerName },
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch (error) {
    logger.error("POS payment receipt email failed", {
      paymentReferenceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return "failed" as const;
  }
}
