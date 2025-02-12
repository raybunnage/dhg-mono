BEGIN;

-- First rename the table
ALTER TABLE uni_document_types RENAME TO document_types;

-- Remove domain_id and hardcoded defaults
ALTER TABLE document_types
  DROP COLUMN domain_id,
  ALTER COLUMN created_by DROP DEFAULT,
  ALTER COLUMN updated_by DROP DEFAULT;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_types_updated_at
  BEFORE UPDATE ON document_types
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Add new fields useful for document processing
ALTER TABLE document_types
  ADD COLUMN content_schema JSONB, -- Defines expected content structure
  ADD COLUMN ai_processing_rules JSONB, -- AI processing configuration
  ADD COLUMN validation_rules JSONB; -- Data validation rules

-- Add validation checks
ALTER TABLE document_types
  ADD CONSTRAINT valid_content_schema 
    CHECK (jsonb_typeof(content_schema) = 'object'),
  ADD CONSTRAINT valid_ai_rules 
    CHECK (jsonb_typeof(ai_processing_rules) = 'object'),
  ADD CONSTRAINT valid_validation_rules 
    CHECK (jsonb_typeof(validation_rules) = 'object');

-- Add indexes for JSONB querying
CREATE INDEX idx_document_types_content_schema 
  ON document_types USING gin (content_schema);
CREATE INDEX idx_document_types_ai_rules 
  ON document_types USING gin (ai_processing_rules);
CREATE INDEX idx_document_types_validation 
  ON document_types USING gin (validation_rules);

COMMIT; 