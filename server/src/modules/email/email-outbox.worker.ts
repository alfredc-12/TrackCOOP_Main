import { randomBytes } from "node:crypto";
import type { Pool } from "mysql2/promise";
import type { EmailConfig } from "./email-config";
import { createOutboxStore, type OutboxRow, type OutboxStore } from "./email-outbox.repository";
import { renderOutboxEmail, type RenderResult } from "./email-render";
import { formatFrom, sendResendEmail, tagValue, type ResendOutcome } from "./resend.client";

/**
 * One short run of the outbox, started by cron. It is safe to start more than once at the same time (a database
 * lock stops overlap, and rows are claimed atomically), and safe to kill at any point (a row left in "Sending" is
 * reclaimed on the next run).
 */

export const WORKER_LOCK_NAME = "trackcoop_email_worker";
export const MAX_ATTEMPTS = 10;
export const MAX_AGE_HOURS = 48;
/** Resend remembers an idempotency key for 24 hours. Past that, an unanswered attempt is held for a person. */
export const AMBIGUOUS_WINDOW_HOURS = 23;

/** Events whose permanent failure leaves a person without a way in, so the Chairman is told. */
const ALERT_EVENTS = new Set(["membership.application.approved"]);

export type RunSummary = {
  ran: boolean;
  reason?: "locked" | "not_resend_mode";
  reclaimed: number;
  cancelled: number;
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  dropped: number;
  systemic?: string;
};

export type WorkerDeps = {
  pool: Pool;
  config: EmailConfig;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  workerToken?: string;
  batchSize?: number;
  maxRunMs?: number;
  /** Pause between sends, to stay well inside Resend's 10 requests per second. */
  sendIntervalMs?: number;
  render?: (row: OutboxRow, ctx: { pool: Pool; config: EmailConfig; now: Date }) => Promise<RenderResult>;
  store?: OutboxStore;
};

/** 60s, 2m, 4m ... capped at 6h, with +/-20% jitter so a recovering outage is not hit all at once. */
export function backoffSeconds(attemptsMade: number, random: () => number = Math.random) {
  const base = Math.min(60 * 2 ** Math.max(0, attemptsMade - 1), 6 * 3600);
  return Math.round(base * (0.8 + random() * 0.4));
}

const emptySummary = (): RunSummary => ({ ran: true, reclaimed: 0, cancelled: 0, claimed: 0, sent: 0, retried: 0, failed: 0, dropped: 0 });

async function notifyChairmenOfFailure(pool: Pool, row: OutboxRow, reason: string) {
  if (!ALERT_EVENTS.has(row.eventKey) || !row.relatedEntityId) return;
  const code = typeof row.payload.applicationCode === "string" ? row.payload.applicationCode : `#${row.relatedEntityId}`;
  // No link, token or message text: only what staff need to know to step in.
  await pool.execute(
    `INSERT INTO notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id)
     SELECT u.user_id, 'System', 'Membership approval email could not be sent',
            CONCAT('Application ', ?, ': the approval email failed permanently (', ?, '). Staff intervention may be required, such as reissuing the activation link.'),
            'membership_applications', ?
       FROM users u JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug = 'chairman' AND u.account_status = 'Active'`,
    [code, reason.slice(0, 60), row.relatedEntityId],
  ).catch(() => undefined);
}

export async function runOutboxOnce(deps: WorkerDeps): Promise<RunSummary> {
  const { pool, config } = deps;
  const now = deps.now ?? (() => new Date());
  const random = deps.random ?? Math.random;
  const sleep = deps.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const render = deps.render ?? renderOutboxEmail;
  const store = deps.store ?? createOutboxStore(pool);
  const token = deps.workerToken ?? `${process.pid}-${randomBytes(6).toString("hex")}`;
  const startedAt = now().getTime();
  const maxRunMs = deps.maxRunMs ?? 45_000;

  const summary = emptySummary();
  if (config.mode !== "resend") return { ...summary, ran: false, reason: "not_resend_mode" };
  if (!config.resendApiKey || !config.fromAddress) throw new Error("Resend is selected but the API key or sender address is missing");

  // One run at a time. The lock belongs to this connection, so it disappears if the process dies.
  const lockConnection = await pool.getConnection();
  try {
    const [lockRows] = await lockConnection.query("SELECT GET_LOCK(?, 0) AS got", [WORKER_LOCK_NAME]);
    if (Number((lockRows as Array<{ got: number | string }>)[0]?.got) !== 1) return { ...summary, ran: false, reason: "locked" };

    summary.reclaimed = await store.reclaimStale();
    const cancelled = await store.cancelUnsendable(config.stage);
    summary.cancelled = cancelled.expired + cancelled.stageChanged;

    const rows = await store.claim(token, deps.batchSize ?? 20);
    summary.claimed = rows.length;
    const unfinished = new Set(rows.map((row) => row.id));

    for (const row of rows) {
      if (now().getTime() - startedAt > maxRunMs) break;
      const attemptStarted = Date.now();

      // Never send past the point where a duplicate could slip through, and never to a recipient the stage forbids.
      if (row.ambiguousSince && now().getTime() - row.ambiguousSince.getTime() > AMBIGUOUS_WINDOW_HOURS * 3600_000) {
        await store.markFailed(row.id, "needs_review", "An earlier attempt got no answer and the idempotency window has passed; check Resend before re-sending.");
        await store.recordAttempt(row.id, row.attemptCount, "held", "needs_review", 0);
        await notifyChairmenOfFailure(pool, row, "needs_review");
        unfinished.delete(row.id);
        summary.failed += 1;
        continue;
      }
      if (config.stage === "restricted" && !config.allowlist.includes((row.recipientEmail ?? "").toLowerCase())) {
        await store.markCancelled(row.id, "not_allowlisted");
        unfinished.delete(row.id);
        summary.dropped += 1;
        continue;
      }
      if (!row.recipientEmail) {
        await store.markCancelled(row.id, "no_recipient");
        unfinished.delete(row.id);
        summary.dropped += 1;
        continue;
      }

      const rendered = await render(row, { pool, config, now: now() }).catch((): RenderResult => ({ ok: false, action: "retry", reason: "render_error" }));
      if (!rendered.ok) {
        if (rendered.action === "cancel") {
          await store.markCancelled(row.id, rendered.reason);
          summary.dropped += 1;
        } else if (rendered.action === "fail") {
          await store.markFailed(row.id, rendered.reason, "The message could not be built.");
          await notifyChairmenOfFailure(pool, row, rendered.reason);
          summary.failed += 1;
        } else {
          await settleRetry(row, { kind: "retry", code: rendered.reason, message: "The message is not ready yet.", ambiguous: false }, summary);
        }
        await store.recordAttempt(row.id, row.attemptCount, rendered.action, rendered.reason, Date.now() - attemptStarted);
        unfinished.delete(row.id);
        continue;
      }

      const outcome = await sendResendEmail(
        { apiKey: config.resendApiKey, fetchImpl: deps.fetchImpl, now },
        {
          from: formatFrom(config.fromName, config.fromAddress),
          to: row.recipientEmail,
          replyTo: config.replyTo,
          subject: rendered.message.subject,
          text: rendered.message.text,
          html: rendered.message.html,
          tags: [{ name: "event", value: tagValue(row.eventKey) }, { name: "outbox_id", value: tagValue(row.id) }],
        },
        `trackcoop/${row.dedupeKey}`,
      );
      await store.recordAttempt(row.id, row.attemptCount, outcome.kind, "code" in outcome ? outcome.code : null, Date.now() - attemptStarted);

      if (outcome.kind === "systemic") {
        // The key, account or domain is the problem: every message would fail. Give back what is left and stop.
        await store.release([...unfinished], 15 * 60);
        unfinished.clear();
        summary.systemic = outcome.code;
        break;
      }
      unfinished.delete(row.id);
      if (outcome.kind === "sent") {
        await store.markSent(row.id, outcome.id);
        summary.sent += 1;
      } else if (outcome.kind === "permanent") {
        await store.markFailed(row.id, outcome.code, outcome.message);
        await notifyChairmenOfFailure(pool, row, outcome.code);
        summary.failed += 1;
      } else {
        await settleRetry(row, outcome, summary);
      }
      await sleep(deps.sendIntervalMs ?? 250);
    }

    // Rows claimed but not reached (the run ran out of time) go back untouched.
    if (unfinished.size) await store.release([...unfinished], 0);
    return summary;
  } finally {
    await lockConnection.query("SELECT RELEASE_LOCK(?)", [WORKER_LOCK_NAME]).catch(() => undefined);
    lockConnection.release();
  }

  async function settleRetry(row: OutboxRow, outcome: Extract<ResendOutcome, { kind: "retry" }>, runSummary: RunSummary) {
    const tooOld = now().getTime() - row.createdAt.getTime() > MAX_AGE_HOURS * 3600_000;
    if (row.attemptCount >= MAX_ATTEMPTS || tooOld) {
      await store.markFailed(row.id, "retries_exhausted", `${outcome.code}: gave up after ${row.attemptCount} attempts.`);
      await notifyChairmenOfFailure(pool, row, "retries_exhausted");
      runSummary.failed += 1;
      return;
    }
    await store.markRetry(row.id, {
      delaySeconds: Math.max(outcome.minDelaySeconds ?? 0, backoffSeconds(row.attemptCount, random)),
      code: outcome.code,
      message: outcome.message,
      ambiguous: outcome.ambiguous,
    });
    runSummary.retried += 1;
  }
}
