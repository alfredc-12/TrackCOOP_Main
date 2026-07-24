INSERT INTO system_settings (
    setting_group,
    setting_key,
    setting_value,
    value_type,
    description,
    is_public
) VALUES
    (
        'membership',
        'membership.associate_fee',
        '200',
        'Number',
        'Associate membership fee in Philippine pesos.',
        0
    ),
    (
        'membership',
        'membership.initial_share_capital',
        '1500',
        'Number',
        'Initial share-capital payment in Philippine pesos.',
        0
    ),
    (
        'membership',
        'membership.true_member_required_capital',
        '3000',
        'Number',
        'Share-capital target required for true-member approval in Philippine pesos.',
        0
    ),
    (
        'membership',
        'membership.maximum_share_capital',
        '15000',
        'Number',
        'Maximum validated member share capital in Philippine pesos.',
        0
    ),
    (
        'membership',
        'membership.share_capital_deadline_months',
        '12',
        'Number',
        'Number of months allowed to complete the true-member share-capital target.',
        0
    ),
    (
        'membership',
        'membership.orientation_required',
        'true',
        'Boolean',
        'Whether applicant orientation or seminar completion is required before approval.',
        0
    ),
    (
        'membership',
        'membership.activation_token_hours',
        '72',
        'Number',
        'Number of hours a member account activation token remains valid.',
        0
    ),
    (
        'membership',
        'membership.terms_version',
        '2026-07-24',
        'String',
        'Membership terms and consent version used for new applications.',
        0
    )
ON DUPLICATE KEY UPDATE
    setting_group = VALUES(setting_group),
    setting_value = VALUES(setting_value),
    value_type = VALUES(value_type),
    description = VALUES(description),
    is_public = VALUES(is_public),
    updated_at = CURRENT_TIMESTAMP;
