-- OPTIONAL PROPOSAL ONLY. Not required or consumed by Financial Overview.
-- Requires explicit production approval, backup and staging validation.
-- Preflight: inspect metadata first; skip ALTER if the column already exists.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='financial_categories'
  AND COLUMN_NAME='operating_classification';

ALTER TABLE financial_categories
  ADD COLUMN operating_classification
    ENUM('Operating','Capital','Internal Transfer','Principal','Non-operating','Needs Review')
    NULL DEFAULT NULL;

-- No automatic backfill. Each category needs accountant-approved classification.
-- Future application readers must explicitly opt into this column with legacy fallback.
-- See docs/financial-overview/database-review.md for rollout and recovery.
