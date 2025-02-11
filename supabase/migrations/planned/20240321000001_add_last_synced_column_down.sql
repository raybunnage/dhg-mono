-- Rollback for: Adding last_synced_at column
-- Safety Level: Safe - Only removes unused column

BEGIN;

-- Remove the last_synced_at column
ALTER TABLE sources_google DROP COLUMN IF EXISTS last_synced_at;

COMMIT; 