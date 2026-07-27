-- TrackCOOP Documents and Reports additive migration
-- Applied by server/src/scripts/migrate-records.ts after information_schema checks.
-- This migration never drops or truncates an existing object.

ALTER TABLE documents ADD COLUMN document_reference VARCHAR(60) NULL;
ALTER TABLE documents ADD COLUMN category VARCHAR(80) NULL;
ALTER TABLE documents ADD COLUMN related_module VARCHAR(80) NULL;
ALTER TABLE documents ADD COLUMN related_record_id BIGINT UNSIGNED NULL;
ALTER TABLE documents ADD COLUMN related_record_reference VARCHAR(120) NULL;
ALTER TABLE documents ADD COLUMN relationship_type VARCHAR(80) NULL;
ALTER TABLE documents ADD COLUMN document_date DATE NULL;
ALTER TABLE documents ADD COLUMN expiration_date DATE NULL;
ALTER TABLE documents ADD COLUMN current_version INT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN tags TEXT NULL;
ALTER TABLE documents ADD COLUMN internal_note TEXT NULL;
ALTER TABLE documents ADD COLUMN archived_by BIGINT UNSIGNED NULL;
ALTER TABLE documents ADD COLUMN archived_at DATETIME NULL;
ALTER TABLE documents ADD COLUMN archive_reason TEXT NULL;
ALTER TABLE documents MODIFY uploaded_by BIGINT UNSIGNED NULL;

CREATE TABLE IF NOT EXISTS document_versions (
  document_version_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_extension VARCHAR(20) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  change_note TEXT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_document_versions_number UNIQUE (document_id, version_number),
  CONSTRAINT fk_document_versions_document FOREIGN KEY (document_id)
    REFERENCES documents(document_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_document_versions_uploader FOREIGN KEY (uploaded_by)
    REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_document_versions_created (document_id, created_at)
) ENGINE=InnoDB;

ALTER TABLE document_versions MODIFY uploaded_by BIGINT UNSIGNED NULL;
ALTER TABLE document_versions MODIFY file_size_bytes BIGINT UNSIGNED NULL;
ALTER TABLE document_versions MODIFY checksum_sha256 CHAR(64) NULL;

ALTER TABLE document_access_logs ADD COLUMN document_version_id BIGINT UNSIGNED NULL;
ALTER TABLE document_access_logs ADD COLUMN user_role VARCHAR(40) NULL;
ALTER TABLE document_access_logs MODIFY access_action
  ENUM('View','Preview','Download','Print','Upload','Replace','Permission Change','Archive','Restore') NOT NULL;
ALTER TABLE document_access_logs
  ADD CONSTRAINT fk_document_access_version
  FOREIGN KEY (document_version_id)
  REFERENCES document_versions(document_version_id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE reports ADD COLUMN report_key VARCHAR(80) NULL;
ALTER TABLE reports ADD COLUMN report_title VARCHAR(255) NULL;
ALTER TABLE reports ADD COLUMN report_category VARCHAR(80) NULL;
ALTER TABLE reports ADD COLUMN summary_json LONGTEXT NULL;
ALTER TABLE reports ADD COLUMN output_format VARCHAR(20) NULL;
ALTER TABLE reports ADD COLUMN archived_at DATETIME NULL;
ALTER TABLE reports ADD COLUMN archive_reason TEXT NULL;
