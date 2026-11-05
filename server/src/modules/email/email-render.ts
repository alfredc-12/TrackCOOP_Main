import { capitalCases, caseProgress } from "../membership-policy/membership-progress.repository";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  renderStatusMessage,
  renderSubmittedMessage,
  type MembershipEmailEvent,
} from "../membership-applications/membership-application-email";
import {
  ACTIVATION_EXPIRES_PLACEHOLDER,
  ACTIVATION_URL_PLACEHOLDER,
  applicantDocumentRequirementTypes,
} from "../membership-applications/membership-outbox";
import { cashInstructionsMessage, loadPosOrderEmail, receiptMessage } from "../pos/pos-email";
import { renderRentalEmail, rentalStatusUrl, type RentalEmailContent } from "../rental/rental-email";
import type { EmailConfig } from "./email-config";
import { decryptSecret, RENTAL_STATUS_LINK_DAYS, signReceiptToken, signRentalStatusToken } from "./email-crypto";
import { renderEmailLayout } from "./email-layout";
import type { OutboxRow } from "./email-outbox.repository";

export type RenderedEmail = { subject: string; text: string; html?: string };

/**
 * cancel: the message no longer applies, so it is dropped quietly.
 * retry:  a precondition is not true yet; try again later (does not count as a failure of the message).
 * fail:   the message cannot be built; the outbox marks it failed and raises the right alert.
 */
export type RenderResult =
  | { ok: true; message: RenderedEmail }
  | { ok: false; action: "cancel" | "retry" | "fail"; reason: string };

type Row = RowDataPacket & Record<string, string | number | null | Date>;

const fail = (action: "cancel" | "retry" | "fail", reason: string): RenderResult => ({ ok: false, action, reason });

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function formatManilaDateTime(value: Date | string | number) {
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(date);
}

export function formatManilaDate(value: Date | string | number) {
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" }).format(date);
}

function readSecret(row: OutboxRow, config: EmailConfig): { activationUrl?: string } | null {
  if (!row.secretEnc) return null;
  if (!config.secretKey) return null;
  try {
    return JSON.parse(decryptSecret(row.secretEnc, config.secretKey, row.dedupeKey)) as { activationUrl?: string };
  } catch {
    return null;
  }
}

async function renderInformationDigest(row: OutboxRow, pool: Pool, config: EmailConfig): Promise<RenderResult> {
  const applicationId = text(row.payload.applicationId);
  const applicationCode = text(row.payload.applicationCode);
  const name = text(row.payload.name, "Applicant");
  const [applications] = await pool.execute<Row[]>(
    "SELECT application_status AS status FROM membership_applications WHERE membership_application_id = ? LIMIT 1",
    [applicationId],
  );
  const status = applications[0] ? String(applications[0].status) : null;
  if (!status) return fail("cancel", "application_missing");
  if (["Approved", "Rejected", "Withdrawn"].includes(status)) return fail("cancel", "application_closed");

  const types = [...applicantDocumentRequirementTypes];
  const [requirements] = await pool.execute<Row[]>(
    `SELECT requirement_type AS type, requirement_status AS status, remarks
       FROM membership_application_requirements
      WHERE membership_application_id = ? AND requirement_status IN ('Pending', 'Rejected')
        AND requirement_type IN (${types.map(() => "?").join(", ")})
      ORDER BY membership_application_requirement_id`,
    [applicationId, ...types],
  );
  const [messages] = await pool.execute<Row[]>(
    `SELECT applicant_message AS message FROM membership_application_status_history
      WHERE membership_application_id = ? AND new_status = 'Needs Information' AND applicant_message IS NOT NULL AND applicant_message <> ''
      ORDER BY membership_application_status_history_id DESC LIMIT 1`,
    [applicationId],
  );
  const note = status === "Needs Information" && messages[0] ? String(messages[0].message) : "";
  // Everything has been supplied or withdrawn since the request: nothing left to ask for.
  if (!requirements.length && !note) return fail("cancel", "nothing_outstanding");

  const lines = [
    "The cooperative needs the following to continue reviewing your membership application.",
    ...(note ? ["", note] : []),
    ...(requirements.length ? [""] : []),
    ...requirements.map((requirement) => {
      const remark = requirement.remarks ? `: ${String(requirement.remarks).trim()}` : "";
      return `- ${String(requirement.type)}${String(requirement.status) === "Rejected" ? " (needs a replacement)" : ""}${remark}`;
    }),
    "",
    "Open your application status page to upload the requested files.",
  ];
  const message = renderStatusMessage({
    event: "membership.application.needs_information",
    name,
    applicationCode,
    status,
    subject: `Membership application needs information: ${applicationCode}`,
    message: lines.join("\n"),
    baseUrl: config.frontendUrl,
  });
  return { ok: true, message };
}

function activationText(url: string, expires: string) {
  return `Activate your member portal account here: ${url}\nThis link can be used once and expires on ${expires}.`;
}

function renderRentalRow(row: OutboxRow, config: EmailConfig, now: Date): RenderResult {
  const payload = row.payload;
  const content = payload.content as RentalEmailContent | undefined;
  // Rows queued before the HTML version existed already hold a finished plain-text message.
  if (!content || typeof content !== "object") return { ok: true, message: { subject: text(payload.subject), text: text(payload.text) } };
  const reference = text(payload.reference);
  // With a key, the link opens the status dialog and loads the booking itself; without one it only fills in the reference.
  const token = config.secretKey && reference
    ? signRentalStatusToken(reference, Math.floor(now.getTime() / 1000) + RENTAL_STATUS_LINK_DAYS * 86_400, config.secretKey)
    : undefined;
  return { ok: true, message: renderRentalEmail(content, rentalStatusUrl(config.frontendUrl, reference, token)) };
}

export async function renderOutboxEmail(row: OutboxRow, ctx: { pool: Pool; config: EmailConfig; now: Date }): Promise<RenderResult> {
  const { config, pool, now } = ctx;
  const payload = row.payload;
  const name = text(payload.name, row.recipientName ?? "there");

  switch (row.eventKey) {
    case "membership.capital.reminder": {
      const cases=await capitalCases(ctx.pool,"c.capital_case_id=? AND c.closed_at IS NULL",[String(row.payload.caseId)]);
      if(!cases[0]) return fail("cancel","capital_case_closed");
      const progress=await caseProgress(ctx.pool,cases[0],new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(ctx.now));
      if(progress.status==='Completed') return fail("cancel","capital_completed");
      if(progress.status==='In Progress' || (row.payload.milestone==='three-month' && progress.status==='Overdue')) return fail("cancel","capital_milestone_changed");
      const subject=progress.status==='Overdue'?'Share capital completion overdue':'Share capital completion reminder';
      const message=`Your validated capital is PHP ${progress.validated.toFixed(2)} of PHP ${progress.target.toFixed(2)}. Remaining: PHP ${progress.remaining.toFixed(2)}. Deadline: ${progress.deadline}. This is an advisory reminder; your membership is not suspended.`;
      return {ok:true,message:{subject,text:message,html:renderEmailLayout({eyebrow:"TrackCOOP membership",title:subject,note:message})}};
    }

    case "membership.application.submitted":
      return { ok: true, message: renderSubmittedMessage({ name, applicationCode: text(payload.applicationCode), baseUrl: config.frontendUrl }) };

    case "membership.application.ready_for_payment":
    case "membership.application.payment_confirmed":
    case "membership.application.rejected":
    case "membership.application.approved": {
      let message = text(payload.message);
      let activation: { url: string; htmlMessage: string } | undefined;
      if (message.includes(ACTIVATION_URL_PLACEHOLDER)) {
        const expiresAt = text(payload.activationExpiresAt);
        if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return fail("cancel", "activation_expired");
        const secret = readSecret(row, config);
        if (!secret?.activationUrl) return fail("fail", "secret_unavailable");
        const expires = expiresAt ? formatManilaDateTime(expiresAt) : "the date shown in your account";
        // The HTML version points to a button instead of printing the address; the text version keeps the link.
        const htmlMessage = message
          .replace(/Activate your member portal account here:\s*\{\{ACTIVATION_URL\}\}/, "Use the button below to activate your member portal account.")
          .replaceAll(ACTIVATION_URL_PLACEHOLDER, secret.activationUrl)
          .replaceAll(ACTIVATION_EXPIRES_PLACEHOLDER, expires);
        activation = { url: secret.activationUrl, htmlMessage };
        message = message
          .replaceAll(ACTIVATION_URL_PLACEHOLDER, secret.activationUrl)
          .replaceAll(ACTIVATION_EXPIRES_PLACEHOLDER, expires);
      }
      return {
        ok: true,
        message: renderStatusMessage({
          event: row.eventKey as Exclude<MembershipEmailEvent, "membership.application.submitted">,
          name,
          applicationCode: text(payload.applicationCode),
          status: text(payload.status),
          subject: text(payload.subject),
          message,
          baseUrl: config.frontendUrl,
          activation,
        }),
      };
    }

    case "membership.application.information_required":
      return renderInformationDigest(row, pool, config);

    case "membership.activation.replacement": {
      const expiresAt = text(payload.activationExpiresAt);
      if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return fail("cancel", "activation_expired");
      const secret = readSecret(row, config);
      if (!secret?.activationUrl) return fail("fail", "secret_unavailable");
      const expires = expiresAt ? formatManilaDateTime(expiresAt) : "the date shown in your account";
      const body = `Hello ${name},\n\nWe received a request for a new TrackCOOP account activation link.\n${activationText(secret.activationUrl, expires)}\n\nIf you did not ask for this, you can ignore this email. Your account stays inactive until the link is used.`;
      const html = renderEmailLayout({
        eyebrow: "TrackCOOP Membership",
        title: "Your new activation link",
        preheader: "Activate your TrackCOOP member account",
        greeting: `Hello ${name},`,
        introHtml: "We received a request for a new TrackCOOP account activation link. Use the button below to activate your member portal account.",
        button: { label: "Activate my account", url: secret.activationUrl },
        note: `This link can be used once and expires on ${expires}. If you did not ask for this, you can ignore this email. Your account stays inactive until the link is used.`,
      });
      return { ok: true, message: { subject: "Your new TrackCOOP activation link", text: body, html } };
    }

    case "rental.booking.submitted":
    case "rental.status.updated":
    case "rental.schedule.updated":
    case "rental.payment.confirmed":
      return renderRentalRow(row, config, now);

    case "pos.cash.instructions": {
      const paymentReferenceId = text(payload.paymentReferenceId);
      const order = await loadPosOrderEmail(paymentReferenceId, pool);
      if (!order || order.paymentMethod !== "Cash") return fail("cancel", "order_not_found");
      const [sales] = await pool.execute<Row[]>(
        `SELECT s.sale_status AS status FROM payment_references p JOIN pos_sales s ON s.pos_sale_id = p.related_entity_id
          WHERE p.payment_reference_id = ? AND p.related_entity_type = 'pos_sales' LIMIT 1`,
        [paymentReferenceId],
      );
      // Do not tell someone to pay for an order that has since been paid, cancelled or refunded.
      if (sales[0] && sales[0].status !== "Pending Payment") return fail("cancel", "order_no_longer_pending");
      return { ok: true, message: cashInstructionsMessage(order) };
    }

    case "pos.payment.receipt": {
      const order = await loadPosOrderEmail(text(payload.paymentReferenceId), pool);
      if (!order) return fail("cancel", "order_not_found");
      if (order.receiptReversed) return fail("cancel", "receipt_reversed");
      // The email is only queued once the receipt is Generated, so this is a safety net, not the normal path.
      if (order.receiptStatus !== "Generated") return fail("retry", "receipt_not_ready");
      const expiresAt = Number(payload.linkExpiresAt);
      if (!config.secretKey || !config.apiPublicUrl) return fail("fail", "receipt_link_not_configured");
      if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= now.getTime()) return fail("cancel", "receipt_link_expired");
      const token = signReceiptToken(text(payload.receiptId), expiresAt, config.secretKey);
      return {
        ok: true,
        message: receiptMessage(order, { url: `${config.apiPublicUrl}/api/public/receipts/${token}`, expiresOn: formatManilaDate(expiresAt) }),
      };
    }

    default:
      return fail("fail", "unknown_event");
  }
}
