-- Add root_drive_id to google_sync_statistics table
ALTER TABLE google_sync_statistics 
ADD COLUMN IF NOT EXISTS root_drive_id text;

-- Add an index on root_drive_id for better query performance
CREATE INDEX IF NOT EXISTS idx_google_sync_statistics_root_drive_id 
ON google_sync_statistics(root_drive_id);

-- Add a comment to explain the field
COMMENT ON COLUMN google_sync_statistics.root_drive_id IS 'The root drive ID for which these statistics were calculated. Allows filtering statistics by specific Google Drive root folders.';