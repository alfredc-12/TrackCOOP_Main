-- Share Capital ledger, running balances, and member dividend decisions.
-- Additive and idempotent: existing payment and patronage records are preserved.

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

CREATE TABLE IF NOT EXISTS dividend_declarations (
    dividend_declaration_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    declaration_name VARCHAR(160) NOT NULL,
    coverage_start DATE NOT NULL,
    coverage_end DATE NOT NULL,
    declared_at DATETIME NULL,
    available_at DATETIME NULL,
    total_declared_amount DECIMAL(14, 2) NOT NULL,
    calculation_method VARCHAR(80) NOT NULL,
    dividend_rate DECIMAL(9, 6) NULL,
    declaration_status ENUM('Draft', 'Approved', 'Published', 'Cancelled') NOT NULL DEFAULT 'Draft',
    notes VARCHAR(1000) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    approved_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_dividend_declaration_name UNIQUE (declaration_name),
    CONSTRAINT fk_dividend_declaration_creator FOREIGN KEY (created_by)
        REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_dividend_declaration_approver FOREIGN KEY (approved_by)
        REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_dividend_declaration_dates CHECK (coverage_end >= coverage_start),
    CONSTRAINT chk_dividend_declaration_amount CHECK (total_declared_amount >= 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS member_dividends (
    member_dividend_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dividend_declaration_id BIGINT UNSIGNED NOT NULL,
    member_id BIGINT UNSIGNED NOT NULL,
    dividend_amount DECIMAL(14, 2) NOT NULL,
    dividend_status ENUM(
        'Pending',
        'Available',
        'Withdrawal Requested',
        'Withdrawn',
        'Added to Share Capital',
        'Cancelled',
        'Reversed'
    ) NOT NULL DEFAULT 'Pending',
    member_decision ENUM('Withdraw', 'Add to Share Capital') NULL,
    available_at DATETIME NULL,
    decided_at DATETIME NULL,
    processed_at DATETIME NULL,
    processed_by BIGINT UNSIGNED NULL,
    share_capital_transaction_id BIGINT UNSIGNED NULL,
    withdrawal_reference VARCHAR(190) NULL,
    processing_notes VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_dividend_declaration UNIQUE (dividend_declaration_id, member_id),
    KEY idx_member_dividend_member_status (member_id, dividend_status, created_at),
    KEY idx_member_dividend_declaration_status (dividend_declaration_id, dividend_status),
    CONSTRAINT fk_member_dividend_declaration FOREIGN KEY (dividend_declaration_id)
        REFERENCES dividend_declarations (dividend_declaration_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_member_dividend_member FOREIGN KEY (member_id)
        REFERENCES member_profiles (member_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_member_dividend_processor FOREIGN KEY (processed_by)
        REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_member_dividend_capital_transaction FOREIGN KEY (share_capital_transaction_id)
        REFERENCES share_capital_transactions (share_capital_transaction_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_member_dividend_amount CHECK (dividend_amount >= 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS dividend_action_history (
    dividend_action_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_dividend_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(40) NULL,
    new_status VARCHAR(40) NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    remarks VARCHAR(1000) NULL,
    performed_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_dividend_action_history_dividend_created (member_dividend_id, created_at),
    UNIQUE KEY uq_dividend_action_history_status (member_dividend_id, new_status),
    CONSTRAINT fk_dividend_action_member_dividend FOREIGN KEY (member_dividend_id)
        REFERENCES member_dividends (member_dividend_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_dividend_action_performer FOREIGN KEY (performed_by)
        REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

INSERT INTO financial_categories (
    category_code, category_name, category_type, description, is_system_category, is_active
) VALUES (
    'DIVIDEND_PAYMENT', 'Member Dividend Payment', 'Expense',
    'Cash dividends withdrawn by cooperative members.', 1, 1
)
ON DUPLICATE KEY UPDATE
    category_name = VALUES(category_name),
    category_type = VALUES(category_type),
    description = VALUES(description),
    is_active = 1;

-- Backfill one account for each member that already has validated capital.
INSERT INTO share_capital_accounts (member_id)
SELECT DISTINCT member_id
  FROM share_capital_payments
 WHERE payment_status = 'Validated'
ON DUPLICATE KEY UPDATE member_id = VALUES(member_id);

-- Backfill an immutable, chronological ledger. The first validated payment is
-- classified as initial capital, while later payments are additional contributions.
INSERT IGNORE INTO share_capital_transactions (
    share_capital_account_id,
    member_id,
    transaction_date,
    transaction_type,
    direction,
    amount,
    balance_before,
    balance_after,
    reference_number,
    source_type,
    source_id,
    transaction_status,
    remarks,
    created_by,
    created_at,
    updated_at
)
SELECT account.share_capital_account_id,
       ranked.member_id,
       ranked.payment_date,
       CASE WHEN ranked.member_sequence = 1
            THEN 'Initial Share Capital'
            ELSE 'Additional Capital Contribution'
       END,
       'Credit',
       ranked.amount,
       ranked.running_balance - ranked.amount,
       ranked.running_balance,
       COALESCE(ranked.reference_number, CONCAT('SC-PAY-', ranked.share_payment_id)),
       'share_capital_payment',
       CAST(ranked.share_payment_id AS CHAR),
       'Posted',
       ranked.remarks,
       ranked.verified_by,
       ranked.created_at,
       ranked.updated_at
  FROM (
      SELECT payment.share_payment_id,
             payment.member_id,
             payment.amount,
             payment.payment_date,
             payment.remarks,
             payment.verified_by,
             payment.created_at,
             payment.updated_at,
             reference.reference_number,
             ROW_NUMBER() OVER (
                 PARTITION BY payment.member_id
                 ORDER BY payment.created_at, payment.share_payment_id
             ) AS member_sequence,
             SUM(payment.amount) OVER (
                 PARTITION BY payment.member_id
                 ORDER BY payment.created_at, payment.share_payment_id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
             ) AS running_balance
        FROM share_capital_payments payment
        LEFT JOIN payment_references reference
          ON reference.payment_reference_id = payment.payment_reference_id
       WHERE payment.payment_status = 'Validated'
  ) ranked
  JOIN share_capital_accounts account ON account.member_id = ranked.member_id;

UPDATE share_capital_accounts account
JOIN (
    SELECT member_id,
           COALESCE(SUM(CASE WHEN transaction_type = 'Initial Share Capital' AND transaction_status = 'Posted' THEN amount ELSE 0 END), 0) AS initial_capital,
           COALESCE(SUM(CASE WHEN transaction_type = 'Additional Capital Contribution' AND transaction_status = 'Posted' THEN amount ELSE 0 END), 0) AS additional_capital,
           COALESCE(SUM(CASE WHEN transaction_type = 'Dividend Added to Share Capital' AND transaction_status = 'Posted' THEN amount ELSE 0 END), 0) AS dividends_added,
           COALESCE(SUM(CASE WHEN direction = 'Debit' AND transaction_status = 'Posted' THEN amount ELSE 0 END), 0) AS deductions,
           COALESCE(SUM(CASE WHEN transaction_status = 'Posted' THEN IF(direction = 'Credit', amount, -amount) ELSE 0 END), 0) AS current_balance
      FROM share_capital_transactions
     GROUP BY member_id
) totals ON totals.member_id = account.member_id
SET account.initial_capital = totals.initial_capital,
    account.total_additional_contributions = totals.additional_capital,
    account.total_dividends_added = totals.dividends_added,
    account.total_deductions = totals.deductions,
    account.current_balance = totals.current_balance;
