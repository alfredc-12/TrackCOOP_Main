-- ============================================================================
-- Phase F: Authenticated Member PayMongo Share Capital checkout
-- Forward-only, non-destructive migration. Apply manually.
-- ============================================================================

SET @has_client_request_id := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'client_request_id'
);
SET @sql := IF(
  @has_client_request_id = 0,
  'ALTER TABLE payment_references ADD COLUMN client_request_id CHAR(36) NULL AFTER idempotency_key',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_client_request_unique := (
  SELECT COUNT(*)
    FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND INDEX_NAME = 'uq_payment_client_request_id'
);
SET @sql := IF(
  @has_client_request_unique = 0,
  'ALTER TABLE payment_references ADD UNIQUE KEY uq_payment_client_request_id (client_request_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS payment_receipts (
  payment_receipt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_reference_id BIGINT UNSIGNED NOT NULL,
  member_id BIGINT UNSIGNED NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  receipt_number VARCHAR(80) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_channel VARCHAR(40) NOT NULL,
  provider VARCHAR(120) NOT NULL,
  issued_by BIGINT UNSIGNED NOT NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_receipt_id),
  UNIQUE KEY uq_payment_receipt_reference (payment_reference_id),
  UNIQUE KEY uq_payment_receipt_number (receipt_number),
  UNIQUE KEY uq_payment_receipt_document (document_id),
  KEY idx_payment_receipt_member (member_id, issued_at),
  CONSTRAINT fk_payment_receipt_reference
    FOREIGN KEY (payment_reference_id)
    REFERENCES payment_references (payment_reference_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payment_receipt_member
    FOREIGN KEY (member_id)
    REFERENCES member_profiles (member_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_payment_receipt_document
    FOREIGN KEY (document_id)
    REFERENCES documents (document_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payment_receipt_issuer
    FOREIGN KEY (issued_by)
    REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
