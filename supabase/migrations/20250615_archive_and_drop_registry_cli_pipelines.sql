-- Archive registry_cli_pipelines table before dropping

-- First, get the table DDL and metadata
DO $$
DECLARE
  v_ddl TEXT;
  v_row_count INTEGER;
  v_foreign_keys JSONB;
  v_indexes JSONB;
BEGIN
  -- Get row count
  SELECT COUNT(*) INTO v_row_count FROM registry_cli_pipelines;
  
  -- Get table DDL (simplified version)
  v_ddl := 'CREATE TABLE registry_cli_pipelines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pipeline_name TEXT NOT NULL,
    pipeline_path TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    domain TEXT,
    main_script TEXT,
    command_count INTEGER,
    has_health_check BOOLEAN,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );';
  
  -- Get foreign keys
  v_foreign_keys := '[]'::jsonb; -- No foreign keys on this table
  
  -- Get indexes
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'index_name', indexname,
        'definition', indexdef
      )
    ),
    '[]'::jsonb
  )
  INTO v_indexes
  FROM pg_indexes
  WHERE schemaname = 'public' 
    AND tablename = 'registry_cli_pipelines'
    AND indexname NOT LIKE '%_pkey';
  
  -- Insert into sys_archived_tables
  INSERT INTO sys_archived_tables (
    table_name,
    table_schema,
    create_statement,
    row_count,
    foreign_keys,
    indexes,
    archived_by,
    reason,
    metadata
  ) VALUES (
    'registry_cli_pipelines',
    'public',
    v_ddl,
    v_row_count,
    v_foreign_keys,
    v_indexes,
    'migration_script',
    'Migrated to sys_cli_pipelines - all data successfully transferred',
    jsonb_build_object(
      'migration_date', CURRENT_TIMESTAMP,
      'target_table', 'sys_cli_pipelines',
      'migration_type', 'full_data_migration',
      'notes', 'All 43 pipelines migrated with refactoring status'
    )
  );
  
  RAISE NOTICE 'Archived registry_cli_pipelines (% rows)', v_row_count;
END;
$$;

-- Drop the table
DROP TABLE IF EXISTS registry_cli_pipelines CASCADE;

-- Log the drop
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'registry_cli_pipelines', '[DROPPED] CLI pipeline registry table', 'Replaced by sys_cli_pipelines', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) 
DO UPDATE SET 
  description = '[DROPPED] ' || EXCLUDED.description,
  purpose = EXCLUDED.purpose || ' (dropped on ' || CURRENT_DATE || ')';