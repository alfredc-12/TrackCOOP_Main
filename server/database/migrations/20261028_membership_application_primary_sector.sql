-- Store the applicant's required primary cooperative sector before approval.
-- Existing applications remain nullable for backward compatibility; new public
-- and Chairman application requests are validated by the API.

SET @has_primary_sector_column := (
    SELECT COUNT(*)
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'membership_applications'
       AND column_name = 'sector'
);

SET @add_primary_sector_sql := IF(
    @has_primary_sector_column = 0,
    'ALTER TABLE membership_applications ADD COLUMN sector VARCHAR(100) NULL AFTER province',
    'SELECT 1'
);

PREPARE add_primary_sector_statement FROM @add_primary_sector_sql;
EXECUTE add_primary_sector_statement;
DEALLOCATE PREPARE add_primary_sector_statement;
