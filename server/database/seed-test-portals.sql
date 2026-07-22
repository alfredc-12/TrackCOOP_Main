-- TrackCOOP local test data for Chairman and Bookkeeper portal checks.
-- Run manually after importing TrackCOOP_Table_Reference_Only.sql.
--
-- This seed is idempotent and does not delete existing data.
-- It creates local test accounts with bcrypt password hashes.
--
-- Local test sign-ins:
--   chairman.test@trackcoop.local   / ChairmanTest123!
--   bookkeeper.test@trackcoop.local / BookkeeperTest123!
--   member.test@trackcoop.local     / MemberTest123!

SET NAMES utf8mb4;
SET time_zone = '+08:00';

START TRANSACTION;

-- ---------------------------------------------------------------------------
-- Reference roles, financial categories, and system settings
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
  ('membership', 'maximum_share_capital', '15000.00', 'Number', 'Maximum validated member share capital in Philippine pesos.', 0)
ON DUPLICATE KEY UPDATE
  setting_group = VALUES(setting_group),
  setting_value = VALUES(setting_value),
  value_type = VALUES(value_type),
  description = VALUES(description),
  is_public = VALUES(is_public);

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
    'member.test',
    'member.test@trackcoop.local',
    '$2b$10$x2Z7f3vBR7htFis/ajCZ7.1mSoaCIUdvZyV6XJgxOoBkzEBhH4ZHy',
    'Maria Santos',
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
SET @member_user_id := (SELECT user_id FROM users WHERE email = 'member.test@trackcoop.local' LIMIT 1);

-- ---------------------------------------------------------------------------
-- Members and status history
-- ---------------------------------------------------------------------------

INSERT INTO member_profiles (
  user_id,
  member_code,
  full_name,
  contact_number,
  email,
  barangay,
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
    @member_user_id,
    'NFFAC-TM-0001',
    'Maria Santos',
    '09171234567',
    'member.test@trackcoop.local',
    'Lumbangan',
    'Rice Farming',
    'True Member',
    'Approved',
    'Active',
    '2026-01-15',
    @chairman_id,
    '2026-01-20 09:00:00',
    '2026-02-01',
    '2026-12-31',
    'Seeded member for Chairman and Bookkeeper portal testing.'
  ),
  (
    NULL,
    'NFFAC-AM-0002',
    'Juan Dela Cruz',
    '09179876543',
    'juan.seed@example.local',
    'Wawa',
    'Fisherfolk',
    'Associate',
    'Pending',
    'Pending',
    '2026-03-05',
    NULL,
    NULL,
    NULL,
    NULL,
    'Pending associate member for approval workflow testing.'
  )
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  contact_number = VALUES(contact_number),
  email = VALUES(email),
  barangay = VALUES(barangay),
  sector = VALUES(sector),
  membership_type = VALUES(membership_type),
  approval_status = VALUES(approval_status),
  official_member_status = VALUES(official_member_status),
  approved_by = VALUES(approved_by),
  approved_at = VALUES(approved_at),
  true_member_since = VALUES(true_member_since),
  share_capital_deadline = VALUES(share_capital_deadline),
  notes = VALUES(notes);

SET @member_id := (SELECT member_id FROM member_profiles WHERE member_code = 'NFFAC-TM-0001' LIMIT 1);
SET @associate_member_id := (SELECT member_id FROM member_profiles WHERE member_code = 'NFFAC-AM-0002' LIMIT 1);

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
SELECT
  @member_id,
  'Associate',
  'True Member',
  'Pending',
  'Active',
  'Initial seeded approval and true-member classification.',
  @chairman_id,
  '2026-02-01 09:30:00'
WHERE NOT EXISTS (
  SELECT 1
  FROM member_status_history
  WHERE member_id = @member_id
    AND changed_by = @chairman_id
    AND new_membership_type = 'True Member'
    AND new_official_status = 'Active'
);

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
SELECT
  @associate_member_id,
  NULL,
  'Associate',
  NULL,
  'Pending',
  'Initial seeded associate application.',
  @chairman_id,
  '2026-03-05 10:15:00'
WHERE NOT EXISTS (
  SELECT 1
  FROM member_status_history
  WHERE member_id = @associate_member_id
    AND changed_by = @chairman_id
    AND new_official_status = 'Pending'
);

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
    @member_id,
    @member_user_id,
    'Maria Santos',
    'member.test@trackcoop.local',
    '09171234567',
    'GCash',
    'TEST-SHARE-0001',
    'Share Capital',
    'member_profiles',
    @member_id,
    1500.00,
    '/private/uploads/test/share-capital-0001.jpg',
    'Validated',
    @bookkeeper_id,
    '2026-02-05 14:00:00',
    'Initial share-capital payment for seeded true member.',
    '2026-02-05 10:00:00'
  ),
  (
    @associate_member_id,
    NULL,
    'Juan Dela Cruz',
    'juan.seed@example.local',
    '09179876543',
    'GCash',
    'TEST-ASSOC-0002',
    'Associate Membership Fee',
    'member_profiles',
    @associate_member_id,
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
  @member_id,
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
  WHERE member_id = @member_id
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
  ('FIN-TEST-SHARE-0001', @share_ref_id, @member_id, @cat_share, @bookkeeper_id, @chairman_id, 'Income', 'Share Capital', @share_ref_id, 1500.00, '2026-02-05', 'Active', 'Seeded share-capital ledger entry.'),
  ('FIN-TEST-ASSOC-0002', @assoc_ref_id, @associate_member_id, @cat_assoc, @bookkeeper_id, NULL, 'Income', 'Membership', @assoc_ref_id, 200.00, '2026-03-06', 'Active', 'Seeded pending associate fee ledger entry.'),
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
  @member_id,
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
  @member_id,
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
  ('RNT-TEST-0001', @tractor_asset_id, @member_id, 'Maria Santos', '09171234567', 'Rice field land preparation in Lumbangan.', '2026-04-10 08:00:00', '2026-04-10 17:00:00', 'Scheduled', 1800.00, 500.00, 2300.00, 'Paid', @chairman_id, '2026-04-01 09:00:00', @chairman_id),
  ('RNT-TEST-0002', @pump_asset_id, @associate_member_id, 'Juan Dela Cruz', '09179876543', 'Irrigation support request awaiting review.', '2026-04-18 08:00:00', '2026-04-18 17:00:00', 'Pending', 650.00, 250.00, 900.00, 'Unpaid', NULL, NULL, @chairman_id)
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
  @member_id,
  @member_user_id,
  'Maria Santos',
  'member.test@trackcoop.local',
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
  @member_id,
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
  @member_id,
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
  @member_id,
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
  (@announcement_id, @member_user_id, 'Delivered', '2026-03-20 08:01:00');

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
  @associate_member_id,
  NULL,
  @announcement_id,
  @pending_rental_booking_id,
  'Public Website',
  'Juan Dela Cruz',
  'juan.seed@example.local',
  '09179876543',
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
  @member_id,
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
  WHERE member_id = @member_id
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
-- Audit entries for accountability views
-- ---------------------------------------------------------------------------

INSERT INTO audit_logs (
  user_id,
  action,
  entity_table,
  record_id,
  description,
  old_values,
  new_values,
  ip_address,
  user_agent,
  action_time
)
SELECT
  @chairman_id,
  'Seed Test Data',
  'users',
  @chairman_id,
  'Local test data was seeded for Chairman and Bookkeeper portal checks.',
  NULL,
  JSON_OBJECT('seed', 'seed-test-portals.sql'),
  '127.0.0.1',
  'TrackCOOP seed',
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM audit_logs
  WHERE action = 'Seed Test Data'
    AND entity_table = 'users'
    AND record_id = @chairman_id
);

COMMIT;
