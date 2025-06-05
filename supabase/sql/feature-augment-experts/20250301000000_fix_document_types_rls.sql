-- Migration to fix RLS and remove audit columns from document_types
-- Created at: 2025-02-27 18:40:50

BEGIN;

-- 1. Remove created_by and updated_by triggers
DROP TRIGGER IF EXISTS set_created_by_trigger ON document_types;
DROP TRIGGER IF EXISTS set_updated_by_trigger ON document_types;

-- 2. Drop the now-unused trigger functions if they're not used elsewhere
DO $$ 
BEGIN
  -- Check if the functions are used by other triggers
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE p.proname IN ('set_created_by', 'set_updated_by')
  ) THEN
    -- If not used elsewhere, drop them
    DROP FUNCTION IF EXISTS set_created_by();
    DROP FUNCTION IF EXISTS set_updated_by();
  END IF;
END $$;

-- 3. Remove the created_by and updated_by columns if they exist
ALTER TABLE document_types 
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by;

-- 4. Fix the RLS policies for document_types
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to select document_types" ON document_types;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_types" ON document_types;
DROP POLICY IF EXISTS "Allow authenticated users to update document_types" ON document_types;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_types" ON document_types;

-- Create proper policies
CREATE POLICY "Allow authenticated users to select document_types" 
  ON document_types FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert document_types" 
  ON document_types FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update document_types" 
  ON document_types FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete document_types" 
  ON document_types FOR DELETE TO authenticated
  USING (true);

COMMIT;

