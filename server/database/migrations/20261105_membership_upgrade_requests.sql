CREATE TABLE IF NOT EXISTS membership_upgrade_requests (
  upgrade_request_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id BIGINT UNSIGNED NOT NULL,
  application_message VARCHAR(2000) NOT NULL,
  request_status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
  pending_member_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN request_status = 'Pending' THEN member_id ELSE NULL END) STORED,
  decision_reason VARCHAR(2000) NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_membership_upgrade_pending (pending_member_id),
  KEY idx_membership_upgrade_member (member_id, upgrade_request_id),
  CONSTRAINT fk_membership_upgrade_member FOREIGN KEY (member_id) REFERENCES member_profiles(member_id),
  CONSTRAINT fk_membership_upgrade_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
) ENGINE=InnoDB;
