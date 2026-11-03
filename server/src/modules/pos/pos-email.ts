import type { Pool, RowDataPacket } from "mysql2/promise";
import { env } from "../../config/env";
import { getPool } from "../../db/pool";
import { logger } from "../../utils/logger";
import { escapeHtml, renderEmailLayout } from "../email/email-layout";
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

function itemsHtml(order: PosOrderEmail) {
  const rows = order.items.map((item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #E3EDDF;color:#123D2A;font-size:14px;line-height:1.4;">${escapeHtml(item.name)}</td>
          <td align="center" style="padding:10px 8px;border-bottom:1px solid #E3EDDF;color:#365F4A;font-size:14px;">${item.quantity}</td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #E3EDDF;color:#123D2A;font-size:14px;font-weight:700;">${escapeHtml(formatAmount(item.lineTotal))}</td>
        </tr>`).join("");
  return `<p style="margin:0 0 6px;color:#1F6B43;font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">Items</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <thead><tr>
          <th align="left" style="padding:8px 0;border-bottom:2px solid #123D2A;color:#6D8978;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;">Item</th>
          <th style="padding:8px;border-bottom:2px solid #123D2A;color:#6D8978;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;">Qty</th>
          <th align="right" style="padding:8px 0;border-bottom:2px solid #123D2A;color:#6D8978;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
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
    html: renderEmailLayout({
      eyebrow: "TrackCOOP Cooperative Store",
      title: "Cash payment instructions",
      preheader: `Pay in cash for order ${order.saleNumber}`,
      greeting: `Hello ${order.customerName},`,
      introHtml: `We received your cooperative store order. Please pay in cash at the cooperative store:<br><strong>${escapeHtml(storeAddress)}</strong>`,
      detailsTitle: "Your order",
      details: [
        { label: "Order reference", value: order.saleNumber },
        { label: "Total due", value: formatAmount(order.totalAmount) },
      ],
      extraHtml: itemsHtml(order),
      note: "Bring your order reference when paying. The Bookkeeper will verify your payment before the order can be released.",
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
    html: renderEmailLayout({
      eyebrow: "TrackCOOP Cooperative Store",
      title: "Payment receipt",
      preheader: `Your ${order.paymentMethod} payment for ${order.saleNumber} is confirmed`,
      greeting: `Hello ${order.customerName},`,
      introHtml: `Your ${escapeHtml(order.paymentMethod)} payment has been confirmed. Please pick up your items at <strong>${escapeHtml(COOPERATIVE_STORE_ADDRESS)}</strong>. The store team will release the order when it is ready.`,
      detailsTitle: "Payment details",
      details: [
        { label: "Receipt reference", value: receiptReference },
        { label: "Order reference", value: order.saleNumber },
        { label: "Payment method", value: order.paymentMethod },
        { label: "Amount paid", value: formatAmount(order.totalAmount) },
      ],
      extraHtml: itemsHtml(order),
      button: receipt ? { label: "Download official receipt (PDF)", url: receipt.url } : undefined,
      note: receipt
        ? `Keep this email as your payment receipt. The download link works until ${receipt.expiresOn}.`
        : "Keep this email as your payment receipt and present your order reference when collecting your items.",
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
