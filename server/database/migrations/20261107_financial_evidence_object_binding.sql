-- Additive S3 object binding for finalized upload intents; no historical backfill.
ALTER TABLE finance_evidence_upload_intents
 ADD COLUMN storage_bucket VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
 ADD COLUMN source_snapshot_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 MODIFY COLUMN intent_state ENUM('PREPARED','UPLOADING','FINALIZED','FAILED','RECOVERY_REQUIRED') NOT NULL DEFAULT 'PREPARED';

ALTER TABLE finance_evidence_upload_events
 MODIFY COLUMN event_type ENUM('PREPARED','UPLOADING','FINALIZED','FAILED','RECOVERY_REQUIRED') NOT NULL;
