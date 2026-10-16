-- Support the active coverage-period guard used when creating dividend declarations.
-- This migration is safe to rerun because the index is created only when missing.

SET @dividend_period_index_exists := (
    SELECT COUNT(*)
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'dividend_declarations'
       AND index_name = 'idx_dividend_declaration_period_status'
);

SET @dividend_period_index_sql := IF(
    @dividend_period_index_exists = 0,
    'ALTER TABLE dividend_declarations ADD KEY idx_dividend_declaration_period_status (declaration_status, coverage_start, coverage_end)',
    'SELECT 1'
);

PREPARE dividend_period_index_statement FROM @dividend_period_index_sql;
EXECUTE dividend_period_index_statement;
DEALLOCATE PREPARE dividend_period_index_statement;
