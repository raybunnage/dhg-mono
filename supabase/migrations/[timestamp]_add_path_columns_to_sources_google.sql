-- Add path columns to sources_google table
ALTER TABLE sources_google 
ADD COLUMN IF NOT EXISTS path TEXT,
ADD COLUMN IF NOT EXISTS parent_path TEXT;

-- Create index on path for faster lookups
CREATE INDEX IF NOT EXISTS sources_google_path_idx ON sources_google(path); 