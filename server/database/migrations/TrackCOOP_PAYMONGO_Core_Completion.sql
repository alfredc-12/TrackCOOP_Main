-- ============================================================================
-- TRACKCOOP PAYMONGO CORE COMPLETION - CLEAN DATABASE OVERLAY
-- Target: MySQL 8.0+ / MariaDB 10.6+
--
-- Apply manually after TrackCOOP_MAIN_Database.sql on a clean database.
-- For an existing PayMongo database, apply only the outstanding dated files in
-- server/database/migrations/ after taking a backup. Do not run both paths.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+08:00';

-- Safe normalized webhook lifecycle. Raw bodies and signatures are never stored.
ALTER TABLE payment_gateway_events
  ADD COLUMN gateway_event_object_id VARCHAR(190) NULL AFTER event_type,
  ADD COLUMN gateway_reference_number VARCHAR(190) NULL AFTER gateway_payment_intent_id,
  ADD COLUMN gateway_amount DECIMAL(12,2) NULL AFTER gateway_reference_number,
  ADD COLUMN gateway_currency CHAR(3) NULL AFTER gateway_amount,
  ADD COLUMN gateway_payment_status VARCHAR(80) NULL AFTER gateway_currency,
  ADD COLUMN gateway_payment_method VARCHAR(80) NULL AFTER gateway_payment_status,
  ADD COLUMN gateway_fee_amount DECIMAL(12,2) NULL AFTER gateway_payment_method,
  ADD COLUMN gateway_net_amount DECIMAL(12,2) NULL AFTER gateway_fee_amount,
  ADD COLUMN gateway_paid_at DATETIME NULL AFTER gateway_net_amount,
  ADD COLUMN safe_error_message VARCHAR(1000) NULL AFTER error_message,
  ADD COLUMN retry_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER processed_at,
  ADD COLUMN processing_started_at DATETIME NULL AFTER retry_count,
  ADD COLUMN last_attempt_at DATETIME NULL AFTER processing_started_at,
  ADD COLUMN signature_verified_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER payload_sha256,
  ADD COLUMN recovery_note VARCHAR(1000) NULL AFTER safe_error_message,
  ADD COLUMN last_retried_by BIGINT UNSIGNED NULL AFTER recovery_note,
  MODIFY processing_status ENUM('Received','Processing','Processed','Ignored','Failed')
    NOT NULL DEFAULT 'Received',
  ADD UNIQUE KEY uq_gateway_event_object (gateway_name, gateway_event_object_id),
  ADD KEY idx_gateway_event_retry_eligibility
    (processing_status, signature_verified_at, payment_reference_id),
  ADD CONSTRAINT fk_gateway_event_last_retried_by
    FOREIGN KEY (last_retried_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE payment_gateway_checkout_attempts (
  payment_gateway_checkout_attempt_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_reference_id BIGINT UNSIGNED NOT NULL,
  gateway_name VARCHAR(80) NOT NULL DEFAULT 'PayMongo',
  attempt_number INT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(190) NOT NULL,
  gateway_checkout_id VARCHAR(190) NULL,
  checkout_url VARCHAR(1000) NULL,
  gateway_status VARCHAR(80) NULL,
  gateway_environment ENUM('Test','Live') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_checked_at DATETIME NULL,
  reusable_until DATETIME NOT NULL,
  superseded_at DATETIME NULL,
  completed_at DATETIME NULL,
  UNIQUE KEY uq_checkout_attempt_idempotency (idempotency_key),
  UNIQUE KEY uq_checkout_attempt_gateway_id (gateway_name, gateway_checkout_id),
  UNIQUE KEY uq_checkout_attempt_sequence
    (payment_reference_id, gateway_name, attempt_number),
  KEY idx_checkout_attempt_active
    (payment_reference_id, gateway_name, gateway_environment, reusable_until,
     superseded_at, completed_at),
  CONSTRAINT fk_checkout_attempt_reference
    FOREIGN KEY (payment_reference_id) REFERENCES payment_references(payment_reference_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE payment_references
  ADD COLUMN client_request_id CHAR(36) NULL AFTER idempotency_key,
  ADD UNIQUE KEY uq_payment_client_request_id (client_request_id);

ALTER TABLE share_capital_payments
  ADD UNIQUE KEY uq_share_capital_payment_reference (payment_reference_id);

CREATE TABLE payment_receipts (
  payment_receipt_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_reference_id BIGINT UNSIGNED NOT NULL,
  member_id BIGINT UNSIGNED NULL,
  document_id BIGINT UNSIGNED NULL,
  receipt_number VARCHAR(80) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_channel VARCHAR(40) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  validation_source VARCHAR(40) NOT NULL DEFAULT 'Manual Bookkeeper',
  subject_reference VARCHAR(120) NULL,
  payment_date DATE NULL,
  validated_at DATETIME NULL,
  processing_status ENUM('Pending','Processing','Generated','Failed')
    NOT NULL DEFAULT 'Pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_attempt_at DATETIME NULL,
  generated_at DATETIME NULL,
  last_error_code VARCHAR(120) NULL,
  last_error_message VARCHAR(1000) NULL,
  reversed_at DATETIME NULL,
  reversal_note VARCHAR(1000) NULL,
  issued_by BIGINT UNSIGNED NOT NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_receipt_reference (payment_reference_id),
  UNIQUE KEY uq_payment_receipt_number (receipt_number),
  UNIQUE KEY uq_payment_receipt_document (document_id),
  KEY idx_payment_receipt_member (member_id, issued_at),
  KEY idx_payment_receipt_processing (processing_status, last_attempt_at),
  CONSTRAINT fk_payment_receipt_reference
    FOREIGN KEY (payment_reference_id) REFERENCES payment_references(payment_reference_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payment_receipt_member
    FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_payment_receipt_document
    FOREIGN KEY (document_id) REFERENCES documents(document_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payment_receipt_issuer
    FOREIGN KEY (issued_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Expected final base-table count: 48.
