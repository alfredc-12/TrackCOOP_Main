import { randomUUID } from "node:crypto";
import { getEmailConfig, isResendMode, type EmailConfig } from "../email/email-config";
import { enqueueEmail, type SqlExecutor } from "../email/email-outbox.repository";

/**
 * Queues the membership emails from inside the transaction that causes them (resend mode only).
 * Rendering happens later in the worker, so what is stored here is data, not finished HTML.
 */

/** Requirements the applicant can act on themselves. Payments and orientation are handled elsewhere. */
export const applicantDocumentRequirementTypes = new Set(["Signed Application", "Valid ID", "Proof of Residency", "Other"]);

/** Placeholders in a queued message. The worker swaps in the decrypted link and the expiry when it sends. */
export const ACTIVATION_URL_PLACEHOLDER = "{{ACTIVATION_URL}}";
export const ACTIVATION_EXPIRES_PLACEHOLDER = "{{ACTIVATION_EXPIRES}}";
export const APPROVED_WITH_ACTIVATION_MESSAGE =
  `Your membership was approved. Activate your member portal account here: ${ACTIVATION_URL_PLACEHOLDER}
` +
  `This link can be used once and expires on ${ACTIVATION_EXPIRES_PLACEHOLDER}.`;

/** How long information requests are gathered before one digest email goes out. */
export const INFORMATION_DIGEST_DELAY_SECONDS = 5 * 60;

type Application = {
  applicationId: string;
  applicationCode: string;
  email: string | null;
  name: string;
};

const related = (application: Application) => ({ type: "membership_applications", id: application.applicationId });

export async function enqueueMembershipReceived(executor: SqlExecutor, application: Application, config: EmailConfig = getEmailConfig()) {
  if (!isResendMode(config)) return;
  await enqueueEmail(executor, {
    eventKey: "membership.application.submitted",
    dedupeKey: `membership.submitted:app:${application.applicationId}`,
    to: { email: application.email, name: application.name },
    payload: { name: application.name, applicationCode: application.applicationCode },
    related: related(application),
  }, config);
}

export type MembershipStatusKind = "ready_for_payment" | "payment_confirmed" | "rejected" | "approved";

export async function enqueueMembershipStatus(
  executor: SqlExecutor,
  application: Application,
  input: {
    kind: MembershipStatusKind;
    status: string;
    subject: string;
    message: string;
    /** Makes the key unique per occurrence when the same status can legitimately repeat (a history row id). */
    occurrence?: string;
    /** Secret part of the message (the activation link). Encrypted in the outbox. */
    secret?: { activationUrl: string };
    /** When the secret stops working. A message still queued after this is cancelled, not sent. */
    secretExpiresAt?: Date;
  },
  config: EmailConfig = getEmailConfig(),
) {
  if (!isResendMode(config)) return;
  await enqueueEmail(executor, {
    eventKey: `membership.application.${input.kind}`,
    dedupeKey: `membership.${input.kind}:app:${application.applicationId}${input.occurrence ? `:${input.occurrence}` : ""}`,
    to: { email: application.email, name: application.name },
    payload: {
      name: application.name,
      applicationCode: application.applicationCode,
      status: input.status,
      subject: input.subject,
      message: input.message,
      ...(input.secretExpiresAt ? { activationExpiresAt: input.secretExpiresAt.toISOString() } : {}),
    },
    secret: input.secret,
    expiresAt: input.secretExpiresAt,
    related: related(application),
  }, config);
}

/**
 * "Something is still needed from you". The first request opens a row that waits five minutes; further requests
 * for the same application join it. The worker lists whatever is outstanding at send time.
 */
export async function enqueueInformationRequest(executor: SqlExecutor, application: Application, config: EmailConfig = getEmailConfig()) {
  if (!isResendMode(config)) return;
  await enqueueEmail(executor, {
    eventKey: "membership.application.information_required",
    dedupeKey: `membership.info:app:${application.applicationId}:${randomUUID()}`,
    coalesceKey: `membership.info:app:${application.applicationId}`,
    to: { email: application.email, name: application.name },
    payload: { name: application.name, applicationCode: application.applicationCode, applicationId: application.applicationId },
    delaySeconds: INFORMATION_DIGEST_DELAY_SECONDS,
    related: related(application),
  }, config);
}

/** A replacement activation link for an account whose first link expired or was lost. */
export async function enqueueActivationReplacement(
  executor: SqlExecutor,
  input: { userId: string; tokenId: string; email: string | null; name: string; activationUrl: string; expiresAt: Date },
  config: EmailConfig = getEmailConfig(),
) {
  if (!isResendMode(config)) return;
  await enqueueEmail(executor, {
    eventKey: "membership.activation.replacement",
    dedupeKey: `membership.activation:user:${input.userId}:token:${input.tokenId}`,
    to: { email: input.email, name: input.name },
    payload: { name: input.name, activationExpiresAt: input.expiresAt.toISOString() },
    secret: { activationUrl: input.activationUrl },
    expiresAt: input.expiresAt,
    related: { type: "users", id: input.userId },
  }, config);
}
