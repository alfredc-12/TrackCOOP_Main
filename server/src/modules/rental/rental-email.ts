import { isTractorService, totalWorkHectares } from "./rental-hectares";
import { logger } from "../../utils/logger";
import { env } from "../../config/env";
import { escapeHtml, linesToHtml, renderEmailLayout } from "../email/email-layout";
import { sendSystemEmail } from "../email/email.service";
import type { RentalDailyWork, RentalInquiry } from "./rental.types";
import {
  formatPeso,
  formatRentalDate,
  formatRentalDateRange,
} from "./rental-formatting";

export type RentalEmailPayload = {
  event: "rental.booking.submitted" | "rental.status.updated";
  to: {
    email: string;
    name: string;
  };
  message: {
    subject: string;
    text: string;
  };
  rental: {
    reference: string;
    equipment: string;
    status: string;
    publicNote: string;
    startDate: string;
    endDate: string;
    preferredTime?: string;
    possibleFee?: {
      pricingUnit?: "day" | "hectare";
      totalHectares?: number;
      days: number;
      originalDailyRate?: number;
      dailyRate: number;
      discountPercent?: number;
      discountAmount?: number;
      total: number;
      rateLabel: string;
      currency: "PHP";
    };
    updatedAt: string;
  };
  statusUrl: string;
};

function statusUrl() {
  const appUrl = env.FRONTEND_URL.replace(/\/$/, "");
  return `${appUrl}/rental/inquiry/status`;
}

function possibleFeeText(inquiry: RentalInquiry) {
  if (!inquiry.estimatedFee) return "Pending rate confirmation";
  const estimate = inquiry.estimatedFee;
  const discount =
    estimate.discountPercent && estimate.discountAmount
      ? `, ${estimate.discountPercent}% member discount`
      : "";
  return `${formatPeso(estimate.total)} estimated (${estimate.pricingUnit === "hectare" ? `${estimate.totalHectares} hectares` : `${estimate.days} day${estimate.days === 1 ? "" : "s"}`} x ${formatPeso(estimate.dailyRate)}${discount})`;
}

function possibleFeeLines(inquiry: RentalInquiry) {
  if (!inquiry.estimatedFee) {
    return ["Possible rental fee: Pending rate confirmation"];
  }
  const estimate = inquiry.estimatedFee;
  const originalDailyRate =
    estimate.originalDailyRate ??
    estimate.dailyRate + (estimate.discountAmount ?? 0);
  return [
    `Original rental rate: ${formatPeso(originalDailyRate)}`,
    `Discount if member: ${
      estimate.discountPercent && estimate.discountAmount
        ? `${estimate.discountPercent}% off (${formatPeso(estimate.discountAmount)} per ${estimate.pricingUnit === "hectare" ? "hectare" : "day"})`
        : "None"
    }`,
    `Final estimated amount: ${possibleFeeText(inquiry)}`,
  ];
}

function rentalSummaryLines(inquiry: RentalInquiry) {
  return [
    `Reference: ${inquiry.inquiryId}`,
    `Equipment: ${inquiry.equipmentName}`,
    `Start date: ${formatRentalDate(inquiry.preferredDate, true)}`,
    `End date: ${formatRentalDate(inquiry.preferredEndDate, true)}`,
    ...(isTractorService({ name: inquiry.equipmentName, serviceId: inquiry.serviceId }) ? [] : [`Preferred time: ${inquiry.preferredStartTime ?? "08:00"} - ${inquiry.preferredEndTime ?? "17:00"}`]),
    ...(inquiry.dailyWork ?? []).map((day) => `Work on ${day.date}: ${day.hectares} hectares`),
    ...possibleFeeLines(inquiry),
  ];
}

function baseRentalPayload(inquiry: RentalInquiry) {
  return {
    reference: inquiry.inquiryId,
    equipment: inquiry.equipmentName,
    status: inquiry.status,
    publicNote: inquiry.publicNote,
    startDate: inquiry.preferredDate,
    endDate: inquiry.preferredEndDate,
    preferredTime: isTractorService({ name: inquiry.equipmentName, serviceId: inquiry.serviceId }) ? undefined : `${inquiry.preferredStartTime ?? "08:00"} - ${inquiry.preferredEndTime ?? "17:00"}`,
    possibleFee: inquiry.estimatedFee
      ? {
          pricingUnit: inquiry.estimatedFee.pricingUnit,
          totalHectares: inquiry.estimatedFee.totalHectares,
          days: inquiry.estimatedFee.days,
          originalDailyRate: inquiry.estimatedFee.originalDailyRate,
          dailyRate: inquiry.estimatedFee.dailyRate,
          discountPercent: inquiry.estimatedFee.discountPercent,
          discountAmount: inquiry.estimatedFee.discountAmount,
          total: inquiry.estimatedFee.total,
          rateLabel: inquiry.estimatedFee.rateLabel,
          currency: inquiry.estimatedFee.currency,
        }
      : undefined,
    updatedAt: inquiry.updatedAt,
  };
}

function requesterEmail(inquiry: RentalInquiry) {
  const email = inquiry.requester.email?.trim();
  if (!email) return undefined;
  return {
    email,
    name: inquiry.requester.fullName,
  };
}

export function buildRentalSubmittedEmailPayload(
  inquiry: RentalInquiry,
): RentalEmailPayload | undefined {
  const to = requesterEmail(inquiry);
  if (!to) return undefined;
  const url = statusUrl();
  return {
    event: "rental.booking.submitted",
    to,
    message: {
      subject: `Rental booking received: ${inquiry.inquiryId}`,
      text: [
        `Hello ${inquiry.requester.fullName},`,
        "",
        "We received your rental booking request. Here is your booking summary:",
        "",
        ...rentalSummaryLines(inquiry),
        "",
        "NFFAC will still review availability, schedule, pricing, and rental conditions before final confirmation.",
        `Check status: ${url}`,
      ].join("\n"),
    },
    rental: baseRentalPayload(inquiry),
    statusUrl: url,
  };
}

export function buildRentalStatusEmailPayload(
  inquiry: RentalInquiry,
): RentalEmailPayload | undefined {
  const to = requesterEmail(inquiry);
  if (!to) return undefined;
  const url = statusUrl();
  return {
    event: "rental.status.updated",
    to,
    message: {
      subject: `Rental request ${inquiry.inquiryId}: ${inquiry.status}`,
      text: [
        `Hello ${inquiry.requester.fullName},`,
        "",
        `Your rental request for ${inquiry.equipmentName} is now ${inquiry.status}.`,
        inquiry.publicNote,
        "",
        `Preferred period: ${formatRentalDateRange(inquiry.preferredDate, inquiry.preferredEndDate, true)}`,
        ...possibleFeeLines(inquiry),
        `Reference: ${inquiry.inquiryId}`,
        `Check status: ${url}`,
      ].join("\n"),
    },
    rental: baseRentalPayload(inquiry),
    statusUrl: url,
  };
}

async function triggerRentalEmail(
  payload: RentalEmailPayload | undefined,
): Promise<"sent" | "skipped" | "failed"> {
  // The outbox owns delivery in resend mode; this direct path is the legacy fallback.
  if (env.EMAIL_DELIVERY === "resend") return "skipped";
  if (env.EMAIL_DELIVERY === "smtp") {
    return sendSystemEmail(payload
      ? {
          to: payload.to,
          subject: payload.message.subject,
          text: payload.message.text,
        }
      : undefined);
  }

  const webhookUrl = env.RENTAL_STATUS_EMAIL_WEBHOOK_URL;
  if (env.EMAIL_DELIVERY !== "webhook" || !webhookUrl || !payload) return "skipped";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const token = env.RENTAL_STATUS_EMAIL_WEBHOOK_TOKEN;
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Email webhook returned HTTP ${response.status}.`);
    }
    return "sent";
  } catch (error) {
    logger.error("Rental email webhook failed", {
      rentalId: payload.rental.reference,
      event: payload.event,
      status: payload.rental.status,
      error: error instanceof Error ? error.message : "Unknown webhook error",
    });
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}

export async function triggerRentalSubmittedEmail(
  inquiry: RentalInquiry,
): Promise<"sent" | "skipped" | "failed"> {
  return triggerRentalEmail(buildRentalSubmittedEmailPayload(inquiry));
}

export async function triggerRentalStatusEmail(
  inquiry: RentalInquiry,
): Promise<"sent" | "skipped" | "failed"> {
  return triggerRentalEmail(buildRentalStatusEmailPayload(inquiry));
}

// ---------------------------------------------------------------------------------------------------------------
// Outbox messages (resend mode). Pure functions: no environment, no database. The content is built inside the
// business transaction from the committed-to-be state and stored without any link. The worker adds the status
// link and renders the plain-text and HTML versions from this one model when it sends.
// ---------------------------------------------------------------------------------------------------------------

export type RentalEmailContent = {
  subject: string;
  title: string;
  preheader: string;
  greeting: string;
  /** Paragraphs shown before the details. */
  intro: string[];
  detailsTitle: string;
  details: Array<{ label: string; value: string }>;
  /** A block of the customer's own instructions, shown apart from the details. */
  quote?: { title: string; text: string };
  note?: string;
};

export type RentalMessage = { subject: string; text: string; html: string };

/**
 * Opens the booking status dialog on the rental page. With a token the dialog loads the status by itself;
 * without one (legacy sends) it opens with the reference filled in.
 */
export function rentalStatusUrl(baseUrl: string, reference: string, token?: string) {
  const query = `booking=${encodeURIComponent(reference)}${token ? `&k=${encodeURIComponent(token)}` : ""}`;
  return `${baseUrl.replace(/\/$/, "")}/rental?${query}`;
}

/** "08:00" -> "8:00 AM". Times are Philippine wall-clock values, never converted between zones. */
export function formatClockTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function scheduleMoment(date: string, time: string) {
  return `${formatRentalDate(date, true)}, ${formatClockTime(time)}`;
}

function lineDetails(lines: string[]) {
  return lines.map((line) => {
    const at = line.indexOf(": ");
    return at < 0 ? { label: line, value: "" } : { label: line.slice(0, at), value: line.slice(at + 2) };
  });
}

export function rentalSubmittedContent(inquiry: RentalInquiry): RentalEmailContent {
  return {
    subject: `Rental booking received: ${inquiry.inquiryId}`,
    title: "Rental booking received",
    preheader: `We received your request for ${inquiry.equipmentName}`,
    greeting: `Hello ${inquiry.requester.fullName},`,
    intro: ["We received your rental booking request. Here is your booking summary:"],
    detailsTitle: "Booking summary",
    details: lineDetails(rentalSummaryLines(inquiry)),
    note: "NFFAC will still review availability, schedule, pricing, and rental conditions before final confirmation.",
  };
}

export function rentalStatusContent(inquiry: RentalInquiry): RentalEmailContent {
  return {
    subject: `Rental request ${inquiry.inquiryId}: ${inquiry.status}`,
    title: `Rental request: ${inquiry.status}`,
    preheader: `${inquiry.equipmentName} is now ${inquiry.status}`,
    greeting: `Hello ${inquiry.requester.fullName},`,
    intro: [`Your rental request for ${inquiry.equipmentName} is now ${inquiry.status}.`, inquiry.publicNote].filter(Boolean),
    detailsTitle: "Request details",
    details: [
      { label: "Reference", value: inquiry.inquiryId },
      { label: "Status", value: inquiry.status },
      { label: "Preferred period", value: formatRentalDateRange(inquiry.preferredDate, inquiry.preferredEndDate, true) },
      ...lineDetails(possibleFeeLines(inquiry)),
    ],
  };
}

/** Customer-facing schedule details only. Internal schedule instructions and staff notes are never included. */
export type RentalScheduleEmailInput = {
  dailyWork?: RentalDailyWork[];
  reference: string;
  requesterName: string;
  equipmentName: string;
  confirmed: boolean;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  assignedOperator?: string;
  serviceLocation?: string;
  barangay?: string;
  customerInstructions?: string;
};

export function rentalScheduleContent(input: RentalScheduleEmailInput): RentalEmailContent {
  const tractor = isTractorService({ name: input.equipmentName });
  const place = [input.serviceLocation, input.barangay].map((part) => part?.trim()).filter(Boolean).join(", ");
  const instructions = input.customerInstructions?.trim();
  return {
    subject: input.confirmed
      ? `Rental schedule confirmed: ${input.reference}`
      : `Rental schedule proposed: ${input.reference}`,
    title: input.confirmed ? "Rental schedule confirmed" : "Rental schedule proposed",
    preheader: `${input.equipmentName}: ${tractor ? formatRentalDateRange(input.date, input.endDate, true) : scheduleMoment(input.date, input.startTime)}`,
    greeting: `Hello ${input.requesterName},`,
    intro: [
      input.confirmed
        ? `The schedule for your ${input.equipmentName} rental is confirmed.`
        : `A schedule has been proposed for your ${input.equipmentName} rental. It is not final until it is confirmed.`,
    ],
    detailsTitle: "Schedule",
    details: [
      { label: "Reference", value: input.reference },
      { label: "Equipment", value: input.equipmentName },
      ...(tractor
        ? [{ label: "Work dates", value: formatRentalDateRange(input.date, input.endDate, true) }]
        : [{ label: "Start", value: scheduleMoment(input.date, input.startTime) }, { label: "End", value: scheduleMoment(input.endDate, input.endTime) }]),
      ...(tractor && input.dailyWork?.length ? [{ label: "Total hectares", value: `${totalWorkHectares(input.dailyWork)} hectares` }] : []),
      ...(input.dailyWork ?? []).map((day) => ({ label: `Work on ${day.date}`, value: `${day.hectares} hectares` })),
      ...(place ? [{ label: "Location", value: place }] : []),
      ...(input.assignedOperator?.trim() ? [{ label: "Assigned operator", value: input.assignedOperator.trim() }] : []),
    ],
    quote: instructions ? { title: "Instructions for you", text: instructions } : undefined,
    note: tractor ? undefined : "All times are Philippine time.",
  };
}

export type RentalPaymentEmailInput = {
  reference: string;
  requesterName: string;
  equipmentName: string;
  amount: number;
  paymentMethod?: string;
  paymentReference?: string;
  receiptNumber?: string;
  paidOn?: string;
};

export function rentalPaymentContent(input: RentalPaymentEmailInput): RentalEmailContent {
  return {
    subject: `Rental payment confirmed: ${input.reference}`,
    title: "Rental payment confirmed",
    preheader: `We confirmed ${formatPeso(input.amount)} for ${input.reference}`,
    greeting: `Hello ${input.requesterName},`,
    intro: [`We confirmed your payment for rental request ${input.reference} (${input.equipmentName}).`],
    detailsTitle: "Payment details",
    details: [
      { label: "Amount paid", value: formatPeso(input.amount) },
      ...(input.paymentMethod ? [{ label: "Payment method", value: input.paymentMethod }] : []),
      ...(input.paymentReference ? [{ label: "Payment reference", value: input.paymentReference }] : []),
      ...(input.receiptNumber ? [{ label: "Receipt number", value: input.receiptNumber }] : []),
      ...(input.paidOn ? [{ label: "Paid on", value: formatRentalDate(input.paidOn, true) }] : []),
      { label: "Reference", value: input.reference },
    ],
    note: "NFFAC will confirm your rental schedule separately.",
  };
}

/** The one place a rental email becomes text and HTML, so the two versions always say the same thing. */
export function renderRentalEmail(content: RentalEmailContent, statusUrl: string): RentalMessage {
  const text = [
    content.greeting,
    "",
    ...content.intro.flatMap((paragraph) => [paragraph, ""]),
    ...content.details.map((detail) => `${detail.label}: ${detail.value}`),
    ...(content.quote ? ["", `${content.quote.title}:`, content.quote.text] : []),
    ...(content.note ? ["", content.note] : []),
    "",
    `Check status: ${statusUrl}`,
  ].join("\n");
  const html = renderEmailLayout({
    eyebrow: "TrackCOOP Equipment Rental",
    title: content.title,
    preheader: content.preheader,
    greeting: content.greeting,
    introHtml: content.intro.map((paragraph) => linesToHtml(paragraph)).join("<br><br>"),
    detailsTitle: content.detailsTitle,
    details: content.details,
    extraHtml: content.quote
      ? `<p style="margin:0 0 6px;color:#1F6B43;font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(content.quote.title)}</p><div style="padding:12px 16px;background:#FFFBEF;border:1px solid #F0E2B6;border-radius:8px;color:#4B4020;font-size:14px;line-height:1.6;">${linesToHtml(content.quote.text)}</div>`
      : undefined,
    button: { label: "Check booking status", url: statusUrl },
    note: content.note,
  });
  return { subject: content.subject, text, html };
}
