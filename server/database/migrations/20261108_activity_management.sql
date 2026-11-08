-- Additive event-management fields. Existing activities stay scheduled and retain
-- their recorded qualification. Legacy participation rows are left untouched.
ALTER TABLE cooperative_activities
  ADD COLUMN activity_time TIME NULL,
  ADD COLUMN activity_location VARCHAR(255) NULL,
  ADD COLUMN activity_status ENUM('Scheduled','Cancelled') NOT NULL DEFAULT 'Scheduled';

-- A separate ownership key enforces one attendance record for each new managed
-- event and member without rewriting legacy participation history.
CREATE TABLE managed_activity_attendance (
  activity_id BIGINT UNSIGNED NOT NULL,
  member_id BIGINT UNSIGNED NOT NULL,
  participation_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (activity_id, member_id),
  UNIQUE KEY uq_managed_participation (participation_id),
  CONSTRAINT fk_managed_activity FOREIGN KEY (activity_id) REFERENCES cooperative_activities (activity_id) ON DELETE RESTRICT,
  CONSTRAINT fk_managed_member FOREIGN KEY (member_id) REFERENCES member_profiles (member_id) ON DELETE RESTRICT,
  CONSTRAINT fk_managed_participation FOREIGN KEY (participation_id) REFERENCES member_activity_participation (participation_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
