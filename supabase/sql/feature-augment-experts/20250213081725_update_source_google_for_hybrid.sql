BEGIN;

-- Add new columns to google_sources table
ALTER TABLE google_sources
  ADD COLUMN IF NOT EXISTS expert_id uuid REFERENCES experts(id),
  ADD COLUMN IF NOT EXISTS sync_status text,
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS document_type_id uuid REFERENCES document_types(id),
  ADD COLUMN IF NOT EXISTS content_extracted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS extraction_error text,
  ADD COLUMN IF NOT EXISTS extracted_content jsonb;

-- Add constraints
ALTER TABLE google_sources
  ADD CONSTRAINT valid_sync_status 
    CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
  ADD CONSTRAINT valid_extracted_content
    CHECK (extracted_content IS NULL OR jsonb_typeof(extracted_content) = 'object');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_google_sources_expert_id ON google_sources(expert_id);
CREATE INDEX IF NOT EXISTS idx_google_sources_document_type_id ON google_sources(document_type_id);
CREATE INDEX IF NOT EXISTS idx_google_sources_content_extracted ON google_sources(content_extracted);

COMMIT;
