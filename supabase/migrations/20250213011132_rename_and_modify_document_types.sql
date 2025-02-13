-- Migration: Rename uni_document_types and add JSONB fields
-- Created at: 2025-02-13 01:11:32
-- Status: planned
-- Dependencies: None

BEGIN;

-- Verify preconditions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'uni_document_types'
  ) THEN
    RAISE EXCEPTION 'Table uni_document_types does not exist';
  END IF;
END $$;

-- Backup affected data
CREATE TABLE IF NOT EXISTS backup_uni_document_types_20250213011132 AS 
  SELECT * FROM uni_document_types;

-- Rename and modify table
ALTER TABLE uni_document_types RENAME TO document_types;

-- Remove domain_id and hardcoded defaults
ALTER TABLE document_types
  DROP COLUMN domain_id,
  ALTER COLUMN created_by DROP DEFAULT,
  ALTER COLUMN updated_by DROP DEFAULT;

-- Add new fields
ALTER TABLE document_types
  ADD COLUMN content_schema JSONB,
  ADD COLUMN ai_processing_rules JSONB,
  ADD COLUMN validation_rules JSONB;

-- Add validation checks
ALTER TABLE document_types
  ADD CONSTRAINT valid_content_schema 
    CHECK (jsonb_typeof(content_schema) = 'object'),
  ADD CONSTRAINT valid_ai_rules 
    CHECK (jsonb_typeof(ai_processing_rules) = 'object'),
  ADD CONSTRAINT valid_validation_rules 
    CHECK (jsonb_typeof(validation_rules) = 'object');

COMMIT;

