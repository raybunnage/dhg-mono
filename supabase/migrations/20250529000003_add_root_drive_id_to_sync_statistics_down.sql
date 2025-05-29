-- Remove root_drive_id from google_sync_statistics table
DROP INDEX IF EXISTS idx_google_sync_statistics_root_drive_id;
ALTER TABLE google_sync_statistics 
DROP COLUMN IF EXISTS root_drive_id;