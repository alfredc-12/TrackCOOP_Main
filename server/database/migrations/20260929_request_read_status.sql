-- ============================================================================
-- TrackCOOP online migration: inquiry read status
-- Adds the fields required by the request conversation and assigned inbox APIs.
-- Existing inquiries are treated as already read to avoid false unread counts.
-- This migration is safe to run more than once.
-- ============================================================================

SET NAMES utf8mb4;

SET @has_is_read_by_admin := (
    SELECT COUNT(*)
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'requests_inquiries'
       AND COLUMN_NAME = 'is_read_by_admin'
);
SET @add_is_read_by_admin := IF(
    @has_is_read_by_admin = 0,
    'ALTER TABLE requests_inquiries ADD COLUMN is_read_by_admin TINYINT(1) NOT NULL DEFAULT 1 AFTER updated_at',
    'SELECT 1'
);
PREPARE add_is_read_by_admin_statement FROM @add_is_read_by_admin;
EXECUTE add_is_read_by_admin_statement;
DEALLOCATE PREPARE add_is_read_by_admin_statement;

SET @has_is_read_by_member := (
    SELECT COUNT(*)
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'requests_inquiries'
       AND COLUMN_NAME = 'is_read_by_member'
);
SET @add_is_read_by_member := IF(
    @has_is_read_by_member = 0,
    'ALTER TABLE requests_inquiries ADD COLUMN is_read_by_member TINYINT(1) NOT NULL DEFAULT 1 AFTER is_read_by_admin',
    'SELECT 1'
);
PREPARE add_is_read_by_member_statement FROM @add_is_read_by_member;
EXECUTE add_is_read_by_member_statement;
DEALLOCATE PREPARE add_is_read_by_member_statement;
