-- ============================================================================
-- TRACKCOOP RDS / PHPMYADMIN COMPATIBLE DATABASE - VERSION 4
-- Target DBMS : MySQL 8.0+ / MariaDB 10.6+
-- Database    : currently selected database
-- Purpose     : Complete database for the TrackCOOP public website, portal,
--               membership, share capital, payments, finance, rental, POS,
--               documents, reports, announcements, inquiries, analytics,
--               audit, and configurable system settings.
-- ============================================================================
-- Compatibility note: this edition uses no triggers, stored procedures,
-- stored functions, custom statement separators, or CHECK constraints. It is intended for
-- AWS RDS and shared-hosting accounts that do not have SUPER privilege.
-- ============================================================================

SET NAMES utf8mb4;

SET time_zone = '+08:00';

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- RESET EXISTING TRACKCOOP OBJECTS
-- ============================================================================
DROP VIEW IF EXISTS `v_member_share_capital_summary`;

DROP VIEW IF EXISTS `v_product_inventory_balance`;

DROP VIEW IF EXISTS `v_latest_member_status_indicator`;

DROP VIEW IF EXISTS `v_financial_monthly_summary`;

DROP VIEW IF EXISTS `v_barangay_member_distribution`;

DROP VIEW IF EXISTS `v_dashboard_financial_overview`;

DROP TABLE IF EXISTS `audit_logs`;

DROP TABLE IF EXISTS `user_activation_tokens`;

DROP TABLE IF EXISTS `system_settings`;

DROP TABLE IF EXISTS `gallery_items`;

DROP TABLE IF EXISTS `partners_certifications`;

DROP TABLE IF EXISTS `programs_projects`;

DROP TABLE IF EXISTS `services`;

DROP TABLE IF EXISTS `site_content_blocks`;

DROP TABLE IF EXISTS `notifications`;

DROP TABLE IF EXISTS `member_status_indicators`;

DROP TABLE IF EXISTS `request_status_history`;

DROP TABLE IF EXISTS `announcement_acknowledgments`;

DROP TABLE IF EXISTS `requests_inquiries`;

DROP TABLE IF EXISTS `announcement_recipients`;

DROP TABLE IF EXISTS `announcements`;

DROP TABLE IF EXISTS `reports`;

DROP TABLE IF EXISTS `document_access_logs`;

DROP TABLE IF EXISTS `documents`;

DROP TABLE IF EXISTS `rental_pos_records`;

DROP TABLE IF EXISTS `rental_status_history`;

DROP TABLE IF EXISTS `rental_bookings`;

DROP TABLE IF EXISTS `rental_assets`;

DROP TABLE IF EXISTS `inventory_movements`;

DROP TABLE IF EXISTS `pos_sale_items`;

DROP TABLE IF EXISTS `pos_sales`;

DROP TABLE IF EXISTS `products`;

DROP TABLE IF EXISTS `financial_records`;

DROP TABLE IF EXISTS `financial_categories`;

DROP TABLE IF EXISTS `share_capital_payments`;

DROP TABLE IF EXISTS `membership_application_requirements`;

DROP TABLE IF EXISTS `payment_validation_history`;

DROP TABLE IF EXISTS `payment_gateway_events`;

DROP TABLE IF EXISTS `payment_references`;

DROP TABLE IF EXISTS `membership_application_status_history`;

DROP TABLE IF EXISTS `membership_application_documents`;

DROP TABLE IF EXISTS `membership_application_beneficiaries`;

DROP TABLE IF EXISTS `membership_applications`;

DROP TABLE IF EXISTS `member_status_history`;

DROP TABLE IF EXISTS `member_profiles`;

DROP TABLE IF EXISTS `password_reset_tokens`;

DROP TABLE IF EXISTS `user_sessions`;

DROP TABLE IF EXISTS `users`;

DROP TABLE IF EXISTS `roles`;

-- Select the target database in phpMyAdmin before importing this file.
-- WARNING: the reset block below deletes existing TrackCOOP tables and data.
-- ============================================================================
-- 1. AUTHENTICATION, ROLES, AND ACCOUNT MANAGEMENT
-- ============================================================================

CREATE TABLE roles (
    role_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(80) NOT NULL,
    role_slug VARCHAR(80) NOT NULL,
    description TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_roles_name UNIQUE (role_name),
    CONSTRAINT uq_roles_slug UNIQUE (role_slug)
) ENGINE = InnoDB;

CREATE TABLE users (
    user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id SMALLINT UNSIGNED NOT NULL,
    username VARCHAR(80) NULL,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    account_status ENUM(
        'Pending',
        'Active',
        'Suspended',
        'Inactive'
    ) NOT NULL DEFAULT 'Pending',
    email_verified_at DATETIME NULL,
    last_login_at DATETIME NULL,
    failed_login_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (role_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_users_role_status` ON `users` (role_id, account_status);

CREATE INDEX `idx_users_display_name` ON `users` (display_name);

CREATE TABLE user_sessions (
    session_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    session_token_hash CHAR(64) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_sessions_token UNIQUE (session_token_hash),
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE INDEX `idx_user_sessions_user_active` ON `user_sessions` (
    user_id,
    expires_at,
    revoked_at
);

CREATE TABLE password_reset_tokens (
    reset_token_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    requested_ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_password_reset_token UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE INDEX `idx_password_reset_user` ON `password_reset_tokens` (user_id, expires_at, used_at);

CREATE TABLE user_activation_tokens (
    user_activation_token_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_activation_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_user_activation_token_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_user_activation_token_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

-- ============================================================================
-- 2. MEMBERSHIP AND SHARE CAPITAL
-- ============================================================================

CREATE TABLE member_profiles (
    member_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    member_code VARCHAR(60) NOT NULL,
    full_name VARCHAR(190) NOT NULL,
    contact_number VARCHAR(40) NULL,
    email VARCHAR(190) NULL,
    barangay VARCHAR(120) NULL,
    municipality VARCHAR(120) NOT NULL DEFAULT 'Nasugbu',
    province VARCHAR(120) NOT NULL DEFAULT 'Batangas',
    sector VARCHAR(100) NULL,
    membership_type ENUM('Associate', 'True Member') NOT NULL DEFAULT 'Associate',
    approval_status ENUM(
        'Pending',
        'Approved',
        'Rejected',
        'Needs Information'
    ) NOT NULL DEFAULT 'Pending',
    official_member_status ENUM(
        'Pending',
        'Active',
        'Inactive',
        'Suspended',
        'Terminated'
    ) NOT NULL DEFAULT 'Pending',
    application_date DATE NULL,
    approved_by BIGINT UNSIGNED NULL,
    approved_at DATETIME NULL,
    true_member_since DATE NULL,
    share_capital_deadline DATE NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_profiles_user UNIQUE (user_id),
    CONSTRAINT uq_member_profiles_code UNIQUE (member_code),
    CONSTRAINT fk_member_profiles_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_member_profiles_approved_by FOREIGN KEY (approved_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_members_name` ON `member_profiles` (full_name);

CREATE INDEX `idx_members_barangay` ON `member_profiles` (barangay);

CREATE INDEX `idx_members_type_status` ON `member_profiles` (
    membership_type,
    approval_status,
    official_member_status
);

CREATE TABLE member_status_history (
    member_status_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    old_membership_type ENUM('Associate', 'True Member') NULL,
    new_membership_type ENUM('Associate', 'True Member') NULL,
    old_official_status ENUM(
        'Pending',
        'Active',
        'Inactive',
        'Suspended',
        'Terminated'
    ) NULL,
    new_official_status ENUM(
        'Pending',
        'Active',
        'Inactive',
        'Suspended',
        'Terminated'
    ) NULL,
    reason TEXT NULL,
    changed_by BIGINT UNSIGNED NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_member_status_history_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_member_status_history_user FOREIGN KEY (changed_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_member_status_history_member` ON `member_status_history` (member_id, changed_at);

CREATE TABLE membership_applications (
    membership_application_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_code VARCHAR(60) NOT NULL,
    public_tracking_token_hash CHAR(64) NOT NULL,
    application_source ENUM(
        'Public Website',
        'Chairman Entry',
        'Imported Paper Form'
    ) NOT NULL DEFAULT 'Public Website',
    requested_membership_type ENUM('Associate', 'True Member') NOT NULL DEFAULT 'Associate',
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    suffix VARCHAR(30) NULL,
    email VARCHAR(190) NULL,
    contact_number VARCHAR(40) NOT NULL,
    civil_status ENUM(
        'Single',
        'Married',
        'Widowed',
        'Separated',
        'Other'
    ) NULL,
    place_of_birth VARCHAR(255) NULL,
    date_of_birth DATE NULL,
    current_address VARCHAR(500) NOT NULL,
    barangay VARCHAR(120) NULL,
    municipality VARCHAR(120) NOT NULL DEFAULT 'Nasugbu',
    province VARCHAR(120) NOT NULL DEFAULT 'Batangas',
    father_name VARCHAR(190) NULL,
    mother_name VARCHAR(190) NULL,
    spouse_name VARCHAR(190) NULL,
    occupation VARCHAR(190) NULL,
    orientation_commitment_accepted TINYINT(1) NOT NULL DEFAULT 0,
    membership_fee_commitment_accepted TINYINT(1) NOT NULL DEFAULT 0,
    membership_fee_amount DECIMAL(12, 2) NOT NULL DEFAULT 200.00,
    share_subscription_commitment_accepted TINYINT(1) NOT NULL DEFAULT 0,
    subscribed_shares SMALLINT UNSIGNED NULL,
    initial_share_capital_amount DECIMAL(12, 2) NOT NULL DEFAULT 1500.00,
    target_share_capital_amount DECIMAL(12, 2) NOT NULL DEFAULT 3000.00,
    share_capital_deadline_months SMALLINT UNSIGNED NOT NULL DEFAULT 12,
    annual_interest_rate DECIMAL(5, 2) NULL,
    patronage_refund_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
    bylaws_agreement_accepted TINYINT(1) NOT NULL DEFAULT 0,
    privacy_consent_accepted TINYINT(1) NOT NULL DEFAULT 0,
    terms_version VARCHAR(40) NOT NULL,
    applicant_signature_name VARCHAR(190) NOT NULL,
    signed_at DATETIME NOT NULL,
    signed_place VARCHAR(190) NOT NULL,
    application_status ENUM(
        'Submitted',
        'Under Review',
        'Needs Information',
        'Approved',
        'Rejected',
        'Withdrawn'
    ) NOT NULL DEFAULT 'Submitted',
    submitted_by_user_id BIGINT UNSIGNED NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    board_meeting_date DATE NULL,
    secretary_name VARCHAR(190) NULL,
    decision_reason TEXT NULL,
    converted_member_id BIGINT UNSIGNED NULL,
    submitted_ip VARCHAR(45) NULL,
    submitted_user_agent VARCHAR(500) NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_membership_applications_code UNIQUE (application_code),
    CONSTRAINT uq_membership_applications_tracking_hash UNIQUE (public_tracking_token_hash),
    CONSTRAINT fk_membership_application_submitter FOREIGN KEY (submitted_by_user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_membership_application_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_membership_application_converted_member FOREIGN KEY (converted_member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE membership_application_beneficiaries (
    membership_application_beneficiary_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    full_name VARCHAR(190) NOT NULL,
    relationship VARCHAR(100) NULL,
    age_at_application SMALLINT UNSIGNED NULL,
    birth_date DATE NULL,
    display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_membership_beneficiary_application FOREIGN KEY (membership_application_id) REFERENCES membership_applications (membership_application_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE membership_application_documents (
    membership_application_document_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    document_type ENUM(
        'Scanned Paper Application',
        'Signed Application',
        'Valid ID',
        'Proof of Residency',
        'Membership Fee Proof',
        'Share Capital Proof',
        'Other'
    ) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    stored_file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size_bytes BIGINT UNSIGNED NOT NULL,
    checksum_sha256 CHAR(64) NULL,
    uploaded_by_user_id BIGINT UNSIGNED NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_membership_document_application FOREIGN KEY (membership_application_id) REFERENCES membership_applications (membership_application_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_membership_document_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE membership_application_status_history (
    membership_application_status_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    old_status ENUM(
        'Submitted',
        'Under Review',
        'Needs Information',
        'Approved',
        'Rejected',
        'Withdrawn'
    ) NULL,
    new_status ENUM(
        'Submitted',
        'Under Review',
        'Needs Information',
        'Approved',
        'Rejected',
        'Withdrawn'
    ) NOT NULL,
    internal_note TEXT NULL,
    applicant_message TEXT NULL,
    changed_by BIGINT UNSIGNED NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_membership_application_history_application FOREIGN KEY (membership_application_id) REFERENCES membership_applications (membership_application_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_membership_application_history_user FOREIGN KEY (changed_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

-- ============================================================================
-- 3. PAYMENT REFERENCES AND VALIDATION
-- ============================================================================

CREATE TABLE payment_references (
    payment_reference_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NULL,
    submitted_by BIGINT UNSIGNED NULL,
    payer_name VARCHAR(190) NULL,
    payer_email VARCHAR(190) NULL,
    payer_contact VARCHAR(40) NULL,
    provider VARCHAR(100) NOT NULL DEFAULT 'Reference-Based Payment',
    payment_channel ENUM(
        'PayMongo',
        'Manual GCash',
        'Cash',
        'Bank Transfer',
        'Other'
    ) NOT NULL DEFAULT 'Other',
    gateway_environment ENUM('Test', 'Live', 'Manual') NOT NULL DEFAULT 'Manual',
    reference_number VARCHAR(190) NOT NULL,
    payment_purpose ENUM(
        'Associate Membership Fee',
        'Share Capital',
        'Rental',
        'POS/Product',
        'Preorder',
        'Bulk Order',
        'Document/Certificate',
        'Other'
    ) NOT NULL,
    related_entity_type VARCHAR(80) NULL,
    related_entity_id BIGINT UNSIGNED NULL,
    amount DECIMAL(12, 2) NOT NULL,
    proof_file_path VARCHAR(500) NULL,
    validation_status ENUM(
        'Pending',
        'Validated',
        'Rejected',
        'Needs Clarification',
        'Reversed'
    ) NOT NULL DEFAULT 'Pending',
    validated_by BIGINT UNSIGNED NULL,
    validated_at DATETIME NULL,
    rejection_reason TEXT NULL,
    notes TEXT NULL,
    gateway_checkout_id VARCHAR(190) NULL,
    gateway_payment_id VARCHAR(190) NULL,
    gateway_payment_intent_id VARCHAR(190) NULL,
    gateway_status VARCHAR(100) NULL,
    gateway_payment_method VARCHAR(80) NULL,
    gateway_fee_amount DECIMAL(12, 2) NULL,
    gateway_net_amount DECIMAL(12, 2) NULL,
    paid_at DATETIME NULL,
    webhook_received_at DATETIME NULL,
    idempotency_key VARCHAR(190) NULL,
    validation_source ENUM(
        'Manual Bookkeeper',
        'PayMongo Webhook',
        'System'
    ) NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_payment_provider_reference UNIQUE (provider, reference_number),
    CONSTRAINT uq_payment_gateway_checkout UNIQUE (gateway_checkout_id),
    CONSTRAINT uq_payment_gateway_payment UNIQUE (gateway_payment_id),
    CONSTRAINT uq_payment_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_payment_reference_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_payment_reference_submitter FOREIGN KEY (submitted_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_payment_reference_validator FOREIGN KEY (validated_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_payment_reference_member` ON `payment_references` (member_id, submitted_at);

CREATE INDEX `idx_payment_reference_status` ON `payment_references` (
    validation_status,
    payment_purpose,
    submitted_at
);

CREATE INDEX `idx_payment_reference_related` ON `payment_references` (
    related_entity_type,
    related_entity_id
);

CREATE TABLE payment_gateway_events (
    payment_gateway_event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payment_reference_id BIGINT UNSIGNED NULL,
    gateway_name VARCHAR(80) NOT NULL DEFAULT 'PayMongo',
    event_type VARCHAR(120) NOT NULL,
    event_fingerprint CHAR(64) NOT NULL,
    gateway_checkout_id VARCHAR(190) NULL,
    gateway_payment_id VARCHAR(190) NULL,
    gateway_payment_intent_id VARCHAR(190) NULL,
    livemode TINYINT(1) NOT NULL DEFAULT 0,
    payload_sha256 CHAR(64) NOT NULL,
    processing_status ENUM(
        'Received',
        'Processed',
        'Ignored',
        'Failed'
    ) NOT NULL DEFAULT 'Received',
    error_code VARCHAR(120) NULL,
    error_message TEXT NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL,
    CONSTRAINT uq_payment_gateway_event_fingerprint UNIQUE (event_fingerprint),
    CONSTRAINT fk_payment_gateway_event_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references (payment_reference_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE payment_validation_history (
    payment_validation_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payment_reference_id BIGINT UNSIGNED NOT NULL,
    old_status ENUM(
        'Pending',
        'Validated',
        'Rejected',
        'Needs Clarification',
        'Reversed'
    ) NULL,
    new_status ENUM(
        'Pending',
        'Validated',
        'Rejected',
        'Needs Clarification',
        'Reversed'
    ) NOT NULL,
    validation_source ENUM(
        'Manual Bookkeeper',
        'PayMongo Webhook',
        'System'
    ) NOT NULL,
    reason TEXT NULL,
    changed_by BIGINT UNSIGNED NULL,
    gateway_event_id BIGINT UNSIGNED NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_validation_history_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references (payment_reference_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_payment_validation_history_user FOREIGN KEY (changed_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_payment_validation_history_event FOREIGN KEY (gateway_event_id) REFERENCES payment_gateway_events (payment_gateway_event_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE membership_application_requirements (
    membership_application_requirement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    requirement_type ENUM(
        'Orientation/Seminar',
        'Associate Membership Fee',
        'Initial Share Capital',
        'Signed Application',
        'Valid ID',
        'Proof of Residency',
        'Other'
    ) NOT NULL,
    requirement_status ENUM(
        'Pending',
        'Submitted',
        'Verified',
        'Rejected',
        'Waived'
    ) NOT NULL DEFAULT 'Pending',
    payment_reference_id BIGINT UNSIGNED NULL,
    membership_application_document_id BIGINT UNSIGNED NULL,
    completion_date DATE NULL,
    verified_by BIGINT UNSIGNED NULL,
    verified_at DATETIME NULL,
    remarks TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_membership_requirement_application FOREIGN KEY (membership_application_id) REFERENCES membership_applications (membership_application_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_membership_requirement_payment FOREIGN KEY (payment_reference_id) REFERENCES payment_references (payment_reference_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_membership_requirement_document FOREIGN KEY (
        membership_application_document_id
    ) REFERENCES membership_application_documents (
        membership_application_document_id
    ) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_membership_requirement_verifier FOREIGN KEY (verified_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE share_capital_payments (
    share_payment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    payment_reference_id BIGINT UNSIGNED NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_status ENUM(
        'Pending',
        'Validated',
        'Rejected',
        'Reversed'
    ) NOT NULL DEFAULT 'Pending',
    verified_by BIGINT UNSIGNED NULL,
    verified_at DATETIME NULL,
    reversal_of_payment_id BIGINT UNSIGNED NULL,
    remarks TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_share_payment_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_share_payment_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references (payment_reference_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_share_payment_verifier FOREIGN KEY (verified_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_share_payment_reversal FOREIGN KEY (reversal_of_payment_id) REFERENCES share_capital_payments (share_payment_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_share_payment_member_status` ON `share_capital_payments` (
    member_id,
    payment_status,
    payment_date
);

CREATE INDEX `idx_share_payment_reference` ON `share_capital_payments` (payment_reference_id);
-- ============================================================================
-- 4. FINANCIAL MANAGEMENT AND ANALYTICS
-- ============================================================================

CREATE TABLE financial_categories (
    financial_category_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_code VARCHAR(60) NOT NULL,
    category_name VARCHAR(120) NOT NULL,
    category_type ENUM('Income', 'Expense', 'Both') NOT NULL,
    description TEXT NULL,
    is_system_category TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_financial_category_code UNIQUE (category_code),
    CONSTRAINT uq_financial_category_name_type UNIQUE (category_name, category_type),
    CONSTRAINT fk_financial_category_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE financial_records (
    financial_record_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    record_number VARCHAR(60) NOT NULL,
    payment_reference_id BIGINT UNSIGNED NULL,
    member_id BIGINT UNSIGNED NULL,
    financial_category_id SMALLINT UNSIGNED NOT NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    approved_by BIGINT UNSIGNED NULL,
    record_type ENUM(
        'Income',
        'Expense',
        'Adjustment'
    ) NOT NULL,
    source_module ENUM(
        'Manual',
        'Membership',
        'Payment',
        'Share Capital',
        'Rental',
        'POS',
        'Document',
        'Other'
    ) NOT NULL DEFAULT 'Manual',
    source_record_id BIGINT UNSIGNED NULL,
    amount DECIMAL(12, 2) NOT NULL,
    record_date DATE NOT NULL,
    record_status ENUM(
        'Active',
        'Corrected',
        'Reversed',
        'Voided'
    ) NOT NULL DEFAULT 'Active',
    correction_of_record_id BIGINT UNSIGNED NULL,
    reversal_of_record_id BIGINT UNSIGNED NULL,
    remarks TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_financial_record_number UNIQUE (record_number),
    CONSTRAINT fk_financial_payment_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references (payment_reference_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_financial_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_financial_category FOREIGN KEY (financial_category_id) REFERENCES financial_categories (financial_category_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_financial_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_financial_approved_by FOREIGN KEY (approved_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_financial_correction FOREIGN KEY (correction_of_record_id) REFERENCES financial_records (financial_record_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_financial_reversal FOREIGN KEY (reversal_of_record_id) REFERENCES financial_records (financial_record_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_financial_record_date_type` ON `financial_records` (
    record_date,
    record_type,
    record_status
);

CREATE INDEX `idx_financial_category_date` ON `financial_records` (
    financial_category_id,
    record_date
);

CREATE INDEX `idx_financial_source` ON `financial_records` (
    source_module,
    source_record_id
);

CREATE INDEX `idx_financial_member` ON `financial_records` (member_id, record_date);
-- ============================================================================
-- 5. POS, PRODUCTS, INVENTORY, PREORDERS, AND BULK ORDERS
-- ============================================================================

CREATE TABLE products (
    product_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(80) NOT NULL,
    product_name VARCHAR(190) NOT NULL,
    category VARCHAR(120) NULL,
    description TEXT NULL,
    unit VARCHAR(40) NOT NULL DEFAULT 'piece',
    selling_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cost_price DECIMAL(12, 2) NULL,
    track_inventory TINYINT(1) NOT NULL DEFAULT 1,
    reorder_level DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    product_status ENUM(
        'Draft',
        'Active',
        'Out of Stock',
        'Inactive',
        'Archived'
    ) NOT NULL DEFAULT 'Draft',
    image_path VARCHAR(500) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_products_sku UNIQUE (sku),
    CONSTRAINT fk_products_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_products_name_status` ON `products` (product_name, product_status);

CREATE INDEX `idx_products_category` ON `products` (category, product_status);

CREATE TABLE pos_sales (
    pos_sale_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sale_number VARCHAR(60) NOT NULL,
    member_id BIGINT UNSIGNED NULL,
    customer_name VARCHAR(190) NULL,
    customer_contact VARCHAR(40) NULL,
    sale_type ENUM(
        'Walk-in',
        'Member Sale',
        'Preorder',
        'Bulk Order'
    ) NOT NULL DEFAULT 'Walk-in',
    sale_status ENUM(
        'Draft',
        'Held',
        'Pending Payment',
        'Paid',
        'Completed',
        'Cancelled',
        'Refunded'
    ) NOT NULL DEFAULT 'Draft',
    payment_status ENUM(
        'Unpaid',
        'Partially Paid',
        'Paid',
        'Refunded'
    ) NOT NULL DEFAULT 'Unpaid',
    payment_reference_id BIGINT UNSIGNED NULL,
    subtotal_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    change_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    requested_fulfillment_date DATE NULL,
    fulfilled_at DATETIME NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    notes TEXT NULL,
    sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_pos_sales_number UNIQUE (sale_number),
    CONSTRAINT fk_pos_sales_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pos_sales_payment_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references (payment_reference_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pos_sales_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_pos_sales_date_status` ON `pos_sales` (
    sale_date,
    sale_status,
    payment_status
);

CREATE INDEX `idx_pos_sales_member` ON `pos_sales` (member_id, sale_date);

CREATE INDEX `idx_pos_sales_type` ON `pos_sales` (sale_type, sale_status);

CREATE TABLE pos_sale_items (
    pos_sale_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pos_sale_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    product_name_snapshot VARCHAR(190) NOT NULL,
    sku_snapshot VARCHAR(80) NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(12, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pos_sale_items_sale FOREIGN KEY (pos_sale_id) REFERENCES pos_sales (pos_sale_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pos_sale_items_product FOREIGN KEY (product_id) REFERENCES products (product_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_pos_sale_items_sale` ON `pos_sale_items` (pos_sale_id);

CREATE INDEX `idx_pos_sale_items_product` ON `pos_sale_items` (product_id);

CREATE TABLE inventory_movements (
    inventory_movement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    movement_type ENUM(
        'Opening Stock',
        'Stock In',
        'Sale',
        'Return In',
        'Return Out',
        'Adjustment',
        'Damage',
        'Expired',
        'Transfer'
    ) NOT NULL,
    quantity_change DECIMAL(12, 3) NOT NULL,
    unit_cost DECIMAL(12, 2) NULL,
    pos_sale_id BIGINT UNSIGNED NULL,
    pos_sale_item_id BIGINT UNSIGNED NULL,
    reference_number VARCHAR(100) NULL,
    remarks TEXT NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products (product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_pos_sale FOREIGN KEY (pos_sale_id) REFERENCES pos_sales (pos_sale_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_inventory_pos_sale_item FOREIGN KEY (pos_sale_item_id) REFERENCES pos_sale_items (pos_sale_item_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_inventory_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_inventory_product_date` ON `inventory_movements` (product_id, movement_date);

CREATE INDEX `idx_inventory_sale` ON `inventory_movements` (pos_sale_id, pos_sale_item_id);
-- ============================================================================
-- 6. RENTAL MANAGEMENT
-- ============================================================================

CREATE TABLE rental_assets (
    rental_asset_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_code VARCHAR(80) NOT NULL,
    asset_name VARCHAR(190) NOT NULL,
    asset_type ENUM(
        'Equipment',
        'Service',
        'Facility',
        'Other'
    ) NOT NULL DEFAULT 'Equipment',
    category VARCHAR(120) NULL,
    description TEXT NULL,
    rate_amount DECIMAL(12, 2) NULL,
    rate_unit ENUM(
        'Per Hour',
        'Per Day',
        'Per Use',
        'Per Unit',
        'Custom'
    ) NOT NULL DEFAULT 'Custom',
    deposit_amount DECIMAL(12, 2) NULL,
    asset_status ENUM(
        'Available',
        'Reserved',
        'In Use',
        'Maintenance',
        'Unavailable',
        'Archived'
    ) NOT NULL DEFAULT 'Available',
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    terms_document_path VARCHAR(500) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_rental_asset_code UNIQUE (asset_code),
    CONSTRAINT fk_rental_assets_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_rental_assets_name_status` ON `rental_assets` (asset_name, asset_status);

CREATE INDEX `idx_rental_assets_category` ON `rental_assets` (category, asset_status);

CREATE TABLE rental_bookings (
    rental_booking_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_number VARCHAR(60) NOT NULL,
    rental_asset_id BIGINT UNSIGNED NOT NULL,
    member_id BIGINT UNSIGNED NULL,
    requester_name VARCHAR(190) NULL,
    requester_contact VARCHAR(80) NULL,
    purpose TEXT NULL,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    booking_status ENUM(
        'Inquiry',
        'Pending',
        'Approved',
        'Scheduled',
        'In Use',
        'Completed',
        'Rescheduled',
        'Cancelled',
        'Rejected'
    ) NOT NULL DEFAULT 'Inquiry',
    rate_amount DECIMAL(12, 2) NULL,
    deposit_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    additional_charges DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_status ENUM(
        'Unpaid',
        'Partially Paid',
        'Paid',
        'Refunded'
    ) NOT NULL DEFAULT 'Unpaid',
    payment_reference_id BIGINT UNSIGNED NULL,
    approved_by BIGINT UNSIGNED NULL,
    approved_at DATETIME NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    completed_at DATETIME NULL,
    cancellation_reason TEXT NULL,
    completion_notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_rental_booking_number UNIQUE (booking_number),
    CONSTRAINT fk_rental_booking_asset FOREIGN KEY (rental_asset_id) REFERENCES rental_assets (rental_asset_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rental_booking_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_booking_payment_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references (payment_reference_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_booking_approved_by FOREIGN KEY (approved_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_booking_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_rental_bookings_asset_schedule` ON `rental_bookings` (
    rental_asset_id,
    start_datetime,
    end_datetime,
    booking_status
);

CREATE INDEX `idx_rental_bookings_member` ON `rental_bookings` (member_id, created_at);

CREATE INDEX `idx_rental_bookings_status` ON `rental_bookings` (
    booking_status,
    payment_status,
    start_datetime
);

CREATE TABLE rental_status_history (
    rental_status_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rental_booking_id BIGINT UNSIGNED NOT NULL,
    old_status ENUM(
        'Inquiry',
        'Pending',
        'Approved',
        'Scheduled',
        'In Use',
        'Completed',
        'Rescheduled',
        'Cancelled',
        'Rejected'
    ) NULL,
    new_status ENUM(
        'Inquiry',
        'Pending',
        'Approved',
        'Scheduled',
        'In Use',
        'Completed',
        'Rescheduled',
        'Cancelled',
        'Rejected'
    ) NOT NULL,
    remarks TEXT NULL,
    changed_by BIGINT UNSIGNED NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rental_status_booking FOREIGN KEY (rental_booking_id) REFERENCES rental_bookings (rental_booking_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_rental_status_user FOREIGN KEY (changed_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_rental_status_history_booking` ON `rental_status_history` (rental_booking_id, changed_at);
-- Baseline combined operational table retained for manuscript/ERD alignment.
CREATE TABLE rental_pos_records (
    rental_pos_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NULL,
    payment_reference_id BIGINT UNSIGNED NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    pos_sale_id BIGINT UNSIGNED NULL,
    rental_booking_id BIGINT UNSIGNED NULL,
    transaction_type ENUM(
        'Rental',
        'POS Sale',
        'Preorder',
        'Bulk Order',
        'Other'
    ) NOT NULL,
    item_name VARCHAR(190) NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL DEFAULT 1.000,
    total_amount DECIMAL(12, 2) NOT NULL,
    transaction_status VARCHAR(80) NOT NULL,
    transaction_date DATE NOT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rental_pos_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_pos_payment_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references (payment_reference_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_pos_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rental_pos_sale FOREIGN KEY (pos_sale_id) REFERENCES pos_sales (pos_sale_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_pos_booking FOREIGN KEY (rental_booking_id) REFERENCES rental_bookings (rental_booking_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_rental_pos_date_type` ON `rental_pos_records` (
    transaction_date,
    transaction_type
);

CREATE INDEX `idx_rental_pos_member` ON `rental_pos_records` (member_id, transaction_date);
-- ============================================================================
-- 7. DOCUMENTS, REPORTS, AND PRINTABLE OUTPUTS
-- ============================================================================

CREATE TABLE documents (
    document_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uploaded_by BIGINT UNSIGNED NOT NULL,
    member_id BIGINT UNSIGNED NULL,
    title VARCHAR(255) NOT NULL,
    document_type ENUM(
        'Receipt',
        'Certificate',
        'Waiver',
        'Financial Document',
        'Annual Plan',
        'Business Plan',
        'Agency Report',
        'Public Document',
        'Other'
    ) NOT NULL,
    access_level ENUM(
        'Public',
        'Member-only',
        'Admin-only',
        'Bookkeeper-only'
    ) NOT NULL,
    document_status ENUM(
        'Active',
        'Archived',
        'Replaced',
        'Restricted'
    ) NOT NULL DEFAULT 'Active',
    file_path VARCHAR(500) NOT NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(120) NULL,
    file_size_bytes BIGINT UNSIGNED NULL,
    checksum_sha256 CHAR(64) NULL,
    replacement_of_document_id BIGINT UNSIGNED NULL,
    description TEXT NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_documents_uploader FOREIGN KEY (uploaded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_documents_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_documents_replacement FOREIGN KEY (replacement_of_document_id) REFERENCES documents (document_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_documents_access_type` ON `documents` (
    access_level,
    document_type,
    document_status
);

CREATE INDEX `idx_documents_member` ON `documents` (member_id, uploaded_at);

CREATE INDEX `idx_documents_title` ON `documents` (title);

CREATE TABLE document_access_logs (
    document_access_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    access_action ENUM(
        'View',
        'Download',
        'Print',
        'Replace',
        'Permission Change'
    ) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_document_access_document FOREIGN KEY (document_id) REFERENCES documents (document_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_document_access_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_document_access_document` ON `document_access_logs` (document_id, accessed_at);

CREATE INDEX `idx_document_access_user` ON `document_access_logs` (user_id, accessed_at);

CREATE TABLE reports (
    report_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    report_number VARCHAR(60) NOT NULL,
    generated_by BIGINT UNSIGNED NOT NULL,
    document_id BIGINT UNSIGNED NULL,
    report_type ENUM(
        'Financial Summary',
        'Transaction Ledger',
        'Share Capital Summary',
        'Payment Validation',
        'Rental',
        'POS Sales',
        'Inventory Movement',
        'Member Master List',
        'Member Engagement',
        'Barangay Distribution',
        'Documents',
        'Announcements',
        'Requests/Inquiries',
        'Audit Logs',
        'Other'
    ) NOT NULL,
    report_period_start DATE NULL,
    report_period_end DATE NULL,
    report_period_label VARCHAR(120) NULL,
    filters_json JSON NULL,
    generation_status ENUM(
        'Queued',
        'Generated',
        'Failed',
        'Archived'
    ) NOT NULL DEFAULT 'Generated',
    file_path VARCHAR(500) NULL,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reports_number UNIQUE (report_number),
    CONSTRAINT fk_reports_generator FOREIGN KEY (generated_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_reports_document FOREIGN KEY (document_id) REFERENCES documents (document_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_reports_type_date` ON `reports` (report_type, generated_at);

CREATE INDEX `idx_reports_period` ON `reports` (
    report_period_start,
    report_period_end
);
-- ============================================================================
-- 8. ANNOUNCEMENTS AND TARGETED MESSAGES
-- ============================================================================

CREATE TABLE announcements (
    announcement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    posted_by BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NULL,
    message LONGTEXT NOT NULL,
    excerpt VARCHAR(500) NULL,
    audience_type ENUM(
        'Public',
        'All Members',
        'Associate Members',
        'True Members',
        'Role',
        'Barangay',
        'Selected Users'
    ) NOT NULL DEFAULT 'Public',
    audience_value VARCHAR(190) NULL,
    announcement_status ENUM(
        'Draft',
        'Scheduled',
        'Published',
        'Archived',
        'Cancelled'
    ) NOT NULL DEFAULT 'Draft',
    featured_image_path VARCHAR(500) NULL,
    publish_at DATETIME NULL,
    expires_at DATETIME NULL,
    posted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_announcements_slug UNIQUE (slug),
    CONSTRAINT fk_announcements_poster FOREIGN KEY (posted_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_announcements_publication` ON `announcements` (
    announcement_status,
    audience_type,
    publish_at
);

CREATE INDEX `idx_announcements_title` ON `announcements` (title);

CREATE TABLE announcement_recipients (
    announcement_recipient_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    announcement_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    delivery_status ENUM(
        'Pending',
        'Delivered',
        'Failed'
    ) NOT NULL DEFAULT 'Pending',
    delivered_at DATETIME NULL,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_announcement_recipient UNIQUE (announcement_id, user_id),
    CONSTRAINT fk_announcement_recipient_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (announcement_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_announcement_recipient_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE INDEX `idx_announcement_recipients_user` ON `announcement_recipients` (user_id, read_at);

CREATE TABLE `announcement_acknowledgments` (
    `announcement_id` bigint(20) unsigned NOT NULL,
    `user_id` bigint(20) unsigned NOT NULL,
    `acknowledged_at` datetime NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`announcement_id`, `user_id`),
    KEY `fk_ack_user` (`user_id`),
    CONSTRAINT `fk_ack_announcement` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`announcement_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ack_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
-- ============================================================================
-- 9. REQUESTS, MEMBER REQUESTS, AND PUBLIC INQUIRIES
-- ============================================================================

CREATE TABLE requests_inquiries (
    request_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference_code VARCHAR(60) NOT NULL,
    member_id BIGINT UNSIGNED NULL,
    submitted_by BIGINT UNSIGNED NULL,
    announcement_id BIGINT UNSIGNED NULL,
    related_document_id BIGINT UNSIGNED NULL,
    related_rental_booking_id BIGINT UNSIGNED NULL,
    related_pos_sale_id BIGINT UNSIGNED NULL,
    request_source ENUM(
        'Member Portal',
        'Public Website',
        'Admin Entry'
    ) NOT NULL,
    requester_name VARCHAR(190) NULL,
    requester_email VARCHAR(190) NULL,
    requester_phone VARCHAR(40) NULL,
    requester_barangay VARCHAR(120) NULL,
    preferred_contact_method ENUM(
        'Email',
        'Phone',
        'SMS',
        'Other'
    ) NULL,
    request_type ENUM(
        'Membership',
        'Payment',
        'Share Capital',
        'Rental',
        'Product/POS',
        'Document',
        'General'
    ) NOT NULL,
    requested_service VARCHAR(190) NULL,
    preferred_schedule DATETIME NULL,
    subject VARCHAR(255) NULL,
    message TEXT NOT NULL,
    priority ENUM(
        'Low',
        'Normal',
        'High',
        'Urgent'
    ) NOT NULL DEFAULT 'Normal',
    request_status ENUM(
        'Submitted',
        'Under Review',
        'Assigned',
        'In Progress',
        'Waiting for Information',
        'Resolved',
        'Closed',
        'Rejected',
        'Cancelled'
    ) NOT NULL DEFAULT 'Submitted',
    assigned_to BIGINT UNSIGNED NULL,
    admin_notes TEXT NULL,
    public_response TEXT NULL,
    consent_at DATETIME NULL,
    resolved_at DATETIME NULL,
    closed_at DATETIME NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_requests_reference_code UNIQUE (reference_code),
    CONSTRAINT fk_requests_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_submitter FOREIGN KEY (submitted_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (announcement_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_document FOREIGN KEY (related_document_id) REFERENCES documents (document_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_rental FOREIGN KEY (related_rental_booking_id) REFERENCES rental_bookings (rental_booking_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_pos FOREIGN KEY (related_pos_sale_id) REFERENCES pos_sales (pos_sale_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_assigned_to FOREIGN KEY (assigned_to) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_requests_status_priority` ON `requests_inquiries` (
    request_status,
    priority,
    submitted_at
);

CREATE INDEX `idx_requests_member` ON `requests_inquiries` (member_id, submitted_at);

CREATE INDEX `idx_requests_assigned` ON `requests_inquiries` (assigned_to, request_status);

CREATE INDEX `idx_requests_type` ON `requests_inquiries` (request_type, request_status);

CREATE TABLE request_status_history (
    request_status_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT UNSIGNED NOT NULL,
    old_status ENUM(
        'Submitted',
        'Under Review',
        'Assigned',
        'In Progress',
        'Waiting for Information',
        'Resolved',
        'Closed',
        'Rejected',
        'Cancelled'
    ) NULL,
    new_status ENUM(
        'Submitted',
        'Under Review',
        'Assigned',
        'In Progress',
        'Waiting for Information',
        'Resolved',
        'Closed',
        'Rejected',
        'Cancelled'
    ) NOT NULL,
    internal_note TEXT NULL,
    user_visible_message TEXT NULL,
    changed_by BIGINT UNSIGNED NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_request_status_request FOREIGN KEY (request_id) REFERENCES requests_inquiries (request_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_request_status_user FOREIGN KEY (changed_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_request_status_history_request` ON `request_status_history` (request_id, changed_at);
-- ============================================================================
-- 10. MEMBER ANALYTICS AND DECISION SUPPORT
-- ============================================================================

CREATE TABLE member_status_indicators (
    indicator_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    basis_period_start DATE NULL,
    basis_period_end DATE NULL,
    recency_score SMALLINT UNSIGNED NOT NULL,
    frequency_score SMALLINT UNSIGNED NOT NULL,
    contribution_score SMALLINT UNSIGNED NOT NULL,
    total_score SMALLINT UNSIGNED NOT NULL,
    status_label ENUM(
        'Active',
        'Needs Monitoring',
        'Inactive'
    ) NOT NULL,
    basis_summary TEXT NULL,
    computed_by BIGINT UNSIGNED NULL,
    computed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_member_indicator_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_member_indicator_computed_by FOREIGN KEY (computed_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_member_indicator_latest` ON `member_status_indicators` (member_id, computed_at);

CREATE INDEX `idx_member_indicator_status` ON `member_status_indicators` (status_label, computed_at);

CREATE TABLE notifications (
    notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    notification_type ENUM(
        'Announcement',
        'Payment',
        'Share Capital',
        'Rental',
        'POS',
        'Document',
        'Request',
        'System'
    ) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_entity_type VARCHAR(80) NULL,
    related_entity_id BIGINT UNSIGNED NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE INDEX `idx_notifications_user_read` ON `notifications` (user_id, is_read, created_at);
-- ============================================================================
-- 11. PUBLIC LANDING WEBSITE CONTENT
-- ============================================================================

CREATE TABLE site_content_blocks (
    site_content_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    page_slug VARCHAR(120) NOT NULL,
    section_key VARCHAR(120) NOT NULL,
    content_type ENUM(
        'Hero',
        'Heading',
        'Rich Text',
        'Statistic',
        'Call to Action',
        'Contact Information',
        'Other'
    ) NOT NULL,
    title VARCHAR(255) NULL,
    body LONGTEXT NULL,
    value_text VARCHAR(255) NULL,
    link_label VARCHAR(120) NULL,
    link_url VARCHAR(500) NULL,
    media_path VARCHAR(500) NULL,
    display_order INT NOT NULL DEFAULT 0,
    content_status ENUM(
        'Draft',
        'Published',
        'Archived'
    ) NOT NULL DEFAULT 'Draft',
    updated_by BIGINT UNSIGNED NOT NULL,
    published_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_site_content_section UNIQUE (
        page_slug,
        section_key,
        display_order
    ),
    CONSTRAINT fk_site_content_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_site_content_page_status` ON `site_content_blocks` (
    page_slug,
    content_status,
    display_order
);

CREATE TABLE services (
    service_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_code VARCHAR(80) NOT NULL,
    service_type ENUM(
        'Membership',
        'Rental',
        'Product/POS',
        'Program',
        'Document',
        'Other'
    ) NOT NULL,
    title VARCHAR(190) NOT NULL,
    short_description VARCHAR(500) NULL,
    full_description LONGTEXT NULL,
    requirements_text LONGTEXT NULL,
    image_path VARCHAR(500) NULL,
    cta_label VARCHAR(120) NULL,
    cta_url VARCHAR(500) NULL,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    service_status ENUM(
        'Draft',
        'Active',
        'Inactive',
        'Archived'
    ) NOT NULL DEFAULT 'Draft',
    display_order INT NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_services_code UNIQUE (service_code),
    CONSTRAINT fk_services_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_services_public` ON `services` (
    service_status,
    public_visibility,
    display_order
);

CREATE TABLE programs_projects (
    program_project_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(120) NULL,
    summary VARCHAR(700) NULL,
    description LONGTEXT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    location VARCHAR(255) NULL,
    image_path VARCHAR(500) NULL,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    status ENUM(
        'Draft',
        'Upcoming',
        'Ongoing',
        'Completed',
        'Archived'
    ) NOT NULL DEFAULT 'Draft',
    display_order INT NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_programs_projects_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_programs_projects_status` ON `programs_projects` (
    status,
    public_visibility,
    display_order
);

CREATE TABLE partners_certifications (
    partner_certification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    record_type ENUM(
        'Partner',
        'Certification',
        'Accreditation',
        'Recognition'
    ) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    logo_path VARCHAR(500) NULL,
    external_url VARCHAR(500) NULL,
    issued_date DATE NULL,
    expiration_date DATE NULL,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    status ENUM(
        'Draft',
        'Active',
        'Expired',
        'Archived'
    ) NOT NULL DEFAULT 'Draft',
    display_order INT NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_partners_certifications_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_partners_certifications_status` ON `partners_certifications` (
    record_type,
    status,
    public_visibility,
    display_order
);

CREATE TABLE gallery_items (
    gallery_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    caption TEXT NULL,
    category VARCHAR(120) NULL,
    image_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500) NULL,
    activity_date DATE NULL,
    location VARCHAR(255) NULL,
    alt_text VARCHAR(255) NULL,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    gallery_status ENUM(
        'Draft',
        'Published',
        'Archived'
    ) NOT NULL DEFAULT 'Draft',
    display_order INT NOT NULL DEFAULT 0,
    uploaded_by BIGINT UNSIGNED NOT NULL,
    published_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_gallery_items_uploader FOREIGN KEY (uploaded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE INDEX `idx_gallery_public` ON `gallery_items` (
    gallery_status,
    public_visibility,
    activity_date,
    display_order
);
-- ============================================================================
-- 12. CONFIGURATION AND AUDIT
-- ============================================================================

CREATE TABLE system_settings (
    system_setting_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_group VARCHAR(100) NOT NULL,
    setting_key VARCHAR(160) NOT NULL,
    setting_value LONGTEXT NULL,
    value_type ENUM(
        'String',
        'Number',
        'Boolean',
        'Date',
        'JSON'
    ) NOT NULL DEFAULT 'String',
    description TEXT NULL,
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    effective_date DATE NULL,
    updated_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_system_settings_key UNIQUE (setting_key),
    CONSTRAINT fk_system_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_system_settings_group` ON `system_settings` (setting_group, setting_key);

CREATE TABLE audit_logs (
    audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    entity_table VARCHAR(100) NOT NULL,
    record_id BIGINT UNSIGNED NULL,
    description TEXT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    action_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX `idx_audit_logs_user_time` ON `audit_logs` (user_id, action_time);

CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (
    entity_table,
    record_id,
    action_time
);

CREATE INDEX `idx_audit_logs_action` ON `audit_logs` (action, action_time);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 13. SEED DATA
-- ============================================================================

INSERT INTO
    roles (
        role_name,
        role_slug,
        description,
        is_active
    )
VALUES (
        'Chairman/Admin',
        'chairman_admin',
        'Administrative, monitoring, configuration, approval, reporting, and audit access.',
        1
    ),
    (
        'Bookkeeper',
        'bookkeeper',
        'Financial recording, payment validation, share capital, rental/POS, receipts, and financial reports.',
        1
    ),
    (
        'Member',
        'member',
        'Member self-service access to own profile, payments, share capital, documents, announcements, and requests.',
        1
    )
ON DUPLICATE KEY UPDATE
    role_name = VALUES(role_name),
    description = VALUES(description),
    is_active = VALUES(is_active);

INSERT INTO
    financial_categories (
        category_code,
        category_name,
        category_type,
        description,
        is_system_category,
        is_active
    )
VALUES (
        'MEMBERSHIP_FEE',
        'Membership Fees',
        'Income',
        'Associate membership and other approved membership fees.',
        1,
        1
    ),
    (
        'RENTAL_INCOME',
        'Rental Income',
        'Income',
        'Income from equipment, service, or facility rental.',
        1,
        1
    ),
    (
        'POS_SALES',
        'POS and Product Sales',
        'Income',
        'Income from product and POS transactions.',
        1,
        1
    ),
    (
        'PROGRAM_INCOME',
        'Program or Project Income',
        'Income',
        'Income from cooperative programs and approved projects.',
        1,
        1
    ),
    (
        'DONATIONS_GRANTS',
        'Donations and Grants',
        'Income',
        'Approved donations, grants, and assistance.',
        1,
        1
    ),
    (
        'OTHER_INCOME',
        'Other Income',
        'Income',
        'Other approved cooperative income.',
        1,
        1
    ),
    (
        'PRODUCT_COST',
        'Product Cost',
        'Expense',
        'Cost related to products sold through POS.',
        1,
        1
    ),
    (
        'FUEL_GASOLINE',
        'Fuel and Gasoline',
        'Expense',
        'Fuel or gasoline expense subject to approved rental rules.',
        1,
        1
    ),
    (
        'REPAIR_MAINTENANCE',
        'Repair and Maintenance',
        'Expense',
        'Repair and maintenance of equipment or facilities.',
        1,
        1
    ),
    (
        'OFFICE_SUPPLIES',
        'Office Supplies',
        'Expense',
        'Office and administrative supplies.',
        1,
        1
    ),
    (
        'UTILITIES',
        'Utilities',
        'Expense',
        'Electricity, water, internet, and other utility costs.',
        1,
        1
    ),
    (
        'TRANSPORTATION',
        'Transportation',
        'Expense',
        'Approved transportation-related costs.',
        1,
        1
    ),
    (
        'OTHER_EXPENSE',
        'Other Expense',
        'Expense',
        'Other approved cooperative expenses.',
        1,
        1
    )
ON DUPLICATE KEY UPDATE
    category_name = VALUES(category_name),
    category_type = VALUES(category_type),
    description = VALUES(description),
    is_active = VALUES(is_active);

INSERT INTO
    system_settings (
        setting_group,
        setting_key,
        setting_value,
        value_type,
        description,
        is_public,
        effective_date
    )
VALUES (
        'Business Rules',
        'business.associate_membership_fee',
        '200.00',
        'Number',
        'Confirmed associate membership fee in Philippine pesos.',
        0,
        CURRENT_DATE
    ),
    (
        'Business Rules',
        'business.true_member_share_capital_required',
        '3000.00',
        'Number',
        'Confirmed share capital required for true membership.',
        0,
        CURRENT_DATE
    ),
    (
        'Business Rules',
        'business.initial_share_capital_payment',
        '1500.00',
        'Number',
        'Confirmed initial share capital payment amount.',
        0,
        CURRENT_DATE
    ),
    (
        'Business Rules',
        'business.share_capital_completion_months',
        '12',
        'Number',
        'Confirmed completion period in months.',
        0,
        CURRENT_DATE
    ),
    (
        'Business Rules',
        'business.maximum_share_capital',
        '15000.00',
        'Number',
        'Confirmed maximum share capital per member.',
        0,
        CURRENT_DATE
    ),
    (
        'General',
        'general.currency_code',
        'PHP',
        'String',
        'System currency code.',
        1,
        CURRENT_DATE
    ),
    (
        'General',
        'general.currency_symbol',
        '₱',
        'String',
        'System currency symbol.',
        1,
        CURRENT_DATE
    ),
    (
        'Inventory',
        'inventory.allow_negative_stock',
        'false',
        'Boolean',
        'Prevent negative stock unless formally changed by an authorized administrator.',
        0,
        CURRENT_DATE
    ),
    (
        'Rental',
        'rental.rules_status',
        'Pending NFFAC Validation',
        'String',
        'Rates, discounts, fuel, cancellation, rescheduling, damage, and late-return rules remain configurable.',
        0,
        CURRENT_DATE
    ),
    (
        'POS',
        'pos.rules_status',
        'Pending NFFAC Validation',
        'String',
        'Product approval, inventory deduction, preorder, bulk order, returns, and refund rules remain configurable.',
        0,
        CURRENT_DATE
    ),
    (
        'Analytics',
        'analytics.member_status_labels',
        '["Active","Needs Monitoring","Inactive"]',
        'JSON',
        'Approved descriptive member engagement labels.',
        0,
        CURRENT_DATE
    ),
    (
        'membership',
        'membership.associate_fee',
        '200',
        'Number',
        'Associate membership fee in Philippine pesos.',
        0,
        CURRENT_DATE
    ),
    (
        'membership',
        'membership.initial_share_capital',
        '1500',
        'Number',
        'Initial share-capital payment in Philippine pesos.',
        0,
        CURRENT_DATE
    ),
    (
        'membership',
        'membership.true_member_required_capital',
        '3000',
        'Number',
        'Share-capital target required for true-member approval in Philippine pesos.',
        0,
        CURRENT_DATE
    ),
    (
        'membership',
        'membership.maximum_share_capital',
        '15000',
        'Number',
        'Maximum validated member share capital in Philippine pesos.',
        0,
        CURRENT_DATE
    ),
    (
        'membership',
        'membership.share_capital_deadline_months',
        '12',
        'Number',
        'Number of months allowed to complete the true-member share-capital target.',
        0,
        CURRENT_DATE
    ),
    (
        'membership',
        'membership.orientation_required',
        'true',
        'Boolean',
        'Whether applicant orientation or seminar completion is required before approval.',
        0,
        CURRENT_DATE
    ),
    (
        'membership',
        'membership.activation_token_hours',
        '72',
        'Number',
        'Number of hours a member account activation token remains valid.',
        0,
        CURRENT_DATE
    ),
    (
        'membership',
        'membership.terms_version',
        '2026-07-24',
        'String',
        'Membership terms and consent version used for new applications.',
        0,
        CURRENT_DATE
    ),
    (
        'member_indicators',
        'member_indicators.minimum_quintile_population',
        '5',
        'Number',
        'Minimum member population before indicator scoring uses deterministic quintile ranks.',
        0,
        CURRENT_DATE
    ),
    (
        'member_indicators',
        'member_indicators.fallback_thresholds',
        '{"recencyDays":[{"max":30,"score":5},{"max":90,"score":4},{"max":180,"score":3},{"max":365,"score":2}],"frequencyCount":[{"min":12,"score":5},{"min":6,"score":4},{"min":3,"score":3},{"min":1,"score":2}],"contributionAmount":[{"min":10000,"score":5},{"min":5000,"score":4},{"min":1500,"score":3},{"min":1,"score":2}]}',
        'JSON',
        'Fallback 1-5 indicator thresholds used when the member population is too small for stable quintile ranks.',
        0,
        CURRENT_DATE
    ),
    (
        'member_indicators',
        'member_indicators.label_thresholds',
        '{"activeMin":12,"needsMonitoringMin":7}',
        'JSON',
        'Total-score thresholds for advisory member indicator labels.',
        0,
        CURRENT_DATE
    )
ON DUPLICATE KEY UPDATE
    setting_group = VALUES(setting_group),
    setting_value = VALUES(setting_value),
    value_type = VALUES(value_type),
    description = VALUES(description),
    is_public = VALUES(is_public),
    effective_date = VALUES(effective_date);

-- ============================================================================
-- 14. VIEWS FOR DASHBOARDS, REPORTS, AND DECISION SUPPORT
-- ============================================================================

DROP VIEW IF EXISTS v_member_share_capital_summary;

CREATE VIEW v_member_share_capital_summary AS
SELECT
    m.member_id,
    m.member_code,
    m.full_name,
    m.membership_type,
    m.approval_status,
    m.official_member_status,
    m.share_capital_deadline,
    COALESCE(
        SUM(
            CASE
                WHEN scp.payment_status = 'Validated' THEN scp.amount
                ELSE 0
            END
        ),
        0.00
    ) AS validated_share_capital,
    GREATEST(
        CAST(
            COALESCE(
                (
                    SELECT setting_value
                    FROM system_settings
                    WHERE
                        setting_key = 'business.true_member_share_capital_required'
                    LIMIT 1
                ),
                '3000.00'
            ) AS DECIMAL(12, 2)
        ) - COALESCE(
            SUM(
                CASE
                    WHEN scp.payment_status = 'Validated' THEN scp.amount
                    ELSE 0
                END
            ),
            0.00
        ),
        0.00
    ) AS remaining_for_true_membership,
    CASE
        WHEN COALESCE(
            SUM(
                CASE
                    WHEN scp.payment_status = 'Validated' THEN scp.amount
                    ELSE 0
                END
            ),
            0.00
        ) >= CAST(
            COALESCE(
                (
                    SELECT setting_value
                    FROM system_settings
                    WHERE
                        setting_key = 'business.initial_share_capital_payment'
                    LIMIT 1
                ),
                '1500.00'
            ) AS DECIMAL(12, 2)
        ) THEN 1
        ELSE 0
    END AS initial_payment_met,
    CASE
        WHEN COALESCE(
            SUM(
                CASE
                    WHEN scp.payment_status = 'Validated' THEN scp.amount
                    ELSE 0
                END
            ),
            0.00
        ) >= CAST(
            COALESCE(
                (
                    SELECT setting_value
                    FROM system_settings
                    WHERE
                        setting_key = 'business.true_member_share_capital_required'
                    LIMIT 1
                ),
                '3000.00'
            ) AS DECIMAL(12, 2)
        ) THEN 1
        ELSE 0
    END AS eligible_for_true_membership_review,
    CASE
        WHEN m.share_capital_deadline IS NULL THEN 'No Deadline Set'
        WHEN CURRENT_DATE <= m.share_capital_deadline THEN 'Within Deadline'
        ELSE 'Past Deadline'
    END AS deadline_status
FROM
    member_profiles m
    LEFT JOIN share_capital_payments scp ON scp.member_id = m.member_id
GROUP BY
    m.member_id,
    m.member_code,
    m.full_name,
    m.membership_type,
    m.approval_status,
    m.official_member_status,
    m.share_capital_deadline;

DROP VIEW IF EXISTS v_product_inventory_balance;

CREATE VIEW v_product_inventory_balance AS
SELECT
    p.product_id,
    p.sku,
    p.product_name,
    p.category,
    p.unit,
    p.selling_price,
    p.reorder_level,
    p.product_status,
    COALESCE(
        SUM(im.quantity_change),
        0.000
    ) AS quantity_on_hand,
    CASE
        WHEN p.track_inventory = 0 THEN 'Not Tracked'
        WHEN COALESCE(
            SUM(im.quantity_change),
            0.000
        ) <= 0 THEN 'Out of Stock'
        WHEN COALESCE(
            SUM(im.quantity_change),
            0.000
        ) <= p.reorder_level THEN 'Low Stock'
        ELSE 'In Stock'
    END AS stock_status
FROM
    products p
    LEFT JOIN inventory_movements im ON im.product_id = p.product_id
GROUP BY
    p.product_id,
    p.sku,
    p.product_name,
    p.category,
    p.unit,
    p.selling_price,
    p.reorder_level,
    p.product_status,
    p.track_inventory;

DROP VIEW IF EXISTS v_latest_member_status_indicator;

CREATE VIEW v_latest_member_status_indicator AS
SELECT msi.*
FROM
    member_status_indicators msi
    INNER JOIN (
        SELECT member_id, MAX(computed_at) AS latest_computed_at
        FROM member_status_indicators
        GROUP BY
            member_id
    ) latest ON latest.member_id = msi.member_id
    AND latest.latest_computed_at = msi.computed_at;

DROP VIEW IF EXISTS v_financial_monthly_summary;

CREATE VIEW v_financial_monthly_summary AS
SELECT
    DATE_FORMAT(record_date, '%Y-%m-01') AS month_start,
    SUM(
        CASE
            WHEN record_type = 'Income'
            AND record_status = 'Active' THEN amount
            ELSE 0
        END
    ) AS total_income,
    SUM(
        CASE
            WHEN record_type = 'Expense'
            AND record_status = 'Active' THEN amount
            ELSE 0
        END
    ) AS total_expense,
    SUM(
        CASE
            WHEN record_type = 'Income'
            AND record_status = 'Active' THEN amount
            WHEN record_type = 'Expense'
            AND record_status = 'Active' THEN - amount
            ELSE 0
        END
    ) AS net_movement
FROM financial_records
GROUP BY
    DATE_FORMAT(record_date, '%Y-%m-01');

DROP VIEW IF EXISTS v_barangay_member_distribution;

CREATE VIEW v_barangay_member_distribution AS
SELECT
    COALESCE(
        NULLIF(TRIM(barangay), ''),
        'Unspecified'
    ) AS barangay,
    COUNT(*) AS total_members,
    SUM(
        CASE
            WHEN membership_type = 'Associate' THEN 1
            ELSE 0
        END
    ) AS associate_members,
    SUM(
        CASE
            WHEN membership_type = 'True Member' THEN 1
            ELSE 0
        END
    ) AS true_members,
    SUM(
        CASE
            WHEN official_member_status = 'Active' THEN 1
            ELSE 0
        END
    ) AS active_official_members
FROM member_profiles
WHERE
    approval_status = 'Approved'
GROUP BY
    COALESCE(
        NULLIF(TRIM(barangay), ''),
        'Unspecified'
    );

DROP VIEW IF EXISTS v_dashboard_financial_overview;

CREATE VIEW v_dashboard_financial_overview AS
SELECT
    COALESCE(
        SUM(
            CASE
                WHEN record_type = 'Income'
                AND record_status = 'Active' THEN amount
                ELSE 0
            END
        ),
        0.00
    ) AS total_income,
    COALESCE(
        SUM(
            CASE
                WHEN record_type = 'Expense'
                AND record_status = 'Active' THEN amount
                ELSE 0
            END
        ),
        0.00
    ) AS total_expense,
    COALESCE(
        SUM(
            CASE
                WHEN record_type = 'Income'
                AND record_status = 'Active' THEN amount
                WHEN record_type = 'Expense'
                AND record_status = 'Active' THEN - amount
                ELSE 0
            END
        ),
        0.00
    ) AS available_balance,
    (
        SELECT COALESCE(SUM(amount), 0.00)
        FROM share_capital_payments
        WHERE
            payment_status = 'Validated'
    ) AS total_share_capital,
    (
        SELECT COUNT(*)
        FROM payment_references
        WHERE
            validation_status = 'Pending'
    ) AS pending_payment_references,
    (
        SELECT COUNT(*)
        FROM rental_bookings
        WHERE
            booking_status IN (
                'Inquiry',
                'Pending',
                'Approved',
                'Scheduled',
                'In Use'
            )
    ) AS open_rental_bookings,
    (
        SELECT COUNT(*)
        FROM requests_inquiries
        WHERE
            request_status NOT IN(
                'Resolved',
                'Closed',
                'Rejected',
                'Cancelled'
            )
    ) AS open_requests
FROM financial_records;

-- ============================================================================
-- 15. APPLICATION-LEVEL VALIDATION NOTICE
-- ============================================================================
-- This RDS/phpMyAdmin-compatible edition intentionally creates no triggers or
-- stored routines. Business rules are enforced by the Next.js/Node.js backend
-- before INSERT or UPDATE operations. Foreign keys, unique constraints, NOT NULL
-- columns, ENUM values, and indexes remain enforced by MySQL.

-- ============================================================================
-- 16. OPTIONAL ADMIN ACCOUNT TEMPLATE
-- Application validation requirements:
-- 1. Payment reference: member_id or payer_name must be supplied.
-- 2. Share capital: amount must be positive; validated total per member must not exceed 15000.00.
-- 3. POS item: quantity must be positive; line_total must equal quantity * unit_price - discount.
-- 4. POS totals and inventory movements must be updated in one database transaction.
-- 5. Inventory balance must not become negative unless the setting explicitly allows it.
-- 6. Rental booking: requester/member is required; end_datetime must be after start_datetime.
-- 7. Approved, Scheduled, or In Use rental bookings must not overlap for one asset.
-- 8. Rental/POS summary record must not reference both a POS sale and rental booking.
-- 9. Request/inquiry must have a member, submitting user, or requester_name.
-- 10. Date ranges, numeric amounts, status transitions, and document access must be validated.

-- ============================================================================
-- Do not store or insert a plain-text password. Generate a secure bcrypt/argon2 hash
-- in the application, then insert the first administrator using a statement similar to:
--
-- INSERT INTO users (role_id, email, password_hash, display_name, account_status)
-- SELECT role_id, 'admin@example.com', '<SECURE_PASSWORD_HASH>', 'System Administrator', 'Active'
-- FROM roles WHERE role_slug = 'chairman_admin';
--
-- ============================================================================
-- END OF TRACKCOOP DATABASE
-- ============================================================================
