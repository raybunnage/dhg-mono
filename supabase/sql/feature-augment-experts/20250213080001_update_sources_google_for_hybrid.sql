BEGIN;

-- Add new columns to sources_google table
ALTER TABLE sources_google
  ADD COLUMN IF NOT EXISTS expert_id uuid REFERENCES experts(id),
  ADD COLUMN IF NOT EXISTS sync_status text,
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS document_type_id uuid REFERENCES document_types(id),
  ADD COLUMN IF NOT EXISTS content_extracted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS extraction_error text,
  ADD COLUMN IF NOT EXISTS extracted_content jsonb;

-- Add constraints
ALTER TABLE sources_google
  ADD CONSTRAINT valid_sync_status 
    CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
  ADD CONSTRAINT valid_extracted_content
    CHECK (extracted_content IS NULL OR jsonb_typeof(extracted_content) = 'object');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sources_google_expert_id ON sources_google(expert_id);
CREATE INDEX IF NOT EXISTS idx_sources_google_document_type_id ON sources_google(document_type_id);
CREATE INDEX IF NOT EXISTS idx_sources_google_content_extracted ON sources_google(content_extracted);

COMMIT; 