CREATE TABLE IF NOT EXISTS membership_applications (
    membership_application_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_code VARCHAR(60) NOT NULL,
    public_tracking_token_hash CHAR(64) NOT NULL,

    application_source ENUM(
        'Public Website',
        'Chairman Entry',
        'Imported Paper Form'
    ) NOT NULL DEFAULT 'Public Website',

    requested_membership_type ENUM(
        'Associate',
        'True Member'
    ) NOT NULL DEFAULT 'Associate',

    full_name VARCHAR(190) NOT NULL,
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
    membership_fee_amount DECIMAL(12,2) NOT NULL DEFAULT 200.00,

    share_subscription_commitment_accepted TINYINT(1) NOT NULL DEFAULT 0,
    subscribed_shares SMALLINT UNSIGNED NULL,
    initial_share_capital_amount DECIMAL(12,2) NOT NULL DEFAULT 1500.00,
    target_share_capital_amount DECIMAL(12,2) NOT NULL DEFAULT 3000.00,
    share_capital_deadline_months SMALLINT UNSIGNED NOT NULL DEFAULT 12,
    annual_interest_rate DECIMAL(5,2) NULL,
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

    CONSTRAINT uq_membership_applications_code
        UNIQUE (application_code),
    CONSTRAINT uq_membership_applications_tracking_hash
        UNIQUE (public_tracking_token_hash),

    CONSTRAINT fk_membership_application_submitter
        FOREIGN KEY (submitted_by_user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT fk_membership_application_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT fk_membership_application_converted_member
        FOREIGN KEY (converted_member_id)
        REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_application_beneficiaries (
    membership_application_beneficiary_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    full_name VARCHAR(190) NOT NULL,
    relationship VARCHAR(100) NULL,
    age_at_application SMALLINT UNSIGNED NULL,
    birth_date DATE NULL,
    display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_membership_beneficiary_application
        FOREIGN KEY (membership_application_id)
        REFERENCES membership_applications(membership_application_id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_application_documents (
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

    CONSTRAINT fk_membership_document_application
        FOREIGN KEY (membership_application_id)
        REFERENCES membership_applications(membership_application_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_membership_document_uploader
        FOREIGN KEY (uploaded_by_user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_application_requirements (
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

    CONSTRAINT fk_membership_requirement_application
        FOREIGN KEY (membership_application_id)
        REFERENCES membership_applications(membership_application_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_membership_requirement_payment
        FOREIGN KEY (payment_reference_id)
        REFERENCES payment_references(payment_reference_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT fk_membership_requirement_document
        FOREIGN KEY (membership_application_document_id)
        REFERENCES membership_application_documents(membership_application_document_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT fk_membership_requirement_verifier
        FOREIGN KEY (verified_by)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_application_status_history (
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

    CONSTRAINT fk_membership_application_history_application
        FOREIGN KEY (membership_application_id)
        REFERENCES membership_applications(membership_application_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_membership_application_history_user
        FOREIGN KEY (changed_by)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_activation_tokens (
    user_activation_token_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_user_activation_token_hash UNIQUE (token_hash),

    CONSTRAINT fk_user_activation_token_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_user_activation_token_creator
        FOREIGN KEY (created_by)
        REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
