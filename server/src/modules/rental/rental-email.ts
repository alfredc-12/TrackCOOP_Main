import { logger } from "../../utils/logger";
import { env } from "../../config/env";
import type { RentalInquiry } from "./rental.types";
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
    preferredTime: string;
    possibleFee?: {
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
  return `${formatPeso(estimate.total)} estimated (${estimate.days} day${estimate.days === 1 ? "" : "s"} x ${formatPeso(estimate.dailyRate)}${discount})`;
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
        ? `${estimate.discountPercent}% off (${formatPeso(estimate.discountAmount)} per day)`
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
    `Preferred time: ${inquiry.preferredStartTime ?? "08:00"} - ${inquiry.preferredEndTime ?? "17:00"}`,
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
    preferredTime: `${inquiry.preferredStartTime ?? "08:00"} - ${inquiry.preferredEndTime ?? "17:00"}`,
    possibleFee: inquiry.estimatedFee
      ? {
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
  const webhookUrl = env.RENTAL_STATUS_EMAIL_WEBHOOK_URL;
  if (!webhookUrl || !payload) return "skipped";

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
