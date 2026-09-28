START TRANSACTION;

ALTER TABLE membership_applications
    MODIFY application_status ENUM(
        'Submitted',
        'Under Review',
        'Needs Information',
        'Payment Required',
        'Payment Confirmed',
        'Approved',
        'Rejected',
        'Withdrawn'
    ) NOT NULL DEFAULT 'Submitted',
    MODIFY initial_share_capital_amount DECIMAL(12, 2) NOT NULL DEFAULT 1500.00,
    MODIFY share_capital_deadline_months SMALLINT UNSIGNED NOT NULL DEFAULT 1;

ALTER TABLE membership_application_status_history
    MODIFY old_status ENUM(
        'Submitted',
        'Under Review',
        'Needs Information',
        'Payment Required',
        'Payment Confirmed',
        'Approved',
        'Rejected',
        'Withdrawn'
    ) NULL,
    MODIFY new_status ENUM(
        'Submitted',
        'Under Review',
        'Needs Information',
        'Payment Required',
        'Payment Confirmed',
        'Approved',
        'Rejected',
        'Withdrawn'
    ) NOT NULL;

UPDATE system_settings
   SET setting_value = '1500'
 WHERE setting_key = 'membership.initial_share_capital';

UPDATE system_settings
   SET setting_value = '1500.00'
 WHERE setting_key IN (
    'business.initial_share_capital_payment',
    'initial_share_capital_payment'
 );

UPDATE system_settings
   SET setting_value = '1'
 WHERE setting_key IN (
    'membership.share_capital_deadline_months',
    'business.share_capital_completion_months',
    'share_capital_completion_months'
 );

COMMIT;
