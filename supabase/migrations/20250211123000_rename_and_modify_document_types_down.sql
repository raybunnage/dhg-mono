BEGIN;

-- Remove new columns first
ALTER TABLE document_types
  DROP COLUMN content_schema,
  DROP COLUMN ai_processing_rules,
  DROP COLUMN validation_rules;

-- Remove trigger
DROP TRIGGER IF EXISTS update_document_types_updated_at ON document_types;

-- Add back domain_id and defaults
ALTER TABLE document_types
  ADD COLUMN domain_id UUID NOT NULL DEFAULT '752f3bf7-a392-4283-bd32-e3f0e530c205'::uuid,
  ALTER COLUMN created_by SET DEFAULT 'fef040df-000e-4982-b6bf-8eea9f9fa59d'::uuid,
  ALTER COLUMN updated_by SET DEFAULT 'fef040df-000e-4982-b6bf-8eea9f9fa59d'::uuid;

-- Rename table back
ALTER TABLE document_types RENAME TO uni_document_types;

COMMIT; 