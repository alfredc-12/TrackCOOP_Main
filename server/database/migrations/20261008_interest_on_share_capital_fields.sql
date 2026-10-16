-- Store the CDA-aligned Interest on Share Capital inputs and monthly-share-month basis.
-- Apply manually after 20261007_share_capital_ledger_and_dividends.sql.

ALTER TABLE dividend_declarations
    ADD COLUMN net_surplus DECIMAL(14, 2) NULL AFTER total_declared_amount,
    ADD COLUMN statutory_reserves DECIMAL(14, 2) NULL AFTER net_surplus,
    ADD COLUMN share_capital_interest_allocation_rate DECIMAL(9, 6) NULL AFTER statutory_reserves,
    ADD COLUMN interest_rate DECIMAL(18, 12) NULL AFTER share_capital_interest_allocation_rate,
    ADD COLUMN total_average_share_month DECIMAL(18, 2) NULL AFTER interest_rate;

ALTER TABLE member_dividends
    ADD COLUMN total_share_months DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER dividend_amount,
    ADD COLUMN average_share_month DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER total_share_months;
