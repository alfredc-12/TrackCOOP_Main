-- Store the member's selected dividend payout method and protected transfer details.
-- QR images are kept as small data URLs so the Bookkeeper can verify them before payout.

ALTER TABLE member_dividends
    ADD COLUMN withdrawal_method ENUM('Cash', 'Online Transfer') NULL AFTER member_decision,
    ADD COLUMN withdrawal_provider VARCHAR(80) NULL AFTER withdrawal_method,
    ADD COLUMN withdrawal_account_name VARCHAR(190) NULL AFTER withdrawal_provider,
    ADD COLUMN withdrawal_account_number VARCHAR(190) NULL AFTER withdrawal_account_name,
    ADD COLUMN withdrawal_qr_code MEDIUMTEXT NULL AFTER withdrawal_account_number;
