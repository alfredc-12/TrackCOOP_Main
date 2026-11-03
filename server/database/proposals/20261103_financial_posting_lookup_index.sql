-- OPTIONAL PROPOSAL ONLY. Profile first; requires explicit production approval.
-- Not an integrity/uniqueness constraint and not required by Financial Overview.
SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='financial_records'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Execute only if no equivalent index exists and staging profiling justifies it.
CREATE INDEX idx_financial_posting_reference
  ON financial_records(payment_reference_id, record_type, record_status, approved_by);

-- Recovery, after checking dependencies:
-- DROP INDEX idx_financial_posting_reference ON financial_records;
