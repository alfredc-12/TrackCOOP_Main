-- Route both member dividend actions through the Bookkeeper queue.
-- The new state is intentionally additive so existing dividend history remains unchanged.

ALTER TABLE member_dividends
    MODIFY COLUMN dividend_status ENUM(
        'Pending',
        'Available',
        'Withdrawal Requested',
        'Capitalization Requested',
        'Withdrawn',
        'Added to Share Capital',
        'Cancelled',
        'Reversed'
    ) NOT NULL DEFAULT 'Pending';
