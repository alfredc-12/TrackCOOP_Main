-- Patronage and patronage-refund tracking.
-- Additive migration: existing POS, rental, member, and finance records are preserved.

CREATE TABLE IF NOT EXISTS patronage_periods (
    patronage_period_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    period_name VARCHAR(120) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    refund_pool DECIMAL(14, 2) NOT NULL,
    period_status ENUM('Draft', 'Finalized', 'Paid') NOT NULL DEFAULT 'Draft',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    finalized_by BIGINT UNSIGNED NULL,
    finalized_at DATETIME NULL,
    paid_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_patronage_period_name UNIQUE (period_name),
    CONSTRAINT fk_patronage_period_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_patronage_period_finalizer FOREIGN KEY (finalized_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX idx_patronage_period_dates ON patronage_periods (period_start, period_end, period_status);

CREATE TABLE IF NOT EXISTS patronage_allocations (
    patronage_allocation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patronage_period_id BIGINT UNSIGNED NOT NULL,
    member_id BIGINT UNSIGNED NOT NULL,
    purchase_patronage DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    rental_patronage DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    total_patronage DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    patronage_share_percent DECIMAL(9, 6) NOT NULL DEFAULT 0.000000,
    refund_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('Pending', 'Paid') NOT NULL DEFAULT 'Pending',
    paid_at DATETIME NULL,
    paid_by BIGINT UNSIGNED NULL,
    payment_notes VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_patronage_allocation_member UNIQUE (patronage_period_id, member_id),
    CONSTRAINT fk_patronage_allocation_period FOREIGN KEY (patronage_period_id) REFERENCES patronage_periods (patronage_period_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_patronage_allocation_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_patronage_allocation_payer FOREIGN KEY (paid_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE INDEX idx_patronage_allocation_member ON patronage_allocations (member_id, payment_status);
CREATE INDEX idx_patronage_allocation_period_status ON patronage_allocations (patronage_period_id, payment_status);
