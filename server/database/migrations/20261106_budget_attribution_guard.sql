-- PR 1B: optional, explicit attribution; no historical rows are backfilled.
CREATE TABLE budget_expense_assignments (
  financial_record_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  budget_line_id BIGINT UNSIGNED NOT NULL,
  commitment_state ENUM('None','Pending') NOT NULL DEFAULT 'None',
  assigned_by BIGINT UNSIGNED NOT NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_budget_assignment_line (budget_line_id, commitment_state),
  CONSTRAINT fk_budget_assignment_record FOREIGN KEY (financial_record_id) REFERENCES financial_records(financial_record_id) ON DELETE RESTRICT,
  CONSTRAINT fk_budget_assignment_line FOREIGN KEY (budget_line_id) REFERENCES budget_lines(budget_line_id) ON DELETE RESTRICT,
  CONSTRAINT fk_budget_assignment_actor FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Participating controlled writers serialize selection, spend and budget transitions.
-- Legacy writers are not connected; activation requires PR 1C integration.
CREATE TABLE budget_control_mutex (
  mutex_id TINYINT UNSIGNED NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
INSERT INTO budget_control_mutex (mutex_id) VALUES (1);

-- Idempotency is recorded in the same transaction as the future controlled post.
CREATE TABLE budget_guard_operations (
  operation_key CHAR(64) NOT NULL PRIMARY KEY,
  request_hash CHAR(64) NOT NULL,
  operation_reference VARCHAR(120) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
