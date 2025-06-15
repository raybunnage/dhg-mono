-- Migrate data from registry_cli_pipelines to sys_cli_pipelines
-- Simple version without sys_table_migrations dependency

-- Insert missing pipelines
INSERT INTO sys_cli_pipelines (
  id,
  pipeline_name,
  pipeline_path,
  description,
  status,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  pipeline_name,
  pipeline_path,
  description,
  COALESCE(status, 'active') as status,
  COALESCE(created_at, CURRENT_TIMESTAMP) as created_at,
  COALESCE(updated_at, CURRENT_TIMESTAMP) as updated_at
FROM registry_cli_pipelines
WHERE NOT EXISTS (
  SELECT 1 FROM sys_cli_pipelines 
  WHERE sys_cli_pipelines.pipeline_name = registry_cli_pipelines.pipeline_name
);

-- Update existing pipelines with any missing data
UPDATE sys_cli_pipelines
SET 
  description = COALESCE(sys_cli_pipelines.description, r.description),
  status = COALESCE(sys_cli_pipelines.status, r.status, 'active'),
  updated_at = CURRENT_TIMESTAMP
FROM registry_cli_pipelines r
WHERE sys_cli_pipelines.pipeline_name = r.pipeline_name;