-- ============================================================================
-- Phase C: PayMongo Checkout Session attempt lifecycle and idempotency
-- Forward-only, non-destructive migration. Apply manually.
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_gateway_checkout_attempts (
  payment_gateway_checkout_attempt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_reference_id BIGINT UNSIGNED NOT NULL,
  gateway_name VARCHAR(40) NOT NULL DEFAULT 'PayMongo',
  attempt_number INT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  gateway_checkout_id VARCHAR(190) NULL,
  checkout_url TEXT NULL,
  gateway_status VARCHAR(80) NULL,
  gateway_environment ENUM('Test', 'Live') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_checked_at DATETIME NULL,
  reusable_until DATETIME NOT NULL,
  superseded_at DATETIME NULL,
  completed_at DATETIME NULL,
  PRIMARY KEY (payment_gateway_checkout_attempt_id),
  UNIQUE KEY uq_gateway_checkout_attempt_idempotency (idempotency_key),
  UNIQUE KEY uq_gateway_checkout_attempt_checkout (gateway_checkout_id),
  UNIQUE KEY uq_gateway_checkout_attempt_sequence
    (payment_reference_id, gateway_name, attempt_number),
  KEY idx_gateway_checkout_attempt_active
    (payment_reference_id, gateway_name, gateway_environment, superseded_at,
     completed_at, reusable_until),
  KEY idx_gateway_checkout_attempt_status
    (gateway_name, gateway_status, last_checked_at),
  CONSTRAINT fk_gateway_checkout_attempt_payment_reference
    FOREIGN KEY (payment_reference_id)
    REFERENCES payment_references (payment_reference_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;
