/**
 * Minimal Resend HTTP API client (no SDK, so the Verpex lockfile never changes).
 * It sends one message and classifies the answer for the outbox:
 *  - sent       Resend accepted the message and returned its id.
 *  - retry      a temporary condition; `ambiguous` means we never saw an answer, so the message may or may
 *               not have been accepted (the idempotency key makes a retry safe for 24 hours).
 *  - permanent  retrying cannot help (invalid request, invalid recipient).
 *  - systemic   the account, key or domain is the problem; every message would fail, so the worker stops.
 */
export type ResendMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  tags?: Array<{ name: string; value: string }>;
};

export type ResendOutcome =
  | { kind: "sent"; id: string }
  | { kind: "retry"; code: string; message: string; ambiguous: boolean; minDelaySeconds?: number }
  | { kind: "permanent"; code: string; message: string }
  | { kind: "systemic"; code: string; message: string };

export type ResendClientOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
  now?: () => Date;
};

/** Keeps provider text short and free of anything that looks like a key. */
export function safeProviderMessage(value: unknown) {
  const text = typeof value === "string" ? value : "";
  return text.replace(/\bre_[A-Za-z0-9_]{8,}/g, "re_***").replace(/\s+/g, " ").trim().slice(0, 200);
}

function secondsUntilNextUtcMidnight(now: Date) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 1, 0);
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}

function retryAfterSeconds(response: Response) {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? Math.min(Math.ceil(value), 3600) : undefined;
}

export function classifyResendError(input: { status: number; name?: string; message?: string; retryAfter?: number; now: Date }): ResendOutcome {
  const { status, name = "unknown_error", retryAfter, now } = input;
  const message = safeProviderMessage(input.message);
  if (status === 429) {
    if (name === "daily_quota_exceeded") return { kind: "retry", code: name, message, ambiguous: false, minDelaySeconds: secondsUntilNextUtcMidnight(now) };
    if (name === "monthly_quota_exceeded") return { kind: "systemic", code: name, message };
    return { kind: "retry", code: name, message, ambiguous: false, minDelaySeconds: retryAfter ?? 5 };
  }
  if (status === 409) {
    if (name === "invalid_idempotent_request") return { kind: "permanent", code: name, message };
    return { kind: "retry", code: name, message, ambiguous: false, minDelaySeconds: 10 };
  }
  if (status === 401 || status === 403) return { kind: "systemic", code: name, message };
  if (status >= 500) return { kind: "retry", code: name, message, ambiguous: false };
  return { kind: "permanent", code: name, message };
}

export async function sendResendEmail(options: ResendClientOptions, message: ResendMessage, idempotencyKey: string): Promise<ResendOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const response = await fetchImpl(`${options.baseUrl ?? "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "User-Agent": "trackcoop-email-outbox/1",
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        ...(message.tags?.length ? { tags: message.tags } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { id?: unknown; name?: unknown; message?: unknown } | null;
    if (response.ok) {
      if (typeof body?.id === "string" && body.id) return { kind: "sent", id: body.id };
      // A 2xx without an id cannot be trusted as accepted.
      return { kind: "retry", code: "missing_email_id", message: "Resend answered without an email id.", ambiguous: true };
    }
    return classifyResendError({
      status: response.status,
      name: typeof body?.name === "string" ? body.name : undefined,
      message: typeof body?.message === "string" ? body.message : undefined,
      retryAfter: retryAfterSeconds(response),
      now: now(),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      kind: "retry",
      code: aborted ? "timeout" : "network_error",
      message: aborted ? "The request to Resend timed out." : "The request to Resend could not be completed.",
      ambiguous: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Resend tag values accept only ASCII letters, digits, underscore and dash. */
export function tagValue(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);
}

export function formatFrom(name: string, address: string) {
  const safeName = name.replace(/["\r\n<>]/g, "").trim();
  return safeName ? `${safeName} <${address}>` : address;
}
