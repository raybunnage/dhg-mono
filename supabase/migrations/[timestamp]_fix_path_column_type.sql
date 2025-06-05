-- First drop the existing GIN index
DROP INDEX IF EXISTS sources_google_path_idx;

-- Change path from ARRAY to TEXT
ALTER TABLE sources_google 
ALTER COLUMN path TYPE TEXT USING path::text,
ALTER COLUMN parent_path TYPE TEXT;

-- Create new B-tree index for text columns
CREATE INDEX IF NOT EXISTS sources_google_path_idx ON sources_google(path);
CREATE INDEX IF NOT EXISTS sources_google_parent_path_idx ON sources_google(parent_path); 