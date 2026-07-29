-- Phase G: durable receipt processing and reversal metadata.
-- Forward-only. Apply after 20260727_member_paymongo_share_capital_checkout.sql.

ALTER TABLE payment_receipts
  MODIFY document_id BIGINT UNSIGNED NULL,
  ADD COLUMN validation_source VARCHAR(40) NOT NULL DEFAULT 'Manual Bookkeeper' AFTER provider,
  ADD COLUMN subject_reference VARCHAR(120) NULL AFTER validation_source,
  ADD COLUMN payment_date DATE NULL AFTER subject_reference,
  ADD COLUMN validated_at DATETIME NULL AFTER payment_date,
  ADD COLUMN processing_status ENUM('Pending','Processing','Generated','Failed') NOT NULL DEFAULT 'Pending' AFTER validated_at,
  ADD COLUMN attempt_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER processing_status,
  ADD COLUMN last_attempt_at DATETIME NULL AFTER attempt_count,
  ADD COLUMN generated_at DATETIME NULL AFTER last_attempt_at,
  ADD COLUMN last_error_code VARCHAR(120) NULL AFTER generated_at,
  ADD COLUMN last_error_message VARCHAR(1000) NULL AFTER last_error_code,
  ADD COLUMN reversed_at DATETIME NULL AFTER last_error_message,
  ADD COLUMN reversal_note VARCHAR(1000) NULL AFTER reversed_at,
  ADD KEY idx_payment_receipt_processing (processing_status, last_attempt_at);

UPDATE payment_receipts
   SET processing_status = 'Generated',
       generated_at = COALESCE(generated_at, issued_at),
       attempt_count = GREATEST(attempt_count, 1)
 WHERE document_id IS NOT NULL;
