-- Member Indicator Workspace: preserve immutable source evidence/configuration.
-- Review and apply through the normal database migration process; never run from a web request.
-- Existing saved scores are untouched. This only widens the optional metadata column and adds an index.
SET @trackcoop_rfm_sql = (
  SELECT IF(DATA_TYPE IN ('tinytext', 'text'),
    'ALTER TABLE member_status_indicators MODIFY COLUMN basis_summary MEDIUMTEXT NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'member_status_indicators' AND column_name = 'basis_summary'
);
PREPARE trackcoop_rfm_statement FROM @trackcoop_rfm_sql;
EXECUTE trackcoop_rfm_statement;
DEALLOCATE PREPARE trackcoop_rfm_statement;

SET @trackcoop_rfm_sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_member_indicator_basis_selection ON member_status_indicators (member_id, basis_period_end, computed_at, indicator_id)',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'member_status_indicators'
    AND index_name = 'idx_member_indicator_basis_selection'
);
PREPARE trackcoop_rfm_statement FROM @trackcoop_rfm_sql;
EXECUTE trackcoop_rfm_statement;
DEALLOCATE PREPARE trackcoop_rfm_statement;
