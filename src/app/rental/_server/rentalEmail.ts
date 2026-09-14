import "server-only";

import { logger } from "@/lib/logger";
import type { RentalInquiry } from "../_types/rental";

export type RentalStatusEmailPayload = {
  event: "rental.status.updated";
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
    updatedAt: string;
  };
  statusUrl: string;
};

export function buildRentalStatusEmailPayload(
  inquiry: RentalInquiry,
): RentalStatusEmailPayload | undefined {
  const email = inquiry.requester.email?.trim();
  if (!email) return undefined;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    .replace(/\/$/, "");
  const statusUrl = `${appUrl}/rental/inquiry/status`;
  return {
    event: "rental.status.updated",
    to: {
      email,
      name: inquiry.requester.fullName,
    },
    message: {
      subject: `Rental request ${inquiry.inquiryId}: ${inquiry.status}`,
      text: [
        `Hello ${inquiry.requester.fullName},`,
        "",
        `Your rental request for ${inquiry.equipmentName} is now ${inquiry.status}.`,
        inquiry.publicNote,
        "",
        `Reference: ${inquiry.inquiryId}`,
        `Check status: ${statusUrl}`,
      ].join("\n"),
    },
    rental: {
      reference: inquiry.inquiryId,
      equipment: inquiry.equipmentName,
      status: inquiry.status,
      publicNote: inquiry.publicNote,
      updatedAt: inquiry.updatedAt,
    },
    statusUrl,
  };
}

export async function triggerRentalStatusEmail(
  inquiry: RentalInquiry,
): Promise<"sent" | "skipped" | "failed"> {
  const webhookUrl = process.env.RENTAL_STATUS_EMAIL_WEBHOOK_URL?.trim();
  const payload = buildRentalStatusEmailPayload(inquiry);
  if (!webhookUrl || !payload) return "skipped";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const token = process.env.RENTAL_STATUS_EMAIL_WEBHOOK_TOKEN?.trim();
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
    logger.error("Rental status email webhook failed", {
      rentalId: inquiry.inquiryId,
      status: inquiry.status,
      error: error instanceof Error ? error.message : "Unknown webhook error",
    });
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}
