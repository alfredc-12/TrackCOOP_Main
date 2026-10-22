-- Member referral codes and application-to-member referral tracking.
-- Apply manually after backing up the existing database.

SET @trackcoop_sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE member_profiles ADD COLUMN referral_code VARCHAR(40) NULL AFTER member_code',
        'SELECT 1'
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'member_profiles'
      AND column_name = 'referral_code'
);
PREPARE trackcoop_stmt FROM @trackcoop_sql;
EXECUTE trackcoop_stmt;
DEALLOCATE PREPARE trackcoop_stmt;

UPDATE member_profiles
   SET referral_code = LEFT(CONCAT('REF-', UPPER(TRIM(member_code))), 40)
 WHERE referral_code IS NULL
   AND NULLIF(TRIM(member_code), '') IS NOT NULL;

SET @trackcoop_sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE member_profiles ADD UNIQUE KEY uq_member_profiles_referral_code (referral_code)',
        'SELECT 1'
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'member_profiles'
      AND index_name = 'uq_member_profiles_referral_code'
);
PREPARE trackcoop_stmt FROM @trackcoop_sql;
EXECUTE trackcoop_stmt;
DEALLOCATE PREPARE trackcoop_stmt;

CREATE TABLE IF NOT EXISTS member_referrals (
    member_referral_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    referrer_member_id BIGINT UNSIGNED NOT NULL,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    referred_member_id BIGINT UNSIGNED NULL,
    referral_code VARCHAR(40) NOT NULL,
    referral_status ENUM('Pending', 'Successful', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    qualified_at DATETIME NULL,
    qualified_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_referrals_application UNIQUE (membership_application_id),
    CONSTRAINT fk_member_referrals_referrer FOREIGN KEY (referrer_member_id)
        REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_member_referrals_application FOREIGN KEY (membership_application_id)
        REFERENCES membership_applications (membership_application_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_member_referrals_referred_member FOREIGN KEY (referred_member_id)
        REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_member_referrals_qualifier FOREIGN KEY (qualified_by)
        REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

SET @trackcoop_sql = (
    SELECT IF(
        COUNT(*) = 0,
        'CREATE INDEX idx_member_referrals_referrer_status ON member_referrals (referrer_member_id, referral_status, created_at)',
        'SELECT 1'
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'member_referrals'
      AND index_name = 'idx_member_referrals_referrer_status'
);
PREPARE trackcoop_stmt FROM @trackcoop_sql;
EXECUTE trackcoop_stmt;
DEALLOCATE PREPARE trackcoop_stmt;

SET @trackcoop_sql = (
    SELECT IF(
        COUNT(*) = 0,
        'CREATE INDEX idx_member_referrals_status ON member_referrals (referral_status, created_at)',
        'SELECT 1'
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'member_referrals'
      AND index_name = 'idx_member_referrals_status'
);
PREPARE trackcoop_stmt FROM @trackcoop_sql;
EXECUTE trackcoop_stmt;
DEALLOCATE PREPARE trackcoop_stmt;

SET @trackcoop_sql = (
    SELECT IF(
        COUNT(*) = 0,
        'CREATE INDEX idx_member_referrals_referred_member ON member_referrals (referred_member_id)',
        'SELECT 1'
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'member_referrals'
      AND index_name = 'idx_member_referrals_referred_member'
);
PREPARE trackcoop_stmt FROM @trackcoop_sql;
EXECUTE trackcoop_stmt;
DEALLOCATE PREPARE trackcoop_stmt;
