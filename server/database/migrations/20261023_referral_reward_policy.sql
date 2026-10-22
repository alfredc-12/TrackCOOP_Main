-- Admin-configurable referral reward policy.
-- Credits are tracking-only until the cooperative separately approves a redemption policy.

INSERT INTO system_settings (
    setting_group,
    setting_key,
    setting_value,
    value_type,
    description,
    is_public,
    effective_date
)
VALUES (
    'Referrals',
    'referrals.reward_policy',
    '{"enabled":true,"creditsPerSuccessfulReferral":1,"label":"Referral credits"}',
    'JSON',
    'Controls the tracking credits shown for successful member referrals. This does not create a cash payout or redemption obligation.',
    0,
    CURRENT_DATE
)
ON DUPLICATE KEY UPDATE
    setting_group = VALUES(setting_group),
    value_type = VALUES(value_type),
    description = VALUES(description),
    is_public = VALUES(is_public);
