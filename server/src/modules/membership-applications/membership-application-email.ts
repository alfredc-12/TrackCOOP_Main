import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import type { PublicMembershipApplicationInput } from "./membership-application.types";

export type MembershipEmailEvent =
  | "membership.application.submitted"
  | "membership.application.needs_information"
  | "membership.application.ready_for_payment"
  | "membership.application.payment_confirmed"
  | "membership.application.approved"
  | "membership.application.rejected";

export type MembershipEmailPayload = {
  event: MembershipEmailEvent;
  to: {
    email: string;
    name: string;
  };
  message: {
    subject: string;
    text: string;
  };
  application: {
    code: string;
    status: string;
    statusUrl: string;
  };
};

function fullName(input: Pick<PublicMembershipApplicationInput, "firstName" | "middleName" | "lastName" | "suffix">) {
  return [input.firstName, input.middleName, input.lastName, input.suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

export function membershipStatusUrl(applicationCode: string) {
  const base = env.FRONTEND_URL.replace(/\/$/, "");
  return `${base}/membership/application-status?code=${encodeURIComponent(applicationCode)}`;
}

export async function triggerMembershipEmail(
  payload: MembershipEmailPayload | undefined,
): Promise<"sent" | "skipped" | "failed"> {
  const webhookUrl = env.MEMBERSHIP_EMAIL_WEBHOOK_URL;
  if (!webhookUrl || !payload) return "skipped";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const token = env.MEMBERSHIP_EMAIL_WEBHOOK_TOKEN;
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
      throw new Error(`Membership email webhook returned HTTP ${response.status}.`);
    }
    return "sent";
  } catch (error) {
    logger.error("Membership email webhook failed", {
      applicationCode: payload.application.code,
      event: payload.event,
      error: error instanceof Error ? error.message : "Unknown webhook error",
    });
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}

export function buildSubmittedEmail(input: {
  application: PublicMembershipApplicationInput;
  applicationCode: string;
}) {
  const email = input.application.email?.trim();
  if (!email) return undefined;
  const name = fullName(input.application);
  const statusUrl = membershipStatusUrl(input.applicationCode);
  return {
    event: "membership.application.submitted" as const,
    to: { email, name },
    message: {
      subject: `Membership application received: ${input.applicationCode}`,
      text: [
        `Hello ${name},`,
        "",
        "We received your TrackCOOP membership application.",
        `Application code: ${input.applicationCode}`,
        `Check status: ${statusUrl}`,
      ].join("\n"),
    },
    application: {
      code: input.applicationCode,
      status: "Submitted",
      statusUrl,
    },
  };
}

export function buildStatusEmail(input: {
  event: Exclude<MembershipEmailEvent, "membership.application.submitted">;
  email: string | null;
  name: string;
  applicationCode: string;
  status: string;
  subject: string;
  message: string;
}) {
  const email = input.email?.trim();
  if (!email) return undefined;
  const statusUrl = membershipStatusUrl(input.applicationCode);
  return {
    event: input.event,
    to: { email, name: input.name },
    message: {
      subject: input.subject,
      text: [
        `Hello ${input.name},`,
        "",
        input.message,
        `Application code: ${input.applicationCode}`,
        `Check status: ${statusUrl}`,
      ].join("\n"),
    },
    application: {
      code: input.applicationCode,
      status: input.status,
      statusUrl,
    },
  };
}
