-- Additive: preserve original refund amounts, payouts, and capital history.
CREATE TABLE IF NOT EXISTS patronage_capital_transfers (
    transfer_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patronage_allocation_id BIGINT UNSIGNED NOT NULL,
    member_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    request_key VARCHAR(36) NOT NULL,
    transfer_status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
    requested_by BIGINT UNSIGNED NOT NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_by BIGINT UNSIGNED NULL,
    processed_at DATETIME NULL,
    processing_notes VARCHAR(500) NULL,
    share_capital_transaction_id BIGINT UNSIGNED NULL,
    UNIQUE KEY uq_patronage_capital_request (request_key),
    KEY idx_patronage_capital_allocation (patronage_allocation_id, transfer_status),
    KEY idx_patronage_capital_member (member_id, requested_at),
    CONSTRAINT fk_patronage_capital_allocation FOREIGN KEY (patronage_allocation_id)
        REFERENCES patronage_allocations (patronage_allocation_id) ON DELETE RESTRICT,
    CONSTRAINT fk_patronage_capital_member FOREIGN KEY (member_id)
        REFERENCES member_profiles (member_id) ON DELETE RESTRICT,
    CONSTRAINT fk_patronage_capital_requester FOREIGN KEY (requested_by)
        REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_patronage_capital_processor FOREIGN KEY (processed_by)
        REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_patronage_capital_transaction FOREIGN KEY (share_capital_transaction_id)
        REFERENCES share_capital_transactions (share_capital_transaction_id) ON DELETE RESTRICT,
    CONSTRAINT chk_patronage_capital_amount CHECK (amount > 0)
) ENGINE = InnoDB;
