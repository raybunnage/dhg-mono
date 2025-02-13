-- Migration: Revert rename_and_modify_document_types
-- Created at: 2025-02-13 01:11:32
-- Status: planned
-- Dependencies: 20250213011132_rename_and_modify_document_types.sql

BEGIN;

-- Verify current state and backup exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'document_types'
  ) THEN
    RAISE EXCEPTION 'Table document_types does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'backup_uni_document_types_20250213011132'
  ) THEN
    RAISE EXCEPTION 'Backup table not found - cannot safely roll back';
  END IF;
END $$;

-- Drop RLS policies first
DROP POLICY IF EXISTS "Allow authenticated users to delete document types" ON document_types;
DROP POLICY IF EXISTS "Allow authenticated users to insert document types" ON document_types;
DROP POLICY IF EXISTS "Allow authenticated users to update document types" ON document_types;
DROP POLICY IF EXISTS "Allow users to view all document types" ON document_types;

-- Drop trigger
DROP TRIGGER IF EXISTS set_updated_at ON document_types;

-- Drop unique constraint
ALTER TABLE document_types DROP CONSTRAINT IF EXISTS unique_document_type_name;

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

-- Rename table back
ALTER TABLE document_types RENAME TO uni_document_types;

-- Restore original indexes
CREATE INDEX IF NOT EXISTS idx_uni_document_types_document_type 
  ON uni_document_types(document_type);

-- Restore original unique constraint
ALTER TABLE uni_document_types
  ADD CONSTRAINT unique_document_type UNIQUE (document_type);

-- Restore RLS policies
ALTER TABLE uni_document_types ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  CREATE POLICY "Allow authenticated users to delete document types" 
    ON uni_document_types FOR DELETE TO authenticated
    USING (true);

  CREATE POLICY "Allow authenticated users to insert document types" 
    ON uni_document_types FOR INSERT TO authenticated
    WITH CHECK (true);

  CREATE POLICY "Allow authenticated users to update document types" 
    ON uni_document_types FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

  CREATE POLICY "Allow users to view all document types" 
    ON uni_document_types FOR SELECT TO authenticated
    USING (true);
END $$;

-- Create trigger on renamed table
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON uni_document_types
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

COMMIT;
