-- Correct the two constructed grant receipts that were stored as adjustments.
-- Donations and Grants is an Income category, so these receipts belong in
-- posted income and net surplus. The original record ids are preserved and
-- the correction is recorded in audit_logs.

START TRANSACTION;

INSERT INTO audit_logs (
    user_id,
    action,
    entity_table,
    record_id,
    description,
    old_values,
    new_values
)
SELECT
    COALESCE(approved_by, recorded_by),
    'financial_record.classification_corrected',
    'financial_records',
    financial_record_id,
    'Grant receipt reclassified from Adjustment to Income.',
    JSON_OBJECT(
        'recordType', record_type,
        'categoryCode', 'DONATIONS_GRANTS',
        'amount', amount,
        'sourceModule', source_module
    ),
    JSON_OBJECT(
        'recordType', 'Income',
        'categoryCode', 'DONATIONS_GRANTS',
        'amount', amount,
        'sourceModule', source_module
    )
FROM financial_records
WHERE record_number IN ('FIN-2026-000317', 'FIN-2026-000318')
  AND financial_category_id = (
      SELECT financial_category_id
      FROM financial_categories
      WHERE category_code = 'DONATIONS_GRANTS'
      LIMIT 1
  )
  AND record_type = 'Adjustment'
  AND record_status = 'Active'
  AND source_module = 'Other';

UPDATE financial_records
SET record_type = 'Income',
    remarks = CONCAT(
        COALESCE(remarks, ''),
        ' Classification corrected: Donations and Grants is an Income category.'
    )
WHERE record_number IN ('FIN-2026-000317', 'FIN-2026-000318')
  AND financial_category_id = (
      SELECT financial_category_id
      FROM financial_categories
      WHERE category_code = 'DONATIONS_GRANTS'
      LIMIT 1
  )
  AND record_type = 'Adjustment'
  AND record_status = 'Active'
  AND source_module = 'Other';

COMMIT;
