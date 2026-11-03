-- Durable email outbox for the Resend integration. ADDITIVE ONLY: three new tables, no existing table is touched.
-- Run manually (npm run db:migrate:email-outbox); it never runs at API startup. Safe to re-run.
--
-- Times are UTC (the server and the API pool both use UTC). The database runs without STRICT_TRANS_TABLES,
-- so the application validates lengths itself instead of relying on errors for over-long values.

CREATE TABLE IF NOT EXISTS email_outbox (
    email_outbox_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_key VARCHAR(80) NOT NULL,
    -- One row per business event. Doubles as the Resend idempotency key.
    dedupe_key VARCHAR(190) NOT NULL,
    -- Set while a digest is open so later events join the same row; cleared when the row finishes.
    coalesce_key VARCHAR(190) NULL,
    recipient_email VARCHAR(254) NULL,
    recipient_name VARCHAR(190) NULL,
    -- Non-secret render data only (ids, names, amounts, dates, status text).
    payload_json JSON NOT NULL,
    -- AES-256-GCM blob for the few secrets a message needs (an activation link). Cleared once terminal.
    secret_payload_enc VARBINARY(4096) NULL,
    status ENUM('Pending', 'Sending', 'Sent', 'Failed', 'Skipped', 'Blocked', 'Cancelled') NOT NULL DEFAULT 'Pending',
    skip_reason VARCHAR(60) NULL,
    -- The release stage in force when the row was queued. A row never crosses stages.
    release_stage VARCHAR(20) NOT NULL DEFAULT 'restricted',
    send_after DATETIME NOT NULL,
    expires_at DATETIME NULL,
    attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    next_attempt_at DATETIME NOT NULL,
    locked_by VARCHAR(80) NULL,
    locked_until DATETIME NULL,
    last_error_code VARCHAR(80) NULL,
    last_error_message VARCHAR(500) NULL,
    -- First time an attempt ended without an answer from Resend. Resend remembers an idempotency key for
    -- 24 hours, so a message that stays ambiguous longer than that is held for review, never re-sent blindly.
    ambiguous_since DATETIME NULL,
    resend_email_id VARCHAR(64) NULL,
    accepted_at DATETIME NULL,
    delivery_status VARCHAR(30) NULL,
    delivery_updated_at DATETIME NULL,
    related_entity_type VARCHAR(40) NULL,
    related_entity_id VARCHAR(40) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_email_outbox_dedupe UNIQUE (dedupe_key),
    CONSTRAINT uq_email_outbox_coalesce UNIQUE (coalesce_key),
    CONSTRAINT uq_email_outbox_resend_id UNIQUE (resend_email_id),
    KEY idx_email_outbox_due (status, next_attempt_at),
    KEY idx_email_outbox_locks (status, locked_until),
    KEY idx_email_outbox_entity (related_entity_type, related_entity_id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS email_outbox_attempts (
    email_outbox_attempt_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email_outbox_id BIGINT UNSIGNED NOT NULL,
    attempt_number SMALLINT UNSIGNED NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    error_code VARCHAR(80) NULL,
    duration_ms INT UNSIGNED NULL,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_email_outbox_attempts_email (email_outbox_id, attempt_number),
    CONSTRAINT fk_email_outbox_attempt_email FOREIGN KEY (email_outbox_id)
        REFERENCES email_outbox (email_outbox_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS email_webhook_events (
    email_webhook_event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    svix_id VARCHAR(120) NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    resend_email_id VARCHAR(64) NULL,
    processing_status ENUM('Processed', 'Ignored') NOT NULL DEFAULT 'Processed',
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_email_webhook_svix UNIQUE (svix_id),
    KEY idx_email_webhook_email (resend_email_id)
) ENGINE = InnoDB;
