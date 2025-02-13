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

-- Backup affected data with domain info
CREATE TABLE IF NOT EXISTS backup_uni_document_types_20250213011132 AS 
  SELECT 
    dt.*,
    d.name as domain_name
  FROM uni_document_types dt
  LEFT JOIN domains d ON dt.domain_id = d.id;

-- Store domain info in metadata before removing
UPDATE uni_document_types
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'legacy_domain_id', domain_id,
  'legacy_domain_name', (SELECT name FROM domains WHERE id = domain_id),
  'migration_timestamp', CURRENT_TIMESTAMP
);

-- Drop RLS policies first
DROP POLICY IF EXISTS "Dynamic Healing Group select access" ON uni_document_types;
DROP POLICY IF EXISTS "Allow authenticated users to delete document types" ON uni_document_types;
DROP POLICY IF EXISTS "Allow authenticated users to insert document types" ON uni_document_types;
DROP POLICY IF EXISTS "Allow authenticated users to update document types" ON uni_document_types;
DROP POLICY IF EXISTS "Allow users to view all document types" ON uni_document_types;

-- Drop trigger first
DROP TRIGGER IF EXISTS set_updated_at ON uni_document_types;

-- Drop indexes
DROP INDEX IF EXISTS idx_uni_document_types_domain_id;
ALTER TABLE uni_document_types DROP CONSTRAINT IF EXISTS unique_document_type;

-- Drop foreign key constraints
ALTER TABLE uni_document_types
  DROP CONSTRAINT IF EXISTS uni_document_types_domain_id_fkey,
  DROP CONSTRAINT IF EXISTS uni_document_types_created_by_fkey,
  DROP CONSTRAINT IF EXISTS uni_document_types_updated_by_fkey;

-- Check for any other tables referencing uni_document_types.domain_id
DO $$ 
BEGIN
  -- This will raise an exception if there are any remaining dependencies
  PERFORM *
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
  WHERE ccu.table_name = 'uni_document_types' 
    AND ccu.column_name = 'domain_id';
  
  IF FOUND THEN
    RAISE EXCEPTION 'Found unexpected dependencies on domain_id column';
  END IF;
END $$;

-- Now we can rename and modify
ALTER TABLE uni_document_types RENAME TO document_types;

-- Remove domain_id and modify defaults
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

-- Restore unique constraint with new name
ALTER TABLE document_types
  ADD CONSTRAINT unique_document_type_name UNIQUE (document_type);

-- Restore auth user foreign keys
ALTER TABLE document_types
  ADD CONSTRAINT document_types_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT document_types_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Recreate trigger on new table
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON document_types
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Recreate RLS policies for new table
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Create new policies (without domain_id dependency)
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

