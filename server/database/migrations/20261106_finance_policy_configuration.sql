-- PR 1A: append-only policy revisions and serialized version heads.
-- Adds no policy amount, category, approval or activation.
CREATE TABLE finance_policy_heads (
  policy_kind ENUM('threshold','restrictions') NOT NULL PRIMARY KEY,
  current_version INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

INSERT INTO finance_policy_heads (policy_kind) VALUES ('threshold'), ('restrictions');

CREATE TABLE finance_policy_revisions (
  revision_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  policy_kind ENUM('threshold','restrictions') NOT NULL,
  version INT UNSIGNED NOT NULL,
  state ENUM('DRAFT','APPROVED') NOT NULL,
  configuration JSON NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME(3) NULL,
  effective_at DATETIME(3) NULL,
  UNIQUE KEY uq_finance_policy_kind_version (policy_kind, version),
  KEY idx_finance_policy_effective (policy_kind, state, effective_at, version),
  CONSTRAINT fk_finance_policy_kind FOREIGN KEY (policy_kind) REFERENCES finance_policy_heads(policy_kind),
  CONSTRAINT fk_finance_policy_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_policy_approver FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT chk_finance_policy_approval CHECK ((state = 'DRAFT' AND approved_by IS NULL AND approved_at IS NULL AND effective_at IS NULL) OR (state = 'APPROVED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND effective_at IS NOT NULL))
) ENGINE=InnoDB;
