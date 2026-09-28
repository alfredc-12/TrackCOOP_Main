-- ============================================================================
-- TrackCOOP: raw member activity participation and RFM-inspired analytics
-- Run once on an existing database before importing the Member Activity /
-- Participation workbook. This migration intentionally does not invent or
-- import activity records; use the workbook importer after field mapping.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cooperative_activities (
    activity_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    activity_code VARCHAR(80) NULL,
    activity_name VARCHAR(255) NOT NULL,
    activity_type VARCHAR(120) NULL,
    activity_date DATE NOT NULL,
    end_date DATE NULL,
    barangay VARCHAR(120) NULL,
    sector VARCHAR(120) NULL,
    description TEXT NULL,
    is_rfm_qualifying TINYINT(1) NOT NULL DEFAULT 1,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_cooperative_activity_code UNIQUE (activity_code),
    CONSTRAINT fk_cooperative_activity_creator
        FOREIGN KEY (created_by) REFERENCES users (user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

SET @trackcoop_sql = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX idx_cooperative_activity_date ON cooperative_activities (activity_date)',
        'SELECT 1')
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'cooperative_activities'
       AND index_name = 'idx_cooperative_activity_date'
);
PREPARE trackcoop_statement FROM @trackcoop_sql;
EXECUTE trackcoop_statement;
DEALLOCATE PREPARE trackcoop_statement;

SET @trackcoop_sql = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX idx_cooperative_activity_type_date ON cooperative_activities (activity_type, activity_date)',
        'SELECT 1')
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'cooperative_activities'
       AND index_name = 'idx_cooperative_activity_type_date'
);
PREPARE trackcoop_statement FROM @trackcoop_sql;
EXECUTE trackcoop_statement;
DEALLOCATE PREPARE trackcoop_statement;

CREATE TABLE IF NOT EXISTS member_activity_participation (
    participation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    activity_id BIGINT UNSIGNED NOT NULL,
    participation_date DATE NOT NULL,
    participation_status VARCHAR(80) NOT NULL,
    participation_role VARCHAR(120) NULL,
    remarks TEXT NULL,
    source_reference VARCHAR(120) NULL,
    recorded_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_member_activity_participation_member
        FOREIGN KEY (member_id) REFERENCES member_profiles (member_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_member_activity_participation_activity
        FOREIGN KEY (activity_id) REFERENCES cooperative_activities (activity_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_member_activity_participation_recorder
        FOREIGN KEY (recorded_by) REFERENCES users (user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

SET @trackcoop_sql = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX idx_member_participation_member_date ON member_activity_participation (member_id, participation_date)',
        'SELECT 1')
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'member_activity_participation'
       AND index_name = 'idx_member_participation_member_date'
);
PREPARE trackcoop_statement FROM @trackcoop_sql;
EXECUTE trackcoop_statement;
DEALLOCATE PREPARE trackcoop_statement;

SET @trackcoop_sql = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX idx_member_participation_activity_status ON member_activity_participation (activity_id, participation_status)',
        'SELECT 1')
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'member_activity_participation'
       AND index_name = 'idx_member_participation_activity_status'
);
PREPARE trackcoop_statement FROM @trackcoop_sql;
EXECUTE trackcoop_statement;
DEALLOCATE PREPARE trackcoop_statement;

SET @trackcoop_sql = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX idx_member_participation_date ON member_activity_participation (participation_date)',
        'SELECT 1')
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'member_activity_participation'
       AND index_name = 'idx_member_participation_date'
);
PREPARE trackcoop_statement FROM @trackcoop_sql;
EXECUTE trackcoop_statement;
DEALLOCATE PREPARE trackcoop_statement;

SET @trackcoop_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE member_status_indicators ADD COLUMN recency_days INT UNSIGNED NULL AFTER basis_period_end',
        'SELECT 1')
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'member_status_indicators'
       AND column_name = 'recency_days'
);
PREPARE trackcoop_statement FROM @trackcoop_sql;
EXECUTE trackcoop_statement;
DEALLOCATE PREPARE trackcoop_statement;

SET @trackcoop_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE member_status_indicators ADD COLUMN frequency_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER recency_days',
        'SELECT 1')
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'member_status_indicators'
       AND column_name = 'frequency_count'
);
PREPARE trackcoop_statement FROM @trackcoop_sql;
EXECUTE trackcoop_statement;
DEALLOCATE PREPARE trackcoop_statement;

SET @trackcoop_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE member_status_indicators ADD COLUMN validated_share_capital DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER frequency_count',
        'SELECT 1')
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'member_status_indicators'
       AND column_name = 'validated_share_capital'
);
PREPARE trackcoop_statement FROM @trackcoop_sql;
EXECUTE trackcoop_statement;
DEALLOCATE PREPARE trackcoop_statement;

SET @trackcoop_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE member_status_indicators ADD COLUMN scoring_version VARCHAR(40) NOT NULL DEFAULT ''TRACKCOOP_RFM_V1'' AFTER status_label',
        'SELECT 1')
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'member_status_indicators'
       AND column_name = 'scoring_version'
);
PREPARE trackcoop_statement FROM @trackcoop_sql;
EXECUTE trackcoop_statement;
DEALLOCATE PREPARE trackcoop_statement;

UPDATE system_settings
   SET setting_value = '{"recencyDays":[{"max":30,"score":5},{"max":90,"score":4},{"max":180,"score":3},{"max":365,"score":2}],"frequencyCount":[{"min":12,"score":5},{"min":6,"score":4},{"min":3,"score":3},{"min":1,"score":2}],"contributionAmount":[{"min":15000,"score":5},{"min":3000,"score":4},{"min":1500,"score":3},{"min":0.01,"score":2}]}'
 WHERE setting_key = 'member_indicators.fallback_thresholds';

INSERT INTO system_settings
    (setting_group, setting_key, setting_value, value_type, description, is_public, effective_date)
VALUES
    ('member_indicators', 'member_indicators.qualifying_participation_statuses', '["Participated"]', 'JSON',
     'Participation statuses that count toward RFM-inspired recency and frequency.', 0, CURRENT_DATE)
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    description = VALUES(description),
    effective_date = VALUES(effective_date);

-- Expected checks after importing the supplied workbook:
-- SELECT COUNT(*) FROM member_activity_participation; -- expected baseline: 4629
-- SELECT COUNT(*)
--   FROM member_activity_participation map
--   LEFT JOIN member_profiles mp ON mp.member_id = map.member_id
--  WHERE mp.member_id IS NULL; -- expected: 0
