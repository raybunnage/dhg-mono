-- Migration: Revert descriptive migration name
-- Created at: YYYY-MM-DD HH:MM:SS
-- Status: planned
-- Dependencies: YYYYMMDDHHMMSS_descriptive_migration_name.sql

BEGIN;

-- Drop triggers first
DROP TRIGGER IF EXISTS set_created_by_trigger ON document_types;
DROP TRIGGER IF EXISTS set_updated_by_trigger ON document_types;

-- Drop functions
DROP FUNCTION IF EXISTS set_created_by();
DROP FUNCTION IF EXISTS set_updated_by();

-- Verify cleanup
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'set_created_by_trigger'
  ) THEN
    RAISE EXCEPTION 'Trigger set_created_by_trigger still exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'set_updated_by_trigger'
  ) THEN
    RAISE EXCEPTION 'Trigger set_updated_by_trigger still exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'set_created_by'
  ) THEN
    RAISE EXCEPTION 'Function set_created_by still exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'set_updated_by'
  ) THEN
    RAISE EXCEPTION 'Function set_updated_by still exists';
  END IF;
END $$;

COMMIT;