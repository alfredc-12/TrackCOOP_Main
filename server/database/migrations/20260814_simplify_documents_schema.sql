-- TrackCOOP Documents UI and Database Simplification Migration
-- Applied by server/src/scripts/migrate-records.ts after information_schema checks.

-- 1. Drop document_versions table
DROP TABLE IF EXISTS document_versions;

-- 2. Drop non-essential columns from documents table
-- Note: Foreign keys must be dropped before dropping the columns if they exist.
-- Assuming `fk_documents_member` and `fk_documents_replacement` were added when the columns were added.
-- Let's drop the foreign keys first.
ALTER TABLE documents DROP FOREIGN KEY fk_documents_member;
ALTER TABLE documents DROP FOREIGN KEY fk_documents_replacement;

ALTER TABLE documents 
  DROP COLUMN related_module,
  DROP COLUMN related_record_id,
  DROP COLUMN related_record_reference,
  DROP COLUMN relationship_type,
  DROP COLUMN member_id,
  DROP COLUMN document_date,
  DROP COLUMN tags,
  DROP COLUMN internal_note,
  DROP COLUMN current_version,
  DROP COLUMN replacement_of_document_id,
  DROP COLUMN checksum_sha256,
  DROP COLUMN archived_by,
  DROP COLUMN archived_at,
  DROP COLUMN archive_reason;
