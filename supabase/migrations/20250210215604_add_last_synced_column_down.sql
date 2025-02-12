BEGIN;

-- Remove the last_synced_at column
ALTER TABLE sources_google 
DROP COLUMN last_synced_at;

COMMIT; 