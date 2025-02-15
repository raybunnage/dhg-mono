-- Add deleted column to sources_google
ALTER TABLE sources_google 
ADD COLUMN deleted boolean DEFAULT false;

-- Update existing records to have deleted=false
UPDATE sources_google 
SET deleted = false 
WHERE deleted IS NULL;

-- Add index for performance
CREATE INDEX idx_sources_google_deleted 
ON sources_google(deleted); 