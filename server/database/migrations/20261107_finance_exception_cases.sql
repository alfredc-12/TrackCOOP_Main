-- Case workflow metadata only; does not change finance or payment records.
CREATE TABLE finance_exception_cases (
 case_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 source_type ENUM('payment_reference','financial_record','controlled_operation') NOT NULL,
 source_id BIGINT UNSIGNED NOT NULL,
 exception_code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 severity ENUM('Critical','High','Medium','Informational') NOT NULL,
 case_state ENUM('Open','Under Review','Awaiting Evidence','Escalated','Resolved','Closed','Reopened') NOT NULL,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 assigned_to BIGINT UNSIGNED NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_finance_exception_fingerprint (fingerprint),
 KEY ix_finance_exception_queue (case_state,severity,updated_at),
 KEY ix_finance_exception_source (source_type,source_id),
 CONSTRAINT fk_finance_exception_creator FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
 CONSTRAINT fk_finance_exception_assignee FOREIGN KEY(assigned_to) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE finance_exception_events (
 event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 case_id BIGINT UNSIGNED NOT NULL,
 event_version INT UNSIGNED NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 actor_role ENUM('chairman','bookkeeper') NOT NULL,
 assigned_to BIGINT UNSIGNED NULL,
 event_code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 previous_state VARCHAR(32) NULL,
 next_state VARCHAR(32) NOT NULL,
 reason_code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_finance_exception_event_version (case_id,event_version),
 UNIQUE KEY uq_finance_exception_event_key (request_key),
 CONSTRAINT fk_finance_exception_event_case FOREIGN KEY(case_id) REFERENCES finance_exception_cases(case_id) ON DELETE RESTRICT,
 CONSTRAINT fk_finance_exception_event_actor FOREIGN KEY(actor_id) REFERENCES users(user_id) ON DELETE RESTRICT,
 CONSTRAINT fk_finance_exception_event_assignee FOREIGN KEY(assigned_to) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
