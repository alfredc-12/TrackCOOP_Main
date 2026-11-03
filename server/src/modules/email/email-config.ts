import { env } from "../../config/env";

export type EmailMode = "disabled" | "smtp" | "webhook" | "resend";
export type EmailStage = "restricted" | "general";

/** Everything the outbox needs to know about delivery, in one injectable object (tests pass their own). */
export type EmailConfig = {
  mode: EmailMode;
  stage: EmailStage;
  /** Lower-cased addresses that may receive mail while the stage is restricted. */
  allowlist: string[];
  fromName: string;
  fromAddress?: string;
  replyTo?: string;
  resendApiKey?: string;
  /** 32-byte master key for encrypting queued secrets and signing receipt links. */
  secretKey?: Buffer;
  apiPublicUrl?: string;
  frontendUrl: string;
};

export function parseAllowlist(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function emailConfigFromEnv(source: typeof env = env): EmailConfig {
  return {
    mode: source.EMAIL_DELIVERY,
    stage: source.EMAIL_RELEASE_STAGE,
    allowlist: parseAllowlist(source.EMAIL_RECIPIENT_ALLOWLIST),
    fromName: source.EMAIL_FROM_NAME,
    fromAddress: source.EMAIL_FROM_ADDRESS,
    replyTo: source.EMAIL_REPLY_TO,
    resendApiKey: source.RESEND_API_KEY,
    secretKey: source.EMAIL_SECRET_KEY ? Buffer.from(source.EMAIL_SECRET_KEY, "base64") : undefined,
    apiPublicUrl: source.API_PUBLIC_URL?.replace(/\/$/, ""),
    frontendUrl: source.FRONTEND_URL.replace(/\/$/, ""),
  };
}

let cached: EmailConfig | undefined;

/** The process-wide configuration. Resolved lazily so importing this module never reads the environment twice. */
export function getEmailConfig(): EmailConfig {
  cached ??= emailConfigFromEnv();
  return cached;
}

export function isResendMode(config: EmailConfig = getEmailConfig()) {
  return config.mode === "resend";
}
