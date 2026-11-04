import { env } from "../../config/env";
import { linesToHtml, renderEmailLayout } from "../email/email-layout";
import { sendSystemEmail } from "../email/email.service";
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
    html?: string;
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

export function membershipStatusUrl(applicationCode: string, baseUrl: string = env.FRONTEND_URL) {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/membership/application-status?code=${encodeURIComponent(applicationCode)}`;
}

export async function triggerMembershipEmail(
  payload: MembershipEmailPayload | undefined,
): Promise<"sent" | "skipped" | "failed"> {
  // The outbox owns delivery in resend mode; this direct path is the legacy fallback.
  if (env.EMAIL_DELIVERY === "resend") return "skipped";
  if (env.EMAIL_DELIVERY === "smtp") {
    return sendSystemEmail(payload
      ? {
          to: payload.to,
          subject: payload.message.subject,
          text: payload.message.text,
          html: payload.message.html,
        }
      : undefined);
  }

  const webhookUrl = env.MEMBERSHIP_EMAIL_WEBHOOK_URL;
  if (env.EMAIL_DELIVERY !== "webhook" || !webhookUrl || !payload) return "skipped";

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

export type MembershipMessage = { subject: string; text: string; html: string };

/** Pure renderer for the "application received" message. */
export function renderSubmittedMessage(input: { name: string; applicationCode: string; baseUrl?: string }): MembershipMessage {
  const statusUrl = membershipStatusUrl(input.applicationCode, input.baseUrl);
  return {
    subject: `Membership application received: ${input.applicationCode}`,
    text: [
      `Hello ${input.name},`,
      "",
      "We received your TrackCOOP membership application.",
      `Application code: ${input.applicationCode}`,
      `Check status: ${statusUrl}`,
    ].join("\n"),
    html: membershipApplicationEmailHtml({
      title: "Membership Application Received",
      name: input.name,
      applicationCode: input.applicationCode,
      statusUrl,
      bodyHtml: [
        "We received your TrackCOOP membership application.",
        "Thank you for your interest in joining our cooperative community.",
      ].join("<br>"),
      note: "We will keep you updated as your application progresses.",
    }),
  };
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
    message: renderSubmittedMessage({ name, applicationCode: input.applicationCode }),
    application: {
      code: input.applicationCode,
      status: "Submitted",
      statusUrl,
    },
  };
}

function statusEmailTitle(event: Exclude<MembershipEmailEvent, "membership.application.submitted">, status: string) {
  switch (event) {
    case "membership.application.needs_information":
      return "Membership Application Needs Information";
    case "membership.application.ready_for_payment":
      return "Membership Payment Is Ready";
    case "membership.application.payment_confirmed":
      return "Membership Payment Confirmed";
    case "membership.application.approved":
      return "Membership Approved";
    case "membership.application.rejected":
      return "Membership Application Update";
    default:
      return status || "Membership Application Update";
  }
}

function statusEmailNote(event: Exclude<MembershipEmailEvent, "membership.application.submitted">) {
  switch (event) {
    case "membership.application.ready_for_payment":
      return "Complete the required payment from your application status page.";
    case "membership.application.payment_confirmed":
      return "Your payment has been recorded for final approval review.";
    case "membership.application.needs_information":
      return "Open your application status page to review the request.";
    case "membership.application.approved":
      return "You can check your application page for the latest details.";
    case "membership.application.rejected":
      return "You can check your application page for the latest details.";
    default:
      return "We will keep you updated as your application progresses.";
  }
}

function membershipApplicationEmailHtml(input: {
  title: string;
  name: string;
  applicationCode: string;
  statusUrl: string;
  bodyHtml: string;
  note: string;
  buttonLabel?: string;
  /** Where the button goes. Defaults to the application status page. */
  buttonUrl?: string;
}) {
  return renderEmailLayout({
    eyebrow: "TrackCOOP Membership",
    title: input.title,
    preheader: `Application ${input.applicationCode}: ${input.title}`,
    greeting: `Hello ${input.name || "Applicant"},`,
    introHtml: input.bodyHtml,
    detailsTitle: "Application details",
    details: [{ label: "Application code", value: input.applicationCode }],
    button: { label: input.buttonLabel ?? "Check Application Status", url: input.buttonUrl ?? input.statusUrl },
    note: input.note,
  });
}

export type StatusMessageInput = {
  event: Exclude<MembershipEmailEvent, "membership.application.submitted">;
  name: string;
  applicationCode: string;
  status: string;
  subject: string;
  message: string;
  baseUrl?: string;
  /**
   * An approval that carries an activation link. The text version keeps the link in `message`; the HTML version
   * shows `htmlMessage` (the same words without the long address) and makes activation the main button.
   */
  activation?: { url: string; htmlMessage: string };
};

/** Pure renderer for every status message (information required, payment, approval, rejection). */
export function renderStatusMessage(input: StatusMessageInput): MembershipMessage {
  const statusUrl = membershipStatusUrl(input.applicationCode, input.baseUrl);
  return {
    subject: input.subject,
    text: [
      `Hello ${input.name},`,
      "",
      input.message,
      `Application code: ${input.applicationCode}`,
      `Check status: ${statusUrl}`,
    ].join("\n"),
    html: membershipApplicationEmailHtml({
      title: statusEmailTitle(input.event, input.status),
      name: input.name,
      applicationCode: input.applicationCode,
      statusUrl,
      bodyHtml: linesToHtml(input.activation ? input.activation.htmlMessage : input.message),
      note: input.activation
        ? "You can also follow your application on the status page using your application code."
        : statusEmailNote(input.event),
      ...(input.activation ? { buttonLabel: "Activate my account", buttonUrl: input.activation.url } : {}),
    }),
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
  return {
    event: input.event,
    to: { email, name: input.name },
    message: renderStatusMessage(input),
    application: {
      code: input.applicationCode,
      status: input.status,
      statusUrl: membershipStatusUrl(input.applicationCode),
    },
  };
}
