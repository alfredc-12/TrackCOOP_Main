-- Preserve completed and cancelled events outside the active register without
-- deleting their announcements, attendance, or audit history.
-- Apply after 20261113_activity_completion_and_cancellation.sql.

ALTER TABLE cooperative_activities
  ADD COLUMN archived_at DATETIME NULL AFTER completed_at,
  ADD COLUMN archived_by BIGINT UNSIGNED NULL AFTER archived_at,
  ADD CONSTRAINT fk_cooperative_activity_archiver
    FOREIGN KEY (archived_by) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX idx_cooperative_activity_archive_date
  ON cooperative_activities (archived_at, activity_date);
