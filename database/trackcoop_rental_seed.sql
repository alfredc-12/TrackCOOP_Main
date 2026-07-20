-- TrackCOOP rental module seed data.
-- Run after importing TrackCOOP_RDS_phpMyAdmin_Compatible_v4.sql into the target database.

SET NAMES utf8mb4;
SET time_zone = '+08:00';

SET @chairman_role_id := (SELECT role_id FROM roles WHERE role_slug = 'chairman_admin' LIMIT 1);
SET @admin_hash := '$2y$10$trackcoopplaceholderhashnotforlogin0000000000000000000000';

INSERT INTO users (role_id, username, email, password_hash, display_name, account_status, email_verified_at)
VALUES (@chairman_role_id, 'trackcoop_admin', 'admin@trackcoop.local', @admin_hash, 'TrackCOOP Admin', 'Active', '2026-07-12 08:00:00')
ON DUPLICATE KEY UPDATE
    role_id = VALUES(role_id),
    display_name = VALUES(display_name),
    account_status = VALUES(account_status);

SET @admin_user_id := (SELECT user_id FROM users WHERE email = 'admin@trackcoop.local' LIMIT 1);

INSERT INTO member_profiles
    (member_code, full_name, contact_number, email, barangay, municipality, province, membership_type, approval_status, official_member_status, application_date, approved_by, approved_at, notes)
VALUES
    ('MEM-2024-0081', 'Juan Dela Cruz', '09171234567', 'juan@example.test', 'Lumbangan', 'Nasugbu', 'Batangas', 'True Member', 'Approved', 'Active', '2024-02-10', @admin_user_id, '2024-02-15 09:00:00', 'Seed member for rental module testing.'),
    ('MEM-2025-0042', 'Pedro Reyes', '09191234567', NULL, 'Bucana', 'Nasugbu', 'Batangas', 'Associate', 'Approved', 'Active', '2025-01-20', @admin_user_id, '2025-01-25 09:00:00', 'Seed member for rental module testing.'),
    ('MEM-2023-0117', 'Ramon Bautista', '09211234567', NULL, 'Banilad', 'Nasugbu', 'Batangas', 'True Member', 'Approved', 'Active', '2023-08-14', @admin_user_id, '2023-08-20 09:00:00', 'Seed member for rental module testing.')
ON DUPLICATE KEY UPDATE
    full_name = VALUES(full_name),
    contact_number = VALUES(contact_number),
    email = VALUES(email),
    barangay = VALUES(barangay),
    municipality = VALUES(municipality),
    province = VALUES(province),
    membership_type = VALUES(membership_type),
    approval_status = VALUES(approval_status),
    official_member_status = VALUES(official_member_status),
    notes = VALUES(notes);

INSERT INTO rental_assets
    (asset_code, asset_name, asset_type, category, description, rate_amount, rate_unit, deposit_amount, asset_status, public_visibility, created_by, created_at, updated_at)
VALUES
    ('SVC-TRC-001', 'Farm Tractor', 'Equipment', 'Land Preparation',
     '{"shortDescription":"Heavy field preparation support for qualified farm areas.","description":"A cooperative-managed farm tractor for plowing and primary land preparation, subject to site, operator, and schedule review.","availability":"By Schedule Only","operationalStatus":"Ready for Use","visibility":"Public","unitOfUsage":"Operating session","suitableActivity":"Plowing and land preparation","capacity":"Confirmed after site review","serviceArea":"Approved areas within Nasugbu","operatorRequirement":"Cooperative operator confirmation required","operationalNotes":"Final operating arrangements are confirmed during cooperative review.","safetyReminders":["Follow the assigned operator safety briefing.","Keep children and bystanders away from the operating area.","Report unsafe ground or weather conditions before operation."],"lastMaintenanceDate":"2026-06-28"}',
     NULL, 'Custom', 0.00, 'Reserved', 1, @admin_user_id, '2026-07-12 09:00:00', '2026-07-12 09:00:00'),
    ('SVC-HTR-002', 'Hand Tractor', 'Equipment', 'Land Preparation',
     '{"shortDescription":"Compact land preparation for smaller and accessible plots.","description":"A compact hand tractor suitable for smaller plots where access and ground conditions allow safe operation.","availability":"Available","operationalStatus":"Ready for Use","visibility":"Public","unitOfUsage":"Operating session","suitableActivity":"Tilling smaller farm plots","capacity":"Site dependent","serviceArea":"Nasugbu service barangays","operatorRequirement":"Cooperative operator confirmation required","operationalNotes":"Final operating arrangements are confirmed during cooperative review.","safetyReminders":["Follow the assigned operator safety briefing.","Keep children and bystanders away from the operating area.","Report unsafe ground or weather conditions before operation."],"lastMaintenanceDate":"2026-06-28"}',
     NULL, 'Custom', 0.00, 'Available', 1, @admin_user_id, '2026-07-12 09:00:00', '2026-07-12 09:00:00'),
    ('SVC-WPM-003', 'Water Pump', 'Equipment', 'Irrigation',
     '{"shortDescription":"Portable water movement support for approved agricultural use.","description":"A portable water pump for irrigation and agricultural water transfer, with setup requirements reviewed by NFFAC.","availability":"Limited Availability","operationalStatus":"Ready for Use","visibility":"Public","unitOfUsage":"Scheduled use","suitableActivity":"Irrigation and agricultural water transfer","capacity":"Confirmed during inquiry review","serviceArea":"Accessible locations within Nasugbu","operatorRequirement":"Cooperative operator confirmation required","operationalNotes":"Final operating arrangements are confirmed during cooperative review.","safetyReminders":["Follow the assigned operator safety briefing.","Keep children and bystanders away from the operating area.","Report unsafe ground or weather conditions before operation."],"lastMaintenanceDate":"2026-06-28"}',
     NULL, 'Custom', 0.00, 'Reserved', 1, @admin_user_id, '2026-07-12 09:00:00', '2026-07-12 09:00:00'),
    ('SVC-GRC-004', 'Grass Cutter', 'Equipment', 'Field Maintenance',
     '{"shortDescription":"Field-edge and vegetation clearing support.","description":"Grass cutting equipment for farm maintenance, subject to terrain inspection and operator availability.","availability":"Available","operationalStatus":"Ready for Use","visibility":"Public","unitOfUsage":"Operating session","suitableActivity":"Vegetation and field-edge clearing","capacity":"Location dependent","serviceArea":"Nasugbu service barangays","operatorRequirement":"Cooperative operator confirmation required","operationalNotes":"Final operating arrangements are confirmed during cooperative review.","safetyReminders":["Follow the assigned operator safety briefing.","Keep children and bystanders away from the operating area.","Report unsafe ground or weather conditions before operation."],"lastMaintenanceDate":"2026-06-28"}',
     NULL, 'Custom', 0.00, 'Available', 1, @admin_user_id, '2026-07-12 09:00:00', '2026-07-12 09:00:00'),
    ('SVC-FTL-005', 'Farm Trailer', 'Equipment', 'Transport',
     '{"shortDescription":"Short-distance hauling support for farm materials and produce.","description":"A farm trailer for approved agricultural hauling, paired with suitable towing equipment and route review.","availability":"By Schedule Only","operationalStatus":"Ready for Use","visibility":"Public","unitOfUsage":"Scheduled trip","suitableActivity":"Farm materials and produce hauling","capacity":"Load subject to cooperative review","serviceArea":"Approved Nasugbu routes","operatorRequirement":"Cooperative operator confirmation required","operationalNotes":"Final operating arrangements are confirmed during cooperative review.","safetyReminders":["Follow the assigned operator safety briefing.","Keep children and bystanders away from the operating area.","Report unsafe ground or weather conditions before operation."],"lastMaintenanceDate":"2026-06-28"}',
     NULL, 'Custom', 0.00, 'Reserved', 1, @admin_user_id, '2026-07-12 09:00:00', '2026-07-12 09:00:00'),
    ('SVC-PSP-006', 'Portable Sprayer', 'Equipment', 'Crop Care',
     '{"shortDescription":"Portable application equipment for approved crop-care activities.","description":"A portable sprayer available for approved agricultural applications with required safety controls.","availability":"Available","operationalStatus":"Ready for Use","visibility":"Public","unitOfUsage":"Scheduled use","suitableActivity":"Crop-care application","capacity":"Application dependent","serviceArea":"Nasugbu service barangays","operatorRequirement":"Cooperative operator confirmation required","operationalNotes":"Final operating arrangements are confirmed during cooperative review.","safetyReminders":["Follow the assigned operator safety briefing.","Keep children and bystanders away from the operating area.","Report unsafe ground or weather conditions before operation."],"lastMaintenanceDate":"2026-06-28"}',
     NULL, 'Custom', 0.00, 'Available', 1, @admin_user_id, '2026-07-12 09:00:00', '2026-07-12 09:00:00'),
    ('SVC-ATS-007', 'Agricultural Transport Service', 'Service', 'Transport',
     '{"shortDescription":"Coordinated agricultural transport for approved cooperative needs.","description":"A scheduled transport service for agricultural materials or produce, subject to route and load validation.","availability":"Limited Availability","operationalStatus":"Ready for Use","visibility":"Public","unitOfUsage":"Approved trip","suitableActivity":"Agricultural logistics","capacity":"Vehicle and route dependent","serviceArea":"Approved routes in and around Nasugbu","operatorRequirement":"Cooperative operator confirmation required","operationalNotes":"Final operating arrangements are confirmed during cooperative review.","safetyReminders":["Follow the assigned operator safety briefing.","Keep children and bystanders away from the operating area.","Report unsafe ground or weather conditions before operation."],"lastMaintenanceDate":"2026-06-28"}',
     NULL, 'Custom', 0.00, 'Reserved', 1, @admin_user_id, '2026-07-12 09:00:00', '2026-07-12 09:00:00')
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
    updated_at = VALUES(updated_at);

INSERT INTO rental_bookings
    (booking_number, rental_asset_id, member_id, requester_name, requester_contact, purpose, start_datetime, end_datetime, booking_status, rate_amount, deposit_amount, additional_charges, discount_amount, total_amount, payment_status, approved_by, approved_at, recorded_by, completed_at, cancellation_reason, completion_notes, created_at, updated_at)
SELECT 'RNT-2026-0041', a.rental_asset_id, m.member_id, 'Juan Dela Cruz', '09171234567',
       '{"scheduleId":"SCH-0041","requesterType":"Member","memberCode":"MEM-2024-0081","email":"juan@example.test","completeAddress":"Purok 2, Lumbangan, Nasugbu, Batangas","barangay":"Lumbangan","municipality":"Nasugbu","preferredContactMethod":"SMS","intendedUse":"Land preparation","preferredDate":"2026-07-18","alternativeDate":"2026-07-19","preferredStartTime":"08:00","estimatedDuration":"4 hours","estimatedUsage":"1.5 hectares","unitOfMeasurement":"Hectares","serviceLocation":"Lumbangan farm lot","serviceBarangay":"Lumbangan","requestDescription":"Prepare the field for the next planting cycle.","specialInstructions":"Please confirm road access before dispatch.","additionalNotes":"Available by phone after 3 PM.","attachmentNames":[],"scheduleStatus":"Confirmed","assignedReviewer":"TrackCOOP Admin","publicNote":"Your request is being coordinated with the equipment schedule."}',
       '2026-07-18 08:00:00', '2026-07-18 12:00:00', 'Scheduled', NULL, 0.00, 0.00, 0.00, 4500.00, 'Paid', @admin_user_id, '2026-07-12 10:30:00', @admin_user_id, NULL, NULL, NULL, '2026-07-10 09:20:00', '2026-07-12 10:30:00'
FROM rental_assets a
LEFT JOIN member_profiles m ON m.member_code = 'MEM-2024-0081'
WHERE a.asset_code = 'SVC-TRC-001'
ON DUPLICATE KEY UPDATE
    rental_asset_id = VALUES(rental_asset_id), member_id = VALUES(member_id), requester_name = VALUES(requester_name), requester_contact = VALUES(requester_contact), purpose = VALUES(purpose), start_datetime = VALUES(start_datetime), end_datetime = VALUES(end_datetime), booking_status = VALUES(booking_status), total_amount = VALUES(total_amount), payment_status = VALUES(payment_status), approved_by = VALUES(approved_by), approved_at = VALUES(approved_at), recorded_by = VALUES(recorded_by), completed_at = VALUES(completed_at), updated_at = VALUES(updated_at);

INSERT INTO rental_bookings
    (booking_number, rental_asset_id, member_id, requester_name, requester_contact, purpose, start_datetime, end_datetime, booking_status, rate_amount, deposit_amount, additional_charges, discount_amount, total_amount, payment_status, approved_by, approved_at, recorded_by, completed_at, cancellation_reason, completion_notes, created_at, updated_at)
SELECT 'RNT-2026-0042', a.rental_asset_id, NULL, 'Maria Santos', '09181234567',
       '{"requesterType":"Public or Non-member","email":"maria@example.test","completeAddress":"Wawa, Nasugbu, Batangas","barangay":"Wawa","municipality":"Nasugbu","preferredContactMethod":"Phone","intendedUse":"Irrigation","preferredDate":"2026-07-21","alternativeDate":"2026-07-19","preferredStartTime":"08:00","estimatedDuration":"4 hours","estimatedUsage":"1.5 hectares","unitOfMeasurement":"Hectares","serviceLocation":"Riverside farm, Wawa","serviceBarangay":"Wawa","requestDescription":"Prepare the field for the next planting cycle.","specialInstructions":"Please confirm road access before dispatch.","additionalNotes":"Available by phone after 3 PM.","attachmentNames":[],"scheduleStatus":"Not scheduled","assignedReviewer":"TrackCOOP Admin","publicNote":"NFFAC is reviewing service availability."}',
       '2026-07-21 08:00:00', '2026-07-21 12:00:00', 'Pending', NULL, 0.00, 0.00, 0.00, 0.00, 'Unpaid', NULL, NULL, @admin_user_id, NULL, NULL, NULL, '2026-07-10 09:20:00', '2026-07-12 10:30:00'
FROM rental_assets a
WHERE a.asset_code = 'SVC-WPM-003'
ON DUPLICATE KEY UPDATE
    rental_asset_id = VALUES(rental_asset_id), member_id = VALUES(member_id), requester_name = VALUES(requester_name), requester_contact = VALUES(requester_contact), purpose = VALUES(purpose), start_datetime = VALUES(start_datetime), end_datetime = VALUES(end_datetime), booking_status = VALUES(booking_status), total_amount = VALUES(total_amount), payment_status = VALUES(payment_status), approved_by = VALUES(approved_by), approved_at = VALUES(approved_at), recorded_by = VALUES(recorded_by), completed_at = VALUES(completed_at), updated_at = VALUES(updated_at);

INSERT INTO rental_bookings
    (booking_number, rental_asset_id, member_id, requester_name, requester_contact, purpose, start_datetime, end_datetime, booking_status, rate_amount, deposit_amount, additional_charges, discount_amount, total_amount, payment_status, approved_by, approved_at, recorded_by, completed_at, cancellation_reason, completion_notes, created_at, updated_at)
SELECT 'RNT-2026-0043', a.rental_asset_id, m.member_id, 'Pedro Reyes', '09191234567',
       '{"requesterType":"Member","memberCode":"MEM-2025-0042","completeAddress":"Bucana, Nasugbu, Batangas","barangay":"Bucana","municipality":"Nasugbu","preferredContactMethod":"SMS","intendedUse":"Land preparation","preferredDate":"2026-07-08","alternativeDate":"2026-07-19","preferredStartTime":"08:00","estimatedDuration":"4 hours","estimatedUsage":"1.5 hectares","unitOfMeasurement":"Hectares","serviceLocation":"Sitio Maligaya farm lot","serviceBarangay":"Bucana","requestDescription":"Prepare the field for the next planting cycle.","specialInstructions":"Please confirm road access before dispatch.","additionalNotes":"Available by phone after 3 PM.","attachmentNames":[],"scheduleStatus":"Completed","assignedReviewer":"TrackCOOP Admin","publicNote":"Rental completed. Your receipt is available."}',
       '2026-07-08 08:00:00', '2026-07-08 12:00:00', 'Completed', NULL, 0.00, 0.00, 0.00, 0.00, 'Paid', @admin_user_id, '2026-07-08 10:30:00', @admin_user_id, '2026-07-08 12:00:00', NULL, 'Rental completed.', '2026-07-10 09:20:00', '2026-07-12 10:30:00'
FROM rental_assets a
LEFT JOIN member_profiles m ON m.member_code = 'MEM-2025-0042'
WHERE a.asset_code = 'SVC-GRC-004'
ON DUPLICATE KEY UPDATE
    rental_asset_id = VALUES(rental_asset_id), member_id = VALUES(member_id), requester_name = VALUES(requester_name), requester_contact = VALUES(requester_contact), purpose = VALUES(purpose), start_datetime = VALUES(start_datetime), end_datetime = VALUES(end_datetime), booking_status = VALUES(booking_status), total_amount = VALUES(total_amount), payment_status = VALUES(payment_status), approved_by = VALUES(approved_by), approved_at = VALUES(approved_at), recorded_by = VALUES(recorded_by), completed_at = VALUES(completed_at), updated_at = VALUES(updated_at);

INSERT INTO rental_bookings
    (booking_number, rental_asset_id, member_id, requester_name, requester_contact, purpose, start_datetime, end_datetime, booking_status, rate_amount, deposit_amount, additional_charges, discount_amount, total_amount, payment_status, approved_by, approved_at, recorded_by, completed_at, cancellation_reason, completion_notes, created_at, updated_at)
SELECT 'RNT-2026-0044', a.rental_asset_id, NULL, 'Ana Mendoza', '09201234567',
       '{"scheduleId":"SCH-0044","requesterType":"Public or Non-member","completeAddress":"Aga, Nasugbu, Batangas","barangay":"Aga","municipality":"Nasugbu","preferredContactMethod":"Phone","intendedUse":"Land preparation","preferredDate":"2026-07-22","alternativeDate":"2026-07-19","preferredStartTime":"09:00","estimatedDuration":"2 hours","estimatedUsage":"1.5 hectares","unitOfMeasurement":"Hectares","serviceLocation":"Aga collection point","serviceBarangay":"Aga","requestDescription":"Prepare the field for the next planting cycle.","specialInstructions":"Please confirm road access before dispatch.","additionalNotes":"Available by phone after 3 PM.","attachmentNames":[],"scheduleStatus":"Proposed","assignedReviewer":"TrackCOOP Admin","publicNote":"A proposed schedule is ready for confirmation."}',
       '2026-07-22 09:00:00', '2026-07-22 11:00:00', 'Approved', NULL, 0.00, 0.00, 0.00, 0.00, 'Unpaid', @admin_user_id, '2026-07-12 10:30:00', @admin_user_id, NULL, NULL, NULL, '2026-07-10 09:20:00', '2026-07-12 10:30:00'
FROM rental_assets a
WHERE a.asset_code = 'SVC-FTL-005'
ON DUPLICATE KEY UPDATE
    rental_asset_id = VALUES(rental_asset_id), member_id = VALUES(member_id), requester_name = VALUES(requester_name), requester_contact = VALUES(requester_contact), purpose = VALUES(purpose), start_datetime = VALUES(start_datetime), end_datetime = VALUES(end_datetime), booking_status = VALUES(booking_status), total_amount = VALUES(total_amount), payment_status = VALUES(payment_status), approved_by = VALUES(approved_by), approved_at = VALUES(approved_at), recorded_by = VALUES(recorded_by), completed_at = VALUES(completed_at), updated_at = VALUES(updated_at);

INSERT INTO rental_bookings
    (booking_number, rental_asset_id, member_id, requester_name, requester_contact, purpose, start_datetime, end_datetime, booking_status, rate_amount, deposit_amount, additional_charges, discount_amount, total_amount, payment_status, approved_by, approved_at, recorded_by, completed_at, cancellation_reason, completion_notes, created_at, updated_at)
SELECT 'RNT-2026-0045', a.rental_asset_id, m.member_id, 'Ramon Bautista', '09211234567',
       '{"requesterType":"Member","memberCode":"MEM-2023-0117","completeAddress":"Banilad, Nasugbu, Batangas","barangay":"Banilad","municipality":"Nasugbu","preferredContactMethod":"SMS","intendedUse":"Land preparation","preferredDate":"2026-07-24","alternativeDate":"2026-07-19","preferredStartTime":"08:00","estimatedDuration":"4 hours","estimatedUsage":"1.5 hectares","unitOfMeasurement":"Hectares","serviceLocation":"Sitio Maligaya farm lot","serviceBarangay":"Banilad","requestDescription":"Prepare the field for the next planting cycle.","specialInstructions":"Please confirm road access before dispatch.","additionalNotes":"Available by phone after 3 PM.","attachmentNames":[],"scheduleStatus":"Awaiting payment","assignedReviewer":"TrackCOOP Admin","publicNote":"Your payment proof is being validated."}',
       '2026-07-24 08:00:00', '2026-07-24 12:00:00', 'Approved', NULL, 0.00, 0.00, 0.00, 750.00, 'Partially Paid', @admin_user_id, '2026-07-12 10:30:00', @admin_user_id, NULL, NULL, NULL, '2026-07-10 09:20:00', '2026-07-12 10:30:00'
FROM rental_assets a
LEFT JOIN member_profiles m ON m.member_code = 'MEM-2023-0117'
WHERE a.asset_code = 'SVC-PSP-006'
ON DUPLICATE KEY UPDATE
    rental_asset_id = VALUES(rental_asset_id), member_id = VALUES(member_id), requester_name = VALUES(requester_name), requester_contact = VALUES(requester_contact), purpose = VALUES(purpose), start_datetime = VALUES(start_datetime), end_datetime = VALUES(end_datetime), booking_status = VALUES(booking_status), total_amount = VALUES(total_amount), payment_status = VALUES(payment_status), approved_by = VALUES(approved_by), approved_at = VALUES(approved_at), recorded_by = VALUES(recorded_by), completed_at = VALUES(completed_at), updated_at = VALUES(updated_at);

INSERT INTO rental_bookings
    (booking_number, rental_asset_id, member_id, requester_name, requester_contact, purpose, start_datetime, end_datetime, booking_status, rate_amount, deposit_amount, additional_charges, discount_amount, total_amount, payment_status, approved_by, approved_at, recorded_by, completed_at, cancellation_reason, completion_notes, created_at, updated_at)
SELECT 'MAINTENANCE-WPM-20260720', a.rental_asset_id, NULL, 'NFFAC Maintenance', NULL,
       '{"scheduleId":"SCH-MNT-01","requesterType":"Member","serviceLocation":"NFFAC equipment yard","serviceBarangay":"Bilaran","scheduleStatus":"Maintenance","assignedOperator":"NFFAC Maintenance","publicNote":"Water Pump maintenance block."}',
       '2026-07-20 08:00:00', '2026-07-20 12:00:00', 'Scheduled', NULL, 0.00, 0.00, 0.00, 0.00, 'Unpaid', @admin_user_id, '2026-07-12 10:30:00', @admin_user_id, NULL, NULL, 'Maintenance schedule block.', '2026-07-12 10:30:00', '2026-07-12 10:30:00'
FROM rental_assets a
WHERE a.asset_code = 'SVC-WPM-003'
ON DUPLICATE KEY UPDATE
    rental_asset_id = VALUES(rental_asset_id), requester_name = VALUES(requester_name), requester_contact = VALUES(requester_contact), purpose = VALUES(purpose), start_datetime = VALUES(start_datetime), end_datetime = VALUES(end_datetime), booking_status = VALUES(booking_status), payment_status = VALUES(payment_status), approved_by = VALUES(approved_by), approved_at = VALUES(approved_at), recorded_by = VALUES(recorded_by), completion_notes = VALUES(completion_notes), updated_at = VALUES(updated_at);

INSERT INTO payment_references
    (member_id, submitted_by, payer_name, payer_email, payer_contact, provider, reference_number, payment_purpose, related_entity_type, related_entity_id, amount, proof_file_path, validation_status, validated_by, validated_at, notes, submitted_at, updated_at)
SELECT rb.member_id, NULL, rb.requester_name, 'juan@example.test', rb.requester_contact, 'Direct GCash', 'GCASH-814729104', 'Rental', 'rental_bookings', rb.rental_booking_id, 4500.00, 'payment-proof-0041.jpg', 'Validated', @admin_user_id, '2026-07-12 10:00:00',
       '{"seed":"trackcoop-rental-seed","paymentId":"PAY-0041","receiptNumber":"OR-RNT-0041","recordedBy":"NFFAC Bookkeeper","status":"Paid","paymentDate":"2026-07-12","scheduleDate":"2026-07-18","paymentMethod":"Direct GCash","notes":"Demonstration transaction record; not an official rental rate."}',
       '2026-07-12 10:00:00', '2026-07-12 10:00:00'
FROM rental_bookings rb
WHERE rb.booking_number = 'RNT-2026-0041'
ON DUPLICATE KEY UPDATE
    member_id = VALUES(member_id),
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

INSERT INTO payment_references
    (member_id, submitted_by, payer_name, payer_email, payer_contact, provider, reference_number, payment_purpose, related_entity_type, related_entity_id, amount, proof_file_path, validation_status, validated_by, validated_at, notes, submitted_at, updated_at)
SELECT rb.member_id, NULL, rb.requester_name, NULL, rb.requester_contact, 'GCash Reference Upload', 'GCASH-550921870', 'Rental', 'rental_bookings', rb.rental_booking_id, 750.00, 'proof-0045.pdf', 'Pending', NULL, NULL,
       '{"seed":"trackcoop-rental-seed","paymentId":"PAY-0045","recordedBy":"Member upload","status":"Under Review","paymentDate":"2026-07-12","scheduleDate":"2026-07-24","paymentMethod":"GCash Reference Upload","notes":"Demonstration transaction record; validation pending."}',
       '2026-07-12 14:35:00', '2026-07-12 14:35:00'
FROM rental_bookings rb
WHERE rb.booking_number = 'RNT-2026-0045'
ON DUPLICATE KEY UPDATE
    member_id = VALUES(member_id),
    payer_name = VALUES(payer_name),
    payer_email = VALUES(payer_email),
    payer_contact = VALUES(payer_contact),
    payment_purpose = VALUES(payment_purpose),
    related_entity_type = VALUES(related_entity_type),
    related_entity_id = VALUES(related_entity_id),
    amount = VALUES(amount),
    proof_file_path = VALUES(proof_file_path),
    validation_status = VALUES(validation_status),
    notes = VALUES(notes);

UPDATE rental_bookings rb
JOIN payment_references pr ON pr.related_entity_type = 'rental_bookings'
    AND pr.related_entity_id = rb.rental_booking_id
    AND pr.payment_purpose = 'Rental'
SET rb.payment_reference_id = pr.payment_reference_id
WHERE rb.booking_number IN ('RNT-2026-0041', 'RNT-2026-0045');

DELETE FROM rental_status_history
WHERE remarks LIKE '%trackcoop-rental-seed%';

INSERT INTO rental_status_history (rental_booking_id, old_status, new_status, remarks, changed_by, changed_at)
SELECT rental_booking_id, NULL, booking_status, CONCAT('trackcoop-rental-seed: ', booking_status), @admin_user_id, updated_at
FROM rental_bookings
WHERE booking_number IN ('RNT-2026-0041', 'RNT-2026-0042', 'RNT-2026-0043', 'RNT-2026-0044', 'RNT-2026-0045', 'MAINTENANCE-WPM-20260720');

DELETE FROM rental_pos_records
WHERE notes LIKE '%trackcoop-rental-seed%';

INSERT INTO rental_pos_records
    (member_id, payment_reference_id, recorded_by, rental_booking_id, transaction_type, item_name, quantity, total_amount, transaction_status, transaction_date, notes)
SELECT rb.member_id, pr.payment_reference_id, @admin_user_id, rb.rental_booking_id, 'Rental', a.asset_name, 1.000, pr.amount, 'Paid', '2026-07-12',
       '{"seed":"trackcoop-rental-seed","paymentId":"PAY-0041","receiptNumber":"OR-RNT-0041"}'
FROM rental_bookings rb
JOIN rental_assets a ON a.rental_asset_id = rb.rental_asset_id
JOIN payment_references pr ON pr.related_entity_id = rb.rental_booking_id AND pr.related_entity_type = 'rental_bookings'
WHERE rb.booking_number = 'RNT-2026-0041';

INSERT INTO rental_pos_records
    (member_id, payment_reference_id, recorded_by, rental_booking_id, transaction_type, item_name, quantity, total_amount, transaction_status, transaction_date, notes)
SELECT rb.member_id, pr.payment_reference_id, @admin_user_id, rb.rental_booking_id, 'Rental', a.asset_name, 1.000, pr.amount, 'Under Review', '2026-07-12',
       '{"seed":"trackcoop-rental-seed","paymentId":"PAY-0045"}'
FROM rental_bookings rb
JOIN rental_assets a ON a.rental_asset_id = rb.rental_asset_id
JOIN payment_references pr ON pr.related_entity_id = rb.rental_booking_id AND pr.related_entity_type = 'rental_bookings'
WHERE rb.booking_number = 'RNT-2026-0045';

INSERT INTO financial_records
    (record_number, payment_reference_id, member_id, financial_category_id, recorded_by, approved_by, record_type, source_module, source_record_id, amount, record_date, record_status, remarks)
SELECT 'FIN-RNT-0041', pr.payment_reference_id, rb.member_id, fc.financial_category_id, @admin_user_id, @admin_user_id, 'Income', 'Rental', rb.rental_booking_id, 4500.00, '2026-07-12', 'Active',
       '{"seed":"trackcoop-rental-seed","paymentId":"PAY-0041","paymentMethod":"Direct GCash","referenceNumber":"GCASH-814729104","receiptNumber":"OR-RNT-0041"}'
FROM rental_bookings rb
JOIN payment_references pr ON pr.related_entity_id = rb.rental_booking_id AND pr.related_entity_type = 'rental_bookings'
JOIN financial_categories fc ON fc.category_code = 'RENTAL_INCOME'
WHERE rb.booking_number = 'RNT-2026-0041'
ON DUPLICATE KEY UPDATE
    payment_reference_id = VALUES(payment_reference_id),
    member_id = VALUES(member_id),
    financial_category_id = VALUES(financial_category_id),
    recorded_by = VALUES(recorded_by),
    approved_by = VALUES(approved_by),
    source_record_id = VALUES(source_record_id),
    amount = VALUES(amount),
    record_date = VALUES(record_date),
    record_status = VALUES(record_status),
    remarks = VALUES(remarks);

INSERT INTO financial_records
    (record_number, payment_reference_id, member_id, financial_category_id, recorded_by, approved_by, record_type, source_module, source_record_id, amount, record_date, record_status, remarks)
SELECT 'FIN-EXP-001', NULL, rb.member_id, fc.financial_category_id, @admin_user_id, @admin_user_id, 'Expense', 'Rental', rb.rental_booking_id, 2000.00, '2026-07-12', 'Active',
       '{"seed":"trackcoop-rental-seed","expenseId":"EXP-001","rentalId":"RNT-2026-0041","equipmentName":"Farm Tractor","category":"Equipment Maintenance","payee":"Nasugbu Farm Supply","paymentMethod":"Cash","referenceNumber":"EXP-REF-001","receiptFileName":"maintenance-receipt.jpg","description":"Demonstration maintenance transaction.","encodedBy":"NFFAC Bookkeeper"}'
FROM rental_bookings rb
JOIN financial_categories fc ON fc.category_code = 'REPAIR_MAINTENANCE'
WHERE rb.booking_number = 'RNT-2026-0041'
ON DUPLICATE KEY UPDATE
    member_id = VALUES(member_id),
    financial_category_id = VALUES(financial_category_id),
    recorded_by = VALUES(recorded_by),
    approved_by = VALUES(approved_by),
    source_record_id = VALUES(source_record_id),
    amount = VALUES(amount),
    record_date = VALUES(record_date),
    record_status = VALUES(record_status),
    remarks = VALUES(remarks);

DELETE FROM notifications
WHERE notification_type = 'Rental'
  AND title IN ('New rental inquiry received', 'Payment proof needs validation', 'Farm Tractor schedule confirmed');

INSERT INTO notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id, is_read, created_at)
SELECT @admin_user_id, 'Rental', 'New rental inquiry received', 'Maria Santos requested the Water Pump for July 21.', 'rental_bookings', rb.rental_booking_id, 0, '2026-07-12 15:20:00'
FROM rental_bookings rb WHERE rb.booking_number = 'RNT-2026-0042';

INSERT INTO notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id, is_read, created_at)
SELECT @admin_user_id, 'Rental', 'Payment proof needs validation', 'Payment proof for RNT-2026-0045 is ready for review.', 'payment_references', pr.payment_reference_id, 0, '2026-07-12 14:35:00'
FROM payment_references pr
JOIN rental_bookings rb ON rb.rental_booking_id = pr.related_entity_id
WHERE rb.booking_number = 'RNT-2026-0045' AND pr.related_entity_type = 'rental_bookings';

INSERT INTO notifications (user_id, notification_type, title, message, related_entity_type, related_entity_id, is_read, created_at)
SELECT @admin_user_id, 'Rental', 'Farm Tractor schedule confirmed', 'RNT-2026-0041 is confirmed for July 18 at 8:00 AM.', 'rental_bookings', rb.rental_booking_id, 1, '2026-07-12 10:30:00'
FROM rental_bookings rb WHERE rb.booking_number = 'RNT-2026-0041';

DELETE FROM audit_logs
WHERE description LIKE '%trackcoop-rental-seed%';

INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, old_values, new_values, action_time)
SELECT @admin_user_id, 'Created Schedule', 'rental_bookings', rb.rental_booking_id, 'trackcoop-rental-seed: Schedule confirmed after availability review.', NULL, JSON_OBJECT('status', 'Scheduled', 'booking_number', rb.booking_number), '2026-07-12 10:30:00'
FROM rental_bookings rb WHERE rb.booking_number = 'RNT-2026-0041';

INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, old_values, new_values, action_time)
SELECT @admin_user_id, 'Confirmed Payment', 'payment_references', pr.payment_reference_id, 'trackcoop-rental-seed: Payment validation completed and receipt generated.', JSON_OBJECT('status', 'Under Review'), JSON_OBJECT('status', 'Paid', 'booking_number', rb.booking_number), '2026-07-12 10:05:00'
FROM payment_references pr
JOIN rental_bookings rb ON rb.rental_booking_id = pr.related_entity_id
WHERE rb.booking_number = 'RNT-2026-0041' AND pr.related_entity_type = 'rental_bookings';
