-- Down migration for CLI command registry tables

-- Drop functions
DROP FUNCTION IF EXISTS get_pipeline_statistics(UUID);
DROP FUNCTION IF EXISTS discover_pipeline_commands(VARCHAR, TEXT);

-- Drop policies
DROP POLICY IF EXISTS "Allow read access to command registry" ON command_categories;
DROP POLICY IF EXISTS "Allow read access to command pipelines" ON command_pipelines;
DROP POLICY IF EXISTS "Allow read access to command definitions" ON command_definitions;
DROP POLICY IF EXISTS "Allow read access to command pipeline tables" ON command_pipeline_tables;
DROP POLICY IF EXISTS "Allow read access to command dependencies" ON command_dependencies;

DROP POLICY IF EXISTS "Allow admin write to command categories" ON command_categories;
DROP POLICY IF EXISTS "Allow admin write to command pipelines" ON command_pipelines;
DROP POLICY IF EXISTS "Allow admin write to command definitions" ON command_definitions;
DROP POLICY IF EXISTS "Allow admin write to command pipeline tables" ON command_pipeline_tables;
DROP POLICY IF EXISTS "Allow admin write to command dependencies" ON command_dependencies;

-- Drop triggers
DROP TRIGGER IF EXISTS update_command_categories_updated_at ON command_categories;
DROP TRIGGER IF EXISTS update_command_pipelines_updated_at ON command_pipelines;
DROP TRIGGER IF EXISTS update_command_definitions_updated_at ON command_definitions;

-- Drop indexes
DROP INDEX IF EXISTS idx_command_pipelines_category;
DROP INDEX IF EXISTS idx_command_pipelines_status;
DROP INDEX IF EXISTS idx_command_definitions_pipeline;
DROP INDEX IF EXISTS idx_command_pipeline_tables_pipeline;
DROP INDEX IF EXISTS idx_command_dependencies_command;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS command_dependencies;
DROP TABLE IF EXISTS command_pipeline_tables;
DROP TABLE IF EXISTS command_definitions;
DROP TABLE IF EXISTS command_pipelines;
DROP TABLE IF EXISTS command_categories;