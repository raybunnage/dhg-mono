-- Migration: Revert rename_and_modify_document_types
-- Created at: 2025-02-11 12:36:04
-- Status: planned
-- Dependencies: 20250211123604_rename_and_modify_document_types.sql

BEGIN;

-- Verify current state
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'document_types'
  ) THEN
    RAISE EXCEPTION 'Table document_types does not exist';
  END IF;
END $$;

-- Remove new constraints
ALTER TABLE document_types
  DROP CONSTRAINT IF EXISTS valid_content_schema,
  DROP CONSTRAINT IF EXISTS valid_ai_rules,
  DROP CONSTRAINT IF EXISTS valid_validation_rules;

-- Remove new columns
ALTER TABLE document_types
  DROP COLUMN IF EXISTS content_schema,
  DROP COLUMN IF EXISTS ai_processing_rules,
  DROP COLUMN IF EXISTS validation_rules;

-- Add back original columns and defaults
ALTER TABLE document_types
  ADD COLUMN domain_id UUID NOT NULL DEFAULT '752f3bf7-a392-4283-bd32-e3f0e530c205'::uuid,
  ALTER COLUMN created_by SET DEFAULT 'fef040df-000e-4982-b6bf-8eea9f9fa59d'::uuid,
  ALTER COLUMN updated_by SET DEFAULT 'fef040df-000e-4982-b6bf-8eea9f9fa59d'::uuid;

-- Rename table back
ALTER TABLE document_types RENAME TO uni_document_types;

COMMIT; 