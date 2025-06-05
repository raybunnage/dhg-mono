-- Migration to fix created_by and updated_by references in google_expert_documents
-- Created at: 2025-02-27 18:41:42

BEGIN;

-- 1. Check if google_expert_documents table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'google_expert_documents'
  ) THEN
    RAISE EXCEPTION 'Table google_expert_documents does not exist';
  END IF;
END $$;

-- 2. Remove triggers for user tracking
DROP TRIGGER IF EXISTS set_created_by_trigger ON google_expert_documents;
DROP TRIGGER IF EXISTS set_updated_by_trigger ON google_expert_documents;

-- 3. Check and drop functions if not used elsewhere
DO $$ 
BEGIN
  -- Check if the functions are used by other triggers
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE p.proname IN ('set_created_by', 'set_updated_by')
      AND t.tgrelid \!= 'google_expert_documents'::regclass
  ) THEN
    -- If not used elsewhere, drop them
    DROP FUNCTION IF EXISTS set_created_by();
    DROP FUNCTION IF EXISTS set_updated_by();
  END IF;
END $$;

-- 4. Remove the columns
ALTER TABLE google_expert_documents 
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by;

COMMIT;

