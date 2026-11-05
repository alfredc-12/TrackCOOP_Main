-- Membership v2: additive, ordered after 20261105_membership_upgrade_requests.sql.
-- Take a backup first. Run once in the selected database. No legacy obligations/payments are changed.
-- Reuse the existing capital-ledger table definitions if absent. No historic balance repair or interest structures/calculations are changed.
CREATE TABLE IF NOT EXISTS share_capital_accounts (
    share_capital_account_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    initial_capital DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    current_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    total_additional_contributions DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    total_dividends_added DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    total_deductions DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_share_capital_account_member UNIQUE (member_id),
    CONSTRAINT fk_share_capital_account_member FOREIGN KEY (member_id)
        REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_share_capital_account_amounts CHECK (
        initial_capital >= 0
        AND current_balance >= 0
        AND total_additional_contributions >= 0
        AND total_dividends_added >= 0
        AND total_deductions >= 0
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS share_capital_transactions (
    share_capital_transaction_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    share_capital_account_id BIGINT UNSIGNED NOT NULL,
    member_id BIGINT UNSIGNED NOT NULL,
    transaction_date DATE NOT NULL,
    transaction_type ENUM(
        'Initial Share Capital',
        'Additional Capital Contribution',
        'Dividend Added to Share Capital',
        'Capital Adjustment Credit',
        'Capital Adjustment Debit',
        'Reversal'
    ) NOT NULL,
    direction ENUM('Credit', 'Debit') NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    balance_before DECIMAL(14, 2) NOT NULL,
    balance_after DECIMAL(14, 2) NOT NULL,
    reference_number VARCHAR(190) NOT NULL,
    source_type VARCHAR(80) NOT NULL,
    source_id VARCHAR(190) NOT NULL,
    transaction_status ENUM('Posted', 'Reversed') NOT NULL DEFAULT 'Posted',
    remarks VARCHAR(1000) NULL,
    created_by BIGINT UNSIGNED NULL,
    reversed_transaction_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_share_capital_transaction_source UNIQUE (source_type, source_id),
    KEY idx_share_capital_transaction_member_created (member_id, created_at, share_capital_transaction_id),
    KEY idx_share_capital_transaction_member_date (member_id, transaction_date, share_capital_transaction_id),
    KEY idx_share_capital_transaction_reference (reference_number),
    CONSTRAINT fk_share_capital_transaction_account FOREIGN KEY (share_capital_account_id)
        REFERENCES share_capital_accounts (share_capital_account_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_share_capital_transaction_member FOREIGN KEY (member_id)
        REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_share_capital_transaction_creator FOREIGN KEY (created_by)
        REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_share_capital_transaction_reversal FOREIGN KEY (reversed_transaction_id)
        REFERENCES share_capital_transactions (share_capital_transaction_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_share_capital_transaction_amount CHECK (amount > 0),
    CONSTRAINT chk_share_capital_transaction_balance CHECK (balance_before >= 0 AND balance_after >= 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS membership_capital_cases (
 capital_case_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 membership_application_id BIGINT UNSIGNED NULL,
 upgrade_request_id BIGINT UNSIGNED NULL,
 member_id BIGINT UNSIGNED NULL,
 policy_version VARCHAR(60) NOT NULL,
 started_on DATE NOT NULL,
 reminder_on DATE NOT NULL,
 deadline DATE NOT NULL,
 required_capital DECIMAL(12,2) NOT NULL DEFAULT 3000,
 opening_validated_capital DECIMAL(12,2) NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 closed_at DATETIME NULL,
 UNIQUE KEY uq_capital_case_application (membership_application_id),
 UNIQUE KEY uq_capital_case_upgrade (upgrade_request_id),
 KEY idx_capital_case_member (member_id),
 KEY idx_capital_case_deadline (deadline),
 CONSTRAINT fk_capital_case_application FOREIGN KEY (membership_application_id) REFERENCES membership_applications(membership_application_id),
 CONSTRAINT fk_capital_case_upgrade FOREIGN KEY (upgrade_request_id) REFERENCES membership_upgrade_requests(upgrade_request_id),
 CONSTRAINT fk_capital_case_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS membership_capital_events (
 capital_event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 capital_case_id BIGINT UNSIGNED NOT NULL,
 event_key VARCHAR(190) NOT NULL,
 amount DECIMAL(12,2) NOT NULL,
 occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 description VARCHAR(190) NOT NULL,
 UNIQUE KEY uq_capital_event_key (event_key),
 KEY idx_capital_event_case_date (capital_case_id,occurred_at),
 CONSTRAINT fk_capital_event_case FOREIGN KEY (capital_case_id) REFERENCES membership_capital_cases(capital_case_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cooperative_sectors (
 sector_id TINYINT UNSIGNED PRIMARY KEY,
 sector_name VARCHAR(100) NOT NULL,
 UNIQUE KEY uq_cooperative_sector_name (sector_name)
) ENGINE=InnoDB;
INSERT IGNORE INTO cooperative_sectors(sector_id,sector_name) VALUES
 (1,'Rice'),(2,'Corn'),(3,'Fishery'),(4,'Livestock'),(5,'High-value crops (gulayan)'),(6,'Coffee');
CREATE TABLE IF NOT EXISTS membership_application_sectors (
 membership_application_id BIGINT UNSIGNED NOT NULL,
 sector_id TINYINT UNSIGNED NOT NULL,
 PRIMARY KEY (membership_application_id,sector_id),
 CONSTRAINT fk_application_sector_application FOREIGN KEY(membership_application_id) REFERENCES membership_applications(membership_application_id),
 CONSTRAINT fk_application_sector_sector FOREIGN KEY(sector_id) REFERENCES cooperative_sectors(sector_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS member_sectors (
 member_id BIGINT UNSIGNED NOT NULL,
 sector_id TINYINT UNSIGNED NOT NULL,
 PRIMARY KEY (member_id,sector_id),
 CONSTRAINT fk_member_sector_member FOREIGN KEY(member_id) REFERENCES member_profiles(member_id),
 CONSTRAINT fk_member_sector_sector FOREIGN KEY(sector_id) REFERENCES cooperative_sectors(sector_id)
) ENGINE=InnoDB;
-- Copy recognized legacy sectors; do not erase or rewrite unknown legacy strings.
INSERT IGNORE INTO membership_application_sectors(membership_application_id,sector_id)
 SELECT a.membership_application_id,s.sector_id FROM membership_applications a
 JOIN cooperative_sectors s ON LOWER(TRIM(a.sector))=LOWER(s.sector_name);
INSERT IGNORE INTO member_sectors(member_id,sector_id)
 SELECT m.member_id,s.sector_id FROM member_profiles m
 JOIN cooperative_sectors s ON LOWER(TRIM(m.sector))=LOWER(s.sector_name);
ALTER TABLE member_profiles MODIFY COLUMN sector ENUM('Rice','Corn','Fishery','Livestock','High-value crops (gulayan)','Coffee') NULL;
-- Nullable codes preserve existing address text. Only new/explicitly edited addresses are normalized.
ALTER TABLE membership_applications ADD COLUMN municipality_psgc CHAR(10) NULL,
 ADD COLUMN barangay_psgc CHAR(10) NULL;
ALTER TABLE member_profiles ADD COLUMN municipality_psgc CHAR(10) NULL,
 ADD COLUMN barangay_psgc CHAR(10) NULL;
ALTER TABLE membership_applications ALTER COLUMN share_capital_deadline_months SET DEFAULT 6;
-- These defaults apply to NEW applications only. Existing rows retain their snapshots.
UPDATE system_settings SET setting_value='3000' WHERE setting_key='membership.true_member_required_capital';
UPDATE system_settings SET setting_value='6',description='Calendar months from submission for new True Membership applications/upgrade requests.' WHERE setting_key='membership.share_capital_deadline_months';
UPDATE system_settings SET setting_value='{"enabled":false,"creditsPerSuccessfulReferral":0,"label":"Referrals"}' WHERE setting_key='referrals.reward_policy';
-- Never backfill capital cases for legacy applications: they require individual review.

-- Capital movements remain separate from the one-time membership fee. Existing rows are never recategorized.
INSERT IGNORE INTO financial_categories(category_code,category_name,category_type,description,is_system_category,is_active)
 VALUES('SHARE_CAPITAL','Share Capital','Income','Member capital movement; excluded from operating income.',1,1);
