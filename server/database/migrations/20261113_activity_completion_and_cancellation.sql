-- Add an explicit lifecycle for managed events and retain the reason for cancellation.
-- Apply after 20261108_activity_management.sql.

ALTER TABLE cooperative_activities
  MODIFY COLUMN activity_status ENUM('Scheduled','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
  ADD COLUMN cancellation_reason TEXT NULL AFTER activity_status,
  ADD COLUMN completed_at DATETIME NULL AFTER cancellation_reason;
