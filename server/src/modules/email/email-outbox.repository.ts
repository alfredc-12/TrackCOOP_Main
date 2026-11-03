import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { encryptSecret } from "./email-crypto";
import { getEmailConfig, type EmailConfig } from "./email-config";

/** Anything with `execute`: the pool, or the connection of an open business transaction. */
export type SqlExecutor = Pick<Pool, "execute"> | Pick<PoolConnection, "execute">;

export type EnqueueInput = {
  eventKey: string;
  /** One stable key per business event. Enqueuing the same key twice is a no-op. */
  dedupeKey: string;
  /** While a row with this key is open, later events join it instead of creating another (digests). */
  coalesceKey?: string;
  to: { email?: string | null; name?: string | null };
  payload: Record<string, unknown>;
  /** Secrets (an activation link). Encrypted at rest and erased once the row is finished. */
  secret?: Record<string, unknown>;
  delaySeconds?: number;
  expiresAt?: Date;
  related?: { type: string; id: string };
};

export type EnqueueResult =
  | { outcome: "disabled" }
  | { outcome: "queued" | "skipped" | "blocked"; outboxId: string; reason?: string }
  | { outcome: "duplicate"; outboxId: string };

const EMAIL_PATTERN = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/;

export function normalizeEmail(value: string | null | undefined) {
  const email = (value ?? "").trim();
  return email ? email.toLowerCase() : "";
}

function isDuplicateEntry(error: unknown) {
  const candidate = error as { code?: string; errno?: number };
  return candidate?.code === "ER_DUP_ENTRY" || candidate?.errno === 1062;
}

function assertLength(name: string, value: string, max: number) {
  // The database is not in strict mode, so an over-long key would be truncated silently and could collide.
  if (!value || value.length > max) throw new Error(`${name} must be 1-${max} characters`);
}

/**
 * Records an email to send. Call it with the business transaction's connection so the email is committed or
 * rolled back together with the change that caused it. A no-op unless EMAIL_DELIVERY is resend.
 */
export async function enqueueEmail(executor: SqlExecutor, input: EnqueueInput, config: EmailConfig = getEmailConfig()): Promise<EnqueueResult> {
  if (config.mode !== "resend") return { outcome: "disabled" };
  assertLength("eventKey", input.eventKey, 80);
  assertLength("dedupeKey", input.dedupeKey, 190);
  if (input.coalesceKey) assertLength("coalesceKey", input.coalesceKey, 190);

  const email = normalizeEmail(input.to.email);
  let status: "Pending" | "Skipped" | "Blocked" = "Pending";
  let reason: string | undefined;
  if (!email) {
    status = "Skipped";
    reason = "no_recipient";
  } else if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    status = "Skipped";
    reason = "invalid_recipient";
  } else if (config.stage === "restricted" && !config.allowlist.includes(email)) {
    status = "Blocked";
    reason = "not_allowlisted";
  }

  let secretBlob: Buffer | null = null;
  if (input.secret && status === "Pending") {
    if (!config.secretKey) throw new Error("EMAIL_SECRET_KEY is required to queue a message that carries a secret");
    secretBlob = encryptSecret(JSON.stringify(input.secret), config.secretKey, input.dedupeKey);
  }

  try {
    const [result] = await (executor as Pick<Pool, "execute">).execute<ResultSetHeader>(
      `INSERT INTO email_outbox
         (event_key, dedupe_key, coalesce_key, recipient_email, recipient_name, payload_json, secret_payload_enc,
          status, skip_reason, release_stage, send_after, expires_at, next_attempt_at, related_entity_type, related_entity_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), ?, UTC_TIMESTAMP(), ?, ?)`,
      [
        input.eventKey,
        input.dedupeKey,
        status === "Pending" ? (input.coalesceKey ?? null) : null,
        email || null,
        input.to.name?.trim().slice(0, 190) || null,
        JSON.stringify(input.payload),
        secretBlob,
        status,
        reason ?? null,
        config.stage,
        Math.max(0, Math.floor(input.delaySeconds ?? 0)),
        input.expiresAt ?? null,
        input.related?.type ?? null,
        input.related?.id ?? null,
      ],
    );
    const outboxId = String(result.insertId);
    if (status === "Pending") return { outcome: "queued", outboxId };
    return { outcome: status === "Blocked" ? "blocked" : "skipped", outboxId, reason };
  } catch (error) {
    if (!isDuplicateEntry(error)) throw error;
    const [rows] = await (executor as Pick<Pool, "execute">).execute<RowDataPacket[]>(
      "SELECT CAST(email_outbox_id AS CHAR) AS id FROM email_outbox WHERE dedupe_key = ? OR coalesce_key = ? LIMIT 1",
      [input.dedupeKey, input.coalesceKey ?? input.dedupeKey],
    );
    return { outcome: "duplicate", outboxId: String(rows[0]?.id ?? "") };
  }
}

// ------------------------------------------------------------------------------------------------- worker side

export type OutboxRow = {
  id: string;
  eventKey: string;
  dedupeKey: string;
  coalesceKey: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  payload: Record<string, unknown>;
  secretEnc: Buffer | null;
  attemptCount: number;
  ambiguousSince: Date | null;
  createdAt: Date;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
};

function parsePayload(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
}

export type OutboxStore = ReturnType<typeof createOutboxStore>;

export function createOutboxStore(pool: Pool) {
  return {
    /** Rows left `Sending` by a crashed worker. The request may have reached Resend, so they are marked ambiguous. */
    async reclaimStale() {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE email_outbox
            SET status = 'Pending', locked_by = NULL, locked_until = NULL,
                ambiguous_since = COALESCE(ambiguous_since, UTC_TIMESTAMP()), next_attempt_at = UTC_TIMESTAMP()
          WHERE status = 'Sending' AND locked_until < UTC_TIMESTAMP()`,
      );
      return result.affectedRows;
    },

    /** Drops queued mail that is past its useful life or that was queued under a different release stage. */
    async cancelUnsendable(currentStage: string) {
      const [expired] = await pool.execute<ResultSetHeader>(
        `UPDATE email_outbox SET status = 'Cancelled', skip_reason = 'expired', coalesce_key = NULL, secret_payload_enc = NULL
          WHERE status = 'Pending' AND expires_at IS NOT NULL AND expires_at < UTC_TIMESTAMP()`,
      );
      const [staged] = await pool.execute<ResultSetHeader>(
        `UPDATE email_outbox SET status = 'Cancelled', skip_reason = 'stage_changed', coalesce_key = NULL, secret_payload_enc = NULL
          WHERE status = 'Pending' AND release_stage <> ?`,
        [currentStage],
      );
      return { expired: expired.affectedRows, stageChanged: staged.affectedRows };
    },

    /** Atomically claims due rows for this worker. No SKIP LOCKED needed, so it is portable. */
    async claim(workerToken: string, limit: number, lockSeconds = 300) {
      await pool.execute(
        `UPDATE email_outbox
            SET status = 'Sending', locked_by = ?, locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),
                attempt_count = attempt_count + 1
          WHERE status = 'Pending' AND next_attempt_at <= UTC_TIMESTAMP() AND send_after <= UTC_TIMESTAMP()
          ORDER BY email_outbox_id
          LIMIT ${Math.max(1, Math.min(100, Math.floor(limit)))}`,
        [workerToken, lockSeconds],
      );
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT CAST(email_outbox_id AS CHAR) AS id, event_key AS eventKey, dedupe_key AS dedupeKey, coalesce_key AS coalesceKey,
                recipient_email AS recipientEmail, recipient_name AS recipientName, payload_json AS payload,
                secret_payload_enc AS secretEnc, attempt_count AS attemptCount, ambiguous_since AS ambiguousSince,
                created_at AS createdAt, related_entity_type AS relatedEntityType, related_entity_id AS relatedEntityId
           FROM email_outbox WHERE status = 'Sending' AND locked_by = ? ORDER BY email_outbox_id`,
        [workerToken],
      );
      return rows.map((row): OutboxRow => ({
        id: String(row.id),
        eventKey: String(row.eventKey),
        dedupeKey: String(row.dedupeKey),
        coalesceKey: row.coalesceKey === null ? null : String(row.coalesceKey),
        recipientEmail: row.recipientEmail === null ? null : String(row.recipientEmail),
        recipientName: row.recipientName === null ? null : String(row.recipientName),
        payload: parsePayload(row.payload),
        secretEnc: row.secretEnc ? Buffer.from(row.secretEnc as Buffer) : null,
        attemptCount: Number(row.attemptCount),
        ambiguousSince: row.ambiguousSince ? new Date(row.ambiguousSince as Date) : null,
        createdAt: new Date(row.createdAt as Date),
        relatedEntityType: row.relatedEntityType === null ? null : String(row.relatedEntityType),
        relatedEntityId: row.relatedEntityId === null ? null : String(row.relatedEntityId),
      }));
    },

    /** Gives unprocessed claimed rows back without spending an attempt (a run ended early or the account is blocked). */
    async release(ids: string[], delaySeconds: number) {
      if (!ids.length) return;
      await pool.execute(
        `UPDATE email_outbox
            SET status = 'Pending', locked_by = NULL, locked_until = NULL, attempt_count = GREATEST(attempt_count - 1, 0),
                next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)
          WHERE status = 'Sending' AND email_outbox_id IN (${ids.map(() => "?").join(",")})`,
        [delaySeconds, ...ids],
      );
    },

    async markSent(id: string, resendEmailId: string) {
      await pool.execute(
        `UPDATE email_outbox
            SET status = 'Sent', resend_email_id = ?, accepted_at = UTC_TIMESTAMP(), delivery_status = COALESCE(delivery_status, 'sent'),
                delivery_updated_at = COALESCE(delivery_updated_at, UTC_TIMESTAMP()), secret_payload_enc = NULL, coalesce_key = NULL,
                locked_by = NULL, locked_until = NULL, ambiguous_since = NULL, last_error_code = NULL, last_error_message = NULL
          WHERE email_outbox_id = ?`,
        [resendEmailId, id],
      );
      await this.reconcileDeliveryEvents(id, resendEmailId);
    },

    async markRetry(id: string, input: { delaySeconds: number; code: string; message: string; ambiguous: boolean }) {
      await pool.execute(
        `UPDATE email_outbox
            SET status = 'Pending', locked_by = NULL, locked_until = NULL,
                next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),
                ambiguous_since = ${input.ambiguous ? "COALESCE(ambiguous_since, UTC_TIMESTAMP())" : "NULL"},
                last_error_code = ?, last_error_message = ?
          WHERE email_outbox_id = ?`,
        [Math.max(1, Math.ceil(input.delaySeconds)), input.code.slice(0, 80), input.message.slice(0, 500), id],
      );
    },

    async markFailed(id: string, code: string, message: string) {
      await pool.execute(
        `UPDATE email_outbox
            SET status = 'Failed', locked_by = NULL, locked_until = NULL, secret_payload_enc = NULL, coalesce_key = NULL,
                last_error_code = ?, last_error_message = ?
          WHERE email_outbox_id = ?`,
        [code.slice(0, 80), message.slice(0, 500), id],
      );
    },

    async markCancelled(id: string, reason: string) {
      await pool.execute(
        `UPDATE email_outbox
            SET status = 'Cancelled', skip_reason = ?, locked_by = NULL, locked_until = NULL, secret_payload_enc = NULL, coalesce_key = NULL
          WHERE email_outbox_id = ?`,
        [reason.slice(0, 60), id],
      );
    },

    async recordAttempt(id: string, attemptNumber: number, outcome: string, errorCode: string | null, durationMs: number) {
      await pool.execute(
        "INSERT INTO email_outbox_attempts (email_outbox_id, attempt_number, outcome, error_code, duration_ms) VALUES (?, ?, ?, ?, ?)",
        [id, attemptNumber, outcome.slice(0, 20), errorCode?.slice(0, 80) ?? null, Math.max(0, Math.round(durationMs))],
      );
    },

    // ------------------------------------------------------------------------------------ delivery webhooks

    /** Applies one delivery event if it does not move the status backwards (events can arrive out of order). */
    async applyDeliveryStatus(resendEmailId: string, status: DeliveryStatus) {
      const rank = deliveryRank(status);
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE email_outbox
            SET delivery_status = ?, delivery_updated_at = UTC_TIMESTAMP()
          WHERE resend_email_id = ?
            AND (delivery_status IS NULL
                 OR (CASE delivery_status WHEN 'sent' THEN 1 WHEN 'delayed' THEN 2 WHEN 'delivered' THEN 3 WHEN 'complained' THEN 4 ELSE 5 END) <= ?)`,
        [status, resendEmailId, rank],
      );
      return result.affectedRows > 0;
    },

    /** Events that arrived before the send was recorded (rare race) are applied once the id is known. */
    async reconcileDeliveryEvents(id: string, resendEmailId: string) {
      const [events] = await pool.execute<RowDataPacket[]>(
        "SELECT event_type AS eventType FROM email_webhook_events WHERE resend_email_id = ? ORDER BY email_webhook_event_id",
        [resendEmailId],
      );
      for (const event of events) {
        const status = deliveryStatusForEvent(String(event.eventType));
        if (status) await this.applyDeliveryStatus(resendEmailId, status);
      }
      void id;
    },

    /** Returns false when this Svix delivery was already seen. */
    async recordWebhookEvent(svixId: string, eventType: string, resendEmailId: string | null, matched: boolean) {
      try {
        await pool.execute(
          "INSERT INTO email_webhook_events (svix_id, event_type, resend_email_id, processing_status) VALUES (?, ?, ?, ?)",
          [svixId.slice(0, 120), eventType.slice(0, 60), resendEmailId?.slice(0, 64) ?? null, matched ? "Processed" : "Ignored"],
        );
        return true;
      } catch (error) {
        if (isDuplicateEntry(error)) return false;
        throw error;
      }
    },

    /**
     * The only way a Blocked message is ever released. It is an explicit, named action; it refuses anything older
     * than 24 hours, so a test-stage backlog can never be released by accident long after the fact.
     */
    async releaseBlocked(ids: string[], currentStage: string) {
      if (!ids.length) return 0;
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE email_outbox
            SET status = 'Pending', skip_reason = NULL, release_stage = ?, next_attempt_at = UTC_TIMESTAMP(), send_after = UTC_TIMESTAMP()
          WHERE status = 'Blocked' AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
            AND email_outbox_id IN (${ids.map(() => "?").join(",")})`,
        [currentStage, ...ids],
      );
      return result.affectedRows;
    },

    async findByResendId(resendEmailId: string) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT CAST(email_outbox_id AS CHAR) AS id FROM email_outbox WHERE resend_email_id = ? LIMIT 1",
        [resendEmailId],
      );
      return rows[0] ? String(rows[0].id) : null;
    },
  };
}

export type DeliveryStatus = "sent" | "delayed" | "delivered" | "complained" | "bounced" | "failed" | "suppressed";

const deliveryEvents: Record<string, DeliveryStatus> = {
  "email.sent": "sent",
  "email.delivery_delayed": "delayed",
  "email.delivered": "delivered",
  "email.complained": "complained",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
};

export function deliveryStatusForEvent(eventType: string): DeliveryStatus | null {
  return deliveryEvents[eventType] ?? null;
}

export function deliveryRank(status: DeliveryStatus) {
  switch (status) {
    case "sent": return 1;
    case "delayed": return 2;
    case "delivered": return 3;
    case "complained": return 4;
    default: return 5;
  }
}
