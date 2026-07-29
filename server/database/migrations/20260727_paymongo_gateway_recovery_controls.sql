-- Phase I: explicit proof of prior webhook verification and Bookkeeper recovery metadata.
-- Forward-only. Apply after 20260727_payment_receipt_processing_and_reversal.sql.

ALTER TABLE payment_gateway_events
  ADD COLUMN signature_verified_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER payload_sha256,
  ADD COLUMN recovery_note VARCHAR(1000) NULL AFTER safe_error_message,
  ADD COLUMN last_retried_by BIGINT UNSIGNED NULL AFTER recovery_note,
  ADD KEY idx_gateway_event_retry_eligibility
    (processing_status, signature_verified_at, payment_reference_id),
  ADD CONSTRAINT fk_gateway_event_last_retried_by
    FOREIGN KEY (last_retried_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- TrackCOOP inserts PayMongo gateway events only after verifyAndParsePaymongoWebhook
-- succeeds. The default preserves that verified provenance for new events, while
-- this backfill preserves the original receive time for existing verified events.
UPDATE payment_gateway_events
   SET signature_verified_at = received_at
 WHERE gateway_name = 'PayMongo'
   AND signature_verified_at IS NULL;
