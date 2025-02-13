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

-- Drop RLS policies first
DROP POLICY IF EXISTS "Allow authenticated users to delete document types" ON uni_document_types;
DROP POLICY IF EXISTS "Allow authenticated users to insert document types" ON uni_document_types;
DROP POLICY IF EXISTS "Allow authenticated users to update document types" ON uni_document_types;
DROP POLICY IF EXISTS "Allow users to view all document types" ON uni_document_types;

-- Drop trigger first
DROP TRIGGER IF EXISTS set_updated_at ON uni_document_types;

-- Drop indexes and constraints
DROP INDEX IF EXISTS idx_uni_document_types_document_type;
ALTER TABLE uni_document_types DROP CONSTRAINT IF EXISTS unique_document_type;

-- Now we can rename and modify
ALTER TABLE uni_document_types RENAME TO document_types;

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

-- Restore unique constraint with new name
ALTER TABLE document_types
  ADD CONSTRAINT unique_document_type_name UNIQUE (document_type);

-- Recreate trigger on new table
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON document_types
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Recreate RLS policies for new table
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  CREATE POLICY "Allow authenticated users to delete document types" 
    ON document_types FOR DELETE TO authenticated
    USING (true);

  CREATE POLICY "Allow authenticated users to insert document types" 
    ON document_types FOR INSERT TO authenticated
    WITH CHECK (true);

  CREATE POLICY "Allow authenticated users to update document types" 
    ON document_types FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

  CREATE POLICY "Allow users to view all document types" 
    ON document_types FOR SELECT TO authenticated
    USING (true);
END $$;

COMMIT;

