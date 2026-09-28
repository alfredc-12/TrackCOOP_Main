-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: trackcoop-db-singapore.craqcs68st7o.ap-southeast-1.rds.amazonaws.com:3306
-- Generation Time: Sep 28, 2026 at 12:14 PM
-- Server version: 8.4.9
-- PHP Version: 8.3.32

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `trackcoopdb`
--

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

CREATE TABLE `announcements` (
  `announcement_id` bigint UNSIGNED NOT NULL,
  `posted_by` bigint UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) DEFAULT NULL,
  `message` longtext NOT NULL,
  `excerpt` varchar(500) DEFAULT NULL,
  `audience_type` enum('Public','All Members','Associate Members','True Members','Barangay','Sector','Selected Users') NOT NULL DEFAULT 'Public',
  `audience_value` varchar(190) DEFAULT NULL,
  `announcement_status` enum('Draft','Scheduled','Published','Archived','Cancelled') NOT NULL DEFAULT 'Draft',
  `featured_image_path` varchar(500) DEFAULT NULL,
  `publish_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `posted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `announcement_acknowledgments`
--

CREATE TABLE `announcement_acknowledgments` (
  `announcement_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `acknowledged_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `announcement_audience_targets`
--

CREATE TABLE `announcement_audience_targets` (
  `announcement_target_id` bigint UNSIGNED NOT NULL,
  `announcement_id` bigint UNSIGNED NOT NULL,
  `target_type` enum('Barangay','Sector') NOT NULL,
  `target_value` varchar(190) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `announcement_images`
--

CREATE TABLE `announcement_images` (
  `announcement_image_id` bigint UNSIGNED NOT NULL,
  `announcement_id` bigint UNSIGNED NOT NULL,
  `image_path` varchar(500) NOT NULL,
  `alt_text` varchar(255) DEFAULT NULL,
  `sort_order` smallint UNSIGNED NOT NULL DEFAULT '0',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `announcement_recipients`
--

CREATE TABLE `announcement_recipients` (
  `announcement_recipient_id` bigint UNSIGNED NOT NULL,
  `announcement_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `delivery_status` enum('Pending','Delivered','Failed') NOT NULL DEFAULT 'Pending',
  `delivered_at` datetime DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `audit_log_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_table` varchar(100) NOT NULL,
  `record_id` bigint UNSIGNED DEFAULT NULL,
  `description` text,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `action_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `documents`
--

CREATE TABLE `documents` (
  `document_id` bigint UNSIGNED NOT NULL,
  `document_reference` varchar(60) DEFAULT NULL,
  `uploaded_by` bigint UNSIGNED DEFAULT NULL,
  `member_id` bigint UNSIGNED DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `category` varchar(80) DEFAULT NULL,
  `document_type` enum('Receipt','Certificate','Waiver','Financial Document','Annual Plan','Business Plan','Agency Report','Public Document','Other') NOT NULL,
  `access_level` enum('Public','Member-only','Admin-only','Bookkeeper-only') NOT NULL,
  `document_status` enum('Active','Archived','Replaced','Restricted') NOT NULL DEFAULT 'Active',
  `file_path` varchar(500) NOT NULL,
  `original_file_name` varchar(255) DEFAULT NULL,
  `mime_type` varchar(120) DEFAULT NULL,
  `file_size_bytes` bigint UNSIGNED DEFAULT NULL,
  `checksum_sha256` char(64) DEFAULT NULL,
  `replacement_of_document_id` bigint UNSIGNED DEFAULT NULL,
  `related_module` varchar(80) DEFAULT NULL,
  `related_record_id` bigint UNSIGNED DEFAULT NULL,
  `related_record_reference` varchar(120) DEFAULT NULL,
  `relationship_type` varchar(80) DEFAULT NULL,
  `document_date` date DEFAULT NULL,
  `expiration_date` date DEFAULT NULL,
  `current_version` int UNSIGNED NOT NULL DEFAULT '1',
  `tags` text,
  `internal_note` text,
  `description` text,
  `archived_by` bigint UNSIGNED DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `archive_reason` text,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `document_access_logs`
--

CREATE TABLE `document_access_logs` (
  `document_access_log_id` bigint UNSIGNED NOT NULL,
  `document_id` bigint UNSIGNED NOT NULL,
  `document_version_id` bigint UNSIGNED DEFAULT NULL,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `user_role` varchar(40) DEFAULT NULL,
  `access_action` enum('View','Preview','Download','Print','Upload','Replace','Permission Change','Archive','Restore') NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `accessed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `document_versions`
--

CREATE TABLE `document_versions` (
  `document_version_id` bigint UNSIGNED NOT NULL,
  `document_id` bigint UNSIGNED NOT NULL,
  `version_number` int UNSIGNED NOT NULL,
  `original_file_name` varchar(255) NOT NULL,
  `stored_file_name` varchar(255) NOT NULL,
  `storage_path` varchar(500) NOT NULL,
  `mime_type` varchar(120) NOT NULL,
  `file_extension` varchar(20) NOT NULL,
  `file_size_bytes` bigint UNSIGNED DEFAULT NULL,
  `checksum_sha256` char(64) DEFAULT NULL,
  `change_note` text,
  `uploaded_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `financial_categories`
--

CREATE TABLE `financial_categories` (
  `financial_category_id` smallint UNSIGNED NOT NULL,
  `category_code` varchar(60) NOT NULL,
  `category_name` varchar(120) NOT NULL,
  `category_type` enum('Income','Expense','Both') NOT NULL,
  `description` text,
  `is_system_category` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `financial_records`
--

CREATE TABLE `financial_records` (
  `financial_record_id` bigint UNSIGNED NOT NULL,
  `record_number` varchar(60) NOT NULL,
  `payment_reference_id` bigint UNSIGNED DEFAULT NULL,
  `member_id` bigint UNSIGNED DEFAULT NULL,
  `financial_category_id` smallint UNSIGNED NOT NULL,
  `recorded_by` bigint UNSIGNED NOT NULL,
  `approved_by` bigint UNSIGNED DEFAULT NULL,
  `record_type` enum('Income','Expense','Adjustment') NOT NULL,
  `source_module` enum('Manual','Membership','Payment','Share Capital','Rental','POS','Document','Other') NOT NULL DEFAULT 'Manual',
  `source_record_id` bigint UNSIGNED DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `record_date` date NOT NULL,
  `record_status` enum('Active','Corrected','Reversed','Voided') NOT NULL DEFAULT 'Active',
  `correction_of_record_id` bigint UNSIGNED DEFAULT NULL,
  `reversal_of_record_id` bigint UNSIGNED DEFAULT NULL,
  `remarks` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gallery_groups`
--

CREATE TABLE `gallery_groups` (
  `gallery_group_id` bigint UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `caption` text,
  `category` varchar(120) DEFAULT NULL,
  `activity_date` date DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `border_color` varchar(20) DEFAULT NULL,
  `public_visibility` tinyint(1) NOT NULL DEFAULT '1',
  `gallery_status` enum('Draft','Published','Archived') NOT NULL DEFAULT 'Draft',
  `display_order` int NOT NULL DEFAULT '0',
  `uploaded_by` bigint UNSIGNED NOT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gallery_images`
--

CREATE TABLE `gallery_images` (
  `gallery_image_id` bigint UNSIGNED NOT NULL,
  `gallery_group_id` bigint UNSIGNED NOT NULL,
  `image_path` varchar(500) NOT NULL,
  `thumbnail_path` varchar(500) DEFAULT NULL,
  `alt_text` varchar(255) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_cover` tinyint(1) NOT NULL DEFAULT '0',
  `public_visibility` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gallery_items`
--

CREATE TABLE `gallery_items` (
  `gallery_item_id` bigint UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `caption` text,
  `category` varchar(120) DEFAULT NULL,
  `image_path` varchar(500) NOT NULL,
  `thumbnail_path` varchar(500) DEFAULT NULL,
  `activity_date` date DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `alt_text` varchar(255) DEFAULT NULL,
  `public_visibility` tinyint(1) NOT NULL DEFAULT '1',
  `gallery_status` enum('Draft','Published','Archived') NOT NULL DEFAULT 'Draft',
  `display_order` int NOT NULL DEFAULT '0',
  `uploaded_by` bigint UNSIGNED NOT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gallery_landing_slots`
--

CREATE TABLE `gallery_landing_slots` (
  `slot_key` varchar(80) NOT NULL,
  `gallery_group_id` bigint UNSIGNED DEFAULT NULL,
  `gallery_image_id` bigint UNSIGNED DEFAULT NULL,
  `display_order` int NOT NULL DEFAULT '0',
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inquiries`
--

CREATE TABLE `inquiries` (
  `inquiry_id` bigint UNSIGNED NOT NULL,
  `tracking_code` varchar(60) NOT NULL,
  `sender_name` varchar(190) NOT NULL,
  `sender_email` varchar(190) DEFAULT NULL,
  `sender_contact` varchar(40) DEFAULT NULL,
  `category` enum('Membership','Loan','General Inquiry','Technical Support') NOT NULL DEFAULT 'General Inquiry',
  `status` enum('Open','Pending','Resolved','Closed') NOT NULL DEFAULT 'Open',
  `priority` enum('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  `assigned_to` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inquiry_messages`
--

CREATE TABLE `inquiry_messages` (
  `message_id` bigint UNSIGNED NOT NULL,
  `inquiry_id` bigint UNSIGNED NOT NULL,
  `sender_type` enum('Public','Admin') NOT NULL,
  `sender_user_id` bigint UNSIGNED DEFAULT NULL,
  `message_body` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_movements`
--

CREATE TABLE `inventory_movements` (
  `inventory_movement_id` bigint UNSIGNED NOT NULL,
  `product_id` bigint UNSIGNED NOT NULL,
  `movement_type` enum('Opening Stock','Stock In','Sale','Return In','Return Out','Adjustment','Damage','Expired','Transfer') NOT NULL,
  `quantity_change` decimal(12,3) NOT NULL,
  `unit_cost` decimal(12,2) DEFAULT NULL,
  `pos_sale_id` bigint UNSIGNED DEFAULT NULL,
  `pos_sale_item_id` bigint UNSIGNED DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `remarks` text,
  `recorded_by` bigint UNSIGNED NOT NULL,
  `movement_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `membership_account_activations`
--

CREATE TABLE `membership_account_activations` (
  `membership_account_activation_id` bigint UNSIGNED NOT NULL,
  `membership_application_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `membership_applications`
--

CREATE TABLE `membership_applications` (
  `membership_application_id` bigint UNSIGNED NOT NULL,
  `application_code` varchar(60) NOT NULL,
  `public_tracking_token_hash` char(64) NOT NULL,
  `application_source` enum('Public Website','Chairman Entry','Imported Paper Form') NOT NULL DEFAULT 'Public Website',
  `requested_membership_type` enum('Associate','True Member') NOT NULL DEFAULT 'Associate',
  `first_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) NOT NULL,
  `suffix` varchar(30) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `contact_number` varchar(40) NOT NULL,
  `civil_status` enum('Single','Married','Widowed','Separated','Other') DEFAULT NULL,
  `place_of_birth` varchar(255) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `current_address` varchar(500) NOT NULL,
  `barangay` varchar(120) DEFAULT NULL,
  `municipality` varchar(120) NOT NULL DEFAULT 'Nasugbu',
  `province` varchar(120) NOT NULL DEFAULT 'Batangas',
  `father_name` varchar(190) DEFAULT NULL,
  `mother_name` varchar(190) DEFAULT NULL,
  `spouse_name` varchar(190) DEFAULT NULL,
  `occupation` varchar(190) DEFAULT NULL,
  `orientation_commitment_accepted` tinyint(1) NOT NULL DEFAULT '0',
  `membership_fee_commitment_accepted` tinyint(1) NOT NULL DEFAULT '0',
  `membership_fee_amount` decimal(12,2) NOT NULL DEFAULT '200.00',
  `share_subscription_commitment_accepted` tinyint(1) NOT NULL DEFAULT '0',
  `subscribed_shares` smallint UNSIGNED DEFAULT NULL,
  `initial_share_capital_amount` decimal(12,2) NOT NULL DEFAULT '1500.00',
  `target_share_capital_amount` decimal(12,2) NOT NULL DEFAULT '3000.00',
  `share_capital_deadline_months` smallint UNSIGNED NOT NULL DEFAULT '12',
  `annual_interest_rate` decimal(5,2) DEFAULT NULL,
  `patronage_refund_acknowledged` tinyint(1) NOT NULL DEFAULT '0',
  `bylaws_agreement_accepted` tinyint(1) NOT NULL DEFAULT '0',
  `privacy_consent_accepted` tinyint(1) NOT NULL DEFAULT '0',
  `terms_version` varchar(40) NOT NULL,
  `applicant_signature_name` varchar(190) NOT NULL,
  `signed_at` datetime NOT NULL,
  `signed_place` varchar(190) NOT NULL,
  `application_status` enum('Submitted','Under Review','Needs Information','Payment Required','Payment Confirmed','Approved','Rejected','Withdrawn') NOT NULL DEFAULT 'Submitted',
  `submitted_by_user_id` bigint UNSIGNED DEFAULT NULL,
  `reviewed_by` bigint UNSIGNED DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `board_meeting_date` date DEFAULT NULL,
  `secretary_name` varchar(190) DEFAULT NULL,
  `decision_reason` text,
  `converted_member_id` bigint UNSIGNED DEFAULT NULL,
  `submitted_ip` varchar(45) DEFAULT NULL,
  `submitted_user_agent` varchar(500) DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `membership_application_beneficiaries`
--

CREATE TABLE `membership_application_beneficiaries` (
  `membership_application_beneficiary_id` bigint UNSIGNED NOT NULL,
  `membership_application_id` bigint UNSIGNED NOT NULL,
  `full_name` varchar(190) NOT NULL,
  `relationship` varchar(100) DEFAULT NULL,
  `age_at_application` smallint UNSIGNED DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `display_order` smallint UNSIGNED NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `membership_application_documents`
--

CREATE TABLE `membership_application_documents` (
  `membership_application_document_id` bigint UNSIGNED NOT NULL,
  `membership_application_id` bigint UNSIGNED NOT NULL,
  `document_type` enum('Scanned Paper Application','Signed Application','Valid ID','Proof of Residency','Membership Fee Proof','Share Capital Proof','Other') NOT NULL,
  `original_file_name` varchar(255) NOT NULL,
  `stored_file_path` varchar(500) NOT NULL,
  `mime_type` varchar(120) NOT NULL,
  `file_size_bytes` bigint UNSIGNED NOT NULL,
  `checksum_sha256` char(64) DEFAULT NULL,
  `uploaded_by_user_id` bigint UNSIGNED DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `membership_application_notes`
--

CREATE TABLE `membership_application_notes` (
  `membership_application_note_id` bigint UNSIGNED NOT NULL,
  `membership_application_id` bigint UNSIGNED NOT NULL,
  `note_type` enum('PUBLIC_RESPONSE','INTERNAL_NOTE','ADDITIONAL_INFORMATION','PAYMENT_NOTE') NOT NULL,
  `note_text` text NOT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `membership_application_payments`
--

CREATE TABLE `membership_application_payments` (
  `membership_application_payment_id` bigint UNSIGNED NOT NULL,
  `membership_application_id` bigint UNSIGNED NOT NULL,
  `payment_reference_id` bigint UNSIGNED NOT NULL,
  `payment_status` varchar(40) NOT NULL DEFAULT 'PENDING',
  `receipt_number` varchar(60) DEFAULT NULL,
  `validated_by` bigint UNSIGNED DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `membership_application_requirements`
--

CREATE TABLE `membership_application_requirements` (
  `membership_application_requirement_id` bigint UNSIGNED NOT NULL,
  `membership_application_id` bigint UNSIGNED NOT NULL,
  `requirement_type` enum('Orientation/Seminar','Associate Membership Fee','Initial Share Capital','Signed Application','Valid ID','Proof of Residency','Other') NOT NULL,
  `requirement_status` enum('Pending','Submitted','Verified','Rejected','Waived') NOT NULL DEFAULT 'Pending',
  `payment_reference_id` bigint UNSIGNED DEFAULT NULL,
  `membership_application_document_id` bigint UNSIGNED DEFAULT NULL,
  `completion_date` date DEFAULT NULL,
  `verified_by` bigint UNSIGNED DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `remarks` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `membership_application_status_history`
--

CREATE TABLE `membership_application_status_history` (
  `membership_application_status_history_id` bigint UNSIGNED NOT NULL,
  `membership_application_id` bigint UNSIGNED NOT NULL,
  `old_status` enum('Submitted','Under Review','Needs Information','Payment Required','Payment Confirmed','Approved','Rejected','Withdrawn') DEFAULT NULL,
  `new_status` enum('Submitted','Under Review','Needs Information','Payment Required','Payment Confirmed','Approved','Rejected','Withdrawn') NOT NULL,
  `internal_note` text,
  `applicant_message` text,
  `changed_by` bigint UNSIGNED DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `member_profiles`
--

CREATE TABLE `member_profiles` (
  `member_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `member_code` varchar(60) NOT NULL,
  `full_name` varchar(190) NOT NULL,
  `contact_number` varchar(40) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `barangay` varchar(120) DEFAULT NULL,
  `municipality` varchar(120) NOT NULL DEFAULT 'Nasugbu',
  `province` varchar(120) NOT NULL DEFAULT 'Batangas',
  `sector` enum('Rice','Corn','Fishery','Livestock','High-value crops (gulayan)') DEFAULT NULL,
  `membership_type` enum('Associate','True Member') NOT NULL DEFAULT 'Associate',
  `approval_status` enum('Pending','Approved','Rejected','Needs Information') NOT NULL DEFAULT 'Pending',
  `official_member_status` enum('Pending','Active','Inactive','Suspended','Terminated') NOT NULL DEFAULT 'Pending',
  `application_date` date DEFAULT NULL,
  `approved_by` bigint UNSIGNED DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `true_member_since` date DEFAULT NULL,
  `share_capital_deadline` date DEFAULT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `member_status_history`
--

CREATE TABLE `member_status_history` (
  `member_status_history_id` bigint UNSIGNED NOT NULL,
  `member_id` bigint UNSIGNED NOT NULL,
  `old_membership_type` enum('Associate','True Member') DEFAULT NULL,
  `new_membership_type` enum('Associate','True Member') DEFAULT NULL,
  `old_official_status` enum('Pending','Active','Inactive','Suspended','Terminated') DEFAULT NULL,
  `new_official_status` enum('Pending','Active','Inactive','Suspended','Terminated') DEFAULT NULL,
  `reason` text,
  `changed_by` bigint UNSIGNED NOT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `member_status_indicators`
--

CREATE TABLE `member_status_indicators` (
  `indicator_id` bigint UNSIGNED NOT NULL,
  `member_id` bigint UNSIGNED NOT NULL,
  `basis_period_start` date DEFAULT NULL,
  `basis_period_end` date DEFAULT NULL,
  `recency_score` smallint UNSIGNED NOT NULL,
  `frequency_score` smallint UNSIGNED NOT NULL,
  `contribution_score` smallint UNSIGNED NOT NULL,
  `total_score` smallint UNSIGNED NOT NULL,
  `status_label` enum('Active','Needs Monitoring','Inactive') NOT NULL,
  `basis_summary` text,
  `computed_by` bigint UNSIGNED DEFAULT NULL,
  `computed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `notification_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `notification_type` enum('Announcement','Payment','Share Capital','Rental','POS','Document','Request','System') NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `related_entity_type` varchar(80) DEFAULT NULL,
  `related_entity_id` bigint UNSIGNED DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `partners_certifications`
--

CREATE TABLE `partners_certifications` (
  `partner_certification_id` bigint UNSIGNED NOT NULL,
  `record_type` enum('Partner','Certification','Accreditation','Recognition') NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `logo_path` varchar(500) DEFAULT NULL,
  `external_url` varchar(500) DEFAULT NULL,
  `issued_date` date DEFAULT NULL,
  `expiration_date` date DEFAULT NULL,
  `public_visibility` tinyint(1) NOT NULL DEFAULT '1',
  `status` enum('Draft','Active','Expired','Archived') NOT NULL DEFAULT 'Draft',
  `display_order` int NOT NULL DEFAULT '0',
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `reset_token_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `requested_ip` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `patronage_allocations`
--

CREATE TABLE `patronage_allocations` (
  `patronage_allocation_id` bigint UNSIGNED NOT NULL,
  `patronage_period_id` bigint UNSIGNED NOT NULL,
  `member_id` bigint UNSIGNED NOT NULL,
  `purchase_patronage` decimal(14,2) NOT NULL DEFAULT '0.00',
  `rental_patronage` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total_patronage` decimal(14,2) NOT NULL DEFAULT '0.00',
  `patronage_share_percent` decimal(9,6) NOT NULL DEFAULT '0.000000',
  `refund_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `payment_status` enum('Pending','Paid') NOT NULL DEFAULT 'Pending',
  `paid_at` datetime DEFAULT NULL,
  `paid_by` bigint UNSIGNED DEFAULT NULL,
  `payment_notes` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `patronage_periods`
--

CREATE TABLE `patronage_periods` (
  `patronage_period_id` bigint UNSIGNED NOT NULL,
  `period_name` varchar(120) NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `refund_pool` decimal(14,2) NOT NULL,
  `period_status` enum('Draft','Finalized','Paid') NOT NULL DEFAULT 'Draft',
  `notes` text,
  `created_by` bigint UNSIGNED NOT NULL,
  `finalized_by` bigint UNSIGNED DEFAULT NULL,
  `finalized_at` datetime DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_gateway_checkout_attempts`
--

CREATE TABLE `payment_gateway_checkout_attempts` (
  `payment_gateway_checkout_attempt_id` bigint UNSIGNED NOT NULL,
  `payment_reference_id` bigint UNSIGNED NOT NULL,
  `gateway_name` varchar(80) NOT NULL DEFAULT 'PayMongo',
  `attempt_number` int UNSIGNED NOT NULL,
  `idempotency_key` varchar(190) NOT NULL,
  `gateway_checkout_id` varchar(190) DEFAULT NULL,
  `checkout_url` varchar(1000) DEFAULT NULL,
  `gateway_status` varchar(80) DEFAULT NULL,
  `gateway_environment` enum('Test','Live') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'PHP',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_checked_at` datetime DEFAULT NULL,
  `reusable_until` datetime NOT NULL,
  `superseded_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_gateway_events`
--

CREATE TABLE `payment_gateway_events` (
  `payment_gateway_event_id` bigint UNSIGNED NOT NULL,
  `payment_reference_id` bigint UNSIGNED DEFAULT NULL,
  `gateway_name` varchar(80) NOT NULL DEFAULT 'PayMongo',
  `event_type` varchar(120) NOT NULL,
  `gateway_event_object_id` varchar(190) DEFAULT NULL,
  `event_fingerprint` char(64) NOT NULL,
  `gateway_checkout_id` varchar(190) DEFAULT NULL,
  `gateway_payment_id` varchar(190) DEFAULT NULL,
  `gateway_payment_intent_id` varchar(190) DEFAULT NULL,
  `gateway_reference_number` varchar(190) DEFAULT NULL,
  `gateway_amount` decimal(12,2) DEFAULT NULL,
  `gateway_currency` char(3) DEFAULT NULL,
  `gateway_payment_status` varchar(80) DEFAULT NULL,
  `gateway_payment_method` varchar(80) DEFAULT NULL,
  `gateway_fee_amount` decimal(12,2) DEFAULT NULL,
  `gateway_net_amount` decimal(12,2) DEFAULT NULL,
  `gateway_paid_at` datetime DEFAULT NULL,
  `livemode` tinyint(1) NOT NULL DEFAULT '0',
  `payload_sha256` char(64) NOT NULL,
  `signature_verified_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `processing_status` enum('Received','Processing','Processed','Ignored','Failed') NOT NULL DEFAULT 'Received',
  `error_code` varchar(120) DEFAULT NULL,
  `error_message` text,
  `safe_error_message` varchar(1000) DEFAULT NULL,
  `recovery_note` varchar(1000) DEFAULT NULL,
  `last_retried_by` bigint UNSIGNED DEFAULT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  `retry_count` int UNSIGNED NOT NULL DEFAULT '0',
  `processing_started_at` datetime DEFAULT NULL,
  `last_attempt_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_receipts`
--

CREATE TABLE `payment_receipts` (
  `payment_receipt_id` bigint UNSIGNED NOT NULL,
  `payment_reference_id` bigint UNSIGNED NOT NULL,
  `member_id` bigint UNSIGNED DEFAULT NULL,
  `document_id` bigint UNSIGNED DEFAULT NULL,
  `receipt_number` varchar(80) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_channel` varchar(40) NOT NULL,
  `provider` varchar(100) NOT NULL,
  `validation_source` varchar(40) NOT NULL DEFAULT 'Manual Bookkeeper',
  `subject_reference` varchar(120) DEFAULT NULL,
  `payment_date` date DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL,
  `processing_status` enum('Pending','Processing','Generated','Failed') NOT NULL DEFAULT 'Pending',
  `attempt_count` int UNSIGNED NOT NULL DEFAULT '0',
  `last_attempt_at` datetime DEFAULT NULL,
  `generated_at` datetime DEFAULT NULL,
  `last_error_code` varchar(120) DEFAULT NULL,
  `last_error_message` varchar(1000) DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  `reversal_note` varchar(1000) DEFAULT NULL,
  `issued_by` bigint UNSIGNED NOT NULL,
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_references`
--

CREATE TABLE `payment_references` (
  `payment_reference_id` bigint UNSIGNED NOT NULL,
  `member_id` bigint UNSIGNED DEFAULT NULL,
  `submitted_by` bigint UNSIGNED DEFAULT NULL,
  `payer_name` varchar(190) DEFAULT NULL,
  `payer_email` varchar(190) DEFAULT NULL,
  `payer_contact` varchar(40) DEFAULT NULL,
  `provider` varchar(100) NOT NULL DEFAULT 'Reference-Based Payment',
  `payment_channel` enum('PayMongo','Manual GCash','Cash','Bank Transfer','Other') NOT NULL DEFAULT 'Other',
  `gateway_environment` enum('Test','Live','Manual') NOT NULL DEFAULT 'Manual',
  `reference_number` varchar(190) NOT NULL,
  `payment_purpose` enum('Associate Membership Fee','Share Capital','Rental','POS/Product','Preorder','Bulk Order','Document/Certificate','Other') NOT NULL,
  `related_entity_type` varchar(80) DEFAULT NULL,
  `related_entity_id` bigint UNSIGNED DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `proof_file_path` varchar(500) DEFAULT NULL,
  `validation_status` enum('Pending','Validated','Rejected','Needs Clarification','Reversed') NOT NULL DEFAULT 'Pending',
  `validated_by` bigint UNSIGNED DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL,
  `rejection_reason` text,
  `notes` text,
  `gateway_checkout_id` varchar(190) DEFAULT NULL,
  `gateway_payment_id` varchar(190) DEFAULT NULL,
  `gateway_payment_intent_id` varchar(190) DEFAULT NULL,
  `gateway_status` varchar(100) DEFAULT NULL,
  `gateway_payment_method` varchar(80) DEFAULT NULL,
  `gateway_fee_amount` decimal(12,2) DEFAULT NULL,
  `gateway_net_amount` decimal(12,2) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `webhook_received_at` datetime DEFAULT NULL,
  `idempotency_key` varchar(190) DEFAULT NULL,
  `client_request_id` char(36) DEFAULT NULL,
  `validation_source` enum('Manual Bookkeeper','PayMongo Webhook','System') DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_validation_history`
--

CREATE TABLE `payment_validation_history` (
  `payment_validation_history_id` bigint UNSIGNED NOT NULL,
  `payment_reference_id` bigint UNSIGNED NOT NULL,
  `old_status` enum('Pending','Validated','Rejected','Needs Clarification','Reversed') DEFAULT NULL,
  `new_status` enum('Pending','Validated','Rejected','Needs Clarification','Reversed') NOT NULL,
  `validation_source` enum('Manual Bookkeeper','PayMongo Webhook','System') NOT NULL,
  `reason` text,
  `changed_by` bigint UNSIGNED DEFAULT NULL,
  `gateway_event_id` bigint UNSIGNED DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pos_sales`
--

CREATE TABLE `pos_sales` (
  `pos_sale_id` bigint UNSIGNED NOT NULL,
  `sale_number` varchar(60) NOT NULL,
  `member_id` bigint UNSIGNED DEFAULT NULL,
  `customer_name` varchar(190) DEFAULT NULL,
  `customer_contact` varchar(40) DEFAULT NULL,
  `sale_type` enum('Walk-in','Member Sale','Preorder','Bulk Order') NOT NULL DEFAULT 'Walk-in',
  `sale_status` enum('Draft','Held','Pending Payment','Paid','Completed','Cancelled','Refunded') NOT NULL DEFAULT 'Draft',
  `payment_status` enum('Unpaid','Partially Paid','Paid','Refunded') NOT NULL DEFAULT 'Unpaid',
  `payment_reference_id` bigint UNSIGNED DEFAULT NULL,
  `subtotal_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `amount_paid` decimal(12,2) NOT NULL DEFAULT '0.00',
  `change_due` decimal(12,2) NOT NULL DEFAULT '0.00',
  `requested_fulfillment_date` date DEFAULT NULL,
  `fulfilled_at` datetime DEFAULT NULL,
  `recorded_by` bigint UNSIGNED NOT NULL,
  `notes` text,
  `sale_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pos_sale_items`
--

CREATE TABLE `pos_sale_items` (
  `pos_sale_item_id` bigint UNSIGNED NOT NULL,
  `pos_sale_id` bigint UNSIGNED NOT NULL,
  `product_id` bigint UNSIGNED NOT NULL,
  `product_name_snapshot` varchar(190) NOT NULL,
  `sku_snapshot` varchar(80) NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `line_total` decimal(12,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `product_id` bigint UNSIGNED NOT NULL,
  `sku` varchar(80) NOT NULL,
  `product_name` varchar(190) NOT NULL,
  `category` varchar(120) DEFAULT NULL,
  `description` text,
  `unit` varchar(40) NOT NULL DEFAULT 'piece',
  `selling_price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `cost_price` decimal(12,2) DEFAULT NULL,
  `track_inventory` tinyint(1) NOT NULL DEFAULT '1',
  `reorder_level` decimal(12,3) NOT NULL DEFAULT '0.000',
  `public_visibility` tinyint(1) NOT NULL DEFAULT '1',
  `product_status` enum('Draft','Active','Out of Stock','Inactive','Archived') NOT NULL DEFAULT 'Draft',
  `image_path` varchar(500) DEFAULT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_assets`
--

CREATE TABLE `rental_assets` (
  `rental_asset_id` bigint UNSIGNED NOT NULL,
  `asset_code` varchar(80) NOT NULL,
  `asset_name` varchar(190) NOT NULL,
  `asset_type` enum('Equipment','Service','Facility','Other') NOT NULL DEFAULT 'Equipment',
  `category` varchar(120) DEFAULT NULL,
  `description` text,
  `rate_amount` decimal(12,2) DEFAULT NULL,
  `rate_unit` enum('Per Hour','Per Day','Per Use','Per Unit','Custom') NOT NULL DEFAULT 'Custom',
  `deposit_amount` decimal(12,2) DEFAULT NULL,
  `asset_status` enum('Available','Reserved','In Use','Maintenance','Unavailable','Archived') NOT NULL DEFAULT 'Available',
  `public_visibility` tinyint(1) NOT NULL DEFAULT '1',
  `terms_document_path` varchar(500) DEFAULT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_asset_attachments`
--

CREATE TABLE `rental_asset_attachments` (
  `primary_asset_id` bigint UNSIGNED NOT NULL,
  `attachment_asset_id` bigint UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_bookings`
--

CREATE TABLE `rental_bookings` (
  `rental_booking_id` bigint UNSIGNED NOT NULL,
  `booking_number` varchar(60) NOT NULL,
  `rental_asset_id` bigint UNSIGNED NOT NULL,
  `operator_id` bigint UNSIGNED DEFAULT NULL,
  `member_id` bigint UNSIGNED DEFAULT NULL,
  `requester_name` varchar(190) DEFAULT NULL,
  `requester_contact` varchar(80) DEFAULT NULL,
  `purpose` text,
  `start_datetime` datetime NOT NULL,
  `end_datetime` datetime NOT NULL,
  `booking_status` enum('Inquiry','Pending','Approved','Scheduled','In Use','Completed','Rescheduled','Cancelled','Rejected') NOT NULL DEFAULT 'Inquiry',
  `rate_amount` decimal(12,2) DEFAULT NULL,
  `deposit_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `additional_charges` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `payment_status` enum('Unpaid','Partially Paid','Paid','Refunded') NOT NULL DEFAULT 'Unpaid',
  `payment_reference_id` bigint UNSIGNED DEFAULT NULL,
  `approved_by` bigint UNSIGNED DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `recorded_by` bigint UNSIGNED NOT NULL,
  `completed_at` datetime DEFAULT NULL,
  `cancellation_reason` text,
  `completion_notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_booking_attachments`
--

CREATE TABLE `rental_booking_attachments` (
  `rental_booking_id` bigint UNSIGNED NOT NULL,
  `attachment_asset_id` bigint UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_booking_sequences`
--

CREATE TABLE `rental_booking_sequences` (
  `reference_year` smallint UNSIGNED NOT NULL,
  `last_number` int UNSIGNED NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_handovers`
--

CREATE TABLE `rental_handovers` (
  `handover_id` bigint UNSIGNED NOT NULL,
  `rental_booking_id` bigint UNSIGNED NOT NULL,
  `handover_type` enum('Pre-Rental','Post-Rental') NOT NULL,
  `fuel_level` varchar(80) DEFAULT NULL,
  `condition_notes` text,
  `recorded_by` bigint UNSIGNED NOT NULL,
  `recorded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_idempotency_keys`
--

CREATE TABLE `rental_idempotency_keys` (
  `idempotency_key` varchar(120) NOT NULL,
  `operation` varchar(100) NOT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_maintenance_periods`
--

CREATE TABLE `rental_maintenance_periods` (
  `rental_maintenance_id` bigint UNSIGNED NOT NULL,
  `rental_asset_id` bigint UNSIGNED NOT NULL,
  `maintenance_type` varchar(120) NOT NULL,
  `start_datetime` datetime NOT NULL,
  `end_datetime` datetime NOT NULL,
  `description` text NOT NULL,
  `technician_provider` varchar(190) DEFAULT NULL,
  `cost` decimal(12,2) DEFAULT NULL,
  `internal_note` text,
  `operational_impact` enum('Limited Availability','Unavailable','Out of Service') NOT NULL DEFAULT 'Unavailable',
  `maintenance_status` enum('Scheduled','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
  `created_by` bigint UNSIGNED NOT NULL,
  `completed_by` bigint UNSIGNED DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_operators`
--

CREATE TABLE `rental_operators` (
  `operator_id` bigint UNSIGNED NOT NULL,
  `name` varchar(190) NOT NULL,
  `contact_number` varchar(80) DEFAULT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_pos_records`
--

CREATE TABLE `rental_pos_records` (
  `rental_pos_id` bigint UNSIGNED NOT NULL,
  `member_id` bigint UNSIGNED DEFAULT NULL,
  `payment_reference_id` bigint UNSIGNED DEFAULT NULL,
  `recorded_by` bigint UNSIGNED NOT NULL,
  `pos_sale_id` bigint UNSIGNED DEFAULT NULL,
  `rental_booking_id` bigint UNSIGNED DEFAULT NULL,
  `transaction_type` enum('Rental','POS Sale','Preorder','Bulk Order','Other') NOT NULL,
  `item_name` varchar(190) NOT NULL,
  `quantity` decimal(12,3) NOT NULL DEFAULT '1.000',
  `total_amount` decimal(12,2) NOT NULL,
  `transaction_status` varchar(80) NOT NULL,
  `transaction_date` date NOT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rental_status_history`
--

CREATE TABLE `rental_status_history` (
  `rental_status_history_id` bigint UNSIGNED NOT NULL,
  `rental_booking_id` bigint UNSIGNED NOT NULL,
  `old_status` enum('Inquiry','Pending','Approved','Scheduled','In Use','Completed','Rescheduled','Cancelled','Rejected') DEFAULT NULL,
  `new_status` enum('Inquiry','Pending','Approved','Scheduled','In Use','Completed','Rescheduled','Cancelled','Rejected') NOT NULL,
  `remarks` text,
  `changed_by` bigint UNSIGNED NOT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reports`
--

CREATE TABLE `reports` (
  `report_id` bigint UNSIGNED NOT NULL,
  `report_number` varchar(60) NOT NULL,
  `report_key` varchar(80) DEFAULT NULL,
  `report_title` varchar(255) DEFAULT NULL,
  `report_category` varchar(80) DEFAULT NULL,
  `generated_by` bigint UNSIGNED NOT NULL,
  `document_id` bigint UNSIGNED DEFAULT NULL,
  `report_type` enum('Financial Summary','Transaction Ledger','Share Capital Summary','Payment Validation','Rental','POS Sales','Inventory Movement','Member Master List','Member Engagement','Barangay Distribution','Documents','Announcements','Requests/Inquiries','Audit Logs','Other') NOT NULL,
  `report_period_start` date DEFAULT NULL,
  `report_period_end` date DEFAULT NULL,
  `report_period_label` varchar(120) DEFAULT NULL,
  `filters_json` json DEFAULT NULL,
  `summary_json` longtext,
  `output_format` varchar(20) DEFAULT NULL,
  `generation_status` enum('Queued','Generated','Failed','Archived') NOT NULL DEFAULT 'Generated',
  `file_path` varchar(500) DEFAULT NULL,
  `generated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `archived_at` datetime DEFAULT NULL,
  `archive_reason` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `requests_inquiries`
--

CREATE TABLE `requests_inquiries` (
  `request_id` bigint UNSIGNED NOT NULL,
  `reference_code` varchar(60) NOT NULL,
  `member_id` bigint UNSIGNED DEFAULT NULL,
  `submitted_by` bigint UNSIGNED DEFAULT NULL,
  `announcement_id` bigint UNSIGNED DEFAULT NULL,
  `related_document_id` bigint UNSIGNED DEFAULT NULL,
  `related_rental_booking_id` bigint UNSIGNED DEFAULT NULL,
  `related_pos_sale_id` bigint UNSIGNED DEFAULT NULL,
  `request_source` enum('Member Portal','Public Website','Admin Entry') NOT NULL,
  `requester_name` varchar(190) DEFAULT NULL,
  `requester_email` varchar(190) DEFAULT NULL,
  `requester_phone` varchar(40) DEFAULT NULL,
  `requester_barangay` varchar(120) DEFAULT NULL,
  `preferred_contact_method` enum('Email','Phone','SMS','Other') DEFAULT NULL,
  `request_type` enum('Membership','Payment','Share Capital','Rental','Product/POS','Document','General') NOT NULL,
  `requested_service` varchar(190) DEFAULT NULL,
  `preferred_schedule` datetime DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `message` text NOT NULL,
  `priority` enum('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  `request_status` enum('Submitted','Under Review','Assigned','In Progress','Waiting for Information','Resolved','Closed','Rejected','Cancelled') NOT NULL DEFAULT 'Submitted',
  `assigned_to` bigint UNSIGNED DEFAULT NULL,
  `admin_notes` text,
  `public_response` text,
  `consent_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_read_by_admin` tinyint(1) NOT NULL DEFAULT '1',
  `is_read_by_member` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `request_status_history`
--

CREATE TABLE `request_status_history` (
  `request_status_history_id` bigint UNSIGNED NOT NULL,
  `request_id` bigint UNSIGNED NOT NULL,
  `old_status` enum('Submitted','Under Review','Assigned','In Progress','Waiting for Information','Resolved','Closed','Rejected','Cancelled') DEFAULT NULL,
  `new_status` enum('Submitted','Under Review','Assigned','In Progress','Waiting for Information','Resolved','Closed','Rejected','Cancelled') NOT NULL,
  `internal_note` text,
  `user_visible_message` text,
  `changed_by` bigint UNSIGNED DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `role_id` smallint UNSIGNED NOT NULL,
  `role_name` varchar(80) NOT NULL,
  `role_slug` varchar(80) NOT NULL,
  `description` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `share_capital_payments`
--

CREATE TABLE `share_capital_payments` (
  `share_payment_id` bigint UNSIGNED NOT NULL,
  `member_id` bigint UNSIGNED NOT NULL,
  `payment_reference_id` bigint UNSIGNED DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_status` enum('Pending','Validated','Rejected','Reversed') NOT NULL DEFAULT 'Pending',
  `verified_by` bigint UNSIGNED DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `reversal_of_payment_id` bigint UNSIGNED DEFAULT NULL,
  `remarks` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `system_setting_id` bigint UNSIGNED NOT NULL,
  `setting_group` varchar(100) NOT NULL,
  `setting_key` varchar(160) NOT NULL,
  `setting_value` longtext,
  `value_type` enum('String','Number','Boolean','Date','JSON') NOT NULL DEFAULT 'String',
  `description` text,
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `effective_date` date DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` bigint UNSIGNED NOT NULL,
  `role_id` smallint UNSIGNED NOT NULL,
  `username` varchar(80) DEFAULT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(160) NOT NULL,
  `account_status` enum('Pending','Active','Suspended','Inactive') NOT NULL DEFAULT 'Pending',
  `email_verified_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `failed_login_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_activation_tokens`
--

CREATE TABLE `user_activation_tokens` (
  `user_activation_token_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_sessions`
--

CREATE TABLE `user_sessions` (
  `session_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `session_token_hash` char(64) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_barangay_member_distribution`
-- (See below for the actual view)
--
CREATE TABLE `v_barangay_member_distribution` (
`active_official_members` decimal(23,0)
,`associate_members` decimal(23,0)
,`barangay` varchar(120)
,`total_members` bigint
,`true_members` decimal(23,0)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_dashboard_financial_overview`
-- (See below for the actual view)
--
CREATE TABLE `v_dashboard_financial_overview` (
`available_balance` decimal(34,2)
,`open_rental_bookings` bigint
,`open_requests` bigint
,`pending_payment_references` bigint
,`total_expense` decimal(34,2)
,`total_income` decimal(34,2)
,`total_share_capital` decimal(34,2)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_financial_monthly_summary`
-- (See below for the actual view)
--
CREATE TABLE `v_financial_monthly_summary` (
`month_start` varchar(10)
,`net_movement` decimal(34,2)
,`total_expense` decimal(34,2)
,`total_income` decimal(34,2)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_latest_member_status_indicator`
-- (See below for the actual view)
--
CREATE TABLE `v_latest_member_status_indicator` (
`basis_period_end` date
,`basis_period_start` date
,`basis_summary` text
,`computed_at` datetime
,`computed_by` bigint unsigned
,`contribution_score` smallint unsigned
,`frequency_score` smallint unsigned
,`indicator_id` bigint unsigned
,`member_id` bigint unsigned
,`recency_score` smallint unsigned
,`status_label` enum('Active','Needs Monitoring','Inactive')
,`total_score` smallint unsigned
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_member_share_capital_summary`
-- (See below for the actual view)
--
CREATE TABLE `v_member_share_capital_summary` (
`approval_status` enum('Pending','Approved','Rejected','Needs Information')
,`deadline_status` varchar(15)
,`eligible_for_true_membership_review` int
,`full_name` varchar(190)
,`initial_payment_met` int
,`member_code` varchar(60)
,`member_id` bigint unsigned
,`membership_type` enum('Associate','True Member')
,`official_member_status` enum('Pending','Active','Inactive','Suspended','Terminated')
,`remaining_for_true_membership` decimal(35,2)
,`share_capital_deadline` date
,`validated_share_capital` decimal(34,2)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_product_inventory_balance`
-- (See below for the actual view)
--
CREATE TABLE `v_product_inventory_balance` (
`category` varchar(120)
,`product_id` bigint unsigned
,`product_name` varchar(190)
,`product_status` enum('Draft','Active','Out of Stock','Inactive','Archived')
,`quantity_on_hand` decimal(34,3)
,`reorder_level` decimal(12,3)
,`selling_price` decimal(12,2)
,`sku` varchar(80)
,`stock_status` varchar(12)
,`unit` varchar(40)
);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`announcement_id`),
  ADD UNIQUE KEY `uq_announcements_slug` (`slug`),
  ADD KEY `fk_announcements_poster` (`posted_by`),
  ADD KEY `idx_announcements_publication` (`announcement_status`,`audience_type`,`publish_at`),
  ADD KEY `idx_announcements_title` (`title`);

--
-- Indexes for table `announcement_acknowledgments`
--
ALTER TABLE `announcement_acknowledgments`
  ADD PRIMARY KEY (`announcement_id`,`user_id`),
  ADD KEY `fk_ack_user` (`user_id`);

--
-- Indexes for table `announcement_audience_targets`
--
ALTER TABLE `announcement_audience_targets`
  ADD PRIMARY KEY (`announcement_target_id`),
  ADD UNIQUE KEY `uq_announcement_target` (`announcement_id`,`target_type`,`target_value`),
  ADD KEY `idx_announcement_targets_lookup` (`target_type`,`target_value`,`announcement_id`),
  ADD KEY `idx_announcement_targets_announcement` (`announcement_id`,`target_type`);

--
-- Indexes for table `announcement_images`
--
ALTER TABLE `announcement_images`
  ADD PRIMARY KEY (`announcement_image_id`),
  ADD UNIQUE KEY `uq_announcement_image_path` (`announcement_id`,`image_path`),
  ADD KEY `idx_announcement_images_order` (`announcement_id`,`sort_order`,`announcement_image_id`);

--
-- Indexes for table `announcement_recipients`
--
ALTER TABLE `announcement_recipients`
  ADD PRIMARY KEY (`announcement_recipient_id`),
  ADD UNIQUE KEY `uq_announcement_recipient` (`announcement_id`,`user_id`),
  ADD KEY `idx_announcement_recipients_user` (`user_id`,`read_at`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`audit_log_id`),
  ADD KEY `idx_audit_logs_user_time` (`user_id`,`action_time`),
  ADD KEY `idx_audit_logs_entity` (`entity_table`,`record_id`,`action_time`),
  ADD KEY `idx_audit_logs_action` (`action`,`action_time`);

--
-- Indexes for table `documents`
--
ALTER TABLE `documents`
  ADD PRIMARY KEY (`document_id`),
  ADD UNIQUE KEY `uq_documents_reference` (`document_reference`),
  ADD KEY `fk_documents_uploader` (`uploaded_by`),
  ADD KEY `fk_documents_replacement` (`replacement_of_document_id`),
  ADD KEY `idx_documents_access_type` (`access_level`,`document_type`,`document_status`),
  ADD KEY `idx_documents_member` (`member_id`,`uploaded_at`),
  ADD KEY `idx_documents_title` (`title`);

--
-- Indexes for table `document_access_logs`
--
ALTER TABLE `document_access_logs`
  ADD PRIMARY KEY (`document_access_log_id`),
  ADD KEY `idx_document_access_document` (`document_id`,`accessed_at`),
  ADD KEY `idx_document_access_version` (`document_version_id`,`accessed_at`),
  ADD KEY `idx_document_access_user` (`user_id`,`accessed_at`);

--
-- Indexes for table `document_versions`
--
ALTER TABLE `document_versions`
  ADD PRIMARY KEY (`document_version_id`),
  ADD UNIQUE KEY `uq_document_versions_number` (`document_id`,`version_number`),
  ADD KEY `fk_document_versions_uploader` (`uploaded_by`),
  ADD KEY `idx_document_versions_created` (`document_id`,`created_at`);

--
-- Indexes for table `financial_categories`
--
ALTER TABLE `financial_categories`
  ADD PRIMARY KEY (`financial_category_id`),
  ADD UNIQUE KEY `uq_financial_category_code` (`category_code`),
  ADD UNIQUE KEY `uq_financial_category_name_type` (`category_name`,`category_type`),
  ADD KEY `fk_financial_category_creator` (`created_by`);

--
-- Indexes for table `financial_records`
--
ALTER TABLE `financial_records`
  ADD PRIMARY KEY (`financial_record_id`),
  ADD UNIQUE KEY `uq_financial_record_number` (`record_number`),
  ADD KEY `fk_financial_payment_reference` (`payment_reference_id`),
  ADD KEY `fk_financial_recorded_by` (`recorded_by`),
  ADD KEY `fk_financial_approved_by` (`approved_by`),
  ADD KEY `fk_financial_correction` (`correction_of_record_id`),
  ADD KEY `fk_financial_reversal` (`reversal_of_record_id`),
  ADD KEY `idx_financial_record_date_type` (`record_date`,`record_type`,`record_status`),
  ADD KEY `idx_financial_category_date` (`financial_category_id`,`record_date`),
  ADD KEY `idx_financial_source` (`source_module`,`source_record_id`),
  ADD KEY `idx_financial_member` (`member_id`,`record_date`);

--
-- Indexes for table `gallery_groups`
--
ALTER TABLE `gallery_groups`
  ADD PRIMARY KEY (`gallery_group_id`),
  ADD KEY `fk_gallery_groups_uploader` (`uploaded_by`),
  ADD KEY `idx_gallery_groups_public` (`gallery_status`,`public_visibility`,`activity_date`,`display_order`),
  ADD KEY `idx_gallery_groups_created` (`created_at`,`display_order`);

--
-- Indexes for table `gallery_images`
--
ALTER TABLE `gallery_images`
  ADD PRIMARY KEY (`gallery_image_id`),
  ADD UNIQUE KEY `uq_gallery_images_path` (`gallery_group_id`,`image_path`),
  ADD KEY `idx_gallery_images_order` (`gallery_group_id`,`sort_order`,`gallery_image_id`),
  ADD KEY `idx_gallery_images_cover` (`gallery_group_id`,`is_cover`);

--
-- Indexes for table `gallery_items`
--
ALTER TABLE `gallery_items`
  ADD PRIMARY KEY (`gallery_item_id`),
  ADD KEY `fk_gallery_items_uploader` (`uploaded_by`),
  ADD KEY `idx_gallery_public` (`gallery_status`,`public_visibility`,`activity_date`,`display_order`);

--
-- Indexes for table `gallery_landing_slots`
--
ALTER TABLE `gallery_landing_slots`
  ADD PRIMARY KEY (`slot_key`),
  ADD KEY `fk_gallery_landing_slots_updated_by` (`updated_by`),
  ADD KEY `idx_gallery_landing_slots_group` (`gallery_group_id`),
  ADD KEY `idx_gallery_landing_slots_image` (`gallery_image_id`);

--
-- Indexes for table `inquiries`
--
ALTER TABLE `inquiries`
  ADD PRIMARY KEY (`inquiry_id`),
  ADD UNIQUE KEY `uq_inquiries_tracking_code` (`tracking_code`),
  ADD KEY `fk_inquiries_assigned_to` (`assigned_to`);

--
-- Indexes for table `inquiry_messages`
--
ALTER TABLE `inquiry_messages`
  ADD PRIMARY KEY (`message_id`),
  ADD KEY `fk_inquiry_messages_inquiry` (`inquiry_id`),
  ADD KEY `fk_inquiry_messages_user` (`sender_user_id`);

--
-- Indexes for table `inventory_movements`
--
ALTER TABLE `inventory_movements`
  ADD PRIMARY KEY (`inventory_movement_id`),
  ADD KEY `fk_inventory_pos_sale_item` (`pos_sale_item_id`),
  ADD KEY `fk_inventory_recorded_by` (`recorded_by`),
  ADD KEY `idx_inventory_product_date` (`product_id`,`movement_date`),
  ADD KEY `idx_inventory_sale` (`pos_sale_id`,`pos_sale_item_id`);

--
-- Indexes for table `membership_account_activations`
--
ALTER TABLE `membership_account_activations`
  ADD PRIMARY KEY (`membership_account_activation_id`),
  ADD UNIQUE KEY `uq_membership_activation_application` (`membership_application_id`),
  ADD UNIQUE KEY `uq_membership_activation_user` (`user_id`),
  ADD UNIQUE KEY `uq_membership_activation_token` (`token_hash`),
  ADD KEY `fk_membership_activation_creator` (`created_by`);

--
-- Indexes for table `membership_applications`
--
ALTER TABLE `membership_applications`
  ADD PRIMARY KEY (`membership_application_id`),
  ADD UNIQUE KEY `uq_membership_applications_code` (`application_code`),
  ADD UNIQUE KEY `uq_membership_applications_tracking_hash` (`public_tracking_token_hash`),
  ADD KEY `fk_membership_application_submitter` (`submitted_by_user_id`),
  ADD KEY `fk_membership_application_reviewer` (`reviewed_by`),
  ADD KEY `fk_membership_application_converted_member` (`converted_member_id`);

--
-- Indexes for table `membership_application_beneficiaries`
--
ALTER TABLE `membership_application_beneficiaries`
  ADD PRIMARY KEY (`membership_application_beneficiary_id`),
  ADD KEY `fk_membership_beneficiary_application` (`membership_application_id`);

--
-- Indexes for table `membership_application_documents`
--
ALTER TABLE `membership_application_documents`
  ADD PRIMARY KEY (`membership_application_document_id`),
  ADD KEY `fk_membership_document_application` (`membership_application_id`),
  ADD KEY `fk_membership_document_uploader` (`uploaded_by_user_id`);

--
-- Indexes for table `membership_application_notes`
--
ALTER TABLE `membership_application_notes`
  ADD PRIMARY KEY (`membership_application_note_id`),
  ADD KEY `fk_membership_note_user` (`created_by`),
  ADD KEY `idx_membership_note_application` (`membership_application_id`,`created_at`);

--
-- Indexes for table `membership_application_payments`
--
ALTER TABLE `membership_application_payments`
  ADD PRIMARY KEY (`membership_application_payment_id`),
  ADD UNIQUE KEY `uq_membership_payment_reference` (`payment_reference_id`),
  ADD UNIQUE KEY `uq_membership_payment_receipt` (`receipt_number`),
  ADD KEY `fk_membership_payment_validator` (`validated_by`),
  ADD KEY `idx_membership_payment_application` (`membership_application_id`),
  ADD KEY `idx_membership_payment_status` (`payment_status`);

--
-- Indexes for table `membership_application_requirements`
--
ALTER TABLE `membership_application_requirements`
  ADD PRIMARY KEY (`membership_application_requirement_id`),
  ADD KEY `fk_membership_requirement_application` (`membership_application_id`),
  ADD KEY `fk_membership_requirement_payment` (`payment_reference_id`),
  ADD KEY `fk_membership_requirement_document` (`membership_application_document_id`),
  ADD KEY `fk_membership_requirement_verifier` (`verified_by`);

--
-- Indexes for table `membership_application_status_history`
--
ALTER TABLE `membership_application_status_history`
  ADD PRIMARY KEY (`membership_application_status_history_id`),
  ADD KEY `fk_membership_application_history_application` (`membership_application_id`),
  ADD KEY `fk_membership_application_history_user` (`changed_by`);

--
-- Indexes for table `member_profiles`
--
ALTER TABLE `member_profiles`
  ADD PRIMARY KEY (`member_id`),
  ADD UNIQUE KEY `uq_member_profiles_code` (`member_code`),
  ADD UNIQUE KEY `uq_member_profiles_user` (`user_id`),
  ADD KEY `fk_member_profiles_approved_by` (`approved_by`),
  ADD KEY `idx_members_name` (`full_name`),
  ADD KEY `idx_members_barangay` (`barangay`),
  ADD KEY `idx_members_type_status` (`membership_type`,`approval_status`,`official_member_status`),
  ADD KEY `idx_members_sector` (`sector`);

--
-- Indexes for table `member_status_history`
--
ALTER TABLE `member_status_history`
  ADD PRIMARY KEY (`member_status_history_id`),
  ADD KEY `fk_member_status_history_user` (`changed_by`),
  ADD KEY `idx_member_status_history_member` (`member_id`,`changed_at`);

--
-- Indexes for table `member_status_indicators`
--
ALTER TABLE `member_status_indicators`
  ADD PRIMARY KEY (`indicator_id`),
  ADD KEY `fk_member_indicator_computed_by` (`computed_by`),
  ADD KEY `idx_member_indicator_latest` (`member_id`,`computed_at`),
  ADD KEY `idx_member_indicator_status` (`status_label`,`computed_at`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `idx_notifications_user_read` (`user_id`,`is_read`,`created_at`);

--
-- Indexes for table `partners_certifications`
--
ALTER TABLE `partners_certifications`
  ADD PRIMARY KEY (`partner_certification_id`),
  ADD KEY `fk_partners_certifications_creator` (`created_by`),
  ADD KEY `idx_partners_certifications_status` (`record_type`,`status`,`public_visibility`,`display_order`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`reset_token_id`),
  ADD UNIQUE KEY `uq_password_reset_token` (`token_hash`),
  ADD KEY `idx_password_reset_user` (`user_id`,`expires_at`,`used_at`);

--
-- Indexes for table `patronage_allocations`
--
ALTER TABLE `patronage_allocations`
  ADD PRIMARY KEY (`patronage_allocation_id`),
  ADD UNIQUE KEY `uq_patronage_allocation_member` (`patronage_period_id`,`member_id`),
  ADD KEY `fk_patronage_allocation_payer` (`paid_by`),
  ADD KEY `idx_patronage_allocation_member` (`member_id`,`payment_status`),
  ADD KEY `idx_patronage_allocation_period_status` (`patronage_period_id`,`payment_status`);

--
-- Indexes for table `patronage_periods`
--
ALTER TABLE `patronage_periods`
  ADD PRIMARY KEY (`patronage_period_id`),
  ADD UNIQUE KEY `uq_patronage_period_name` (`period_name`),
  ADD KEY `fk_patronage_period_creator` (`created_by`),
  ADD KEY `fk_patronage_period_finalizer` (`finalized_by`),
  ADD KEY `idx_patronage_period_dates` (`period_start`,`period_end`,`period_status`);

--
-- Indexes for table `payment_gateway_checkout_attempts`
--
ALTER TABLE `payment_gateway_checkout_attempts`
  ADD PRIMARY KEY (`payment_gateway_checkout_attempt_id`),
  ADD UNIQUE KEY `uq_checkout_attempt_idempotency` (`idempotency_key`),
  ADD UNIQUE KEY `uq_checkout_attempt_sequence` (`payment_reference_id`,`gateway_name`,`attempt_number`),
  ADD UNIQUE KEY `uq_checkout_attempt_gateway_id` (`gateway_name`,`gateway_checkout_id`),
  ADD KEY `idx_checkout_attempt_active` (`payment_reference_id`,`gateway_name`,`gateway_environment`,`reusable_until`,`superseded_at`,`completed_at`);

--
-- Indexes for table `payment_gateway_events`
--
ALTER TABLE `payment_gateway_events`
  ADD PRIMARY KEY (`payment_gateway_event_id`),
  ADD UNIQUE KEY `uq_payment_gateway_event_fingerprint` (`event_fingerprint`),
  ADD UNIQUE KEY `uq_gateway_event_object` (`gateway_name`,`gateway_event_object_id`),
  ADD KEY `fk_payment_gateway_event_reference` (`payment_reference_id`),
  ADD KEY `fk_gateway_event_last_retried_by` (`last_retried_by`),
  ADD KEY `idx_gateway_event_retry_eligibility` (`processing_status`,`signature_verified_at`,`payment_reference_id`),
  ADD KEY `idx_payment_gateway_events_status_retry` (`processing_status`,`retry_count`,`last_attempt_at`),
  ADD KEY `idx_payment_gateway_events_reference_number` (`gateway_reference_number`);

--
-- Indexes for table `payment_receipts`
--
ALTER TABLE `payment_receipts`
  ADD PRIMARY KEY (`payment_receipt_id`),
  ADD UNIQUE KEY `uq_payment_receipt_reference` (`payment_reference_id`),
  ADD UNIQUE KEY `uq_payment_receipt_number` (`receipt_number`),
  ADD UNIQUE KEY `uq_payment_receipt_document` (`document_id`),
  ADD KEY `fk_payment_receipt_issuer` (`issued_by`),
  ADD KEY `idx_payment_receipt_member` (`member_id`,`issued_at`),
  ADD KEY `idx_payment_receipt_processing` (`processing_status`,`last_attempt_at`);

--
-- Indexes for table `payment_references`
--
ALTER TABLE `payment_references`
  ADD PRIMARY KEY (`payment_reference_id`),
  ADD UNIQUE KEY `uq_payment_provider_reference` (`provider`,`reference_number`),
  ADD UNIQUE KEY `uq_payment_gateway_checkout` (`gateway_checkout_id`),
  ADD UNIQUE KEY `uq_payment_gateway_payment` (`gateway_payment_id`),
  ADD UNIQUE KEY `uq_payment_idempotency` (`idempotency_key`),
  ADD UNIQUE KEY `uq_payment_client_request_id` (`client_request_id`),
  ADD KEY `fk_payment_reference_submitter` (`submitted_by`),
  ADD KEY `fk_payment_reference_validator` (`validated_by`),
  ADD KEY `idx_payment_reference_member` (`member_id`,`submitted_at`),
  ADD KEY `idx_payment_reference_status` (`validation_status`,`payment_purpose`,`submitted_at`),
  ADD KEY `idx_payment_reference_related` (`related_entity_type`,`related_entity_id`);

--
-- Indexes for table `payment_validation_history`
--
ALTER TABLE `payment_validation_history`
  ADD PRIMARY KEY (`payment_validation_history_id`),
  ADD KEY `fk_payment_validation_history_reference` (`payment_reference_id`),
  ADD KEY `fk_payment_validation_history_user` (`changed_by`),
  ADD KEY `fk_payment_validation_history_event` (`gateway_event_id`);

--
-- Indexes for table `pos_sales`
--
ALTER TABLE `pos_sales`
  ADD PRIMARY KEY (`pos_sale_id`),
  ADD UNIQUE KEY `uq_pos_sales_number` (`sale_number`),
  ADD KEY `fk_pos_sales_payment_reference` (`payment_reference_id`),
  ADD KEY `fk_pos_sales_recorded_by` (`recorded_by`),
  ADD KEY `idx_pos_sales_date_status` (`sale_date`,`sale_status`,`payment_status`),
  ADD KEY `idx_pos_sales_member` (`member_id`,`sale_date`),
  ADD KEY `idx_pos_sales_type` (`sale_type`,`sale_status`);

--
-- Indexes for table `pos_sale_items`
--
ALTER TABLE `pos_sale_items`
  ADD PRIMARY KEY (`pos_sale_item_id`),
  ADD KEY `idx_pos_sale_items_sale` (`pos_sale_id`),
  ADD KEY `idx_pos_sale_items_product` (`product_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`product_id`),
  ADD UNIQUE KEY `uq_products_sku` (`sku`),
  ADD KEY `fk_products_creator` (`created_by`),
  ADD KEY `idx_products_name_status` (`product_name`,`product_status`),
  ADD KEY `idx_products_category` (`category`,`product_status`);

--
-- Indexes for table `rental_assets`
--
ALTER TABLE `rental_assets`
  ADD PRIMARY KEY (`rental_asset_id`),
  ADD UNIQUE KEY `uq_rental_asset_code` (`asset_code`),
  ADD KEY `fk_rental_assets_creator` (`created_by`),
  ADD KEY `idx_rental_assets_name_status` (`asset_name`,`asset_status`),
  ADD KEY `idx_rental_assets_category` (`category`,`asset_status`);

--
-- Indexes for table `rental_asset_attachments`
--
ALTER TABLE `rental_asset_attachments`
  ADD PRIMARY KEY (`primary_asset_id`,`attachment_asset_id`),
  ADD KEY `fk_raa_attachment` (`attachment_asset_id`);

--
-- Indexes for table `rental_bookings`
--
ALTER TABLE `rental_bookings`
  ADD PRIMARY KEY (`rental_booking_id`),
  ADD UNIQUE KEY `uq_rental_booking_number` (`booking_number`),
  ADD KEY `fk_rental_booking_payment_reference` (`payment_reference_id`),
  ADD KEY `fk_rental_booking_approved_by` (`approved_by`),
  ADD KEY `fk_rental_booking_recorded_by` (`recorded_by`),
  ADD KEY `idx_rental_bookings_asset_schedule` (`rental_asset_id`,`start_datetime`,`end_datetime`,`booking_status`),
  ADD KEY `idx_rental_bookings_member` (`member_id`,`created_at`),
  ADD KEY `idx_rental_bookings_status` (`booking_status`,`payment_status`,`start_datetime`),
  ADD KEY `fk_rental_booking_operator` (`operator_id`);

--
-- Indexes for table `rental_booking_attachments`
--
ALTER TABLE `rental_booking_attachments`
  ADD PRIMARY KEY (`rental_booking_id`,`attachment_asset_id`),
  ADD KEY `fk_rba_attachment` (`attachment_asset_id`);

--
-- Indexes for table `rental_booking_sequences`
--
ALTER TABLE `rental_booking_sequences`
  ADD PRIMARY KEY (`reference_year`);

--
-- Indexes for table `rental_handovers`
--
ALTER TABLE `rental_handovers`
  ADD PRIMARY KEY (`handover_id`),
  ADD KEY `fk_rental_handover_booking` (`rental_booking_id`),
  ADD KEY `fk_rental_handover_user` (`recorded_by`);

--
-- Indexes for table `rental_idempotency_keys`
--
ALTER TABLE `rental_idempotency_keys`
  ADD PRIMARY KEY (`idempotency_key`),
  ADD KEY `idx_rental_idempotency_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_rental_idempotency_expiry` (`expires_at`);

--
-- Indexes for table `rental_maintenance_periods`
--
ALTER TABLE `rental_maintenance_periods`
  ADD PRIMARY KEY (`rental_maintenance_id`),
  ADD KEY `fk_rental_maintenance_creator` (`created_by`),
  ADD KEY `fk_rental_maintenance_completer` (`completed_by`),
  ADD KEY `idx_rental_maintenance_asset_period` (`rental_asset_id`,`start_datetime`,`end_datetime`,`maintenance_status`);

--
-- Indexes for table `rental_operators`
--
ALTER TABLE `rental_operators`
  ADD PRIMARY KEY (`operator_id`);

--
-- Indexes for table `rental_pos_records`
--
ALTER TABLE `rental_pos_records`
  ADD PRIMARY KEY (`rental_pos_id`),
  ADD KEY `fk_rental_pos_payment_reference` (`payment_reference_id`),
  ADD KEY `fk_rental_pos_recorded_by` (`recorded_by`),
  ADD KEY `fk_rental_pos_sale` (`pos_sale_id`),
  ADD KEY `fk_rental_pos_booking` (`rental_booking_id`),
  ADD KEY `idx_rental_pos_date_type` (`transaction_date`,`transaction_type`),
  ADD KEY `idx_rental_pos_member` (`member_id`,`transaction_date`);

--
-- Indexes for table `rental_status_history`
--
ALTER TABLE `rental_status_history`
  ADD PRIMARY KEY (`rental_status_history_id`),
  ADD KEY `fk_rental_status_user` (`changed_by`),
  ADD KEY `idx_rental_status_history_booking` (`rental_booking_id`,`changed_at`);

--
-- Indexes for table `reports`
--
ALTER TABLE `reports`
  ADD PRIMARY KEY (`report_id`),
  ADD UNIQUE KEY `uq_reports_number` (`report_number`),
  ADD KEY `fk_reports_generator` (`generated_by`),
  ADD KEY `fk_reports_document` (`document_id`),
  ADD KEY `idx_reports_type_date` (`report_type`,`generated_at`),
  ADD KEY `idx_reports_period` (`report_period_start`,`report_period_end`);

--
-- Indexes for table `requests_inquiries`
--
ALTER TABLE `requests_inquiries`
  ADD PRIMARY KEY (`request_id`),
  ADD UNIQUE KEY `uq_requests_reference_code` (`reference_code`),
  ADD KEY `fk_requests_submitter` (`submitted_by`),
  ADD KEY `fk_requests_announcement` (`announcement_id`),
  ADD KEY `fk_requests_document` (`related_document_id`),
  ADD KEY `fk_requests_rental` (`related_rental_booking_id`),
  ADD KEY `fk_requests_pos` (`related_pos_sale_id`),
  ADD KEY `idx_requests_status_priority` (`request_status`,`priority`,`submitted_at`),
  ADD KEY `idx_requests_member` (`member_id`,`submitted_at`),
  ADD KEY `idx_requests_assigned` (`assigned_to`,`request_status`),
  ADD KEY `idx_requests_type` (`request_type`,`request_status`);

--
-- Indexes for table `request_status_history`
--
ALTER TABLE `request_status_history`
  ADD PRIMARY KEY (`request_status_history_id`),
  ADD KEY `fk_request_status_user` (`changed_by`),
  ADD KEY `idx_request_status_history_request` (`request_id`,`changed_at`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`role_id`),
  ADD UNIQUE KEY `uq_roles_name` (`role_name`),
  ADD UNIQUE KEY `uq_roles_slug` (`role_slug`);

--
-- Indexes for table `share_capital_payments`
--
ALTER TABLE `share_capital_payments`
  ADD PRIMARY KEY (`share_payment_id`),
  ADD UNIQUE KEY `uq_share_capital_payment_reference` (`payment_reference_id`),
  ADD KEY `fk_share_payment_verifier` (`verified_by`),
  ADD KEY `fk_share_payment_reversal` (`reversal_of_payment_id`),
  ADD KEY `idx_share_payment_member_status` (`member_id`,`payment_status`,`payment_date`),
  ADD KEY `idx_share_payment_reference` (`payment_reference_id`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`system_setting_id`),
  ADD UNIQUE KEY `uq_system_settings_key` (`setting_key`),
  ADD KEY `fk_system_settings_updated_by` (`updated_by`),
  ADD KEY `idx_system_settings_group` (`setting_group`,`setting_key`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `uq_users_email` (`email`),
  ADD UNIQUE KEY `uq_users_username` (`username`),
  ADD KEY `fk_users_created_by` (`created_by`),
  ADD KEY `idx_users_role_status` (`role_id`,`account_status`),
  ADD KEY `idx_users_display_name` (`display_name`);

--
-- Indexes for table `user_activation_tokens`
--
ALTER TABLE `user_activation_tokens`
  ADD PRIMARY KEY (`user_activation_token_id`),
  ADD UNIQUE KEY `uq_user_activation_token_hash` (`token_hash`),
  ADD KEY `fk_user_activation_token_user` (`user_id`),
  ADD KEY `fk_user_activation_token_creator` (`created_by`);

--
-- Indexes for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD UNIQUE KEY `uq_user_sessions_token` (`session_token_hash`),
  ADD KEY `idx_user_sessions_user_active` (`user_id`,`expires_at`,`revoked_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `announcements`
--
ALTER TABLE `announcements`
  MODIFY `announcement_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `announcement_audience_targets`
--
ALTER TABLE `announcement_audience_targets`
  MODIFY `announcement_target_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `announcement_images`
--
ALTER TABLE `announcement_images`
  MODIFY `announcement_image_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `announcement_recipients`
--
ALTER TABLE `announcement_recipients`
  MODIFY `announcement_recipient_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `audit_log_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `documents`
--
ALTER TABLE `documents`
  MODIFY `document_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `document_access_logs`
--
ALTER TABLE `document_access_logs`
  MODIFY `document_access_log_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `document_versions`
--
ALTER TABLE `document_versions`
  MODIFY `document_version_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `financial_categories`
--
ALTER TABLE `financial_categories`
  MODIFY `financial_category_id` smallint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `financial_records`
--
ALTER TABLE `financial_records`
  MODIFY `financial_record_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gallery_groups`
--
ALTER TABLE `gallery_groups`
  MODIFY `gallery_group_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gallery_images`
--
ALTER TABLE `gallery_images`
  MODIFY `gallery_image_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gallery_items`
--
ALTER TABLE `gallery_items`
  MODIFY `gallery_item_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inquiries`
--
ALTER TABLE `inquiries`
  MODIFY `inquiry_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inquiry_messages`
--
ALTER TABLE `inquiry_messages`
  MODIFY `message_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_movements`
--
ALTER TABLE `inventory_movements`
  MODIFY `inventory_movement_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `membership_account_activations`
--
ALTER TABLE `membership_account_activations`
  MODIFY `membership_account_activation_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `membership_applications`
--
ALTER TABLE `membership_applications`
  MODIFY `membership_application_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `membership_application_beneficiaries`
--
ALTER TABLE `membership_application_beneficiaries`
  MODIFY `membership_application_beneficiary_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `membership_application_documents`
--
ALTER TABLE `membership_application_documents`
  MODIFY `membership_application_document_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `membership_application_notes`
--
ALTER TABLE `membership_application_notes`
  MODIFY `membership_application_note_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `membership_application_payments`
--
ALTER TABLE `membership_application_payments`
  MODIFY `membership_application_payment_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `membership_application_requirements`
--
ALTER TABLE `membership_application_requirements`
  MODIFY `membership_application_requirement_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `membership_application_status_history`
--
ALTER TABLE `membership_application_status_history`
  MODIFY `membership_application_status_history_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `member_profiles`
--
ALTER TABLE `member_profiles`
  MODIFY `member_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `member_status_history`
--
ALTER TABLE `member_status_history`
  MODIFY `member_status_history_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `member_status_indicators`
--
ALTER TABLE `member_status_indicators`
  MODIFY `indicator_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `notification_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `partners_certifications`
--
ALTER TABLE `partners_certifications`
  MODIFY `partner_certification_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `reset_token_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `patronage_allocations`
--
ALTER TABLE `patronage_allocations`
  MODIFY `patronage_allocation_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `patronage_periods`
--
ALTER TABLE `patronage_periods`
  MODIFY `patronage_period_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_gateway_checkout_attempts`
--
ALTER TABLE `payment_gateway_checkout_attempts`
  MODIFY `payment_gateway_checkout_attempt_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_gateway_events`
--
ALTER TABLE `payment_gateway_events`
  MODIFY `payment_gateway_event_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_receipts`
--
ALTER TABLE `payment_receipts`
  MODIFY `payment_receipt_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_references`
--
ALTER TABLE `payment_references`
  MODIFY `payment_reference_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_validation_history`
--
ALTER TABLE `payment_validation_history`
  MODIFY `payment_validation_history_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pos_sales`
--
ALTER TABLE `pos_sales`
  MODIFY `pos_sale_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pos_sale_items`
--
ALTER TABLE `pos_sale_items`
  MODIFY `pos_sale_item_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `product_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rental_assets`
--
ALTER TABLE `rental_assets`
  MODIFY `rental_asset_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rental_bookings`
--
ALTER TABLE `rental_bookings`
  MODIFY `rental_booking_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rental_handovers`
--
ALTER TABLE `rental_handovers`
  MODIFY `handover_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rental_maintenance_periods`
--
ALTER TABLE `rental_maintenance_periods`
  MODIFY `rental_maintenance_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rental_operators`
--
ALTER TABLE `rental_operators`
  MODIFY `operator_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rental_pos_records`
--
ALTER TABLE `rental_pos_records`
  MODIFY `rental_pos_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rental_status_history`
--
ALTER TABLE `rental_status_history`
  MODIFY `rental_status_history_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reports`
--
ALTER TABLE `reports`
  MODIFY `report_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `requests_inquiries`
--
ALTER TABLE `requests_inquiries`
  MODIFY `request_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `request_status_history`
--
ALTER TABLE `request_status_history`
  MODIFY `request_status_history_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `role_id` smallint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `share_capital_payments`
--
ALTER TABLE `share_capital_payments`
  MODIFY `share_payment_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `system_setting_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_activation_tokens`
--
ALTER TABLE `user_activation_tokens`
  MODIFY `user_activation_token_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_sessions`
--
ALTER TABLE `user_sessions`
  MODIFY `session_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

-- --------------------------------------------------------

--
-- Structure for view `v_barangay_member_distribution`
--
DROP TABLE IF EXISTS `v_barangay_member_distribution`;

CREATE ALGORITHM=UNDEFINED DEFINER=`trackCOOPadmin`@`%` SQL SECURITY DEFINER VIEW `v_barangay_member_distribution`  AS SELECT coalesce(nullif(trim(`member_profiles`.`barangay`),''),'Unspecified') AS `barangay`, count(0) AS `total_members`, sum((case when (`member_profiles`.`membership_type` = 'Associate') then 1 else 0 end)) AS `associate_members`, sum((case when (`member_profiles`.`membership_type` = 'True Member') then 1 else 0 end)) AS `true_members`, sum((case when (`member_profiles`.`official_member_status` = 'Active') then 1 else 0 end)) AS `active_official_members` FROM `member_profiles` WHERE (`member_profiles`.`approval_status` = 'Approved') GROUP BY coalesce(nullif(trim(`member_profiles`.`barangay`),''),'Unspecified') ;

-- --------------------------------------------------------

--
-- Structure for view `v_dashboard_financial_overview`
--
DROP TABLE IF EXISTS `v_dashboard_financial_overview`;

CREATE ALGORITHM=UNDEFINED DEFINER=`trackCOOPadmin`@`%` SQL SECURITY DEFINER VIEW `v_dashboard_financial_overview`  AS SELECT coalesce(sum((case when ((`financial_records`.`record_type` = 'Income') and (`financial_records`.`record_status` = 'Active')) then `financial_records`.`amount` else 0 end)),0.00) AS `total_income`, coalesce(sum((case when ((`financial_records`.`record_type` = 'Expense') and (`financial_records`.`record_status` = 'Active')) then `financial_records`.`amount` else 0 end)),0.00) AS `total_expense`, coalesce(sum((case when ((`financial_records`.`record_type` = 'Income') and (`financial_records`.`record_status` = 'Active')) then `financial_records`.`amount` when ((`financial_records`.`record_type` = 'Expense') and (`financial_records`.`record_status` = 'Active')) then -(`financial_records`.`amount`) else 0 end)),0.00) AS `available_balance`, (select coalesce(sum(`share_capital_payments`.`amount`),0.00) from `share_capital_payments` where (`share_capital_payments`.`payment_status` = 'Validated')) AS `total_share_capital`, (select count(0) from `payment_references` where (`payment_references`.`validation_status` = 'Pending')) AS `pending_payment_references`, (select count(0) from `rental_bookings` where (`rental_bookings`.`booking_status` in ('Inquiry','Pending','Approved','Scheduled','In Use'))) AS `open_rental_bookings`, (select count(0) from `requests_inquiries` where (`requests_inquiries`.`request_status` not in ('Resolved','Closed','Rejected','Cancelled'))) AS `open_requests` FROM `financial_records` ;

-- --------------------------------------------------------

--
-- Structure for view `v_financial_monthly_summary`
--
DROP TABLE IF EXISTS `v_financial_monthly_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`trackCOOPadmin`@`%` SQL SECURITY DEFINER VIEW `v_financial_monthly_summary`  AS SELECT date_format(`financial_records`.`record_date`,'%Y-%m-01') AS `month_start`, sum((case when ((`financial_records`.`record_type` = 'Income') and (`financial_records`.`record_status` = 'Active')) then `financial_records`.`amount` else 0 end)) AS `total_income`, sum((case when ((`financial_records`.`record_type` = 'Expense') and (`financial_records`.`record_status` = 'Active')) then `financial_records`.`amount` else 0 end)) AS `total_expense`, sum((case when ((`financial_records`.`record_type` = 'Income') and (`financial_records`.`record_status` = 'Active')) then `financial_records`.`amount` when ((`financial_records`.`record_type` = 'Expense') and (`financial_records`.`record_status` = 'Active')) then -(`financial_records`.`amount`) else 0 end)) AS `net_movement` FROM `financial_records` GROUP BY date_format(`financial_records`.`record_date`,'%Y-%m-01') ;

-- --------------------------------------------------------

--
-- Structure for view `v_latest_member_status_indicator`
--
DROP TABLE IF EXISTS `v_latest_member_status_indicator`;

CREATE ALGORITHM=UNDEFINED DEFINER=`trackCOOPadmin`@`%` SQL SECURITY DEFINER VIEW `v_latest_member_status_indicator`  AS SELECT `msi`.`indicator_id` AS `indicator_id`, `msi`.`member_id` AS `member_id`, `msi`.`basis_period_start` AS `basis_period_start`, `msi`.`basis_period_end` AS `basis_period_end`, `msi`.`recency_score` AS `recency_score`, `msi`.`frequency_score` AS `frequency_score`, `msi`.`contribution_score` AS `contribution_score`, `msi`.`total_score` AS `total_score`, `msi`.`status_label` AS `status_label`, `msi`.`basis_summary` AS `basis_summary`, `msi`.`computed_by` AS `computed_by`, `msi`.`computed_at` AS `computed_at` FROM (`member_status_indicators` `msi` join (select `member_status_indicators`.`member_id` AS `member_id`,max(`member_status_indicators`.`computed_at`) AS `latest_computed_at` from `member_status_indicators` group by `member_status_indicators`.`member_id`) `latest` on(((`latest`.`member_id` = `msi`.`member_id`) and (`latest`.`latest_computed_at` = `msi`.`computed_at`)))) ;

-- --------------------------------------------------------

--
-- Structure for view `v_member_share_capital_summary`
--
DROP TABLE IF EXISTS `v_member_share_capital_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`trackCOOPadmin`@`%` SQL SECURITY DEFINER VIEW `v_member_share_capital_summary`  AS SELECT `m`.`member_id` AS `member_id`, `m`.`member_code` AS `member_code`, `m`.`full_name` AS `full_name`, `m`.`membership_type` AS `membership_type`, `m`.`approval_status` AS `approval_status`, `m`.`official_member_status` AS `official_member_status`, `m`.`share_capital_deadline` AS `share_capital_deadline`, coalesce(sum((case when (`scp`.`payment_status` = 'Validated') then `scp`.`amount` else 0 end)),0.00) AS `validated_share_capital`, greatest((cast(coalesce((select `system_settings`.`setting_value` from `system_settings` where (`system_settings`.`setting_key` = 'business.true_member_share_capital_required') limit 1),'3000.00') as decimal(12,2)) - coalesce(sum((case when (`scp`.`payment_status` = 'Validated') then `scp`.`amount` else 0 end)),0.00)),0.00) AS `remaining_for_true_membership`, (case when (coalesce(sum((case when (`scp`.`payment_status` = 'Validated') then `scp`.`amount` else 0 end)),0.00) >= cast(coalesce((select `system_settings`.`setting_value` from `system_settings` where (`system_settings`.`setting_key` = 'business.initial_share_capital_payment') limit 1),'1500.00') as decimal(12,2))) then 1 else 0 end) AS `initial_payment_met`, (case when (coalesce(sum((case when (`scp`.`payment_status` = 'Validated') then `scp`.`amount` else 0 end)),0.00) >= cast(coalesce((select `system_settings`.`setting_value` from `system_settings` where (`system_settings`.`setting_key` = 'business.true_member_share_capital_required') limit 1),'3000.00') as decimal(12,2))) then 1 else 0 end) AS `eligible_for_true_membership_review`, (case when (`m`.`share_capital_deadline` is null) then 'No Deadline Set' when (curdate() <= `m`.`share_capital_deadline`) then 'Within Deadline' else 'Past Deadline' end) AS `deadline_status` FROM (`member_profiles` `m` left join `share_capital_payments` `scp` on((`scp`.`member_id` = `m`.`member_id`))) GROUP BY `m`.`member_id`, `m`.`member_code`, `m`.`full_name`, `m`.`membership_type`, `m`.`approval_status`, `m`.`official_member_status`, `m`.`share_capital_deadline` ;

-- --------------------------------------------------------

--
-- Structure for view `v_product_inventory_balance`
--
DROP TABLE IF EXISTS `v_product_inventory_balance`;

CREATE ALGORITHM=UNDEFINED DEFINER=`trackCOOPadmin`@`%` SQL SECURITY DEFINER VIEW `v_product_inventory_balance`  AS SELECT `p`.`product_id` AS `product_id`, `p`.`sku` AS `sku`, `p`.`product_name` AS `product_name`, `p`.`category` AS `category`, `p`.`unit` AS `unit`, `p`.`selling_price` AS `selling_price`, `p`.`reorder_level` AS `reorder_level`, `p`.`product_status` AS `product_status`, coalesce(sum(`im`.`quantity_change`),0.000) AS `quantity_on_hand`, (case when (`p`.`track_inventory` = 0) then 'Not Tracked' when (coalesce(sum(`im`.`quantity_change`),0.000) <= 0) then 'Out of Stock' when (coalesce(sum(`im`.`quantity_change`),0.000) <= `p`.`reorder_level`) then 'Low Stock' else 'In Stock' end) AS `stock_status` FROM (`products` `p` left join `inventory_movements` `im` on((`im`.`product_id` = `p`.`product_id`))) GROUP BY `p`.`product_id`, `p`.`sku`, `p`.`product_name`, `p`.`category`, `p`.`unit`, `p`.`selling_price`, `p`.`reorder_level`, `p`.`product_status`, `p`.`track_inventory` ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `announcements`
--
ALTER TABLE `announcements`
  ADD CONSTRAINT `fk_announcements_poster` FOREIGN KEY (`posted_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `announcement_acknowledgments`
--
ALTER TABLE `announcement_acknowledgments`
  ADD CONSTRAINT `fk_ack_announcement` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`announcement_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ack_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `announcement_audience_targets`
--
ALTER TABLE `announcement_audience_targets`
  ADD CONSTRAINT `fk_announcement_targets_announcement` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`announcement_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `announcement_images`
--
ALTER TABLE `announcement_images`
  ADD CONSTRAINT `fk_announcement_images_announcement` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`announcement_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `announcement_recipients`
--
ALTER TABLE `announcement_recipients`
  ADD CONSTRAINT `fk_announcement_recipient_announcement` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`announcement_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_announcement_recipient_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `documents`
--
ALTER TABLE `documents`
  ADD CONSTRAINT `fk_documents_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_documents_replacement` FOREIGN KEY (`replacement_of_document_id`) REFERENCES `documents` (`document_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_documents_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `document_access_logs`
--
ALTER TABLE `document_access_logs`
  ADD CONSTRAINT `fk_document_access_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_document_access_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_document_access_version` FOREIGN KEY (`document_version_id`) REFERENCES `document_versions` (`document_version_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `document_versions`
--
ALTER TABLE `document_versions`
  ADD CONSTRAINT `fk_document_versions_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_document_versions_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `financial_categories`
--
ALTER TABLE `financial_categories`
  ADD CONSTRAINT `fk_financial_category_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `financial_records`
--
ALTER TABLE `financial_records`
  ADD CONSTRAINT `fk_financial_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_financial_category` FOREIGN KEY (`financial_category_id`) REFERENCES `financial_categories` (`financial_category_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_financial_correction` FOREIGN KEY (`correction_of_record_id`) REFERENCES `financial_records` (`financial_record_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_financial_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_financial_payment_reference` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_financial_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_financial_reversal` FOREIGN KEY (`reversal_of_record_id`) REFERENCES `financial_records` (`financial_record_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `gallery_groups`
--
ALTER TABLE `gallery_groups`
  ADD CONSTRAINT `fk_gallery_groups_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `gallery_images`
--
ALTER TABLE `gallery_images`
  ADD CONSTRAINT `fk_gallery_images_group` FOREIGN KEY (`gallery_group_id`) REFERENCES `gallery_groups` (`gallery_group_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `gallery_items`
--
ALTER TABLE `gallery_items`
  ADD CONSTRAINT `fk_gallery_items_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `gallery_landing_slots`
--
ALTER TABLE `gallery_landing_slots`
  ADD CONSTRAINT `fk_gallery_landing_slots_group` FOREIGN KEY (`gallery_group_id`) REFERENCES `gallery_groups` (`gallery_group_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_gallery_landing_slots_image` FOREIGN KEY (`gallery_image_id`) REFERENCES `gallery_images` (`gallery_image_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_gallery_landing_slots_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `inquiries`
--
ALTER TABLE `inquiries`
  ADD CONSTRAINT `fk_inquiries_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `inquiry_messages`
--
ALTER TABLE `inquiry_messages`
  ADD CONSTRAINT `fk_inquiry_messages_inquiry` FOREIGN KEY (`inquiry_id`) REFERENCES `inquiries` (`inquiry_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inquiry_messages_user` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `inventory_movements`
--
ALTER TABLE `inventory_movements`
  ADD CONSTRAINT `fk_inventory_pos_sale` FOREIGN KEY (`pos_sale_id`) REFERENCES `pos_sales` (`pos_sale_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inventory_pos_sale_item` FOREIGN KEY (`pos_sale_item_id`) REFERENCES `pos_sale_items` (`pos_sale_item_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inventory_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inventory_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `membership_account_activations`
--
ALTER TABLE `membership_account_activations`
  ADD CONSTRAINT `fk_membership_activation_application` FOREIGN KEY (`membership_application_id`) REFERENCES `membership_applications` (`membership_application_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_activation_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_activation_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `membership_applications`
--
ALTER TABLE `membership_applications`
  ADD CONSTRAINT `fk_membership_application_converted_member` FOREIGN KEY (`converted_member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_application_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_application_submitter` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `membership_application_beneficiaries`
--
ALTER TABLE `membership_application_beneficiaries`
  ADD CONSTRAINT `fk_membership_beneficiary_application` FOREIGN KEY (`membership_application_id`) REFERENCES `membership_applications` (`membership_application_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `membership_application_documents`
--
ALTER TABLE `membership_application_documents`
  ADD CONSTRAINT `fk_membership_document_application` FOREIGN KEY (`membership_application_id`) REFERENCES `membership_applications` (`membership_application_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_document_uploader` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `membership_application_notes`
--
ALTER TABLE `membership_application_notes`
  ADD CONSTRAINT `fk_membership_note_application` FOREIGN KEY (`membership_application_id`) REFERENCES `membership_applications` (`membership_application_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_note_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `membership_application_payments`
--
ALTER TABLE `membership_application_payments`
  ADD CONSTRAINT `fk_membership_payment_application` FOREIGN KEY (`membership_application_id`) REFERENCES `membership_applications` (`membership_application_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_payment_reference` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_payment_validator` FOREIGN KEY (`validated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `membership_application_requirements`
--
ALTER TABLE `membership_application_requirements`
  ADD CONSTRAINT `fk_membership_requirement_application` FOREIGN KEY (`membership_application_id`) REFERENCES `membership_applications` (`membership_application_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_requirement_document` FOREIGN KEY (`membership_application_document_id`) REFERENCES `membership_application_documents` (`membership_application_document_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_requirement_payment` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_requirement_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `membership_application_status_history`
--
ALTER TABLE `membership_application_status_history`
  ADD CONSTRAINT `fk_membership_application_history_application` FOREIGN KEY (`membership_application_id`) REFERENCES `membership_applications` (`membership_application_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_membership_application_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `member_profiles`
--
ALTER TABLE `member_profiles`
  ADD CONSTRAINT `fk_member_profiles_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_member_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `member_status_history`
--
ALTER TABLE `member_status_history`
  ADD CONSTRAINT `fk_member_status_history_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_member_status_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `member_status_indicators`
--
ALTER TABLE `member_status_indicators`
  ADD CONSTRAINT `fk_member_indicator_computed_by` FOREIGN KEY (`computed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_member_indicator_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `partners_certifications`
--
ALTER TABLE `partners_certifications`
  ADD CONSTRAINT `fk_partners_certifications_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `fk_password_reset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `patronage_allocations`
--
ALTER TABLE `patronage_allocations`
  ADD CONSTRAINT `fk_patronage_allocation_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_patronage_allocation_payer` FOREIGN KEY (`paid_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_patronage_allocation_period` FOREIGN KEY (`patronage_period_id`) REFERENCES `patronage_periods` (`patronage_period_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `patronage_periods`
--
ALTER TABLE `patronage_periods`
  ADD CONSTRAINT `fk_patronage_period_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_patronage_period_finalizer` FOREIGN KEY (`finalized_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `payment_gateway_checkout_attempts`
--
ALTER TABLE `payment_gateway_checkout_attempts`
  ADD CONSTRAINT `fk_checkout_attempt_reference` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `payment_gateway_events`
--
ALTER TABLE `payment_gateway_events`
  ADD CONSTRAINT `fk_gateway_event_last_retried_by` FOREIGN KEY (`last_retried_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_gateway_event_reference` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `payment_receipts`
--
ALTER TABLE `payment_receipts`
  ADD CONSTRAINT `fk_payment_receipt_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_receipt_issuer` FOREIGN KEY (`issued_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_receipt_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_receipt_reference` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `payment_references`
--
ALTER TABLE `payment_references`
  ADD CONSTRAINT `fk_payment_reference_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_reference_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_reference_validator` FOREIGN KEY (`validated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `payment_validation_history`
--
ALTER TABLE `payment_validation_history`
  ADD CONSTRAINT `fk_payment_validation_history_event` FOREIGN KEY (`gateway_event_id`) REFERENCES `payment_gateway_events` (`payment_gateway_event_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_validation_history_reference` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_validation_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `pos_sales`
--
ALTER TABLE `pos_sales`
  ADD CONSTRAINT `fk_pos_sales_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pos_sales_payment_reference` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pos_sales_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `pos_sale_items`
--
ALTER TABLE `pos_sale_items`
  ADD CONSTRAINT `fk_pos_sale_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pos_sale_items_sale` FOREIGN KEY (`pos_sale_id`) REFERENCES `pos_sales` (`pos_sale_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `rental_assets`
--
ALTER TABLE `rental_assets`
  ADD CONSTRAINT `fk_rental_assets_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `rental_asset_attachments`
--
ALTER TABLE `rental_asset_attachments`
  ADD CONSTRAINT `fk_raa_attachment` FOREIGN KEY (`attachment_asset_id`) REFERENCES `rental_assets` (`rental_asset_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_raa_primary` FOREIGN KEY (`primary_asset_id`) REFERENCES `rental_assets` (`rental_asset_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `rental_bookings`
--
ALTER TABLE `rental_bookings`
  ADD CONSTRAINT `fk_rental_booking_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_booking_asset` FOREIGN KEY (`rental_asset_id`) REFERENCES `rental_assets` (`rental_asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_booking_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_booking_operator` FOREIGN KEY (`operator_id`) REFERENCES `rental_operators` (`operator_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_booking_payment_reference` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_booking_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `rental_booking_attachments`
--
ALTER TABLE `rental_booking_attachments`
  ADD CONSTRAINT `fk_rba_attachment` FOREIGN KEY (`attachment_asset_id`) REFERENCES `rental_assets` (`rental_asset_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rba_booking` FOREIGN KEY (`rental_booking_id`) REFERENCES `rental_bookings` (`rental_booking_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `rental_handovers`
--
ALTER TABLE `rental_handovers`
  ADD CONSTRAINT `fk_rental_handover_booking` FOREIGN KEY (`rental_booking_id`) REFERENCES `rental_bookings` (`rental_booking_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_handover_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `rental_maintenance_periods`
--
ALTER TABLE `rental_maintenance_periods`
  ADD CONSTRAINT `fk_rental_maintenance_asset` FOREIGN KEY (`rental_asset_id`) REFERENCES `rental_assets` (`rental_asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_maintenance_completer` FOREIGN KEY (`completed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_maintenance_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `rental_pos_records`
--
ALTER TABLE `rental_pos_records`
  ADD CONSTRAINT `fk_rental_pos_booking` FOREIGN KEY (`rental_booking_id`) REFERENCES `rental_bookings` (`rental_booking_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_pos_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_pos_payment_reference` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_pos_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_pos_sale` FOREIGN KEY (`pos_sale_id`) REFERENCES `pos_sales` (`pos_sale_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `rental_status_history`
--
ALTER TABLE `rental_status_history`
  ADD CONSTRAINT `fk_rental_status_booking` FOREIGN KEY (`rental_booking_id`) REFERENCES `rental_bookings` (`rental_booking_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rental_status_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `reports`
--
ALTER TABLE `reports`
  ADD CONSTRAINT `fk_reports_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reports_generator` FOREIGN KEY (`generated_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `requests_inquiries`
--
ALTER TABLE `requests_inquiries`
  ADD CONSTRAINT `fk_requests_announcement` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`announcement_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_requests_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_requests_document` FOREIGN KEY (`related_document_id`) REFERENCES `documents` (`document_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_requests_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_requests_pos` FOREIGN KEY (`related_pos_sale_id`) REFERENCES `pos_sales` (`pos_sale_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_requests_rental` FOREIGN KEY (`related_rental_booking_id`) REFERENCES `rental_bookings` (`rental_booking_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_requests_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `request_status_history`
--
ALTER TABLE `request_status_history`
  ADD CONSTRAINT `fk_request_status_request` FOREIGN KEY (`request_id`) REFERENCES `requests_inquiries` (`request_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_request_status_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `share_capital_payments`
--
ALTER TABLE `share_capital_payments`
  ADD CONSTRAINT `fk_share_payment_member` FOREIGN KEY (`member_id`) REFERENCES `member_profiles` (`member_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_share_payment_reference` FOREIGN KEY (`payment_reference_id`) REFERENCES `payment_references` (`payment_reference_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_share_payment_reversal` FOREIGN KEY (`reversal_of_payment_id`) REFERENCES `share_capital_payments` (`share_payment_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_share_payment_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD CONSTRAINT `fk_system_settings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `user_activation_tokens`
--
ALTER TABLE `user_activation_tokens`
  ADD CONSTRAINT `fk_user_activation_token_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_user_activation_token_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD CONSTRAINT `fk_user_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
