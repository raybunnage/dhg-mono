-- Add last_checked column to doc_continuous_monitoring table
-- This tracks when the system last checked for updates (different from last_updated which is when content changed)

ALTER TABLE doc_continuous_monitoring 
ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP WITH TIME ZONE;

-- Add comment for clarity
COMMENT ON COLUMN doc_continuous_monitoring.last_checked IS 'Timestamp of when the document was last checked for updates by the monitoring system';