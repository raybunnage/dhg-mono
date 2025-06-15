-- Migrate data from registry_cli_pipelines to sys_cli_pipelines
-- First, ensure sys_cli_pipelines exists and has all needed columns
DO $$
BEGIN
  -- Check if registry_cli_pipelines exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'registry_cli_pipelines') THEN
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
    
    RAISE NOTICE 'Migration from registry_cli_pipelines to sys_cli_pipelines completed';
  ELSE
    RAISE NOTICE 'registry_cli_pipelines table not found, skipping migration';
  END IF;
END;
$$;

-- Add tracking record
INSERT INTO sys_table_migrations (
  old_table_name,
  new_table_name,
  migration_type,
  status,
  notes
) VALUES (
  'registry_cli_pipelines',
  'sys_cli_pipelines',
  'data_migration',
  'completed',
  'Migrated all CLI pipeline data from registry to sys table'
) ON CONFLICT (old_table_name, new_table_name) 
DO UPDATE SET 
  status = 'completed',
  updated_at = CURRENT_TIMESTAMP;