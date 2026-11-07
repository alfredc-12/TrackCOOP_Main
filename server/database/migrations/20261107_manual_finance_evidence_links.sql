-- Unverified evidence relationship metadata only. No historical backfill or posting changes.
CREATE TABLE finance_manual_evidence_links (
  link_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  financial_record_id BIGINT UNSIGNED NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  document_version INT UNSIGNED NOT NULL,
  document_checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  supersedes_link_id BIGINT UNSIGNED NULL,
  link_status ENUM('ACTIVE','REPLACED','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN link_status='ACTIVE' THEN 1 ELSE NULL END) STORED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_manual_evidence_active_record (financial_record_id, active_slot),
  UNIQUE KEY uq_manual_evidence_document_history (document_id),
  KEY ix_manual_evidence_history (financial_record_id, link_id),
  CONSTRAINT fk_manual_evidence_record FOREIGN KEY (financial_record_id) REFERENCES financial_records(financial_record_id) ON DELETE RESTRICT,
  CONSTRAINT fk_manual_evidence_document FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE RESTRICT,
  CONSTRAINT fk_manual_evidence_actor FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_manual_evidence_predecessor FOREIGN KEY (supersedes_link_id) REFERENCES finance_manual_evidence_links(link_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE finance_manual_evidence_events (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  link_id BIGINT UNSIGNED NOT NULL,
  link_version INT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('LINKED','REPLACED','REVOKED') NOT NULL,
  replacement_link_id BIGINT UNSIGNED NULL,
  reason VARCHAR(2000) NULL,
  request_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_manual_evidence_event_version (link_id,link_version),
  UNIQUE KEY uq_manual_evidence_request (request_key),
  CONSTRAINT fk_manual_evidence_event_link FOREIGN KEY (link_id) REFERENCES finance_manual_evidence_links(link_id) ON DELETE RESTRICT,
  CONSTRAINT fk_manual_evidence_event_actor FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_manual_evidence_event_replacement FOREIGN KEY (replacement_link_id) REFERENCES finance_manual_evidence_links(link_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
