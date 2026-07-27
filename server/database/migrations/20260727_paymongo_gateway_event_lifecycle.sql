-- ============================================================================
-- Phase B: PayMongo webhook lifecycle, event recovery, and safe error fields
-- Forward-only, non-destructive migration.
-- Apply manually after reviewing against the target TrackCOOP database.
-- ============================================================================

SET @table_name := 'payment_gateway_events';

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'gateway_event_object_id'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN gateway_event_object_id VARCHAR(190) NULL AFTER event_fingerprint',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'gateway_reference_number'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN gateway_reference_number VARCHAR(190) NULL AFTER gateway_event_object_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'gateway_amount'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN gateway_amount DECIMAL(12, 2) NULL AFTER payload_sha256',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'gateway_currency'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN gateway_currency CHAR(3) NULL AFTER gateway_amount',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'gateway_payment_status'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN gateway_payment_status VARCHAR(80) NULL AFTER gateway_currency',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'gateway_payment_method'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN gateway_payment_method VARCHAR(80) NULL AFTER gateway_payment_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'gateway_fee_amount'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN gateway_fee_amount DECIMAL(12, 2) NULL AFTER gateway_payment_method',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'gateway_net_amount'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN gateway_net_amount DECIMAL(12, 2) NULL AFTER gateway_fee_amount',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'gateway_paid_at'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN gateway_paid_at DATETIME NULL AFTER gateway_net_amount',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'retry_count'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN retry_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER processing_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'processing_started_at'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN processing_started_at DATETIME NULL AFTER retry_count',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'last_attempt_at'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN last_attempt_at DATETIME NULL AFTER processing_started_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'safe_error_message'
);
SET @sql := IF(@column_exists = 0,
  'ALTER TABLE payment_gateway_events ADD COLUMN safe_error_message TEXT NULL AFTER error_message',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @processing_enum_needs_update := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND COLUMN_NAME = 'processing_status'
     AND COLUMN_TYPE NOT LIKE '%''Processing''%'
);
SET @sql := IF(@processing_enum_needs_update > 0,
  'ALTER TABLE payment_gateway_events MODIFY COLUMN processing_status ENUM(''Received'', ''Processing'', ''Processed'', ''Ignored'', ''Failed'') NOT NULL DEFAULT ''Received''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND INDEX_NAME = 'uq_payment_gateway_event_object'
);
SET @sql := IF(@index_exists = 0,
  'CREATE UNIQUE INDEX uq_payment_gateway_event_object ON payment_gateway_events (gateway_event_object_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND INDEX_NAME = 'idx_payment_gateway_events_status_retry'
);
SET @sql := IF(@index_exists = 0,
  'CREATE INDEX idx_payment_gateway_events_status_retry ON payment_gateway_events (processing_status, retry_count, last_attempt_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = @table_name
     AND INDEX_NAME = 'idx_payment_gateway_events_reference_number'
);
SET @sql := IF(@index_exists = 0,
  'CREATE INDEX idx_payment_gateway_events_reference_number ON payment_gateway_events (gateway_reference_number)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
