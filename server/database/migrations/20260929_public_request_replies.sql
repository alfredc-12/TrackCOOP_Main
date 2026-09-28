-- ============================================================================
-- TrackCOOP online migration: public inquiry replies
-- Public visitors do not have a users row, so their history actor is NULL.
-- ============================================================================

SET NAMES utf8mb4;

ALTER TABLE request_status_history
    MODIFY COLUMN changed_by BIGINT UNSIGNED NULL;
