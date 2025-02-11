-- Description: Adds a last_synced_at timestamp column to sources_google table
-- Safety Level: Safe - Additive only change
-- Rollback: See corresponding down migration

BEGIN;

-- Add optional timestamp column to track last sync time
ALTER TABLE sources_google 
ADD COLUMN last_synced_at TIMESTAMPTZ;

-- Add helpful comment to the column
COMMENT ON COLUMN sources_google.last_synced_at IS 'Tracks when this Google Drive item was last synced';

COMMIT;