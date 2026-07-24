START TRANSACTION;

CREATE TABLE IF NOT EXISTS membership_applications (
    membership_application_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_reference VARCHAR(40) NOT NULL,
    idempotency_key CHAR(36) NOT NULL,
    linked_member_id BIGINT UNSIGNED NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    suffix VARCHAR(30) NULL,
    contact_number VARCHAR(40) NOT NULL,
    contact_number_normalized VARCHAR(30) NOT NULL,
    email VARCHAR(190) NOT NULL,
    preferred_contact_method ENUM('Phone', 'SMS', 'Email') NOT NULL,
    complete_address VARCHAR(500) NOT NULL,
    barangay VARCHAR(120) NOT NULL,
    municipality VARCHAR(120) NOT NULL DEFAULT 'Nasugbu',
    province VARCHAR(120) NOT NULL DEFAULT 'Batangas',
    sector VARCHAR(100) NOT NULL,
    livelihood VARCHAR(190) NOT NULL,
    applicant_classification ENUM('Farmer', 'Fisherfolk', 'Both', 'Other') NOT NULL,
    primary_activity VARCHAR(190) NOT NULL,
    preferred_membership_type ENUM('ASSOCIATE', 'TRUE_MEMBER', 'NOT_SURE') NOT NULL,
    approved_membership_type ENUM('ASSOCIATE', 'TRUE_MEMBER') NULL,
    application_status VARCHAR(40) NOT NULL DEFAULT 'SUBMITTED',
    payment_status VARCHAR(40) NOT NULL DEFAULT 'NOT_SUBMITTED',
    required_payment_type VARCHAR(80) NULL,
    required_payment_amount DECIMAL(12,2) NULL,
    assigned_reviewer_id BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    approved_by BIGINT UNSIGNED NULL,
    approved_at DATETIME NULL,
    rejected_by BIGINT UNSIGNED NULL,
    rejected_at DATETIME NULL,
    public_response TEXT NULL,
    internal_note TEXT NULL,
    possible_duplicate TINYINT(1) NOT NULL DEFAULT 0,
    consent_accepted TINYINT(1) NOT NULL,
    consent_accepted_at DATETIME NOT NULL,
    privacy_notice_version VARCHAR(40) NOT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    account_created_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    archived_at DATETIME NULL,
    CONSTRAINT uq_membership_application_reference UNIQUE (application_reference),
    CONSTRAINT uq_membership_application_idempotency UNIQUE (idempotency_key),
    CONSTRAINT fk_membership_application_member FOREIGN KEY (linked_member_id)
        REFERENCES member_profiles(member_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_membership_application_reviewer FOREIGN KEY (assigned_reviewer_id)
        REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_membership_application_approver FOREIGN KEY (approved_by)
        REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_membership_application_rejector FOREIGN KEY (rejected_by)
        REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_membership_application_status (application_status),
    INDEX idx_membership_application_payment_status (payment_status),
    INDEX idx_membership_application_submitted (submitted_at),
    INDEX idx_membership_application_contact (contact_number_normalized),
    INDEX idx_membership_application_email (email),
    INDEX idx_membership_application_member (linked_member_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_application_documents (
    membership_application_document_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    document_type VARCHAR(80) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    stored_file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size_bytes BIGINT UNSIGNED NOT NULL,
    verification_status ENUM('Pending', 'Verified', 'Rejected') NOT NULL DEFAULT 'Pending',
    reviewer_note TEXT NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_membership_document_application FOREIGN KEY (membership_application_id)
        REFERENCES membership_applications(membership_application_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX idx_membership_document_application (membership_application_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_application_status_history (
    membership_application_status_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    old_status VARCHAR(40) NULL,
    new_status VARCHAR(40) NOT NULL,
    public_message TEXT NULL,
    internal_reason TEXT NULL,
    changed_by BIGINT UNSIGNED NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_membership_history_application FOREIGN KEY (membership_application_id)
        REFERENCES membership_applications(membership_application_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_membership_history_user FOREIGN KEY (changed_by)
        REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_membership_history_application (membership_application_id, changed_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_application_notes (
    membership_application_note_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    note_type ENUM('PUBLIC_RESPONSE', 'INTERNAL_NOTE', 'ADDITIONAL_INFORMATION', 'PAYMENT_NOTE') NOT NULL,
    note_text TEXT NOT NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_membership_note_application FOREIGN KEY (membership_application_id)
        REFERENCES membership_applications(membership_application_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_membership_note_user FOREIGN KEY (created_by)
        REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_membership_note_application (membership_application_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_application_payments (
    membership_application_payment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    payment_reference_id BIGINT UNSIGNED NOT NULL,
    payment_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    receipt_number VARCHAR(60) NULL,
    validated_by BIGINT UNSIGNED NULL,
    validated_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_membership_payment_reference UNIQUE (payment_reference_id),
    CONSTRAINT uq_membership_payment_receipt UNIQUE (receipt_number),
    CONSTRAINT fk_membership_payment_application FOREIGN KEY (membership_application_id)
        REFERENCES membership_applications(membership_application_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_membership_payment_reference FOREIGN KEY (payment_reference_id)
        REFERENCES payment_references(payment_reference_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_membership_payment_validator FOREIGN KEY (validated_by)
        REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_membership_payment_application (membership_application_id),
    INDEX idx_membership_payment_status (payment_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_account_activations (
    membership_account_activation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership_application_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_membership_activation_application UNIQUE (membership_application_id),
    CONSTRAINT uq_membership_activation_user UNIQUE (user_id),
    CONSTRAINT uq_membership_activation_token UNIQUE (token_hash),
    CONSTRAINT fk_membership_activation_application FOREIGN KEY (membership_application_id)
        REFERENCES membership_applications(membership_application_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_membership_activation_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_membership_activation_creator FOREIGN KEY (created_by)
        REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

COMMIT;
