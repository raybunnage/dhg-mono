-- Archive and drop registry_cli_pipelines table
-- This should be run AFTER:
-- 1. sys_archived_tables is created
-- 2. Data is migrated to sys_cli_pipelines
-- 3. All code references are updated

-- Note: The actual archiving will be done through the archive CLI command
-- This migration just drops the table after it's been archived

-- First, verify that data has been migrated
DO $$
DECLARE
  registry_count INTEGER;
  sys_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO registry_count FROM registry_cli_pipelines;
  SELECT COUNT(*) INTO sys_count FROM sys_cli_pipelines;
  
  IF registry_count > 0 AND sys_count = 0 THEN
    RAISE EXCEPTION 'Data has not been migrated from registry_cli_pipelines to sys_cli_pipelines';
  END IF;
END $$;

-- Drop foreign key constraints that reference registry_cli_pipelines
-- (These should have been updated in the previous migration)

-- Drop the table
-- Note: In production, you would run the archive CLI command first:
-- ./scripts/cli-pipeline/archive/archive-cli.sh archive-table registry_cli_pipelines --reason "Migrated to sys_cli_pipelines for consistent sys_ naming convention"

-- Uncomment to actually drop the table:
-- DROP TABLE IF EXISTS registry_cli_pipelines CASCADE;

-- For safety, we're leaving this commented out
-- Run manually after confirming the archive is complete