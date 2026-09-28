START TRANSACTION;

ALTER TABLE membership_applications
    MODIFY application_status VARCHAR(40) NOT NULL DEFAULT 'Submitted';

ALTER TABLE membership_application_status_history
    MODIFY old_status VARCHAR(40) NULL,
    MODIFY new_status VARCHAR(40) NOT NULL;

UPDATE membership_application_status_history
   SET old_status = NULLIF(CASE COALESCE(old_status, '')
        WHEN 'SUBMITTED' THEN 'Submitted'
        WHEN 'UNDER_REVIEW' THEN 'Under Review'
        WHEN 'NEEDS_INFORMATION' THEN 'Needs Information'
        WHEN 'APPROVED_PENDING_PAYMENT' THEN 'Payment Required'
        WHEN 'PAYMENT_UNDER_REVIEW' THEN 'Payment Required'
        WHEN 'PAYMENT_REQUIRED' THEN 'Payment Required'
        WHEN 'PAYMENT_CONFIRMED' THEN 'Payment Confirmed'
        WHEN 'APPROVED' THEN 'Approved'
        WHEN 'REJECTED' THEN 'Rejected'
        WHEN 'WITHDRAWN' THEN 'Withdrawn'
        ELSE old_status
    END, ''),
       new_status = CASE COALESCE(new_status, '')
        WHEN '' THEN 'Payment Required'
        WHEN 'SUBMITTED' THEN 'Submitted'
        WHEN 'UNDER_REVIEW' THEN 'Under Review'
        WHEN 'NEEDS_INFORMATION' THEN 'Needs Information'
        WHEN 'APPROVED_PENDING_PAYMENT' THEN 'Payment Required'
        WHEN 'PAYMENT_UNDER_REVIEW' THEN 'Payment Required'
        WHEN 'PAYMENT_REQUIRED' THEN 'Payment Required'
        WHEN 'PAYMENT_CONFIRMED' THEN 'Payment Confirmed'
        WHEN 'APPROVED' THEN 'Approved'
        WHEN 'REJECTED' THEN 'Rejected'
        WHEN 'WITHDRAWN' THEN 'Withdrawn'
        ELSE new_status
    END;

UPDATE membership_applications
   SET application_status = CASE COALESCE(application_status, '')
        WHEN '' THEN 'Payment Required'
        WHEN 'SUBMITTED' THEN 'Submitted'
        WHEN 'UNDER_REVIEW' THEN 'Under Review'
        WHEN 'NEEDS_INFORMATION' THEN 'Needs Information'
        WHEN 'APPROVED_PENDING_PAYMENT' THEN 'Payment Required'
        WHEN 'PAYMENT_UNDER_REVIEW' THEN 'Payment Required'
        WHEN 'PAYMENT_REQUIRED' THEN 'Payment Required'
        WHEN 'PAYMENT_CONFIRMED' THEN 'Payment Confirmed'
        WHEN 'APPROVED' THEN 'Approved'
        WHEN 'REJECTED' THEN 'Rejected'
        WHEN 'WITHDRAWN' THEN 'Withdrawn'
        ELSE application_status
    END;

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
    ) NOT NULL DEFAULT 'Submitted';

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

COMMIT;
