BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS idx_google_sources_expert_id;
DROP INDEX IF EXISTS idx_google_sources_document_type_id;
DROP INDEX IF EXISTS idx_google_sources_content_extracted;

-- Remove constraints
ALTER TABLE google_sources
  DROP CONSTRAINT IF EXISTS valid_sync_status,
  DROP CONSTRAINT IF EXISTS valid_extracted_content;

-- Remove columns
ALTER TABLE google_sources
  DROP COLUMN IF EXISTS expert_id,
  DROP COLUMN IF EXISTS sync_status,
  DROP COLUMN IF EXISTS sync_error,
  DROP COLUMN IF EXISTS document_type_id,
  DROP COLUMN IF EXISTS content_extracted,
  DROP COLUMN IF EXISTS extraction_error,
  DROP COLUMN IF EXISTS extracted_content;

COMMIT; 