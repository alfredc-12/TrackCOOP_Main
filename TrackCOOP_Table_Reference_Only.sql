-- ============================================================================
-- TRACKCOOP TABLE REFERENCE SCHEMA
-- Target DBMS : MySQL 8.0+ / MariaDB 10.6+
-- Intended DB : trackcoopdb
-- ============================================================================
-- This clean reference file contains only table definitions and explanatory
-- comments. It does not delete existing data and does not create sample data.
--
-- INCLUDED:
--   - 34 CREATE TABLE statements
--   - Primary keys and foreign keys
--   - Unique constraints
--   - Default values and status fields
--   - Comments describing every table
--
-- EXCLUDED:
--   - Views
--   - Triggers
--   - Stored procedures and functions
--   - CHECK constraints
--   - Standalone CREATE INDEX statements
--   - INSERT statements and sample accounts
--   - DROP TABLE and DROP DATABASE statements
--
-- APPLICATION-LEVEL RULES:
-- The Next.js/Node.js application must validate the PHP 15,000 maximum share
-- capital, positive monetary values, POS calculations, stock deductions,
-- negative-stock prevention, rental conflicts, valid date ranges, and required
-- submitter information.
--
-- Select trackcoopdb in phpMyAdmin before importing this reference.
-- Optional when the database already exists:
-- USE `trackcoopdb`;
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+08:00';


-- ============================================================================
-- 1. AUTHENTICATION, ROLES, AND ACCOUNT MANAGEMENT
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: roles
-- Stores the account roles used by role-based access control.
-- Expected roles are Chairman/Admin, Bookkeeper, and Member.
-- Each users.role_id value points to one record in this table.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    role_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(80) NOT NULL,
    role_slug VARCHAR(80) NOT NULL,
    description TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_roles_name UNIQUE (role_name),
    CONSTRAINT uq_roles_slug UNIQUE (role_slug)) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: users
-- Stores login accounts and basic account information.
-- password_hash must contain a secure hash and never a plain-text password.
-- role_id controls which portal pages and actions the account may use.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id SMALLINT UNSIGNED NOT NULL,
    username VARCHAR(80) NULL,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    account_status ENUM('Pending', 'Active', 'Suspended', 'Inactive') NOT NULL DEFAULT 'Pending',
    email_verified_at DATETIME NULL,
    last_login_at DATETIME NULL,
    failed_login_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: user_sessions
-- Stores active, expired, or revoked login sessions.
-- Only a token hash is stored so the raw session token is not saved.
-- Used for authenticated sessions, logout, expiration, and revocation.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    session_token_hash CHAR(64) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_sessions_token UNIQUE (session_token_hash),
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: password_reset_tokens
-- Stores temporary password-reset requests.
-- The raw reset token is not stored; only its hash is saved.
-- A token becomes invalid after expiration or when used_at is populated.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    reset_token_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    requested_ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_password_reset_token UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE) ENGINE=InnoDB;

-- ============================================================================
-- 2. MEMBERSHIP MANAGEMENT
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: member_profiles
-- Stores the main cooperative member profile.
-- Includes member code, contact details, barangay, sector, type, approval, and status.
-- May be connected to a Member login account through user_id.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_profiles (
    member_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    member_code VARCHAR(60) NOT NULL,
    full_name VARCHAR(190) NOT NULL,
    contact_number VARCHAR(40) NULL,
    email VARCHAR(190) NULL,
    barangay VARCHAR(120) NULL,
    municipality VARCHAR(120) NOT NULL DEFAULT 'Nasugbu',
    province VARCHAR(120) NOT NULL DEFAULT 'Batangas',
    sector VARCHAR(100) NULL,
    membership_type ENUM('Associate', 'True Member') NOT NULL DEFAULT 'Associate',
    approval_status ENUM('Pending', 'Approved', 'Rejected', 'Needs Information') NOT NULL DEFAULT 'Pending',
    official_member_status ENUM('Pending', 'Active', 'Inactive', 'Suspended', 'Terminated') NOT NULL DEFAULT 'Pending',
    application_date DATE NULL,
    approved_by BIGINT UNSIGNED NULL,
    approved_at DATETIME NULL,
    true_member_since DATE NULL,
    share_capital_deadline DATE NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_profiles_user UNIQUE (user_id),
    CONSTRAINT uq_member_profiles_code UNIQUE (member_code),
    CONSTRAINT fk_member_profiles_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_member_profiles_approved_by FOREIGN KEY (approved_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: member_status_history
-- Stores the history of official membership and approval-status changes.
-- Records old values, new values, the responsible user, date, and remarks.
-- This is separate from the RFM-inspired decision-support indicator.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_status_history (
    member_status_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    old_membership_type ENUM('Associate', 'True Member') NULL,
    new_membership_type ENUM('Associate', 'True Member') NULL,
    old_official_status ENUM('Pending', 'Active', 'Inactive', 'Suspended', 'Terminated') NULL,
    new_official_status ENUM('Pending', 'Active', 'Inactive', 'Suspended', 'Terminated') NULL,
    reason TEXT NULL,
    changed_by BIGINT UNSIGNED NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_member_status_history_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_member_status_history_user FOREIGN KEY (changed_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- ============================================================================
-- 3. PAYMENT VALIDATION AND SHARE CAPITAL
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: payment_references
-- Stores submitted payment references and proof-of-payment files.
-- Supports membership, share capital, rental, POS, preorder, bulk order, and other payments.
-- Authorized staff record validation status, date, and rejection information.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_references (
    payment_reference_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NULL,
    submitted_by BIGINT UNSIGNED NULL,
    payer_name VARCHAR(190) NULL,
    payer_email VARCHAR(190) NULL,
    payer_contact VARCHAR(40) NULL,
    provider VARCHAR(100) NOT NULL DEFAULT 'Reference-Based Payment',
    reference_number VARCHAR(190) NOT NULL,
    payment_purpose ENUM(
        'Associate Membership Fee',
        'Share Capital',
        'Rental',
        'POS/Product',
        'Preorder',
        'Bulk Order',
        'Document/Certificate',
        'Other'
    ) NOT NULL,
    related_entity_type VARCHAR(80) NULL,
    related_entity_id BIGINT UNSIGNED NULL,
    amount DECIMAL(12,2) NOT NULL,
    proof_file_path VARCHAR(500) NULL,
    validation_status ENUM('Pending', 'Validated', 'Rejected', 'Needs Clarification') NOT NULL DEFAULT 'Pending',
    validated_by BIGINT UNSIGNED NULL,
    validated_at DATETIME NULL,
    rejection_reason TEXT NULL,
    notes TEXT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_payment_provider_reference UNIQUE (provider, reference_number),
    CONSTRAINT fk_payment_reference_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_payment_reference_submitter FOREIGN KEY (submitted_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_payment_reference_validator FOREIGN KEY (validated_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: share_capital_payments
-- Stores every share-capital payment made by a member.
-- Validated amounts are used to calculate the member's share-capital progress.
-- The application must prevent validated totals above PHP 15,000.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS share_capital_payments (
    share_payment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    payment_reference_id BIGINT UNSIGNED NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_status ENUM('Pending', 'Validated', 'Rejected', 'Reversed') NOT NULL DEFAULT 'Pending',
    verified_by BIGINT UNSIGNED NULL,
    verified_at DATETIME NULL,
    reversal_of_payment_id BIGINT UNSIGNED NULL,
    remarks TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_share_payment_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_share_payment_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references(payment_reference_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_share_payment_verifier FOREIGN KEY (verified_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_share_payment_reversal FOREIGN KEY (reversal_of_payment_id) REFERENCES share_capital_payments(share_payment_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- ============================================================================
-- 4. FINANCIAL MANAGEMENT
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: financial_categories
-- Stores reusable income and expense categories.
-- Used to organize, filter, summarize, and report financial records.
-- Examples include membership fees, rental income, sales, supplies, and utilities.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_categories (
    financial_category_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_code VARCHAR(60) NOT NULL,
    category_name VARCHAR(120) NOT NULL,
    category_type ENUM('Income', 'Expense', 'Both') NOT NULL,
    description TEXT NULL,
    is_system_category TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_financial_category_code UNIQUE (category_code),
    CONSTRAINT uq_financial_category_name_type UNIQUE (category_name, category_type),
    CONSTRAINT fk_financial_category_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: financial_records
-- Stores the cooperative income-and-expense ledger.
-- Entries may link to members, payments, POS sales, rentals, or other transactions.
-- Provides the source records for financial summaries and printable reports.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_records (
    financial_record_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    record_number VARCHAR(60) NOT NULL,
    payment_reference_id BIGINT UNSIGNED NULL,
    member_id BIGINT UNSIGNED NULL,
    financial_category_id SMALLINT UNSIGNED NOT NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    approved_by BIGINT UNSIGNED NULL,
    record_type ENUM('Income', 'Expense', 'Adjustment') NOT NULL,
    source_module ENUM('Manual', 'Membership', 'Payment', 'Share Capital', 'Rental', 'POS', 'Document', 'Other') NOT NULL DEFAULT 'Manual',
    source_record_id BIGINT UNSIGNED NULL,
    amount DECIMAL(12,2) NOT NULL,
    record_date DATE NOT NULL,
    record_status ENUM('Active', 'Corrected', 'Reversed', 'Voided') NOT NULL DEFAULT 'Active',
    correction_of_record_id BIGINT UNSIGNED NULL,
    reversal_of_record_id BIGINT UNSIGNED NULL,
    remarks TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_financial_record_number UNIQUE (record_number),
    CONSTRAINT fk_financial_payment_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references(payment_reference_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_financial_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_financial_category FOREIGN KEY (financial_category_id) REFERENCES financial_categories(financial_category_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_financial_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_financial_approved_by FOREIGN KEY (approved_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_financial_correction FOREIGN KEY (correction_of_record_id) REFERENCES financial_records(financial_record_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_financial_reversal FOREIGN KEY (reversal_of_record_id) REFERENCES financial_records(financial_record_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- ============================================================================
-- 5. PRODUCTS, POS SALES, AND INVENTORY
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: products
-- Stores products handled by the POS module.
-- Includes product code, name, price, unit, reorder level, stock tracking, and status.
-- Inventory changes are recorded separately in inventory_movements.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    product_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(80) NOT NULL,
    product_name VARCHAR(190) NOT NULL,
    category VARCHAR(120) NULL,
    description TEXT NULL,
    unit VARCHAR(40) NOT NULL DEFAULT 'piece',
    selling_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    cost_price DECIMAL(12,2) NULL,
    track_inventory TINYINT(1) NOT NULL DEFAULT 1,
    reorder_level DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    product_status ENUM('Draft', 'Active', 'Out of Stock', 'Inactive', 'Archived') NOT NULL DEFAULT 'Draft',
    image_path VARCHAR(500) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_products_sku UNIQUE (sku),
    CONSTRAINT fk_products_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: pos_sales
-- Stores the header and totals for each POS transaction.
-- Supports normal sales, preorders, and bulk orders.
-- Contains customer, payment, order, subtotal, discount, tax, and total information.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_sales (
    pos_sale_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sale_number VARCHAR(60) NOT NULL,
    member_id BIGINT UNSIGNED NULL,
    customer_name VARCHAR(190) NULL,
    customer_contact VARCHAR(40) NULL,
    sale_type ENUM('Walk-in', 'Member Sale', 'Preorder', 'Bulk Order') NOT NULL DEFAULT 'Walk-in',
    sale_status ENUM('Draft', 'Held', 'Pending Payment', 'Paid', 'Completed', 'Cancelled', 'Refunded') NOT NULL DEFAULT 'Draft',
    payment_status ENUM('Unpaid', 'Partially Paid', 'Paid', 'Refunded') NOT NULL DEFAULT 'Unpaid',
    payment_reference_id BIGINT UNSIGNED NULL,
    subtotal_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    change_due DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    requested_fulfillment_date DATE NULL,
    fulfilled_at DATETIME NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    notes TEXT NULL,
    sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_pos_sales_number UNIQUE (sale_number),
    CONSTRAINT fk_pos_sales_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pos_sales_payment_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references(payment_reference_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pos_sales_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: pos_sale_items
-- Stores the individual product lines inside a POS transaction.
-- Each row belongs to one sale and normally points to one product.
-- The application calculates the line total from quantity, unit price, and discount.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_sale_items (
    pos_sale_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pos_sale_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    product_name_snapshot VARCHAR(190) NOT NULL,
    sku_snapshot VARCHAR(80) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(12,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pos_sale_items_sale FOREIGN KEY (pos_sale_id) REFERENCES pos_sales(pos_sale_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pos_sale_items_product FOREIGN KEY (product_id) REFERENCES products(product_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: inventory_movements
-- Stores every stock increase, decrease, reservation, return, or adjustment.
-- Provides an auditable stock history instead of relying on one balance field.
-- May be linked to a POS sale item and the user who recorded the movement.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
    inventory_movement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    movement_type ENUM('Opening Stock', 'Stock In', 'Sale', 'Return In', 'Return Out', 'Adjustment', 'Damage', 'Expired', 'Transfer') NOT NULL,
    quantity_change DECIMAL(12,3) NOT NULL,
    unit_cost DECIMAL(12,2) NULL,
    pos_sale_id BIGINT UNSIGNED NULL,
    pos_sale_item_id BIGINT UNSIGNED NULL,
    reference_number VARCHAR(100) NULL,
    remarks TEXT NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(product_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_pos_sale FOREIGN KEY (pos_sale_id) REFERENCES pos_sales(pos_sale_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_inventory_pos_sale_item FOREIGN KEY (pos_sale_item_id) REFERENCES pos_sale_items(pos_sale_item_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_inventory_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- ============================================================================
-- 6. RENTAL MANAGEMENT
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: rental_assets
-- Stores equipment, facilities, services, and other rentable resources.
-- Includes configurable rate, rate unit, deposit, availability, and visibility.
-- The terms_document_path may point to the applicable rental terms or waiver.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rental_assets (
    rental_asset_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_code VARCHAR(80) NOT NULL,
    asset_name VARCHAR(190) NOT NULL,
    asset_type ENUM('Equipment', 'Service', 'Facility', 'Other') NOT NULL DEFAULT 'Equipment',
    category VARCHAR(120) NULL,
    description TEXT NULL,
    rate_amount DECIMAL(12,2) NULL,
    rate_unit ENUM('Per Hour', 'Per Day', 'Per Use', 'Per Unit', 'Custom') NOT NULL DEFAULT 'Custom',
    deposit_amount DECIMAL(12,2) NULL,
    asset_status ENUM('Available', 'Reserved', 'In Use', 'Maintenance', 'Unavailable', 'Archived') NOT NULL DEFAULT 'Available',
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    terms_document_path VARCHAR(500) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_rental_asset_code UNIQUE (asset_code),
    CONSTRAINT fk_rental_assets_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: rental_bookings
-- Stores rental inquiries, schedules, charges, payment status, and completion data.
-- A booking may belong to a member or to a public requester.
-- The application must validate dates and prevent overlapping approved schedules.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rental_bookings (
    rental_booking_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_number VARCHAR(60) NOT NULL,
    rental_asset_id BIGINT UNSIGNED NOT NULL,
    member_id BIGINT UNSIGNED NULL,
    requester_name VARCHAR(190) NULL,
    requester_contact VARCHAR(80) NULL,
    purpose TEXT NULL,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    booking_status ENUM('Inquiry', 'Pending', 'Approved', 'Scheduled', 'In Use', 'Completed', 'Rescheduled', 'Cancelled', 'Rejected') NOT NULL DEFAULT 'Inquiry',
    rate_amount DECIMAL(12,2) NULL,
    deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    additional_charges DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('Unpaid', 'Partially Paid', 'Paid', 'Refunded') NOT NULL DEFAULT 'Unpaid',
    payment_reference_id BIGINT UNSIGNED NULL,
    approved_by BIGINT UNSIGNED NULL,
    approved_at DATETIME NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    completed_at DATETIME NULL,
    cancellation_reason TEXT NULL,
    completion_notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_rental_booking_number UNIQUE (booking_number),
    CONSTRAINT fk_rental_booking_asset FOREIGN KEY (rental_asset_id) REFERENCES rental_assets(rental_asset_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rental_booking_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_booking_payment_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references(payment_reference_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_booking_approved_by FOREIGN KEY (approved_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_booking_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: rental_status_history
-- Stores every rental-booking status change.
-- Records the old status, new status, user, date, and remarks.
-- Supports approval, rescheduling, cancellation, use, and completion tracking.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rental_status_history (
    rental_status_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rental_booking_id BIGINT UNSIGNED NOT NULL,
    old_status ENUM('Inquiry', 'Pending', 'Approved', 'Scheduled', 'In Use', 'Completed', 'Rescheduled', 'Cancelled', 'Rejected') NULL,
    new_status ENUM('Inquiry', 'Pending', 'Approved', 'Scheduled', 'In Use', 'Completed', 'Rescheduled', 'Cancelled', 'Rejected') NOT NULL,
    remarks TEXT NULL,
    changed_by BIGINT UNSIGNED NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rental_status_booking FOREIGN KEY (rental_booking_id) REFERENCES rental_bookings(rental_booking_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_rental_status_user FOREIGN KEY (changed_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: rental_pos_records
-- Stores a unified reference for rental and POS-related income activity.
-- May connect to a member, payment reference, POS sale, or rental booking.
-- Used for consolidated income-source monitoring and reporting.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rental_pos_records (
    rental_pos_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NULL,
    payment_reference_id BIGINT UNSIGNED NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    pos_sale_id BIGINT UNSIGNED NULL,
    rental_booking_id BIGINT UNSIGNED NULL,
    transaction_type ENUM('Rental', 'POS Sale', 'Preorder', 'Bulk Order', 'Other') NOT NULL,
    item_name VARCHAR(190) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL DEFAULT 1.000,
    total_amount DECIMAL(12,2) NOT NULL,
    transaction_status VARCHAR(80) NOT NULL,
    transaction_date DATE NOT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rental_pos_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_pos_payment_reference FOREIGN KEY (payment_reference_id) REFERENCES payment_references(payment_reference_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_pos_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rental_pos_sale FOREIGN KEY (pos_sale_id) REFERENCES pos_sales(pos_sale_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_rental_pos_booking FOREIGN KEY (rental_booking_id) REFERENCES rental_bookings(rental_booking_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- ============================================================================
-- 7. DOCUMENTS AND REPORTS
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: documents
-- Stores metadata for uploaded and generated cooperative documents.
-- Supports receipts, certificates, waivers, plans, reports, and financial files.
-- access_level controls public, member-only, admin-only, or bookkeeper-only access.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    document_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uploaded_by BIGINT UNSIGNED NOT NULL,
    member_id BIGINT UNSIGNED NULL,
    title VARCHAR(255) NOT NULL,
    document_type ENUM('Receipt', 'Certificate', 'Waiver', 'Financial Document', 'Annual Plan', 'Business Plan', 'Agency Report', 'Public Document', 'Other') NOT NULL,
    access_level ENUM('Public', 'Member-only', 'Admin-only', 'Bookkeeper-only') NOT NULL,
    document_status ENUM('Active', 'Archived', 'Replaced', 'Restricted') NOT NULL DEFAULT 'Active',
    file_path VARCHAR(500) NOT NULL,
    original_file_name VARCHAR(255) NULL,
    mime_type VARCHAR(120) NULL,
    file_size_bytes BIGINT UNSIGNED NULL,
    checksum_sha256 CHAR(64) NULL,
    replacement_of_document_id BIGINT UNSIGNED NULL,
    description TEXT NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_documents_uploader FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_documents_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_documents_replacement FOREIGN KEY (replacement_of_document_id) REFERENCES documents(document_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: document_access_logs
-- Records document viewing, downloading, printing, replacement, and permission changes.
-- Supports accountability and traceability for restricted documents.
-- user_id may be null for anonymous access to an allowed public document.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_access_logs (
    document_access_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    access_action ENUM('View', 'Download', 'Print', 'Replace', 'Permission Change') NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_document_access_document FOREIGN KEY (document_id) REFERENCES documents(document_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_document_access_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: reports
-- Stores information about reports generated by the system.
-- Includes type, reporting period, filters, status, and optional output file.
-- A generated report may also be linked to a documents record.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    report_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    report_number VARCHAR(60) NOT NULL,
    generated_by BIGINT UNSIGNED NOT NULL,
    document_id BIGINT UNSIGNED NULL,
    report_type ENUM('Financial Summary', 'Transaction Ledger', 'Share Capital Summary', 'Payment Validation', 'Rental', 'POS Sales', 'Inventory Movement', 'Member Master List', 'Member Engagement', 'Barangay Distribution', 'Documents', 'Announcements', 'Requests/Inquiries', 'Audit Logs', 'Other') NOT NULL,
    report_period_start DATE NULL,
    report_period_end DATE NULL,
    report_period_label VARCHAR(120) NULL,
    filters_json JSON NULL,
    generation_status ENUM('Queued', 'Generated', 'Failed', 'Archived') NOT NULL DEFAULT 'Generated',
    file_path VARCHAR(500) NULL,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reports_number UNIQUE (report_number),
    CONSTRAINT fk_reports_generator FOREIGN KEY (generated_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_reports_document FOREIGN KEY (document_id) REFERENCES documents(document_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- ============================================================================
-- 8. ANNOUNCEMENTS
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: announcements
-- Stores public posts, member announcements, reminders, and targeted messages.
-- Audience settings determine which users may see an announcement.
-- Publication states support drafts, scheduling, publishing, archiving, and cancellation.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    announcement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    posted_by BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NULL,
    message LONGTEXT NOT NULL,
    excerpt VARCHAR(500) NULL,
    audience_type ENUM('Public', 'All Members', 'Associate Members', 'True Members', 'Role', 'Barangay', 'Selected Users') NOT NULL DEFAULT 'Public',
    audience_value VARCHAR(190) NULL,
    announcement_status ENUM('Draft', 'Scheduled', 'Published', 'Archived', 'Cancelled') NOT NULL DEFAULT 'Draft',
    featured_image_path VARCHAR(500) NULL,
    publish_at DATETIME NULL,
    expires_at DATETIME NULL,
    posted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_announcements_slug UNIQUE (slug),
    CONSTRAINT fk_announcements_poster FOREIGN KEY (posted_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: announcement_recipients
-- Stores the individual recipients of selected-user announcements.
-- Tracks delivery and read status for each user.
-- The unique constraint prevents duplicate recipients for one announcement.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcement_recipients (
    announcement_recipient_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    announcement_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    delivery_status ENUM('Pending', 'Delivered', 'Failed') NOT NULL DEFAULT 'Pending',
    delivered_at DATETIME NULL,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_announcement_recipient UNIQUE (announcement_id, user_id),
    CONSTRAINT fk_announcement_recipient_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(announcement_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_announcement_recipient_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE) ENGINE=InnoDB;

-- ============================================================================
-- 9. REQUESTS AND PUBLIC INQUIRIES
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: requests_inquiries
-- Stores requests and inquiries from members, public users, or administrators.
-- May link to documents, announcements, rentals, or POS transactions.
-- Tracks requester details, type, priority, assignment, status, and response.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests_inquiries (
    request_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference_code VARCHAR(60) NOT NULL,
    member_id BIGINT UNSIGNED NULL,
    submitted_by BIGINT UNSIGNED NULL,
    announcement_id BIGINT UNSIGNED NULL,
    related_document_id BIGINT UNSIGNED NULL,
    related_rental_booking_id BIGINT UNSIGNED NULL,
    related_pos_sale_id BIGINT UNSIGNED NULL,
    request_source ENUM('Member Portal', 'Public Website', 'Admin Entry') NOT NULL,
    requester_name VARCHAR(190) NULL,
    requester_email VARCHAR(190) NULL,
    requester_phone VARCHAR(40) NULL,
    requester_barangay VARCHAR(120) NULL,
    preferred_contact_method ENUM('Email', 'Phone', 'SMS', 'Other') NULL,
    request_type ENUM('Membership', 'Payment', 'Share Capital', 'Rental', 'Product/POS', 'Document', 'General') NOT NULL,
    requested_service VARCHAR(190) NULL,
    preferred_schedule DATETIME NULL,
    subject VARCHAR(255) NULL,
    message TEXT NOT NULL,
    priority ENUM('Low', 'Normal', 'High', 'Urgent') NOT NULL DEFAULT 'Normal',
    request_status ENUM('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Waiting for Information', 'Resolved', 'Closed', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Submitted',
    assigned_to BIGINT UNSIGNED NULL,
    admin_notes TEXT NULL,
    public_response TEXT NULL,
    consent_at DATETIME NULL,
    resolved_at DATETIME NULL,
    closed_at DATETIME NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_requests_reference_code UNIQUE (reference_code),
    CONSTRAINT fk_requests_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_submitter FOREIGN KEY (submitted_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(announcement_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_document FOREIGN KEY (related_document_id) REFERENCES documents(document_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_rental FOREIGN KEY (related_rental_booking_id) REFERENCES rental_bookings(rental_booking_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_pos FOREIGN KEY (related_pos_sale_id) REFERENCES pos_sales(pos_sale_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_requests_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: request_status_history
-- Stores every status change made to a request or inquiry.
-- Supports internal notes and a separate user-visible message.
-- Records the responsible user and change date.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_status_history (
    request_status_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT UNSIGNED NOT NULL,
    old_status ENUM('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Waiting for Information', 'Resolved', 'Closed', 'Rejected', 'Cancelled') NULL,
    new_status ENUM('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Waiting for Information', 'Resolved', 'Closed', 'Rejected', 'Cancelled') NOT NULL,
    internal_note TEXT NULL,
    user_visible_message TEXT NULL,
    changed_by BIGINT UNSIGNED NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_request_status_request FOREIGN KEY (request_id) REFERENCES requests_inquiries(request_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_request_status_user FOREIGN KEY (changed_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- ============================================================================
-- 10. MEMBER INDICATORS AND NOTIFICATIONS
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: member_status_indicators
-- Stores RFM-inspired member engagement indicators.
-- Uses recency, frequency, and contribution scores.
-- Active, Needs Monitoring, and Inactive labels are decision-support indicators only.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_status_indicators (
    indicator_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT UNSIGNED NOT NULL,
    basis_period_start DATE NULL,
    basis_period_end DATE NULL,
    recency_score SMALLINT UNSIGNED NOT NULL,
    frequency_score SMALLINT UNSIGNED NOT NULL,
    contribution_score SMALLINT UNSIGNED NOT NULL,
    total_score SMALLINT UNSIGNED NOT NULL,
    status_label ENUM('Active', 'Needs Monitoring', 'Inactive') NOT NULL,
    basis_summary TEXT NULL,
    computed_by BIGINT UNSIGNED NULL,
    computed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_member_indicator_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_member_indicator_computed_by FOREIGN KEY (computed_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: notifications
-- Stores in-system notifications for authenticated users.
-- Notifications may relate to payments, share capital, rentals, POS, documents, or requests.
-- is_read and read_at support unread-notification counters.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    notification_type ENUM('Announcement', 'Payment', 'Share Capital', 'Rental', 'POS', 'Document', 'Request', 'System') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_entity_type VARCHAR(80) NULL,
    related_entity_id BIGINT UNSIGNED NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE) ENGINE=InnoDB;

-- ============================================================================
-- 11. PUBLIC LANDING PAGE CONTENT
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: site_content_blocks
-- Stores editable sections used by the public landing pages.
-- Supports hero content, headings, text, statistics, calls to action, and contact details.
-- page_slug, section_key, and display_order determine page placement.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_content_blocks (
    site_content_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    page_slug VARCHAR(120) NOT NULL,
    section_key VARCHAR(120) NOT NULL,
    content_type ENUM('Hero', 'Heading', 'Rich Text', 'Statistic', 'Call to Action', 'Contact Information', 'Other') NOT NULL,
    title VARCHAR(255) NULL,
    body LONGTEXT NULL,
    value_text VARCHAR(255) NULL,
    link_label VARCHAR(120) NULL,
    link_url VARCHAR(500) NULL,
    media_path VARCHAR(500) NULL,
    display_order INT NOT NULL DEFAULT 0,
    content_status ENUM('Draft', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
    updated_by BIGINT UNSIGNED NOT NULL,
    published_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_site_content_section UNIQUE (page_slug, section_key, display_order),
    CONSTRAINT fk_site_content_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: services
-- Stores services shown on the public website.
-- May represent membership, rental, product/POS, program, document, or other services.
-- Visibility, status, image, order, and call-to-action fields control presentation.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
    service_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_code VARCHAR(80) NOT NULL,
    service_type ENUM('Membership', 'Rental', 'Product/POS', 'Program', 'Document', 'Other') NOT NULL,
    title VARCHAR(190) NOT NULL,
    short_description VARCHAR(500) NULL,
    full_description LONGTEXT NULL,
    requirements_text LONGTEXT NULL,
    image_path VARCHAR(500) NULL,
    cta_label VARCHAR(120) NULL,
    cta_url VARCHAR(500) NULL,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    service_status ENUM('Draft', 'Active', 'Inactive', 'Archived') NOT NULL DEFAULT 'Draft',
    display_order INT NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_services_code UNIQUE (service_code),
    CONSTRAINT fk_services_created_by FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: programs_projects
-- Stores cooperative programs, projects, and activities.
-- Includes schedule, location, description, image, visibility, and publication status.
-- Supports upcoming, ongoing, completed, and archived activities.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs_projects (
    program_project_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(120) NULL,
    summary VARCHAR(700) NULL,
    description LONGTEXT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    location VARCHAR(255) NULL,
    image_path VARCHAR(500) NULL,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    status ENUM('Draft', 'Upcoming', 'Ongoing', 'Completed', 'Archived') NOT NULL DEFAULT 'Draft',
    display_order INT NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_programs_projects_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: partners_certifications
-- Stores partners, certifications, accreditations, and recognitions.
-- Includes logo, description, link, issue date, expiry date, and visibility.
-- Used for public organizational and credibility information.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partners_certifications (
    partner_certification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    record_type ENUM('Partner', 'Certification', 'Accreditation', 'Recognition') NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    logo_path VARCHAR(500) NULL,
    external_url VARCHAR(500) NULL,
    issued_date DATE NULL,
    expiration_date DATE NULL,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    status ENUM('Draft', 'Active', 'Expired', 'Archived') NOT NULL DEFAULT 'Draft',
    display_order INT NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_partners_certifications_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: gallery_items
-- Stores public-gallery image information and captions.
-- The database stores the file path while the actual image remains in file storage.
-- Includes category, date, location, alternate text, visibility, and display order.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery_items (
    gallery_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    caption TEXT NULL,
    category VARCHAR(120) NULL,
    image_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500) NULL,
    activity_date DATE NULL,
    location VARCHAR(255) NULL,
    alt_text VARCHAR(255) NULL,
    public_visibility TINYINT(1) NOT NULL DEFAULT 1,
    gallery_status ENUM('Draft', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
    display_order INT NOT NULL DEFAULT 0,
    uploaded_by BIGINT UNSIGNED NOT NULL,
    published_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_gallery_items_uploader FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB;

-- ============================================================================
-- 12. SYSTEM CONFIGURATION AND AUDIT
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE: system_settings
-- Stores configurable business rules and application settings.
-- May hold membership fees, share-capital limits, rental rules, and POS settings.
-- The application validates setting_value according to value_type.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    system_setting_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_group VARCHAR(100) NOT NULL,
    setting_key VARCHAR(160) NOT NULL,
    setting_value LONGTEXT NULL,
    value_type ENUM('String', 'Number', 'Boolean', 'Date', 'JSON') NOT NULL DEFAULT 'String',
    description TEXT NULL,
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    effective_date DATE NULL,
    updated_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_system_settings_key UNIQUE (setting_key),
    CONSTRAINT fk_system_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- --------------------------------------------------------------------------
-- TABLE: audit_logs
-- Stores important account actions and record changes.
-- May record the affected table, record ID, old values, new values, IP, and user agent.
-- The application writes these records because this schema does not use triggers.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    entity_table VARCHAR(100) NOT NULL,
    record_id BIGINT UNSIGNED NULL,
    description TEXT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    action_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL) ENGINE=InnoDB;

-- ============================================================================
-- END OF TRACKCOOP TABLE REFERENCE SCHEMA
-- Total tables: 34
-- ============================================================================
