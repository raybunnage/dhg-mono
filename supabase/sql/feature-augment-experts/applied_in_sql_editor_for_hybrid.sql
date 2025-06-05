CREATE OR REPLACE FUNCTION handle_timestamps() 
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    NEW.created_at = NOW();
    NEW.updated_at = NOW();
  ELSIF (TG_OP = 'UPDATE') THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamps
  BEFORE INSERT OR UPDATE ON document_types
  FOR EACH ROW
  EXECUTE FUNCTION handle_timestamps();

  SELECT * FROM pg_proc WHERE proname = 'handle_timestamps';

  SELECT * FROM pg_trigger WHERE tgname = 'set_timestamps';

  BEGIN;

-- Add new columns to experts table
ALTER TABLE experts
  ADD COLUMN IF NOT EXISTS google_user_id text,
  ADD COLUMN IF NOT EXISTS google_email text,
  ADD COLUMN IF NOT EXISTS google_profile_data jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sync_status text,
  ADD COLUMN IF NOT EXISTS sync_error text;

-- Add constraints
ALTER TABLE experts
  ADD CONSTRAINT valid_google_email 
    CHECK (google_email IS NULL OR google_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  ADD CONSTRAINT valid_sync_status 
    CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
  ADD CONSTRAINT valid_profile_data
    CHECK (google_profile_data IS NULL OR jsonb_typeof(google_profile_data) = 'object');

-- Create index for google lookups
CREATE INDEX IF NOT EXISTS idx_experts_google_user_id ON experts(google_user_id);
CREATE INDEX IF NOT EXISTS idx_experts_google_email ON experts(google_email);

COMMIT;



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



BEGIN;

CREATE TABLE IF NOT EXISTS google_expert_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid REFERENCES experts(id),
  source_id uuid REFERENCES google_sources(id),
  document_type_id uuid REFERENCES document_types(id),
  
  -- Content and Analysis
  raw_content text,
  processed_content jsonb,
  ai_analysis jsonb,
  key_insights text[],
  topics text[],
  
  -- Metadata
  word_count integer,
  language text,
  confidence_score decimal,
  processing_status text CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
  processing_error text,
  
  -- Timestamps and Tracking
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  last_processed_at timestamp with time zone
);

-- Indexes
CREATE INDEX idx_google_expert_documents_expert_id ON google_expert_documents(expert_id);
CREATE INDEX idx_google_expert_documents_source_id ON google_expert_documents(source_id);
CREATE INDEX idx_google_expert_documents_document_type_id ON google_expert_documents(document_type_id);
CREATE INDEX idx_google_expert_documents_topics ON google_expert_documents USING gin(topics);
CREATE INDEX idx_google_expert_documents_processing_status ON google_expert_documents(processing_status);

-- Add RLS policies
ALTER TABLE google_expert_documents ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  CREATE POLICY "Allow authenticated users to delete expert documents" 
    ON google_expert_documents FOR DELETE TO authenticated
    USING (true);

  CREATE POLICY "Allow authenticated users to insert expert documents" 
    ON google_expert_documents FOR INSERT TO authenticated
    WITH CHECK (true);

  CREATE POLICY "Allow authenticated users to update expert documents" 
    ON google_expert_documents FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

  CREATE POLICY "Allow users to view all expert documents" 
    ON google_expert_documents FOR SELECT TO authenticated
    USING (true);
END $$;

-- Add triggers for timestamps and user tracking
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON google_expert_documents
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_created_by_trigger
  BEFORE INSERT ON google_expert_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_updated_by_trigger
  BEFORE UPDATE ON google_expert_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

COMMIT; 





BEGIN;

-- Add version tracking
ALTER TABLE google_expert_documents
  ADD COLUMN version integer DEFAULT 1,
  ADD COLUMN previous_version_id uuid REFERENCES google_expert_documents(id),
  ADD COLUMN is_latest boolean DEFAULT true;

-- Add content classification
ALTER TABLE google_expert_documents
  ADD COLUMN content_type text,
  ADD COLUMN classification_confidence decimal,
  ADD COLUMN classification_metadata jsonb;

-- Add constraints
ALTER TABLE google_expert_documents
  ADD CONSTRAINT valid_version CHECK (version > 0),
  ADD CONSTRAINT valid_classification_metadata 
    CHECK (classification_metadata IS NULL OR jsonb_typeof(classification_metadata) = 'object'),
  ADD CONSTRAINT valid_content_type 
    CHECK (content_type IN ('article', 'research', 'presentation', 'report', 'other'));

-- Add index for version queries
CREATE INDEX idx_google_expert_documents_version ON google_expert_documents(version);
CREATE INDEX idx_google_expert_documents_is_latest ON google_expert_documents(is_latest);

COMMIT;



BEGIN;

-- Rename inconsistent index names
ALTER INDEX uni_document_types_pkey RENAME TO document_types_pkey;
ALTER INDEX idx_uni_document_types_document_type RENAME TO idx_document_types_document_type;

COMMIT;