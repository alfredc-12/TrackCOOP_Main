-- Store optional proof attached by the Bookkeeper when completing a dividend withdrawal.
ALTER TABLE member_dividends
    ADD COLUMN withdrawal_receipt MEDIUMTEXT NULL AFTER withdrawal_qr_code,
    ADD COLUMN withdrawal_receipt_name VARCHAR(190) NULL AFTER withdrawal_receipt;
