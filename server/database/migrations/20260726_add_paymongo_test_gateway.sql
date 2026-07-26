-- Add PayMongo test-mode gateway fields and payment validation history.
-- Run this manually on existing databases after taking a backup.
-- This migration is forward-only and does not drop, truncate, or rewrite data.

SET @payment_validation_type := (
  SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'validation_status'
);

SET @sql := IF(
  @payment_validation_type NOT LIKE '%''Reversed''%',
  'ALTER TABLE payment_references
     MODIFY validation_status ENUM(''Pending'', ''Validated'', ''Rejected'', ''Needs Clarification'', ''Reversed'') NOT NULL DEFAULT ''Pending''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'payment_channel'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references
     ADD COLUMN payment_channel ENUM(''PayMongo'', ''Manual GCash'', ''Cash'', ''Bank Transfer'', ''Other'') NOT NULL DEFAULT ''Other'' AFTER provider',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'gateway_environment'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references
     ADD COLUMN gateway_environment ENUM(''Test'', ''Live'', ''Manual'') NOT NULL DEFAULT ''Manual'' AFTER payment_channel',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'gateway_checkout_id'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references ADD COLUMN gateway_checkout_id VARCHAR(190) NULL AFTER notes',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'gateway_payment_id'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references ADD COLUMN gateway_payment_id VARCHAR(190) NULL AFTER gateway_checkout_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'gateway_payment_intent_id'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references ADD COLUMN gateway_payment_intent_id VARCHAR(190) NULL AFTER gateway_payment_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'gateway_status'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references ADD COLUMN gateway_status VARCHAR(100) NULL AFTER gateway_payment_intent_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'gateway_payment_method'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references ADD COLUMN gateway_payment_method VARCHAR(80) NULL AFTER gateway_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'gateway_fee_amount'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references ADD COLUMN gateway_fee_amount DECIMAL(12,2) NULL AFTER gateway_payment_method',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'gateway_net_amount'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references ADD COLUMN gateway_net_amount DECIMAL(12,2) NULL AFTER gateway_fee_amount',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'paid_at'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references ADD COLUMN paid_at DATETIME NULL AFTER gateway_net_amount',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'webhook_received_at'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references ADD COLUMN webhook_received_at DATETIME NULL AFTER paid_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'idempotency_key'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references ADD COLUMN idempotency_key VARCHAR(190) NULL AFTER webhook_received_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_column := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND COLUMN_NAME = 'validation_source'
);
SET @sql := IF(
  @has_column = 0,
  'ALTER TABLE payment_references
     ADD COLUMN validation_source ENUM(''Manual Bookkeeper'', ''PayMongo Webhook'', ''System'') NULL AFTER idempotency_key',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_index := (
  SELECT COUNT(*)
    FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND INDEX_NAME = 'uq_payment_gateway_checkout'
);
SET @sql := IF(
  @has_index = 0,
  'CREATE UNIQUE INDEX uq_payment_gateway_checkout ON payment_references (gateway_checkout_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_index := (
  SELECT COUNT(*)
    FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND INDEX_NAME = 'uq_payment_gateway_payment'
);
SET @sql := IF(
  @has_index = 0,
  'CREATE UNIQUE INDEX uq_payment_gateway_payment ON payment_references (gateway_payment_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_index := (
  SELECT COUNT(*)
    FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'payment_references'
     AND INDEX_NAME = 'uq_payment_idempotency'
);
SET @sql := IF(
  @has_index = 0,
  'CREATE UNIQUE INDEX uq_payment_idempotency ON payment_references (idempotency_key)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS payment_gateway_events (
    payment_gateway_event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payment_reference_id BIGINT UNSIGNED NULL,
    gateway_name VARCHAR(80) NOT NULL DEFAULT 'PayMongo',
    event_type VARCHAR(120) NOT NULL,
    event_fingerprint CHAR(64) NOT NULL,
    gateway_checkout_id VARCHAR(190) NULL,
    gateway_payment_id VARCHAR(190) NULL,
    gateway_payment_intent_id VARCHAR(190) NULL,
    livemode TINYINT(1) NOT NULL DEFAULT 0,
    payload_sha256 CHAR(64) NOT NULL,
    processing_status ENUM('Received','Processed','Ignored','Failed') NOT NULL DEFAULT 'Received',
    error_code VARCHAR(120) NULL,
    error_message TEXT NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL,
    CONSTRAINT uq_payment_gateway_event_fingerprint UNIQUE (event_fingerprint),
    CONSTRAINT fk_payment_gateway_event_reference
        FOREIGN KEY (payment_reference_id)
        REFERENCES payment_references(payment_reference_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_validation_history (
    payment_validation_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payment_reference_id BIGINT UNSIGNED NOT NULL,
    old_status ENUM('Pending','Validated','Rejected','Needs Clarification','Reversed') NULL,
    new_status ENUM('Pending','Validated','Rejected','Needs Clarification','Reversed') NOT NULL,
    validation_source ENUM('Manual Bookkeeper','PayMongo Webhook','System') NOT NULL,
    reason TEXT NULL,
    changed_by BIGINT UNSIGNED NULL,
    gateway_event_id BIGINT UNSIGNED NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_validation_history_reference
        FOREIGN KEY (payment_reference_id)
        REFERENCES payment_references(payment_reference_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_payment_validation_history_user
        FOREIGN KEY (changed_by)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_payment_validation_history_event
        FOREIGN KEY (gateway_event_id)
        REFERENCES payment_gateway_events(payment_gateway_event_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
