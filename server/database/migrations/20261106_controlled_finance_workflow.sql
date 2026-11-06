-- PR 1C: workflow metadata only; never backfills or changes existing financial rows.
CREATE TABLE finance_controlled_operations (
  operation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  financial_record_id BIGINT UNSIGNED NOT NULL,
  maker_id BIGINT UNSIGNED NOT NULL,
  idempotency_key CHAR(64) NOT NULL,
  creation_hash CHAR(64) NULL,
  workflow_state ENUM('DRAFT','INCOMPLETE_EVIDENCE','CONFIGURATION_BLOCKED','BUDGET_BLOCKED','PENDING_APPROVAL','REJECTED','ROUTINE_POST_ELIGIBLE','APPROVED_FOR_POSTING','POSTED','CORRECTION_REQUESTED') NOT NULL DEFAULT 'DRAFT',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  threshold_version INT UNSIGNED NULL,
  restriction_version INT UNSIGNED NULL,
  budget_basis CHAR(64) NULL,
  record_fingerprint CHAR(64) NULL,
  evidence_fingerprint CHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_controlled_financial_record (financial_record_id),
  UNIQUE KEY uq_controlled_idempotency (idempotency_key),
  KEY idx_controlled_state (workflow_state, created_at),
  CONSTRAINT fk_controlled_record FOREIGN KEY (financial_record_id) REFERENCES financial_records(financial_record_id) ON DELETE RESTRICT,
  CONSTRAINT fk_controlled_maker FOREIGN KEY (maker_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE finance_controlled_operation_events (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  operation_id BIGINT UNSIGNED NOT NULL,
  operation_version INT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  previous_state VARCHAR(40) NULL,
  next_state VARCHAR(40) NOT NULL,
  reason VARCHAR(2000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_controlled_event_version (operation_id, operation_version),
  CONSTRAINT fk_controlled_event_operation FOREIGN KEY (operation_id) REFERENCES finance_controlled_operations(operation_id) ON DELETE RESTRICT,
  CONSTRAINT fk_controlled_event_actor FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
