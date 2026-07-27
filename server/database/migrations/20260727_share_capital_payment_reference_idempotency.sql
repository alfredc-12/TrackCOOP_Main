-- ============================================================================
-- Phase E: preserve pre-approval Share Capital through membership conversion
-- Forward-only, non-destructive migration. Apply manually.
--
-- This unique key makes payment_reference_id the idempotency boundary for
-- application-to-member Share Capital reconciliation. Existing duplicate
-- non-NULL payment_reference_id values must be reviewed before applying.
-- ============================================================================

SET @has_share_capital_reference_unique := (
  SELECT COUNT(*)
    FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'share_capital_payments'
     AND INDEX_NAME = 'uq_share_capital_payment_reference'
);

SET @sql := IF(
  @has_share_capital_reference_unique = 0,
  'ALTER TABLE share_capital_payments
     ADD UNIQUE KEY uq_share_capital_payment_reference (payment_reference_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
