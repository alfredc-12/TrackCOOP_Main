-- TrackCOOP testing data and admin settings.
-- Run manually after importing TrackCOOP_MAIN_Database.sql.
--
-- Intended for a fresh or truncated local database.
-- People seeded:
--   1 Chairman account
--   1 Bookkeeper account
--   10 membership application people total
--     - 3 approved applications converted to member profiles
--     - 7 applications still in process
--   Additional module test/reference data for finance, POS, inventory, rentals,
--   documents, reports, announcements, requests, notifications, landing content,
--   member indicators, and admin-managed settings.
--
-- Local test sign-ins:
--   chairman.test@trackcoop.local   / ChairmanTest123!
--   bookkeeper.test@trackcoop.local / BookkeeperTest123!
--   maria.member@trackcoop.local    / MemberTest123!
--   benito.member@trackcoop.local   / MemberTest123!
--   elena.member@trackcoop.local    / MemberTest123!

SET NAMES utf8mb4;
SET time_zone = '+08:00';

START TRANSACTION;

-- ---------------------------------------------------------------------------
-- Reference roles and admin settings
-- ---------------------------------------------------------------------------

INSERT INTO roles (role_name, role_slug, description, is_active)
VALUES
  ('Chairman', 'chairman', 'Cooperative oversight and administration role.', 1),
  ('Bookkeeper', 'bookkeeper', 'Financial operations and recordkeeping role.', 1),
  ('Member', 'member', 'Cooperative member self-service role.', 1)
ON DUPLICATE KEY UPDATE
  role_name = VALUES(role_name),
  description = VALUES(description),
  is_active = VALUES(is_active);

SET @chairman_role_id := (SELECT role_id FROM roles WHERE role_slug = 'chairman' LIMIT 1);
SET @bookkeeper_role_id := (SELECT role_id FROM roles WHERE role_slug = 'bookkeeper' LIMIT 1);
SET @member_role_id := (SELECT role_id FROM roles WHERE role_slug = 'member' LIMIT 1);

INSERT INTO financial_categories (
  category_code,
  category_name,
  category_type,
  description,
  is_system_category,
  is_active
)
VALUES
  ('ASSOCIATE_MEMBERSHIP_FEE', 'Associate Membership Fee', 'Income', 'Associate membership fee collections.', 1, 1),
  ('SHARE_CAPITAL', 'Share Capital', 'Income', 'Validated member share-capital contributions.', 1, 1),
  ('RENTAL_INCOME', 'Rental Income', 'Income', 'Income from cooperative asset rentals.', 1, 1),
  ('POS_SALES', 'POS Sales', 'Income', 'Income from point-of-sale transactions.', 1, 1),
  ('DOCUMENT_FEES', 'Document Fees', 'Income', 'Fees collected for eligible cooperative documents.', 1, 1),
  ('SUPPLIES', 'Supplies', 'Expense', 'Operating and office supply expenses.', 1, 1),
  ('UTILITIES', 'Utilities', 'Expense', 'Utility and communication expenses.', 1, 1),
  ('ADJUSTMENTS', 'Adjustments', 'Both', 'Controlled income or expense adjustments.', 1, 1)
ON DUPLICATE KEY UPDATE
  category_name = VALUES(category_name),
  category_type = VALUES(category_type),
  description = VALUES(description),
  is_system_category = VALUES(is_system_category),
  is_active = VALUES(is_active);

INSERT INTO system_settings (
  setting_group,
  setting_key,
  setting_value,
  value_type,
  description,
  is_public
)
VALUES
  ('membership', 'associate_membership_fee', '200.00', 'Number', 'Associate membership fee in Philippine pesos.', 0),
  ('membership', 'true_member_share_capital_requirement', '3000.00', 'Number', 'Share-capital requirement for true-member status in Philippine pesos.', 0),
  ('membership', 'initial_share_capital_payment', '1500.00', 'Number', 'Initial true-member share-capital payment in Philippine pesos.', 0),
  ('membership', 'share_capital_completion_months', '12', 'Number', 'Number of months allowed to complete the true-member share-capital requirement.', 0),
  ('membership', 'maximum_share_capital', '15000.00', 'Number', 'Maximum validated member share capital in Philippine pesos.', 0),
  ('membership', 'member_indicator_labels', '["Active","Needs Monitoring","Inactive"]', 'JSON', 'Display labels for calculated member indicators; indicators do not change official member status.', 0),
  ('membership', 'membership.associate_fee', '200', 'Number', 'Associate membership fee in Philippine pesos.', 0),
  ('membership', 'membership.initial_share_capital', '1500', 'Number', 'Initial share-capital payment in Philippine pesos.', 0),
  ('membership', 'membership.true_member_required_capital', '3000', 'Number', 'Share-capital target required for true-member approval in Philippine pesos.', 0),
  ('membership', 'membership.maximum_share_capital', '15000', 'Number', 'Maximum validated member share capital in Philippine pesos.', 0),
  ('membership', 'membership.share_capital_deadline_months', '12', 'Number', 'Number of months allowed to complete the true-member share-capital target.', 0),
  ('membership', 'membership.orientation_required', 'true', 'Boolean', 'Whether applicant orientation or seminar completion is required before approval.', 0),
  ('membership', 'membership.activation_token_hours', '72', 'Number', 'Number of hours a member account activation token remains valid.', 0),
  ('membership', 'membership.terms_version', '2026-07-24', 'String', 'Membership terms and consent version used for new applications.', 0),
  ('member_indicators', 'member_indicators.minimum_quintile_population', '5', 'Number', 'Minimum member population before indicator scoring uses deterministic quintile ranks.', 0),
  ('member_indicators', 'member_indicators.fallback_thresholds', '{"recencyDays":[{"max":30,"score":5},{"max":90,"score":4},{"max":180,"score":3},{"max":365,"score":2}],"frequencyCount":[{"min":12,"score":5},{"min":6,"score":4},{"min":3,"score":3},{"min":1,"score":2}],"contributionAmount":[{"min":10000,"score":5},{"min":5000,"score":4},{"min":1500,"score":3},{"min":1,"score":2}]}', 'JSON', 'Fallback 1-5 indicator thresholds used when the member population is too small for stable quintile ranks.', 0),
  ('member_indicators', 'member_indicators.label_thresholds', '{"activeMin":12,"needsMonitoringMin":7}', 'JSON', 'Total-score thresholds for advisory member indicator labels.', 0),
  ('inventory', 'inventory.allow_negative_stock', 'false', 'Boolean', 'Prevent negative stock unless formally changed by an authorized administrator.', 0)
ON DUPLICATE KEY UPDATE
  setting_group = VALUES(setting_group),
  setting_value = VALUES(setting_value),
  value_type = VALUES(value_type),
  description = VALUES(description),
  is_public = VALUES(is_public),
  updated_at = CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- Login accounts
-- ---------------------------------------------------------------------------

INSERT INTO users (
  role_id,
  username,
  email,
  password_hash,
  display_name,
  account_status,
  email_verified_at,
  created_by
)
VALUES (
  @chairman_role_id,
  'chairman.test',
  'chairman.test@trackcoop.local',
  '$2b$10$rMTyxL3KQUcPfWGQPNnjxutquiwcILpI9lAmDiQa3njUatGH1Mt2y',
  'Test Chairman',
  'Active',
  NOW(),
  NULL
)
ON DUPLICATE KEY UPDATE
  role_id = VALUES(role_id),
  username = VALUES(username),
  password_hash = VALUES(password_hash),
  display_name = VALUES(display_name),
  account_status = VALUES(account_status),
  email_verified_at = COALESCE(email_verified_at, VALUES(email_verified_at));

SET @chairman_id := (SELECT user_id FROM users WHERE email = 'chairman.test@trackcoop.local' LIMIT 1);

INSERT INTO users (
  role_id,
  username,
  email,
  password_hash,
  display_name,
  account_status,
  email_verified_at,
  created_by
)
VALUES
  (
    @bookkeeper_role_id,
    'bookkeeper.test',
    'bookkeeper.test@trackcoop.local',
    '$2b$10$Y819b/AZmxbPvsuXM7s99e5CelFItjBRPjdnP6Exx4SmKAFXx0h1m',
    'Test Bookkeeper',
    'Active',
    NOW(),
    @chairman_id
  ),
  (
    @member_role_id,
    'maria.member',
    'maria.member@trackcoop.local',
    '$2b$10$x2Z7f3vBR7htFis/ajCZ7.1mSoaCIUdvZyV6XJgxOoBkzEBhH4ZHy',
    'Maria Santos',
    'Active',
    NOW(),
    @chairman_id
  ),
  (
    @member_role_id,
    'benito.member',
    'benito.member@trackcoop.local',
    '$2b$10$x2Z7f3vBR7htFis/ajCZ7.1mSoaCIUdvZyV6XJgxOoBkzEBhH4ZHy',
    'Benito Cruz',
    'Active',
    NOW(),
    @chairman_id
  ),
  (
    @member_role_id,
    'elena.member',
    'elena.member@trackcoop.local',
    '$2b$10$x2Z7f3vBR7htFis/ajCZ7.1mSoaCIUdvZyV6XJgxOoBkzEBhH4ZHy',
    'Elena Ramos',
    'Active',
    NOW(),
    @chairman_id
  )
ON DUPLICATE KEY UPDATE
  role_id = VALUES(role_id),
  username = VALUES(username),
  password_hash = VALUES(password_hash),
  display_name = VALUES(display_name),
  account_status = VALUES(account_status),
  email_verified_at = COALESCE(email_verified_at, VALUES(email_verified_at)),
  created_by = COALESCE(created_by, VALUES(created_by));

SET @bookkeeper_id := (SELECT user_id FROM users WHERE email = 'bookkeeper.test@trackcoop.local' LIMIT 1);
SET @maria_user_id := (SELECT user_id FROM users WHERE email = 'maria.member@trackcoop.local' LIMIT 1);
SET @benito_user_id := (SELECT user_id FROM users WHERE email = 'benito.member@trackcoop.local' LIMIT 1);
SET @elena_user_id := (SELECT user_id FROM users WHERE email = 'elena.member@trackcoop.local' LIMIT 1);

-- ---------------------------------------------------------------------------
-- Approved members
-- ---------------------------------------------------------------------------

INSERT INTO member_profiles (
  user_id,
  member_code,
  full_name,
  contact_number,
  email,
  barangay,
  municipality,
  province,
  sector,
  membership_type,
  approval_status,
  official_member_status,
  application_date,
  approved_by,
  approved_at,
  true_member_since,
  share_capital_deadline,
  notes
)
VALUES
  (
    @maria_user_id,
    'NFFAC-SEED-0001',
    'Maria Santos',
    '09171234567',
    'maria.member@trackcoop.local',
    'Lumbangan',
    'Nasugbu',
    'Batangas',
    'Rice Farming',
    'True Member',
    'Approved',
    'Active',
    '2026-01-15',
    @chairman_id,
    '2026-01-20 09:00:00',
    '2026-02-01',
    NULL,
    'Approved seeded member converted from a membership application.'
  ),
  (
    @benito_user_id,
    'NFFAC-SEED-0002',
    'Benito Cruz',
    '09170000002',
    'benito.member@trackcoop.local',
    'Wawa',
    'Nasugbu',
    'Batangas',
    'Fisherfolk',
    'Associate',
    'Approved',
    'Active',
    '2026-02-05',
    @chairman_id,
    '2026-02-09 10:30:00',
    NULL,
    '2027-02-09',
    'Approved seeded associate member.'
  ),
  (
    @elena_user_id,
    'NFFAC-SEED-0003',
    'Elena Ramos',
    '09170000003',
    'elena.member@trackcoop.local',
    'Bilaran',
    'Nasugbu',
    'Batangas',
    'Vegetable Farming',
    'Associate',
    'Approved',
    'Active',
    '2026-03-12',
    @chairman_id,
    '2026-03-16 14:15:00',
    NULL,
    '2027-03-16',
    'Approved seeded associate member.'
  )
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  full_name = VALUES(full_name),
  contact_number = VALUES(contact_number),
  email = VALUES(email),
  barangay = VALUES(barangay),
  municipality = VALUES(municipality),
  province = VALUES(province),
  sector = VALUES(sector),
  membership_type = VALUES(membership_type),
  approval_status = VALUES(approval_status),
  official_member_status = VALUES(official_member_status),
  application_date = VALUES(application_date),
  approved_by = VALUES(approved_by),
  approved_at = VALUES(approved_at),
  true_member_since = VALUES(true_member_since),
  share_capital_deadline = VALUES(share_capital_deadline),
  notes = VALUES(notes);

SET @maria_member_id := (SELECT member_id FROM member_profiles WHERE member_code = 'NFFAC-SEED-0001' LIMIT 1);
SET @benito_member_id := (SELECT member_id FROM member_profiles WHERE member_code = 'NFFAC-SEED-0002' LIMIT 1);
SET @elena_member_id := (SELECT member_id FROM member_profiles WHERE member_code = 'NFFAC-SEED-0003' LIMIT 1);

DELETE h
  FROM member_status_history h
  JOIN member_profiles m ON m.member_id = h.member_id
 WHERE m.member_code IN ('NFFAC-SEED-0001', 'NFFAC-SEED-0002', 'NFFAC-SEED-0003');

INSERT INTO member_status_history (
  member_id,
  old_membership_type,
  new_membership_type,
  old_official_status,
  new_official_status,
  reason,
  changed_by,
  changed_at
)
VALUES
  (@maria_member_id, 'Associate', 'True Member', 'Pending', 'Active', 'Seeded approved member application conversion.', @chairman_id, '2026-01-20 09:00:00'),
  (@benito_member_id, NULL, 'Associate', 'Pending', 'Active', 'Seeded approved member application conversion.', @chairman_id, '2026-02-09 10:30:00'),
  (@elena_member_id, NULL, 'Associate', 'Pending', 'Active', 'Seeded approved member application conversion.', @chairman_id, '2026-03-16 14:15:00');

-- ---------------------------------------------------------------------------
-- Membership applications: 3 approved and 7 still in process
-- ---------------------------------------------------------------------------

DELETE FROM membership_applications
 WHERE application_code LIKE 'MEM-APP-SEED-%';

INSERT INTO membership_applications (
  application_code,
  public_tracking_token_hash,
  application_source,
  requested_membership_type,
  first_name,
  middle_name,
  last_name,
  suffix,
  email,
  contact_number,
  civil_status,
  place_of_birth,
  date_of_birth,
  current_address,
  barangay,
  municipality,
  province,
  father_name,
  mother_name,
  spouse_name,
  occupation,
  orientation_commitment_accepted,
  membership_fee_commitment_accepted,
  membership_fee_amount,
  share_subscription_commitment_accepted,
  initial_share_capital_amount,
  target_share_capital_amount,
  share_capital_deadline_months,
  patronage_refund_acknowledged,
  bylaws_agreement_accepted,
  privacy_consent_accepted,
  terms_version,
  applicant_signature_name,
  signed_at,
  signed_place,
  application_status,
  submitted_by_user_id,
  reviewed_by,
  reviewed_at,
  board_meeting_date,
  secretary_name,
  decision_reason,
  converted_member_id,
  submitted_ip,
  submitted_user_agent,
  submitted_at
)
VALUES
  (
    'MEM-APP-SEED-0001',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'Public Website',
    'True Member',
    'Maria',
    NULL,
    'Santos',
    NULL,
    'maria.member@trackcoop.local',
    '09171234567',
    'Married',
    'Nasugbu, Batangas',
    '1990-01-15',
    'Barangay Lumbangan, Nasugbu, Batangas',
    'Lumbangan',
    'Nasugbu',
    'Batangas',
    'Juan Santos',
    'Rosa Santos',
    'Pedro Santos',
    'Rice Farmer',
    1,
    1,
    200.00,
    1,
    1500.00,
    3000.00,
    12,
    1,
    1,
    1,
    '2026-07-24',
    'Maria Santos',
    '2026-01-15 08:00:00',
    'Nasugbu, Batangas',
    'Approved',
    NULL,
    @chairman_id,
    '2026-01-20 09:00:00',
    '2026-01-20',
    'Test Chairman',
    'Seeded approved true-member application.',
    @maria_member_id,
    '127.0.0.1',
    'TrackCOOP seed',
    '2026-01-15 08:00:00'
  ),
  (
    'MEM-APP-SEED-0002',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'Chairman Entry',
    'Associate',
    'Benito',
    NULL,
    'Cruz',
    NULL,
    'benito.member@trackcoop.local',
    '09170000002',
    'Single',
    'Nasugbu, Batangas',
    '1988-05-08',
    'Barangay Wawa, Nasugbu, Batangas',
    'Wawa',
    'Nasugbu',
    'Batangas',
    'Ramon Cruz',
    'Lourdes Cruz',
    NULL,
    'Fisherfolk',
    1,
    1,
    200.00,
    1,
    1500.00,
    3000.00,
    12,
    1,
    1,
    1,
    '2026-07-24',
    'Benito Cruz',
    '2026-02-05 09:15:00',
    'Nasugbu, Batangas',
    'Approved',
    @chairman_id,
    @chairman_id,
    '2026-02-09 10:30:00',
    '2026-02-09',
    'Test Chairman',
    'Seeded approved associate application.',
    @benito_member_id,
    NULL,
    NULL,
    '2026-02-05 09:15:00'
  ),
  (
    'MEM-APP-SEED-0003',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    'Imported Paper Form',
    'Associate',
    'Elena',
    NULL,
    'Ramos',
    NULL,
    'elena.member@trackcoop.local',
    '09170000003',
    'Widowed',
    'Nasugbu, Batangas',
    '1979-11-21',
    'Barangay Bilaran, Nasugbu, Batangas',
    'Bilaran',
    'Nasugbu',
    'Batangas',
    'Manuel Ramos',
    'Corazon Ramos',
    NULL,
    'Vegetable Farmer',
    1,
    1,
    200.00,
    1,
    1500.00,
    3000.00,
    12,
    1,
    1,
    1,
    '2026-07-24',
    'Elena Ramos',
    '2026-03-12 13:20:00',
    'Nasugbu, Batangas',
    'Approved',
    @chairman_id,
    @chairman_id,
    '2026-03-16 14:15:00',
    '2026-03-16',
    'Test Chairman',
    'Seeded approved associate application.',
    @elena_member_id,
    NULL,
    NULL,
    '2026-03-12 13:20:00'
  ),
  (
    'MEM-APP-SEED-0004',
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    'Public Website',
    'Associate',
    'Ana',
    'Reyes',
    'Villanueva',
    NULL,
    'ana.applicant@example.local',
    '09170000004',
    'Single',
    'Nasugbu, Batangas',
    '1996-04-02',
    'Barangay Bucana, Nasugbu, Batangas',
    'Bucana',
    'Nasugbu',
    'Batangas',
    'Alberto Villanueva',
    'Mila Villanueva',
    NULL,
    'Rice Farmer',
    1,
    1,
    200.00,
    1,
    1500.00,
    3000.00,
    12,
    1,
    1,
    1,
    '2026-07-24',
    'Ana Reyes Villanueva',
    '2026-07-01 08:30:00',
    'Nasugbu, Batangas',
    'Submitted',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '127.0.0.1',
    'TrackCOOP seed',
    '2026-07-01 08:30:00'
  ),
  (
    'MEM-APP-SEED-0005',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'Public Website',
    'True Member',
    'Carlos',
    NULL,
    'Mendoza',
    'Jr.',
    'carlos.applicant@example.local',
    '09170000005',
    'Married',
    'Nasugbu, Batangas',
    '1985-09-18',
    'Barangay Papaya, Nasugbu, Batangas',
    'Papaya',
    'Nasugbu',
    'Batangas',
    'Jose Mendoza',
    'Nena Mendoza',
    'Liza Mendoza',
    'Aquaculture Operator',
    1,
    1,
    200.00,
    1,
    1500.00,
    3000.00,
    12,
    1,
    1,
    1,
    '2026-07-24',
    'Carlos Mendoza Jr.',
    '2026-07-03 09:45:00',
    'Nasugbu, Batangas',
    'Under Review',
    NULL,
    @chairman_id,
    '2026-07-04 10:00:00',
    NULL,
    NULL,
    NULL,
    NULL,
    '127.0.0.1',
    'TrackCOOP seed',
    '2026-07-03 09:45:00'
  ),
  (
    'MEM-APP-SEED-0006',
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    'Public Website',
    'Associate',
    'Lucia',
    'De Vera',
    'Garcia',
    NULL,
    'lucia.applicant@example.local',
    '09170000006',
    'Separated',
    'Nasugbu, Batangas',
    '1991-12-05',
    'Barangay Kaylaway, Nasugbu, Batangas',
    'Kaylaway',
    'Nasugbu',
    'Batangas',
    'Ricardo Garcia',
    'Amelia Garcia',
    NULL,
    'Vegetable Farmer',
    1,
    1,
    200.00,
    1,
    1500.00,
    3000.00,
    12,
    1,
    1,
    1,
    '2026-07-24',
    'Lucia De Vera Garcia',
    '2026-07-05 11:10:00',
    'Nasugbu, Batangas',
    'Needs Information',
    NULL,
    @chairman_id,
    '2026-07-06 14:00:00',
    NULL,
    NULL,
    NULL,
    NULL,
    '127.0.0.1',
    'TrackCOOP seed',
    '2026-07-05 11:10:00'
  ),
  (
    'MEM-APP-SEED-0007',
    '1111111111111111111111111111111111111111111111111111111111111111',
    'Chairman Entry',
    'Associate',
    'Teresa',
    NULL,
    'Dizon',
    NULL,
    NULL,
    '09170000007',
    'Single',
    'Nasugbu, Batangas',
    '1994-06-14',
    'Barangay Natipuan, Nasugbu, Batangas',
    'Natipuan',
    'Nasugbu',
    'Batangas',
    'Oscar Dizon',
    'Remedios Dizon',
    NULL,
    'Farm Laborer',
    1,
    1,
    200.00,
    1,
    1500.00,
    3000.00,
    12,
    1,
    1,
    1,
    '2026-07-24',
    'Teresa Dizon',
    '2026-07-07 15:00:00',
    'Nasugbu, Batangas',
    'Submitted',
    @chairman_id,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-07 15:00:00'
  ),
  (
    'MEM-APP-SEED-0008',
    '2222222222222222222222222222222222222222222222222222222222222222',
    'Public Website',
    'True Member',
    'Marco',
    'Luna',
    'Bautista',
    NULL,
    'marco.applicant@example.local',
    '09170000008',
    'Married',
    'Nasugbu, Batangas',
    '1982-02-22',
    'Barangay Looc, Nasugbu, Batangas',
    'Looc',
    'Nasugbu',
    'Batangas',
    'Danilo Bautista',
    'Gloria Bautista',
    'Patricia Bautista',
    'Fisherfolk',
    1,
    1,
    200.00,
    1,
    1500.00,
    3000.00,
    12,
    1,
    1,
    1,
    '2026-07-24',
    'Marco Luna Bautista',
    '2026-07-09 07:40:00',
    'Nasugbu, Batangas',
    'Under Review',
    NULL,
    @chairman_id,
    '2026-07-10 09:00:00',
    NULL,
    NULL,
    NULL,
    NULL,
    '127.0.0.1',
    'TrackCOOP seed',
    '2026-07-09 07:40:00'
  ),
  (
    'MEM-APP-SEED-0009',
    '3333333333333333333333333333333333333333333333333333333333333333',
    'Public Website',
    'Associate',
    'Sofia',
    NULL,
    'Ramos',
    NULL,
    'sofia.applicant@example.local',
    '09170000009',
    'Widowed',
    'Nasugbu, Batangas',
    '1976-08-30',
    'Barangay Tumalim, Nasugbu, Batangas',
    'Tumalim',
    'Nasugbu',
    'Batangas',
    'Victor Ramos',
    'Leticia Ramos',
    NULL,
    'Market Vendor',
    1,
    1,
    200.00,
    1,
    1500.00,
    3000.00,
    12,
    1,
    1,
    1,
    '2026-07-24',
    'Sofia Ramos',
    '2026-07-11 12:25:00',
    'Nasugbu, Batangas',
    'Needs Information',
    NULL,
    @chairman_id,
    '2026-07-12 10:20:00',
    NULL,
    NULL,
    NULL,
    NULL,
    '127.0.0.1',
    'TrackCOOP seed',
    '2026-07-11 12:25:00'
  ),
  (
    'MEM-APP-SEED-0010',
    '4444444444444444444444444444444444444444444444444444444444444444',
    'Imported Paper Form',
    'Associate',
    'Rafael',
    'Ocampo',
    'Navarro',
    NULL,
    'rafael.applicant@example.local',
    '09170000010',
    'Single',
    'Nasugbu, Batangas',
    '1998-10-19',
    'Barangay Banilad, Nasugbu, Batangas',
    'Banilad',
    'Nasugbu',
    'Batangas',
    'Mario Navarro',
    'Estrella Navarro',
    NULL,
    'Young Farmer',
    1,
    1,
    200.00,
    1,
    1500.00,
    3000.00,
    12,
    1,
    1,
    1,
    '2026-07-24',
    'Rafael Ocampo Navarro',
    '2026-07-13 16:35:00',
    'Nasugbu, Batangas',
    'Under Review',
    @chairman_id,
    @chairman_id,
    '2026-07-14 09:30:00',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-13 16:35:00'
  );

INSERT INTO membership_application_status_history (
  membership_application_id,
  old_status,
  new_status,
  internal_note,
  applicant_message,
  changed_by,
  changed_at
)
SELECT membership_application_id, NULL, application_status,
       CASE
         WHEN application_status = 'Approved' THEN 'Seeded approved application converted to a member profile.'
         WHEN application_status = 'Under Review' THEN 'Seeded application is currently under Chairman review.'
         WHEN application_status = 'Needs Information' THEN 'Seeded application is waiting for applicant follow-up.'
         ELSE 'Seeded application is waiting for review.'
       END,
       CASE
         WHEN application_status = 'Approved' THEN 'Your membership application has been approved.'
         WHEN application_status = 'Needs Information' THEN 'Please provide the additional information requested by the cooperative.'
         ELSE 'Your application has been received by the cooperative.'
       END,
       CASE WHEN application_status = 'Submitted' THEN NULL ELSE @chairman_id END,
       submitted_at
  FROM membership_applications
 WHERE application_code LIKE 'MEM-APP-SEED-%';

INSERT INTO membership_application_requirements (
  membership_application_id,
  requirement_type,
  requirement_status,
  completion_date,
  verified_by,
  verified_at,
  remarks
)
SELECT membership_application_id, 'Orientation/Seminar',
       CASE WHEN application_status = 'Approved' THEN 'Verified' WHEN application_status = 'Needs Information' THEN 'Rejected' ELSE 'Pending' END,
       CASE WHEN application_status = 'Approved' THEN DATE(reviewed_at) ELSE NULL END,
       CASE WHEN application_status = 'Approved' THEN @chairman_id ELSE NULL END,
       CASE WHEN application_status = 'Approved' THEN reviewed_at ELSE NULL END,
       CASE WHEN application_status = 'Needs Information' THEN 'Orientation attendance needs confirmation.' ELSE NULL END
  FROM membership_applications
 WHERE application_code LIKE 'MEM-APP-SEED-%'
UNION ALL
SELECT membership_application_id, 'Associate Membership Fee',
       CASE WHEN application_status = 'Approved' THEN 'Verified' WHEN application_status = 'Under Review' THEN 'Submitted' ELSE 'Pending' END,
       CASE WHEN application_status = 'Approved' THEN DATE(reviewed_at) ELSE NULL END,
       CASE WHEN application_status = 'Approved' THEN @chairman_id ELSE NULL END,
       CASE WHEN application_status = 'Approved' THEN reviewed_at ELSE NULL END,
       NULL
  FROM membership_applications
 WHERE application_code LIKE 'MEM-APP-SEED-%'
UNION ALL
SELECT membership_application_id, 'Signed Application',
       CASE WHEN application_status IN ('Approved', 'Under Review') THEN 'Verified' ELSE 'Pending' END,
       CASE WHEN application_status IN ('Approved', 'Under Review') THEN DATE(submitted_at) ELSE NULL END,
       CASE WHEN application_status IN ('Approved', 'Under Review') THEN @chairman_id ELSE NULL END,
       CASE WHEN application_status IN ('Approved', 'Under Review') THEN submitted_at ELSE NULL END,
       NULL
  FROM membership_applications
 WHERE application_code LIKE 'MEM-APP-SEED-%'
UNION ALL
SELECT membership_application_id, 'Initial Share Capital',
       CASE WHEN application_status = 'Approved' THEN 'Verified' WHEN application_status = 'Under Review' THEN 'Submitted' ELSE 'Pending' END,
       CASE WHEN application_status = 'Approved' THEN DATE(reviewed_at) ELSE NULL END,
       CASE WHEN application_status = 'Approved' THEN @chairman_id ELSE NULL END,
       CASE WHEN application_status = 'Approved' THEN reviewed_at ELSE NULL END,
       NULL
  FROM membership_applications
 WHERE application_code LIKE 'MEM-APP-SEED-%'
   AND requested_membership_type = 'True Member';


-- ---------------------------------------------------------------------------
-- Payments, share capital, and finance
-- ---------------------------------------------------------------------------

INSERT INTO payment_references (
  member_id,
  submitted_by,
  payer_name,
  payer_email,
  payer_contact,
  provider,
  reference_number,
  payment_purpose,
  related_entity_type,
  related_entity_id,
  amount,
  proof_file_path,
  validation_status,
  validated_by,
  validated_at,
  notes,
  submitted_at
)
VALUES
  (
    @maria_member_id,
    @maria_user_id,
    'Maria Santos',
    'maria.member@trackcoop.local',
    '09171234567',
    'GCash',
    'TEST-SHARE-0001',
    'Share Capital',
    'member_profiles',
    @maria_member_id,
    1500.00,
    '/private/uploads/test/share-capital-0001.jpg',
    'Validated',
    @bookkeeper_id,
    '2026-02-05 14:00:00',
    'Initial share-capital payment for seeded true member.',
    '2026-02-05 10:00:00'
  ),
  (
    @benito_member_id,
    NULL,
    'Benito Cruz',
    'benito.member@trackcoop.local',
    '09170000002',
    'GCash',
    'TEST-ASSOC-0002',
    'Associate Membership Fee',
    'member_profiles',
    @benito_member_id,
    200.00,
    '/private/uploads/test/associate-fee-0002.jpg',
    'Pending',
    NULL,
    NULL,
    'Pending associate membership fee for validation testing.',
    '2026-03-06 08:45:00'
  )
ON DUPLICATE KEY UPDATE
  member_id = VALUES(member_id),
  submitted_by = VALUES(submitted_by),
  payer_name = VALUES(payer_name),
  payer_email = VALUES(payer_email),
  payer_contact = VALUES(payer_contact),
  payment_purpose = VALUES(payment_purpose),
  related_entity_type = VALUES(related_entity_type),
  related_entity_id = VALUES(related_entity_id),
  amount = VALUES(amount),
  proof_file_path = VALUES(proof_file_path),
  validation_status = VALUES(validation_status),
  validated_by = VALUES(validated_by),
  validated_at = VALUES(validated_at),
  notes = VALUES(notes);

SET @share_ref_id := (SELECT payment_reference_id FROM payment_references WHERE provider = 'GCash' AND reference_number = 'TEST-SHARE-0001' LIMIT 1);
SET @assoc_ref_id := (SELECT payment_reference_id FROM payment_references WHERE provider = 'GCash' AND reference_number = 'TEST-ASSOC-0002' LIMIT 1);

INSERT INTO share_capital_payments (
  member_id,
  payment_reference_id,
  amount,
  payment_date,
  payment_status,
  verified_by,
  verified_at,
  remarks
)
SELECT
  @maria_member_id,
  @share_ref_id,
  1500.00,
  '2026-02-05',
  'Validated',
  @bookkeeper_id,
  '2026-02-05 14:00:00',
  'Initial seeded share-capital contribution.'
WHERE NOT EXISTS (
  SELECT 1
  FROM share_capital_payments
  WHERE member_id = @maria_member_id
    AND payment_reference_id = @share_ref_id
);

SET @cat_assoc := (SELECT financial_category_id FROM financial_categories WHERE category_code = 'ASSOCIATE_MEMBERSHIP_FEE' LIMIT 1);
SET @cat_share := (SELECT financial_category_id FROM financial_categories WHERE category_code = 'SHARE_CAPITAL' LIMIT 1);
SET @cat_pos := (SELECT financial_category_id FROM financial_categories WHERE category_code = 'POS_SALES' LIMIT 1);
SET @cat_rental := (SELECT financial_category_id FROM financial_categories WHERE category_code = 'RENTAL_INCOME' LIMIT 1);
SET @cat_supplies := (SELECT financial_category_id FROM financial_categories WHERE category_code = 'SUPPLIES' LIMIT 1);

INSERT INTO financial_records (
  record_number,
  payment_reference_id,
  member_id,
  financial_category_id,
  recorded_by,
  approved_by,
  record_type,
  source_module,
  source_record_id,
  amount,
  record_date,
  record_status,
  remarks
)
VALUES
  ('FIN-TEST-SHARE-0001', @share_ref_id, @maria_member_id, @cat_share, @bookkeeper_id, @chairman_id, 'Income', 'Share Capital', @share_ref_id, 1500.00, '2026-02-05', 'Active', 'Seeded share-capital ledger entry.'),
  ('FIN-TEST-ASSOC-0002', @assoc_ref_id, @benito_member_id, @cat_assoc, @bookkeeper_id, NULL, 'Income', 'Membership', @assoc_ref_id, 200.00, '2026-03-06', 'Active', 'Seeded pending associate fee ledger entry.'),
  ('FIN-TEST-EXP-0001', NULL, NULL, @cat_supplies, @bookkeeper_id, @chairman_id, 'Expense', 'Manual', NULL, 850.00, '2026-03-12', 'Active', 'Seeded farm supplies expense.')
ON DUPLICATE KEY UPDATE
  payment_reference_id = VALUES(payment_reference_id),
  member_id = VALUES(member_id),
  financial_category_id = VALUES(financial_category_id),
  recorded_by = VALUES(recorded_by),
  approved_by = VALUES(approved_by),
  record_type = VALUES(record_type),
  source_module = VALUES(source_module),
  source_record_id = VALUES(source_record_id),
  amount = VALUES(amount),
  record_date = VALUES(record_date),
  record_status = VALUES(record_status),
  remarks = VALUES(remarks);

-- ---------------------------------------------------------------------------
-- POS products, sales, and inventory
-- ---------------------------------------------------------------------------

INSERT INTO products (
  sku,
  product_name,
  category,
  description,
  unit,
  selling_price,
  cost_price,
  track_inventory,
  reorder_level,
  public_visibility,
  product_status,
  image_path,
  created_by
)
VALUES
  ('NFFAC-RICE-SEED-001', 'Certified Rice Seeds', 'Seeds', 'Certified rice seed sacks for member farms.', 'sack', 1250.00, 1000.00, 1, 10.000, 1, 'Active', '/images/products/rice-seeds.jpg', @chairman_id),
  ('NFFAC-FERT-UREA-001', 'Urea Fertilizer', 'Fertilizer', 'Fertilizer support stock for seasonal planting.', 'bag', 1650.00, 1425.00, 1, 8.000, 1, 'Active', '/images/products/urea.jpg', @chairman_id),
  ('NFFAC-FISH-FEED-001', 'Fish Feed', 'Aquaculture', 'Feed support for fisherfolk livelihood projects.', 'bag', 980.00, 820.00, 1, 6.000, 1, 'Active', '/images/products/fish-feed.jpg', @chairman_id)
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  category = VALUES(category),
  description = VALUES(description),
  unit = VALUES(unit),
  selling_price = VALUES(selling_price),
  cost_price = VALUES(cost_price),
  track_inventory = VALUES(track_inventory),
  reorder_level = VALUES(reorder_level),
  public_visibility = VALUES(public_visibility),
  product_status = VALUES(product_status),
  image_path = VALUES(image_path),
  created_by = VALUES(created_by);

SET @rice_seed_product_id := (SELECT product_id FROM products WHERE sku = 'NFFAC-RICE-SEED-001' LIMIT 1);
SET @fert_product_id := (SELECT product_id FROM products WHERE sku = 'NFFAC-FERT-UREA-001' LIMIT 1);
SET @fish_feed_product_id := (SELECT product_id FROM products WHERE sku = 'NFFAC-FISH-FEED-001' LIMIT 1);

INSERT INTO inventory_movements (
  product_id,
  movement_type,
  quantity_change,
  unit_cost,
  reference_number,
  remarks,
  recorded_by,
  movement_date
)
SELECT @rice_seed_product_id, 'Opening Stock', 40.000, 1000.00, 'INV-OPEN-RICE-001', 'Seeded opening stock.', @chairman_id, '2026-03-01 08:00:00'
WHERE NOT EXISTS (SELECT 1 FROM inventory_movements WHERE reference_number = 'INV-OPEN-RICE-001');

INSERT INTO inventory_movements (
  product_id,
  movement_type,
  quantity_change,
  unit_cost,
  reference_number,
  remarks,
  recorded_by,
  movement_date
)
SELECT @fert_product_id, 'Opening Stock', 25.000, 1425.00, 'INV-OPEN-FERT-001', 'Seeded opening stock.', @chairman_id, '2026-03-01 08:05:00'
WHERE NOT EXISTS (SELECT 1 FROM inventory_movements WHERE reference_number = 'INV-OPEN-FERT-001');

INSERT INTO inventory_movements (
  product_id,
  movement_type,
  quantity_change,
  unit_cost,
  reference_number,
  remarks,
  recorded_by,
  movement_date
)
SELECT @fish_feed_product_id, 'Opening Stock', 18.000, 820.00, 'INV-OPEN-FISH-001', 'Seeded opening stock.', @chairman_id, '2026-03-01 08:10:00'
WHERE NOT EXISTS (SELECT 1 FROM inventory_movements WHERE reference_number = 'INV-OPEN-FISH-001');

INSERT INTO pos_sales (
  sale_number,
  member_id,
  customer_name,
  customer_contact,
  sale_type,
  sale_status,
  payment_status,
  subtotal_amount,
  discount_amount,
  total_amount,
  amount_paid,
  change_due,
  recorded_by,
  notes,
  sale_date
)
VALUES (
  'POS-TEST-0001',
  @maria_member_id,
  'Maria Santos',
  '09171234567',
  'Member Sale',
  'Completed',
  'Paid',
  2900.00,
  100.00,
  2800.00,
  2800.00,
  0.00,
  @bookkeeper_id,
  'Seeded POS sale for inventory and finance testing.',
  '2026-03-15 13:20:00'
)
ON DUPLICATE KEY UPDATE
  member_id = VALUES(member_id),
  customer_name = VALUES(customer_name),
  customer_contact = VALUES(customer_contact),
  sale_type = VALUES(sale_type),
  sale_status = VALUES(sale_status),
  payment_status = VALUES(payment_status),
  subtotal_amount = VALUES(subtotal_amount),
  discount_amount = VALUES(discount_amount),
  total_amount = VALUES(total_amount),
  amount_paid = VALUES(amount_paid),
  change_due = VALUES(change_due),
  recorded_by = VALUES(recorded_by),
  notes = VALUES(notes),
  sale_date = VALUES(sale_date);

SET @pos_sale_id := (SELECT pos_sale_id FROM pos_sales WHERE sale_number = 'POS-TEST-0001' LIMIT 1);

INSERT INTO pos_sale_items (
  pos_sale_id,
  product_id,
  product_name_snapshot,
  sku_snapshot,
  quantity,
  unit_price,
  discount_amount,
  line_total
)
SELECT @pos_sale_id, @rice_seed_product_id, 'Certified Rice Seeds', 'NFFAC-RICE-SEED-001', 1.000, 1250.00, 50.00, 1200.00
WHERE NOT EXISTS (
  SELECT 1 FROM pos_sale_items WHERE pos_sale_id = @pos_sale_id AND product_id = @rice_seed_product_id
);

INSERT INTO pos_sale_items (
  pos_sale_id,
  product_id,
  product_name_snapshot,
  sku_snapshot,
  quantity,
  unit_price,
  discount_amount,
  line_total
)
SELECT @pos_sale_id, @fert_product_id, 'Urea Fertilizer', 'NFFAC-FERT-UREA-001', 1.000, 1650.00, 50.00, 1600.00
WHERE NOT EXISTS (
  SELECT 1 FROM pos_sale_items WHERE pos_sale_id = @pos_sale_id AND product_id = @fert_product_id
);

INSERT INTO inventory_movements (
  product_id,
  movement_type,
  quantity_change,
  pos_sale_id,
  reference_number,
  remarks,
  recorded_by,
  movement_date
)
SELECT @rice_seed_product_id, 'Sale', -1.000, @pos_sale_id, 'INV-SALE-POS-TEST-0001-RICE', 'Seeded POS stock deduction.', @bookkeeper_id, '2026-03-15 13:21:00'
WHERE NOT EXISTS (SELECT 1 FROM inventory_movements WHERE reference_number = 'INV-SALE-POS-TEST-0001-RICE');

INSERT INTO financial_records (
  record_number,
  member_id,
  financial_category_id,
  recorded_by,
  approved_by,
  record_type,
  source_module,
  source_record_id,
  amount,
  record_date,
  record_status,
  remarks
)
VALUES (
  'FIN-TEST-POS-0001',
  @maria_member_id,
  @cat_pos,
  @bookkeeper_id,
  @chairman_id,
  'Income',
  'POS',
  @pos_sale_id,
  2800.00,
  '2026-03-15',
  'Active',
  'Seeded POS sale income.'
)
ON DUPLICATE KEY UPDATE
  member_id = VALUES(member_id),
  financial_category_id = VALUES(financial_category_id),
  recorded_by = VALUES(recorded_by),
  approved_by = VALUES(approved_by),
  source_record_id = VALUES(source_record_id),
  amount = VALUES(amount),
  record_date = VALUES(record_date),
  remarks = VALUES(remarks);

-- ---------------------------------------------------------------------------
-- Rentals
-- ---------------------------------------------------------------------------

INSERT INTO rental_assets (
  asset_code,
  asset_name,
  asset_type,
  category,
  description,
  rate_amount,
  rate_unit,
  deposit_amount,
  asset_status,
  public_visibility,
  created_by
)
VALUES
  ('RNT-TRACTOR-001', 'Farm Tractor', 'Equipment', 'Land Preparation', 'Shared tractor for approved field preparation schedules.', 1800.00, 'Per Day', 500.00, 'Available', 1, @chairman_id),
  ('RNT-PUMP-001', 'Water Pump', 'Equipment', 'Irrigation', 'Portable water pump for irrigation support.', 650.00, 'Per Day', 250.00, 'Available', 1, @chairman_id)
ON DUPLICATE KEY UPDATE
  asset_name = VALUES(asset_name),
  asset_type = VALUES(asset_type),
  category = VALUES(category),
  description = VALUES(description),
  rate_amount = VALUES(rate_amount),
  rate_unit = VALUES(rate_unit),
  deposit_amount = VALUES(deposit_amount),
  asset_status = VALUES(asset_status),
  public_visibility = VALUES(public_visibility),
  created_by = VALUES(created_by);

SET @tractor_asset_id := (SELECT rental_asset_id FROM rental_assets WHERE asset_code = 'RNT-TRACTOR-001' LIMIT 1);
SET @pump_asset_id := (SELECT rental_asset_id FROM rental_assets WHERE asset_code = 'RNT-PUMP-001' LIMIT 1);

INSERT INTO rental_bookings (
  booking_number,
  rental_asset_id,
  member_id,
  requester_name,
  requester_contact,
  purpose,
  start_datetime,
  end_datetime,
  booking_status,
  rate_amount,
  deposit_amount,
  total_amount,
  payment_status,
  approved_by,
  approved_at,
  recorded_by
)
VALUES
  ('RNT-TEST-0001', @tractor_asset_id, @maria_member_id, 'Maria Santos', '09171234567', 'Rice field land preparation in Lumbangan.', '2026-04-10 08:00:00', '2026-04-10 17:00:00', 'Scheduled', 1800.00, 500.00, 2300.00, 'Paid', @chairman_id, '2026-04-01 09:00:00', @chairman_id),
  ('RNT-TEST-0002', @pump_asset_id, @benito_member_id, 'Benito Cruz', '09170000002', 'Irrigation support request awaiting review.', '2026-04-18 08:00:00', '2026-04-18 17:00:00', 'Pending', 650.00, 250.00, 900.00, 'Unpaid', NULL, NULL, @chairman_id)
ON DUPLICATE KEY UPDATE
  rental_asset_id = VALUES(rental_asset_id),
  member_id = VALUES(member_id),
  requester_name = VALUES(requester_name),
  requester_contact = VALUES(requester_contact),
  purpose = VALUES(purpose),
  start_datetime = VALUES(start_datetime),
  end_datetime = VALUES(end_datetime),
  booking_status = VALUES(booking_status),
  rate_amount = VALUES(rate_amount),
  deposit_amount = VALUES(deposit_amount),
  total_amount = VALUES(total_amount),
  payment_status = VALUES(payment_status),
  approved_by = VALUES(approved_by),
  approved_at = VALUES(approved_at),
  recorded_by = VALUES(recorded_by);

SET @rental_booking_id := (SELECT rental_booking_id FROM rental_bookings WHERE booking_number = 'RNT-TEST-0001' LIMIT 1);
SET @pending_rental_booking_id := (SELECT rental_booking_id FROM rental_bookings WHERE booking_number = 'RNT-TEST-0002' LIMIT 1);

INSERT INTO rental_status_history (rental_booking_id, old_status, new_status, remarks, changed_by, changed_at)
SELECT @rental_booking_id, 'Approved', 'Scheduled', 'Seeded scheduled tractor booking.', @chairman_id, '2026-04-01 09:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM rental_status_history WHERE rental_booking_id = @rental_booking_id AND new_status = 'Scheduled'
);

INSERT INTO payment_references (
  member_id,
  submitted_by,
  payer_name,
  payer_email,
  payer_contact,
  provider,
  reference_number,
  payment_purpose,
  related_entity_type,
  related_entity_id,
  amount,
  proof_file_path,
  validation_status,
  validated_by,
  validated_at,
  notes,
  submitted_at
)
VALUES (
  @maria_member_id,
  @maria_user_id,
  'Maria Santos',
  'maria.member@trackcoop.local',
  '09171234567',
  'GCash',
  'TEST-RENTAL-0001',
  'Rental',
  'rental_bookings',
  @rental_booking_id,
  2300.00,
  '/private/uploads/test/rental-0001.jpg',
  'Validated',
  @bookkeeper_id,
  '2026-04-02 09:30:00',
  'Seeded rental payment proof.',
  '2026-04-02 08:00:00'
)
ON DUPLICATE KEY UPDATE
  member_id = VALUES(member_id),
  submitted_by = VALUES(submitted_by),
  related_entity_id = VALUES(related_entity_id),
  amount = VALUES(amount),
  validation_status = VALUES(validation_status),
  validated_by = VALUES(validated_by),
  validated_at = VALUES(validated_at),
  notes = VALUES(notes);

SET @rental_ref_id := (SELECT payment_reference_id FROM payment_references WHERE provider = 'GCash' AND reference_number = 'TEST-RENTAL-0001' LIMIT 1);

UPDATE rental_bookings
SET payment_reference_id = @rental_ref_id
WHERE booking_number = 'RNT-TEST-0001';

INSERT INTO rental_pos_records (
  member_id,
  payment_reference_id,
  recorded_by,
  rental_booking_id,
  transaction_type,
  item_name,
  quantity,
  total_amount,
  transaction_status,
  transaction_date,
  notes
)
SELECT
  @maria_member_id,
  @rental_ref_id,
  @bookkeeper_id,
  @rental_booking_id,
  'Rental',
  'Farm Tractor',
  1.000,
  2300.00,
  'Paid',
  '2026-04-02',
  'Seeded rental income transaction.'
WHERE NOT EXISTS (
  SELECT 1
  FROM rental_pos_records
  WHERE rental_booking_id = @rental_booking_id
    AND transaction_type = 'Rental'
);

INSERT INTO financial_records (
  record_number,
  payment_reference_id,
  member_id,
  financial_category_id,
  recorded_by,
  approved_by,
  record_type,
  source_module,
  source_record_id,
  amount,
  record_date,
  record_status,
  remarks
)
VALUES (
  'FIN-TEST-RENTAL-0001',
  @rental_ref_id,
  @maria_member_id,
  @cat_rental,
  @bookkeeper_id,
  @chairman_id,
  'Income',
  'Rental',
  @rental_booking_id,
  2300.00,
  '2026-04-02',
  'Active',
  'Seeded rental income.'
)
ON DUPLICATE KEY UPDATE
  payment_reference_id = VALUES(payment_reference_id),
  member_id = VALUES(member_id),
  financial_category_id = VALUES(financial_category_id),
  recorded_by = VALUES(recorded_by),
  approved_by = VALUES(approved_by),
  source_record_id = VALUES(source_record_id),
  amount = VALUES(amount),
  record_date = VALUES(record_date),
  remarks = VALUES(remarks);

-- ---------------------------------------------------------------------------
-- Documents, reports, announcements, requests, and notifications
-- ---------------------------------------------------------------------------

INSERT INTO documents (
  uploaded_by,
  member_id,
  title,
  document_type,
  access_level,
  document_status,
  file_path,
  original_file_name,
  mime_type,
  file_size_bytes,
  description
)
SELECT
  @bookkeeper_id,
  @maria_member_id,
  'Seeded Share Capital Receipt',
  'Receipt',
  'Member-only',
  'Active',
  '/private/documents/test/share-capital-receipt.pdf',
  'share-capital-receipt.pdf',
  'application/pdf',
  128000,
  'Seeded receipt metadata for document access testing.'
WHERE NOT EXISTS (
  SELECT 1 FROM documents WHERE title = 'Seeded Share Capital Receipt'
);

SET @document_id := (SELECT document_id FROM documents WHERE title = 'Seeded Share Capital Receipt' LIMIT 1);

INSERT INTO document_access_logs (document_id, user_id, access_action, ip_address, user_agent)
SELECT @document_id, @bookkeeper_id, 'View', '127.0.0.1', 'TrackCOOP seed'
WHERE NOT EXISTS (
  SELECT 1
  FROM document_access_logs
  WHERE document_id = @document_id
    AND user_id = @bookkeeper_id
    AND access_action = 'View'
);

INSERT INTO reports (
  report_number,
  generated_by,
  document_id,
  report_type,
  report_period_start,
  report_period_end,
  report_period_label,
  filters_json,
  generation_status,
  file_path
)
VALUES (
  'RPT-TEST-FIN-0001',
  @bookkeeper_id,
  @document_id,
  'Financial Summary',
  '2026-03-01',
  '2026-03-31',
  'March 2026',
  JSON_OBJECT('scope', 'local-test-seed'),
  'Generated',
  '/private/reports/test/financial-summary-march-2026.pdf'
)
ON DUPLICATE KEY UPDATE
  generated_by = VALUES(generated_by),
  document_id = VALUES(document_id),
  report_type = VALUES(report_type),
  report_period_start = VALUES(report_period_start),
  report_period_end = VALUES(report_period_end),
  report_period_label = VALUES(report_period_label),
  filters_json = VALUES(filters_json),
  generation_status = VALUES(generation_status),
  file_path = VALUES(file_path);

INSERT INTO announcements (
  posted_by,
  title,
  slug,
  message,
  excerpt,
  audience_type,
  announcement_status,
  featured_image_path,
  publish_at,
  posted_at
)
VALUES (
  @chairman_id,
  'Seed Distribution Schedule',
  'seed-distribution-schedule-test',
  'Members may coordinate with the cooperative office for the seeded local test distribution schedule. This entry is intended for announcement workflow testing.',
  'Seeded announcement for local portal testing.',
  'All Members',
  'Published',
  '/images/announcements/seed-distribution.jpg',
  '2026-03-20 08:00:00',
  '2026-03-20 08:00:00'
)
ON DUPLICATE KEY UPDATE
  posted_by = VALUES(posted_by),
  title = VALUES(title),
  message = VALUES(message),
  excerpt = VALUES(excerpt),
  audience_type = VALUES(audience_type),
  announcement_status = VALUES(announcement_status),
  featured_image_path = VALUES(featured_image_path),
  publish_at = VALUES(publish_at),
  posted_at = VALUES(posted_at);

SET @announcement_id := (SELECT announcement_id FROM announcements WHERE slug = 'seed-distribution-schedule-test' LIMIT 1);

INSERT IGNORE INTO announcement_recipients (
  announcement_id,
  user_id,
  delivery_status,
  delivered_at
)
VALUES
  (@announcement_id, @bookkeeper_id, 'Delivered', '2026-03-20 08:01:00'),
  (@announcement_id, @maria_user_id, 'Delivered', '2026-03-20 08:01:00');

INSERT INTO requests_inquiries (
  reference_code,
  member_id,
  submitted_by,
  announcement_id,
  related_rental_booking_id,
  request_source,
  requester_name,
  requester_email,
  requester_phone,
  requester_barangay,
  preferred_contact_method,
  request_type,
  requested_service,
  preferred_schedule,
  subject,
  message,
  priority,
  request_status,
  assigned_to,
  consent_at
)
VALUES (
  'REQ-TEST-0001',
  @benito_member_id,
  NULL,
  @announcement_id,
  @pending_rental_booking_id,
  'Public Website',
  'Benito Cruz',
  'benito.member@trackcoop.local',
  '09170000002',
  'Wawa',
  'SMS',
  'Rental',
  'Water Pump',
  '2026-04-18 08:00:00',
  'Water pump rental request',
  'Seeded public request awaiting Chairman review and staff assignment.',
  'Normal',
  'Under Review',
  @chairman_id,
  '2026-03-22 11:00:00'
)
ON DUPLICATE KEY UPDATE
  member_id = VALUES(member_id),
  submitted_by = VALUES(submitted_by),
  announcement_id = VALUES(announcement_id),
  related_rental_booking_id = VALUES(related_rental_booking_id),
  request_source = VALUES(request_source),
  requester_name = VALUES(requester_name),
  requester_email = VALUES(requester_email),
  requester_phone = VALUES(requester_phone),
  requester_barangay = VALUES(requester_barangay),
  request_type = VALUES(request_type),
  requested_service = VALUES(requested_service),
  preferred_schedule = VALUES(preferred_schedule),
  subject = VALUES(subject),
  message = VALUES(message),
  priority = VALUES(priority),
  request_status = VALUES(request_status),
  assigned_to = VALUES(assigned_to);

SET @request_id := (SELECT request_id FROM requests_inquiries WHERE reference_code = 'REQ-TEST-0001' LIMIT 1);

INSERT INTO request_status_history (
  request_id,
  old_status,
  new_status,
  internal_note,
  user_visible_message,
  changed_by,
  changed_at
)
SELECT
  @request_id,
  'Submitted',
  'Under Review',
  'Seeded request moved into review.',
  'Your request is now being reviewed by the cooperative.',
  @chairman_id,
  '2026-03-22 11:15:00'
WHERE NOT EXISTS (
  SELECT 1
  FROM request_status_history
  WHERE request_id = @request_id
    AND new_status = 'Under Review'
);

INSERT INTO member_status_indicators (
  member_id,
  basis_period_start,
  basis_period_end,
  recency_score,
  frequency_score,
  contribution_score,
  total_score,
  status_label,
  basis_summary,
  computed_by,
  computed_at
)
SELECT
  @maria_member_id,
  '2026-01-01',
  '2026-03-31',
  5,
  4,
  5,
  14,
  'Active',
  'Seeded active indicator based on recent payments and service activity.',
  @chairman_id,
  '2026-04-01 08:00:00'
WHERE NOT EXISTS (
  SELECT 1
  FROM member_status_indicators
  WHERE member_id = @maria_member_id
    AND basis_period_start = '2026-01-01'
    AND basis_period_end = '2026-03-31'
);

INSERT INTO notifications (
  user_id,
  notification_type,
  title,
  message,
  related_entity_type,
  related_entity_id,
  is_read
)
SELECT
  @bookkeeper_id,
  'Payment',
  'Payment validation pending',
  'A seeded associate membership payment is waiting for validation.',
  'payment_references',
  @assoc_ref_id,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM notifications WHERE user_id = @bookkeeper_id AND title = 'Payment validation pending'
);

INSERT INTO notifications (
  user_id,
  notification_type,
  title,
  message,
  related_entity_type,
  related_entity_id,
  is_read
)
SELECT
  @chairman_id,
  'Request',
  'Rental request under review',
  'A seeded water pump rental request is ready for Chairman review.',
  'requests_inquiries',
  @request_id,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM notifications WHERE user_id = @chairman_id AND title = 'Rental request under review'
);

-- ---------------------------------------------------------------------------
-- Landing-content records for Chairman content editors
-- ---------------------------------------------------------------------------

INSERT INTO site_content_blocks (
  page_slug,
  section_key,
  content_type,
  title,
  body,
  value_text,
  media_path,
  display_order,
  content_status,
  updated_by,
  published_at
)
VALUES
  ('home', 'hero', 'Hero', 'Nasugbu Farmers and Fisherfolks Agriculture Cooperative', 'Seeded content block for local landing editor testing.', NULL, '/images/Hero Page/hero-1.jpg', 1, 'Published', @chairman_id, '2026-03-01 08:00:00'),
  ('home', 'numbers', 'Statistic', 'Members Assisted', 'Seeded statistic for local landing editor testing.', '120+', NULL, 1, 'Published', @chairman_id, '2026-03-01 08:00:00')
ON DUPLICATE KEY UPDATE
  content_type = VALUES(content_type),
  title = VALUES(title),
  body = VALUES(body),
  value_text = VALUES(value_text),
  media_path = VALUES(media_path),
  content_status = VALUES(content_status),
  updated_by = VALUES(updated_by),
  published_at = VALUES(published_at);

INSERT INTO services (
  service_code,
  service_type,
  title,
  short_description,
  full_description,
  requirements_text,
  image_path,
  cta_label,
  cta_url,
  public_visibility,
  service_status,
  display_order,
  created_by
)
VALUES
  ('SVC-MEMBERSHIP-TEST', 'Membership', 'Membership Assistance', 'Support for cooperative membership applications and records.', 'Seeded service record for landing admin testing.', 'Valid contact details and cooperative application information.', '/images/services/membership.jpg', 'Start Inquiry', '/contact', 1, 'Active', 1, @chairman_id),
  ('SVC-RENTAL-TEST', 'Rental', 'Farm Equipment Access', 'Shared equipment access for approved cooperative work.', 'Seeded rental service record for landing admin testing.', 'Approved schedule and confirmed availability.', '/images/services/rental.jpg', 'View Rentals', '/rental', 1, 'Active', 2, @chairman_id)
ON DUPLICATE KEY UPDATE
  service_type = VALUES(service_type),
  title = VALUES(title),
  short_description = VALUES(short_description),
  full_description = VALUES(full_description),
  requirements_text = VALUES(requirements_text),
  image_path = VALUES(image_path),
  cta_label = VALUES(cta_label),
  cta_url = VALUES(cta_url),
  public_visibility = VALUES(public_visibility),
  service_status = VALUES(service_status),
  display_order = VALUES(display_order),
  created_by = VALUES(created_by);

INSERT INTO programs_projects (
  title,
  category,
  summary,
  description,
  start_date,
  end_date,
  location,
  image_path,
  public_visibility,
  status,
  display_order,
  created_by
)
SELECT
  'Seedling Nursery Support',
  'Agriculture',
  'Shared growing support for resilient crop cycles.',
  'Seeded project record for landing project editor testing.',
  '2026-02-01',
  '2026-05-31',
  'Nasugbu, Batangas',
  '/images/projects/seedling-nursery.jpg',
  1,
  'Ongoing',
  1,
  @chairman_id
WHERE NOT EXISTS (SELECT 1 FROM programs_projects WHERE title = 'Seedling Nursery Support');

INSERT INTO partners_certifications (
  record_type,
  name,
  description,
  logo_path,
  external_url,
  issued_date,
  expiration_date,
  public_visibility,
  status,
  display_order,
  created_by
)
SELECT
  'Certification',
  'Seeded Certificate of Compliance',
  'Seeded certification metadata for landing admin testing.',
  '/images/certifications/compliance.jpg',
  NULL,
  '2026-01-01',
  '2026-12-31',
  1,
  'Active',
  1,
  @chairman_id
WHERE NOT EXISTS (SELECT 1 FROM partners_certifications WHERE name = 'Seeded Certificate of Compliance');

INSERT INTO gallery_items (
  title,
  caption,
  category,
  image_path,
  thumbnail_path,
  activity_date,
  location,
  alt_text,
  public_visibility,
  gallery_status,
  display_order,
  uploaded_by,
  published_at
)
SELECT
  'Seeded Cooperative Meeting',
  'Seeded gallery item for local content testing.',
  'Meeting',
  '/images/announcement/post-1-1.jpg',
  '/images/announcement/post-1-1.jpg',
  '2026-03-23',
  'Nasugbu, Batangas',
  'Cooperative meeting with members and students',
  1,
  'Published',
  1,
  @chairman_id,
  '2026-03-23 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM gallery_items WHERE title = 'Seeded Cooperative Meeting');

-- ---------------------------------------------------------------------------

INSERT INTO audit_logs (
  user_id,
  action,
  entity_table,
  record_id,
  description,
  new_values,
  ip_address,
  user_agent
)
VALUES (
  @chairman_id,
  'seed.testing_data.loaded',
  'membership_applications',
  NULL,
  'Loaded focused testing data: one Chairman, one Bookkeeper, three approved members, and seven in-process applications.',
  JSON_OBJECT(
    'chairmen', 1,
    'bookkeepers', 1,
    'approvedMembers', 3,
    'inProcessApplications', 7
  ),
  '127.0.0.1',
  'TrackCOOP seed'
);

COMMIT;
