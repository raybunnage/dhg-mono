-- Migration: Rename Service Dependency Tables
-- Description: Rename tables to follow consistent naming conventions
-- Author: Claude Code Assistant
-- Date: 2025-06-06

-- SECTION: tables

-- First, rename the existing tables to follow the new naming conventions

-- 1. Rename scripts_registry to registry_scripts
ALTER TABLE IF EXISTS scripts_registry RENAME TO registry_scripts;

-- 2. Rename services_registry to registry_services
ALTER TABLE IF EXISTS services_registry RENAME TO registry_services;

-- 3. Rename apps_registry to registry_apps
ALTER TABLE IF EXISTS apps_registry RENAME TO registry_apps;

-- 4. Rename cli_pipelines_registry to registry_cli_pipelines
ALTER TABLE IF EXISTS cli_pipelines_registry RENAME TO registry_cli_pipelines;

-- 5. Rename cli_commands_registry to registry_cli_commands
ALTER TABLE IF EXISTS cli_commands_registry RENAME TO registry_cli_commands;

-- 6. Rename app_service_dependencies to service_app_dependencies
ALTER TABLE IF EXISTS app_service_dependencies RENAME TO service_app_dependencies;

-- 7. Rename pipeline_service_dependencies to service_pipeline_dependencies
ALTER TABLE IF EXISTS pipeline_service_dependencies RENAME TO service_pipeline_dependencies;

-- 8. Rename command_service_dependencies to service_command_dependencies
ALTER TABLE IF EXISTS command_service_dependencies RENAME TO service_command_dependencies;

-- 9. Rename service_exports to service_exports (no change needed)
-- Already has correct prefix

-- 10. Rename dependency_analysis_runs to service_dependency_analysis_runs
ALTER TABLE IF EXISTS dependency_analysis_runs RENAME TO service_dependency_analysis_runs;

-- SECTION: constraints

-- Update foreign key constraint names to match new table names

-- For registry_cli_commands
ALTER TABLE registry_cli_commands 
  DROP CONSTRAINT IF EXISTS cli_commands_registry_pipeline_id_fkey,
  ADD CONSTRAINT registry_cli_commands_pipeline_id_fkey 
    FOREIGN KEY (pipeline_id) REFERENCES registry_cli_pipelines(id) ON DELETE CASCADE;

-- For service_app_dependencies
ALTER TABLE service_app_dependencies
  DROP CONSTRAINT IF EXISTS app_service_dependencies_app_id_fkey,
  DROP CONSTRAINT IF EXISTS app_service_dependencies_service_id_fkey,
  ADD CONSTRAINT service_app_dependencies_app_id_fkey 
    FOREIGN KEY (app_id) REFERENCES registry_apps(id) ON DELETE CASCADE,
  ADD CONSTRAINT service_app_dependencies_service_id_fkey 
    FOREIGN KEY (service_id) REFERENCES registry_services(id) ON DELETE CASCADE;

-- For service_pipeline_dependencies
ALTER TABLE service_pipeline_dependencies
  DROP CONSTRAINT IF EXISTS pipeline_service_dependencies_pipeline_id_fkey,
  DROP CONSTRAINT IF EXISTS pipeline_service_dependencies_service_id_fkey,
  ADD CONSTRAINT service_pipeline_dependencies_pipeline_id_fkey 
    FOREIGN KEY (pipeline_id) REFERENCES registry_cli_pipelines(id) ON DELETE CASCADE,
  ADD CONSTRAINT service_pipeline_dependencies_service_id_fkey 
    FOREIGN KEY (service_id) REFERENCES registry_services(id) ON DELETE CASCADE;

-- For service_command_dependencies
ALTER TABLE service_command_dependencies
  DROP CONSTRAINT IF EXISTS command_service_dependencies_command_id_fkey,
  DROP CONSTRAINT IF EXISTS command_service_dependencies_service_id_fkey,
  ADD CONSTRAINT service_command_dependencies_command_id_fkey 
    FOREIGN KEY (command_id) REFERENCES registry_cli_commands(id) ON DELETE CASCADE,
  ADD CONSTRAINT service_command_dependencies_service_id_fkey 
    FOREIGN KEY (service_id) REFERENCES registry_services(id) ON DELETE CASCADE;

-- For service_exports
ALTER TABLE service_exports
  DROP CONSTRAINT IF EXISTS service_exports_service_id_fkey,
  ADD CONSTRAINT service_exports_service_id_fkey 
    FOREIGN KEY (service_id) REFERENCES registry_services(id) ON DELETE CASCADE;

-- SECTION: custom
-- Record the migration in sys_table_migrations

INSERT INTO sys_table_migrations (old_table_name, new_table_name, migration_date, migration_type, notes)
VALUES 
  ('scripts_registry', 'registry_scripts', CURRENT_DATE, 'rename', 'Standardized naming: registry_ prefix for registry tables'),
  ('services_registry', 'registry_services', CURRENT_DATE, 'rename', 'Standardized naming: registry_ prefix for registry tables'),
  ('apps_registry', 'registry_apps', CURRENT_DATE, 'rename', 'Standardized naming: registry_ prefix for registry tables'),
  ('cli_pipelines_registry', 'registry_cli_pipelines', CURRENT_DATE, 'rename', 'Standardized naming: registry_ prefix for registry tables'),
  ('cli_commands_registry', 'registry_cli_commands', CURRENT_DATE, 'rename', 'Standardized naming: registry_ prefix for registry tables'),
  ('app_service_dependencies', 'service_app_dependencies', CURRENT_DATE, 'rename', 'Standardized naming: service_ prefix for service-related tables'),
  ('pipeline_service_dependencies', 'service_pipeline_dependencies', CURRENT_DATE, 'rename', 'Standardized naming: service_ prefix for service-related tables'),
  ('command_service_dependencies', 'service_command_dependencies', CURRENT_DATE, 'rename', 'Standardized naming: service_ prefix for service-related tables'),
  ('dependency_analysis_runs', 'service_dependency_analysis_runs', CURRENT_DATE, 'rename', 'Standardized naming: service_ prefix for service-related tables')
ON CONFLICT (old_table_name) DO NOTHING;