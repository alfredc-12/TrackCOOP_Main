-- Prevent duplicate dividend status history rows when scheduled activation is
-- triggered concurrently by two member or staff requests.
-- This is safe for an already-migrated database because the index is added
-- only when it does not already exist.

SET @share_capital_history_index_exists := (
    SELECT COUNT(*)
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'dividend_action_history'
       AND index_name = 'uq_dividend_action_history_status'
);

SET @share_capital_history_index_sql := IF(
    @share_capital_history_index_exists = 0,
    'ALTER TABLE dividend_action_history ADD UNIQUE KEY uq_dividend_action_history_status (member_dividend_id, new_status)',
    'SELECT 1'
);

PREPARE share_capital_history_index_statement FROM @share_capital_history_index_sql;
EXECUTE share_capital_history_index_statement;
DEALLOCATE PREPARE share_capital_history_index_statement;
