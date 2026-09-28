import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

export type EmailRecipient = {
  email: string;
  name?: string;
};

export type SystemEmailInput = {
  to: EmailRecipient;
  subject: string;
  text: string;
  html?: string;
};

let smtpTransport: Transporter | undefined;

function formatAddress(input: EmailRecipient) {
  const email = input.email.trim();
  const name = input.name?.trim();
  if (!name) return email;
  return { name, address: email };
}

function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;

  smtpTransport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  return smtpTransport;
}

export async function sendSystemEmail(
  input: SystemEmailInput | undefined,
): Promise<"sent" | "skipped" | "failed"> {
  if (env.EMAIL_DELIVERY !== "smtp" || !input) return "skipped";

  const fromAddress = env.EMAIL_FROM_ADDRESS ?? env.SMTP_USER;
  if (!fromAddress) {
    logger.error("SMTP email is enabled but no from address is configured");
    return "failed";
  }

  try {
    await getSmtpTransport().sendMail({
      from: formatAddress({
        name: env.EMAIL_FROM_NAME,
        email: fromAddress,
      }),
      to: formatAddress(input.to),
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return "sent";
  } catch (error) {
    logger.error("SMTP email failed", {
      to: input.to.email,
      subject: input.subject,
      error: error instanceof Error ? error.message : "Unknown SMTP error",
    });
    return "failed";
  }
}
