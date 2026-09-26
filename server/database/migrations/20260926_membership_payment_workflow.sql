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
    MODIFY initial_share_capital_amount DECIMAL(12, 2) NOT NULL DEFAULT 3000.00;

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
   SET setting_value = '3000'
 WHERE setting_key = 'membership.initial_share_capital';

UPDATE system_settings
   SET setting_value = '3000.00'
 WHERE setting_key IN (
    'business.initial_share_capital_payment',
    'initial_share_capital_payment'
 );

COMMIT;
