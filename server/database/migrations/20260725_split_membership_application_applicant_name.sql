-- Split membership application applicant names into first/middle/last/suffix.
-- Run this on existing databases that still have membership_applications.full_name.

SET @has_full_name := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'membership_applications'
     AND COLUMN_NAME = 'full_name'
);

SET @has_first_name := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'membership_applications'
     AND COLUMN_NAME = 'first_name'
);

SET @sql := IF(
  @has_first_name = 0,
  'ALTER TABLE membership_applications
     ADD COLUMN first_name VARCHAR(100) NULL AFTER requested_membership_type,
     ADD COLUMN middle_name VARCHAR(100) NULL AFTER first_name,
     ADD COLUMN last_name VARCHAR(100) NULL AFTER middle_name,
     ADD COLUMN suffix VARCHAR(30) NULL AFTER last_name',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @has_full_name > 0,
  'UPDATE membership_applications
      SET first_name = COALESCE(NULLIF(first_name, ''''), SUBSTRING_INDEX(TRIM(full_name), '' '', 1)),
          last_name = COALESCE(
            NULLIF(last_name, ''''),
            CASE
              WHEN TRIM(full_name) LIKE ''% %'' THEN SUBSTRING_INDEX(TRIM(full_name), '' '', -1)
              ELSE TRIM(full_name)
            END
          ),
          middle_name = COALESCE(
            NULLIF(middle_name, ''''),
            NULLIF(
              TRIM(
                SUBSTRING(
                  TRIM(full_name),
                  CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), '' '', 1)) + 1,
                  GREATEST(
                    CHAR_LENGTH(TRIM(full_name))
                    - CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), '' '', 1))
                    - CHAR_LENGTH(SUBSTRING_INDEX(TRIM(full_name), '' '', -1)),
                    0
                  )
                )
              ),
              ''''
            )
          )',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE membership_applications
   SET first_name = COALESCE(NULLIF(first_name, ''), 'Unknown'),
       last_name = COALESCE(NULLIF(last_name, ''), first_name, 'Unknown');

ALTER TABLE membership_applications
  MODIFY first_name VARCHAR(100) NOT NULL,
  MODIFY last_name VARCHAR(100) NOT NULL;

SET @sql := IF(
  @has_full_name > 0,
  'ALTER TABLE membership_applications DROP COLUMN full_name',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
