BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS idx_sources_google_expert_id;
DROP INDEX IF EXISTS idx_sources_google_document_type_id;
DROP INDEX IF EXISTS idx_sources_google_content_extracted;

-- Remove constraints
ALTER TABLE sources_google
  DROP CONSTRAINT IF EXISTS valid_sync_status,
  DROP CONSTRAINT IF EXISTS valid_extracted_content;

-- Remove columns
ALTER TABLE sources_google
  DROP COLUMN IF EXISTS expert_id,
  DROP COLUMN IF EXISTS sync_status,
  DROP COLUMN IF EXISTS sync_error,
  DROP COLUMN IF EXISTS document_type_id,
  DROP COLUMN IF EXISTS content_extracted,
  DROP COLUMN IF EXISTS extraction_error,
  DROP COLUMN IF EXISTS extracted_content;

COMMIT; 