import { env } from "../../config/env";
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

export function membershipStatusUrl(applicationCode: string) {
  const base = env.FRONTEND_URL.replace(/\/$/, "");
  return `${base}/membership/application-status?code=${encodeURIComponent(applicationCode)}`;
}

export async function triggerMembershipEmail(
  payload: MembershipEmailPayload | undefined,
): Promise<"sent" | "skipped" | "failed"> {
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
      html: membershipApplicationEmailHtml({
        title: "Membership Application Received",
        name,
        applicationCode: input.applicationCode,
        statusUrl,
        bodyHtml: [
          "We received your TrackCOOP membership application.",
          "Thank you for your interest in joining our cooperative community.",
        ].join("<br>"),
        note: "We will keep you updated as your application progresses.",
      }),
    },
    application: {
      code: input.applicationCode,
      status: "Submitted",
      statusUrl,
    },
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linesToHtml(value: string) {
  return escapeHtml(value)
    .split(/\r?\n/)
    .map((line) => line || "&nbsp;")
    .join("<br>");
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
}) {
  const title = escapeHtml(input.title);
  const name = escapeHtml(input.name || "Applicant");
  const applicationCode = escapeHtml(input.applicationCode);
  const statusUrl = escapeHtml(input.statusUrl);
  const note = escapeHtml(input.note);
  const buttonLabel = escapeHtml(input.buttonLabel ?? "Check Application Status");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#F7F8F3;font-family:Arial,Helvetica,sans-serif;color:#123D2A;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#F7F8F3;">
      <tr>
        <td align="center" style="padding:0 12px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border-collapse:collapse;background:#FFFDF8;border:1px solid #DDE8D8;box-shadow:0 18px 46px rgba(18,61,42,0.10);">
            <tr>
              <td style="height:8px;background:#123D2A;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 24px 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="center" style="width:76px;height:76px;border-radius:38px;background:#EAF3E8;color:#1F6B43;font-size:36px;font-weight:700;line-height:76px;">
                      &#10003;
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:10px 32px 0;">
                <h1 style="margin:0;color:#123D2A;font-size:32px;line-height:1.18;font-weight:800;letter-spacing:0;">
                  ${title}
                </h1>
                <div style="width:74px;height:3px;margin:18px auto 0;background:#9BCC8D;font-size:0;line-height:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0;">
                <p style="margin:0 0 14px;color:#123D2A;font-size:16px;line-height:1.55;font-weight:700;">
                  Hello ${name},
                </p>
                <p style="margin:0;color:#5D6D63;font-size:15px;line-height:1.65;">
                  ${input.bodyHtml}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#F7FBF5;border:1px solid #DDE8D8;border-radius:10px;">
                  <tr>
                    <td width="82" align="center" style="padding:20px 0 20px 20px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                        <tr>
                          <td align="center" style="width:58px;height:58px;border-radius:29px;background:#DFF1E2;color:#1F6B43;font-size:28px;font-weight:700;line-height:58px;">
                            &#9776;
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td style="padding:20px 22px;">
                      <p style="margin:0 0 7px;color:#6D8978;font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">
                        Application Details
                      </p>
                      <p style="margin:0;color:#365F4A;font-size:14px;line-height:1.35;font-weight:700;">
                        Application code
                      </p>
                      <p style="margin:4px 0 0;color:#123D2A;font-size:24px;line-height:1.2;font-weight:800;letter-spacing:0.01em;">
                        ${applicationCode}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 40px 0;">
                <a href="${statusUrl}" style="display:inline-block;min-width:260px;background:#0F7654;background:linear-gradient(135deg,#148363,#087048);color:#FFFFFF;text-decoration:none;border-radius:10px;padding:15px 24px;font-size:16px;line-height:1;font-weight:800;box-shadow:0 10px 18px rgba(18,61,42,0.18);">
                  ${buttonLabel} &rarr;
                </a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:14px 40px 0;">
                <table role="presentation" width="330" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="border-top:1px solid #DDE8D8;font-size:0;line-height:0;">&nbsp;</td>
                    <td align="center" width="42" style="color:#A7B7AA;font-size:11px;font-weight:800;line-height:1;">OR</td>
                    <td style="border-top:1px solid #DDE8D8;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 40px 0;">
                <p style="margin:0;color:#7B8D82;font-size:12px;line-height:1.5;font-weight:700;">
                  If the button does not work, copy and paste this link:
                </p>
                <a href="${statusUrl}" style="color:#1F6B43;font-size:13px;line-height:1.6;font-weight:700;text-decoration:underline;word-break:break-all;">
                  ${statusUrl}
                </a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 40px 28px;">
                <table role="presentation" width="78%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#F7FBF5;border:1px solid #DDE8D8;border-radius:10px;">
                  <tr>
                    <td align="center" style="padding:12px 16px;color:#365F4A;font-size:13px;line-height:1.4;font-weight:800;">
                      <span style="display:inline-block;width:22px;height:22px;border-radius:11px;background:#65B96E;color:#FFFFFF;font-size:14px;line-height:22px;text-align:center;margin-right:8px;">i</span>
                      ${note}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
  const title = statusEmailTitle(input.event, input.status);
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
      html: membershipApplicationEmailHtml({
        title,
        name: input.name,
        applicationCode: input.applicationCode,
        statusUrl,
        bodyHtml: linesToHtml(input.message),
        note: statusEmailNote(input.event),
      }),
    },
    application: {
      code: input.applicationCode,
      status: input.status,
      statusUrl,
    },
  };
}
