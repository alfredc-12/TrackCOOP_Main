-- Forward-only upload intent. Existing source/document data is not backfilled.
CREATE TABLE finance_evidence_upload_intents (
 intent_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 financial_record_id BIGINT UNSIGNED NOT NULL,
 source_owner_id BIGINT UNSIGNED NOT NULL,
 uploaded_by BIGINT UNSIGNED NOT NULL,
 request_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 object_key VARCHAR(500) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 storage_provider ENUM('S3') NOT NULL,
 expected_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 expected_size BIGINT UNSIGNED NOT NULL,
 expected_mime VARCHAR(120) NOT NULL,
 document_id BIGINT UNSIGNED NULL,
 document_version INT UNSIGNED NULL,
 object_version VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
 intent_state ENUM('PREPARED','FINALIZED','FAILED','RECOVERY_REQUIRED') NOT NULL DEFAULT 'PREPARED',
 generation INT UNSIGNED NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_evidence_intent_request(request_key),
 UNIQUE KEY uq_evidence_intent_object(object_key),
 UNIQUE KEY uq_evidence_intent_document(document_id),
 KEY ix_evidence_intent_source(financial_record_id,intent_state),
 CONSTRAINT ck_evidence_intent_size CHECK(expected_size > 0 AND expected_size <= 10485760),
 CONSTRAINT ck_evidence_intent_generation CHECK(generation > 0),
 CONSTRAINT ck_evidence_intent_finalized CHECK(intent_state <> 'FINALIZED' OR (document_id IS NOT NULL AND document_version IS NOT NULL AND document_version > 0 AND object_version IS NOT NULL AND CHAR_LENGTH(object_version) > 0)),
 CONSTRAINT fk_evidence_intent_source FOREIGN KEY(financial_record_id) REFERENCES financial_records(financial_record_id) ON DELETE RESTRICT,
 CONSTRAINT fk_evidence_intent_owner FOREIGN KEY(source_owner_id) REFERENCES users(user_id) ON DELETE RESTRICT,
 CONSTRAINT fk_evidence_intent_actor FOREIGN KEY(uploaded_by) REFERENCES users(user_id) ON DELETE RESTRICT,
 CONSTRAINT fk_evidence_intent_document FOREIGN KEY(document_id) REFERENCES documents(document_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE finance_evidence_upload_events (
 event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 intent_id BIGINT UNSIGNED NOT NULL,
 generation INT UNSIGNED NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 event_type ENUM('PREPARED','FINALIZED','FAILED','RECOVERY_REQUIRED') NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_evidence_upload_event_version(intent_id,generation),
 CONSTRAINT fk_evidence_upload_event_intent FOREIGN KEY(intent_id) REFERENCES finance_evidence_upload_intents(intent_id) ON DELETE RESTRICT,
 CONSTRAINT fk_evidence_upload_event_actor FOREIGN KEY(actor_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
