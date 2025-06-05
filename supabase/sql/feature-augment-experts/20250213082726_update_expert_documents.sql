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