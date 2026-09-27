START TRANSACTION;

-- Change only the previous default. Preserve any cooperative-specific amount.
UPDATE system_settings
   SET setting_value = '1500'
 WHERE setting_key IN (
    'membership.initial_share_capital',
    'membership.true_member_required_capital',
    'business.true_member_share_capital_required',
    'business.initial_share_capital_payment',
    'true_member_share_capital_requirement',
    'initial_share_capital_payment'
 )
   AND CAST(setting_value AS DECIMAL(12, 2)) = 3000.00;

-- Existing applications retain their payment history while unpaid requests change.
UPDATE membership_applications
   SET membership_fee_amount = 0.00,
       initial_share_capital_amount = 1500.00,
       target_share_capital_amount = 1500.00
 WHERE requested_membership_type = 'True Member'
   AND application_status NOT IN ('Approved', 'Rejected', 'Withdrawn')
   AND initial_share_capital_amount = 3000.00
   AND target_share_capital_amount = 3000.00;

UPDATE membership_applications
   SET membership_fee_amount = 0.00
 WHERE requested_membership_type = 'True Member'
   AND application_status NOT IN ('Approved', 'Rejected', 'Withdrawn')
   AND membership_fee_amount = 200.00;

UPDATE membership_application_requirements r
JOIN membership_applications a ON a.membership_application_id = r.membership_application_id
   SET r.requirement_status = 'Waived',
       r.remarks = 'True Member applicants pay PHP 1,500 share capital instead of the Associate fee.'
 WHERE a.requested_membership_type = 'True Member'
   AND a.application_status NOT IN ('Approved', 'Rejected', 'Withdrawn')
   AND r.requirement_type = 'Associate Membership Fee'
   AND r.requirement_status = 'Pending';

-- Recheck older True Member applications with validated share capital.
UPDATE membership_application_requirements r
JOIN membership_applications a ON a.membership_application_id = r.membership_application_id
   SET r.requirement_status = 'Verified',
       r.completion_date = COALESCE(r.completion_date, UTC_DATE()),
       r.verified_at = COALESCE(r.verified_at, UTC_TIMESTAMP())
 WHERE a.requested_membership_type = 'True Member'
   AND a.application_status = 'Payment Required'
   AND r.requirement_type = 'Initial Share Capital'
   AND r.requirement_status = 'Pending'
   AND (SELECT COALESCE(SUM(p.amount), 0)
          FROM payment_references p
         WHERE p.related_entity_type = 'membership_application'
           AND p.related_entity_id = a.membership_application_id
           AND p.payment_purpose = 'Share Capital'
           AND p.validation_status = 'Validated') >= 1500.00;

INSERT INTO membership_application_status_history
    (membership_application_id, old_status, new_status, internal_note, applicant_message, changed_by)
SELECT a.membership_application_id, 'Payment Required', 'Payment Confirmed',
       'Validated PHP 1,500 True Member share capital satisfies the payment rule.',
       'Your payment was confirmed. The Chairman can now finalize your membership approval.', NULL
  FROM membership_applications a
 WHERE a.requested_membership_type = 'True Member'
   AND a.application_status = 'Payment Required'
   AND (SELECT COALESCE(SUM(p.amount), 0)
          FROM payment_references p
         WHERE p.related_entity_type = 'membership_application'
           AND p.related_entity_id = a.membership_application_id
           AND p.payment_purpose = 'Share Capital'
           AND p.validation_status = 'Validated') >= 1500.00;

UPDATE membership_applications a
   SET a.application_status = 'Payment Confirmed',
       a.reviewed_at = COALESCE(a.reviewed_at, UTC_TIMESTAMP()),
       a.updated_at = UTC_TIMESTAMP()
 WHERE a.requested_membership_type = 'True Member'
   AND a.application_status = 'Payment Required'
   AND (SELECT COALESCE(SUM(p.amount), 0)
          FROM payment_references p
         WHERE p.related_entity_type = 'membership_application'
           AND p.related_entity_id = a.membership_application_id
           AND p.payment_purpose = 'Share Capital'
           AND p.validation_status = 'Validated') >= 1500.00;

COMMIT;
