BEGIN;

-- Remove added columns from sources_google
ALTER TABLE sources_google
DROP COLUMN file_name,
DROP COLUMN file_type,
DROP COLUMN file_size,
DROP COLUMN mime_type,
DROP COLUMN created_time,
DROP COLUMN modified_time,
DROP COLUMN web_view_link,
DROP COLUMN is_processed,
DROP COLUMN processing_status;

-- Remove the index
DROP INDEX IF EXISTS idx_sources_google_is_processed;

COMMIT; 