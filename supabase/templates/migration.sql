-- Migration: {description}
-- Created at: {timestamp}
-- Status: planned
-- Affects tables: [LIST_TABLES]
-- Risk Level: [low|medium|high]
-- Dependencies: List any migrations this depends on
-- Verified by: Your name

-- !!! BACKUP RECOMMENDED BEFORE PROCEEDING !!!
-- Backup command: pnpm supabase db dump -f backup_${timestamp}.sql

BEGIN;

-- Verify we're not duplicating remote migrations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations 
    WHERE version = '${timestamp}'
  ) THEN
    RAISE EXCEPTION 'Migration ${timestamp} already exists in remote database';
  END IF;
  
  -- Verify dependencies exist
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations 
    WHERE version = '20250210215603'
  ) THEN
    RAISE EXCEPTION 'Required migration 20250210215603 not found';
  END IF;
END $$;

-- 1. Verify preconditions
DO $$ 
BEGIN
  -- Verify table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'uni_document_types'
  ) THEN
    RAISE EXCEPTION 'Table uni_document_types does not exist';
  END IF;
  
  -- Verify target name not taken
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'document_types'
  ) THEN
    RAISE EXCEPTION 'Table document_types already exists';
  END IF;
END $$;

-- 2. Backup affected data
CREATE TABLE IF NOT EXISTS backup_uni_document_types_${timestamp} AS 
  SELECT * FROM uni_document_types;

-- 3. Migration changes
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

-- 4. Verify changes
DO $$ 
BEGIN
  -- Verify table was renamed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'document_types'
  ) THEN
    RAISE EXCEPTION 'Table rename failed';
  END IF;
  
  -- Verify columns were added
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_types' 
    AND column_name = 'content_schema'
  ) THEN
    RAISE EXCEPTION 'New columns not added correctly';
  END IF;
END $$;

COMMIT;

-- Rollback script
/*
BEGIN;
  -- Rollback steps here
COMMIT;
*/ 