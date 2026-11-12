-- Forward-only receipt attempt journal. No backfill and no deletion of old files.
CREATE TABLE payment_receipt_attempts (
  attempt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_receipt_id BIGINT UNSIGNED NOT NULL,
  attempt_number INT UNSIGNED NOT NULL,
  object_key VARCHAR(500) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempt_state ENUM('PREPARED','STORED','FINALIZED','FAILED','SUPERSEDED') NOT NULL DEFAULT 'PREPARED',
  upload_checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  upload_size BIGINT UNSIGNED NULL,
  document_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_receipt_attempt_number (payment_receipt_id,attempt_number),
  UNIQUE KEY uq_receipt_attempt_object (object_key),
  KEY ix_receipt_attempt_recovery (attempt_state,updated_at),
  CONSTRAINT fk_receipt_attempt_receipt FOREIGN KEY(payment_receipt_id) REFERENCES payment_receipts(payment_receipt_id) ON DELETE RESTRICT,
  CONSTRAINT fk_receipt_attempt_document FOREIGN KEY(document_id) REFERENCES documents(document_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE payment_receipt_attempt_events (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('PREPARED','STORED','FINALIZED','FAILED','SUPERSEDED') NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_receipt_attempt_event (attempt_id,event_type),
  CONSTRAINT fk_receipt_attempt_event FOREIGN KEY(attempt_id) REFERENCES payment_receipt_attempts(attempt_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
