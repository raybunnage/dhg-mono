-- Migrate data from registry_cli_pipelines to sys_cli_pipelines
-- First, ensure sys_cli_pipelines has all necessary columns

-- Copy all data from registry_cli_pipelines to sys_cli_pipelines
INSERT INTO sys_cli_pipelines (
  id,
  name,
  display_name,
  description,
  path,
  main_script,
  status,
  has_help_command,
  has_test_suite,
  last_modified,
  command_count,
  dependencies,
  health_check_implemented,
  created_at,
  updated_at
)
SELECT 
  id,
  name,
  display_name,
  description,
  path,
  main_script,
  status,
  has_help_command,
  has_test_suite,
  last_modified,
  command_count,
  dependencies,
  health_check_implemented,
  created_at,
  updated_at
FROM registry_cli_pipelines
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  main_script = EXCLUDED.main_script,
  status = EXCLUDED.status,
  has_help_command = EXCLUDED.has_help_command,
  has_test_suite = EXCLUDED.has_test_suite,
  last_modified = EXCLUDED.last_modified,
  command_count = EXCLUDED.command_count,
  dependencies = EXCLUDED.dependencies,
  health_check_implemented = EXCLUDED.health_check_implemented,
  updated_at = CURRENT_TIMESTAMP;

-- Update foreign key references from registry_cli_pipelines to sys_cli_pipelines
-- sys_pipeline_service_dependencies
ALTER TABLE sys_pipeline_service_dependencies 
DROP CONSTRAINT IF EXISTS sys_pipeline_service_dependencies_pipeline_id_fkey;

ALTER TABLE sys_pipeline_service_dependencies
ADD CONSTRAINT sys_pipeline_service_dependencies_pipeline_id_fkey 
FOREIGN KEY (pipeline_id) REFERENCES sys_cli_pipelines(id) ON DELETE CASCADE;

-- sys_app_service_dependencies (if it references pipelines)
-- Check and update other tables that might reference registry_cli_pipelines

-- Create a record in sys_archived_tables for registry_cli_pipelines
-- This will be done through the archive CLI command