-- Migration: {description}
-- Created at: {timestamp}
-- Status: [planned|applied]
-- Affects tables: [LIST_TABLES]
-- Risk Level: [low|medium|high]

-- !!! BACKUP RECOMMENDED BEFORE PROCEEDING !!!
-- Backup command: pnpm supabase db dump -f backup_${timestamp}.sql

BEGIN;

-- 1. Verify preconditions
DO $$ 
BEGIN
  -- Add verification checks here
END $$;

-- 2. Backup affected data (if needed)
CREATE TABLE IF NOT EXISTS backup_{table}_{timestamp} AS 
  SELECT * FROM {table};

-- 3. Migration changes
-- [YOUR MIGRATION CODE HERE]

-- 4. Verify changes
DO $$ 
BEGIN
  -- Add post-migration verification
END $$;

COMMIT;

-- Rollback script
/*
BEGIN;
  -- Rollback steps here
COMMIT;
*/ 