BEGIN;

-- Modify sources_google table to store basic file information
ALTER TABLE sources_google
ADD COLUMN file_name TEXT,
ADD COLUMN file_type TEXT,
ADD COLUMN file_size BIGINT,
ADD COLUMN mime_type TEXT,
ADD COLUMN created_time TIMESTAMPTZ,
ADD COLUMN modified_time TIMESTAMPTZ,
ADD COLUMN web_view_link TEXT,
ADD COLUMN is_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN processing_status TEXT DEFAULT 'pending';

-- Add an index on is_processed for efficient querying
CREATE INDEX idx_sources_google_is_processed ON sources_google(is_processed);

COMMIT; 