-- Database Manager Functions for Supabase Manager Page
-- This migration creates functions needed for the Supabase Manager UI

-- Function to get summaries of all tables
CREATE OR REPLACE FUNCTION public.get_table_summaries()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  size text,
  last_vacuum timestamp with time zone,
  missing_indexes int,
  has_primary_key boolean,
  column_count int,
  status text
) SECURITY DEFINER LANGUAGE sql AS $$
  WITH table_stats AS (
    SELECT
      pg_class.relname AS table_name,
      pg_stat_user_tables.n_live_tup AS row_count,
      pg_size_pretty(pg_total_relation_size(pg_class.oid)) AS size,
      pg_stat_user_tables.last_vacuum,
      pg_stat_user_tables.last_autovacuum,
      (SELECT count(*) FROM pg_index i WHERE i.indrelid = pg_class.oid AND i.indisprimary) > 0 AS has_primary_key,
      (SELECT count(*) FROM pg_attribute WHERE attrelid = pg_class.oid AND attnum > 0 AND NOT attisdropped) AS column_count,
      (SELECT count(*) FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = pg_class.oid) AS index_count,
      (SELECT count(*) FROM pg_constraint WHERE conrelid = pg_class.oid) AS constraint_count
    FROM pg_class
    JOIN pg_stat_user_tables ON pg_stat_user_tables.relname = pg_class.relname
    WHERE pg_class.relkind = 'r'
    AND pg_class.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  )
  SELECT
    table_name,
    row_count,
    size,
    COALESCE(last_vacuum, last_autovacuum) AS last_vacuum,
    CASE
      WHEN row_count > 10000 AND index_count < 2 THEN 1
      ELSE 0
    END AS missing_indexes,
    has_primary_key,
    column_count,
    CASE
      WHEN has_primary_key = false THEN 'danger'
      WHEN row_count > 1000000 THEN 'warning'
      WHEN (last_vacuum IS NULL AND last_autovacuum IS NULL AND row_count > 10000) THEN 'warning'
      ELSE 'good'
    END AS status
  FROM table_stats
  ORDER BY row_count DESC;
$$;

-- Function to find schema inconsistencies
CREATE OR REPLACE FUNCTION public.find_schema_inconsistencies()
RETURNS TABLE (
  table_name text,
  issue_type text,
  description text,
  suggested_fix text,
  severity text
) SECURITY DEFINER LANGUAGE sql AS $$
  -- Tables without primary keys
  SELECT
    t.table_name,
    'missing_primary_key' AS issue_type,
    'Table has no primary key' AS description,
    format('ALTER TABLE %I ADD PRIMARY KEY (id);', t.table_name) AS suggested_fix,
    'high' AS severity
  FROM information_schema.tables t
  LEFT JOIN information_schema.table_constraints tc
    ON tc.table_schema = t.table_schema
    AND tc.table_name = t.table_name
    AND tc.constraint_type = 'PRIMARY KEY'
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND tc.constraint_name IS NULL
    
  UNION ALL
  
  -- Tables without created_at/updated_at columns
  SELECT
    t.table_name,
    'missing_timestamp_columns' AS issue_type,
    'Table is missing created_at or updated_at columns' AS description,
    format('ALTER TABLE %I ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(), ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();', t.table_name) AS suggested_fix,
    'medium' AS severity
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND (
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = t.table_schema 
        AND table_name = t.table_name 
        AND column_name = 'created_at'
      )
      OR
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = t.table_schema 
        AND table_name = t.table_name 
        AND column_name = 'updated_at'
      )
    )
    
  UNION ALL
  
  -- Tables with TEXT columns that should probably be VARCHAR
  SELECT
    c.table_name,
    'large_text_columns' AS issue_type,
    format('Column %I is TEXT type but might be better as VARCHAR with limit', c.column_name) AS description,
    format('ALTER TABLE %I ALTER COLUMN %I TYPE VARCHAR(255);', c.table_name, c.column_name) AS suggested_fix,
    'low' AS severity
  FROM information_schema.columns c
  JOIN information_schema.tables t 
    ON t.table_schema = c.table_schema 
    AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND c.data_type = 'text'
    AND c.column_name NOT IN ('description', 'content', 'notes', 'raw_content')
    
  UNION ALL
  
  -- Tables missing indexes on foreign keys
  SELECT
    tc.table_name,
    'missing_foreign_key_index' AS issue_type,
    format('Foreign key column %I has no index', kcu.column_name) AS description,
    format('CREATE INDEX ON %I (%I);', tc.table_name, kcu.column_name) AS suggested_fix,
    'medium' AS severity
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_schema = tc.constraint_schema
    AND kcu.constraint_name = tc.constraint_name
  LEFT JOIN pg_indexes idx
    ON idx.tablename = tc.table_name
    AND idx.indexdef LIKE '%' || kcu.column_name || '%'
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND idx.indexname IS NULL
  
  ORDER BY severity, table_name;
$$;

-- Function to export full schema
CREATE OR REPLACE FUNCTION public.export_full_schema()
RETURNS json SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  full_schema text;
BEGIN
  -- Get tables
  WITH table_defs AS (
    SELECT 
      format(
        '-- Table: %I\n%s;\n\n', 
        tablename,
        pg_catalog.pg_get_tabledef(tablename)
      ) AS def
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
  ),
  view_defs AS (
    SELECT 
      format(
        '-- View: %I\nCREATE OR REPLACE VIEW %I AS\n%s;\n\n', 
        viewname,
        viewname,
        definition
      ) AS def
    FROM pg_catalog.pg_views
    WHERE schemaname = 'public'
  ),
  function_defs AS (
    SELECT 
      format(
        '-- Function: %s\n%s\n\n',
        p.proname || '(' || pg_get_function_arguments(p.oid) || ')',
        pg_get_functiondef(p.oid)
      ) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  ),
  enum_defs AS (
    SELECT 
      format(
        '-- Enum: %I\nCREATE TYPE %I AS ENUM (%s);\n\n',
        t.typname,
        t.typname,
        (SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder)
         FROM pg_enum e
         WHERE e.enumtypid = t.oid)
      ) AS def
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    AND t.typtype = 'e'
  ),
  all_defs AS (
    SELECT '-- ENUMS\n\n' AS def
    UNION ALL
    SELECT def FROM enum_defs
    UNION ALL
    SELECT '\n-- TABLES\n\n' AS def
    UNION ALL
    SELECT def FROM table_defs
    UNION ALL
    SELECT '\n-- VIEWS\n\n' AS def
    UNION ALL
    SELECT def FROM view_defs
    UNION ALL
    SELECT '\n-- FUNCTIONS\n\n' AS def
    UNION ALL
    SELECT def FROM function_defs
  )
  SELECT string_agg(def, '') INTO full_schema FROM all_defs;

  RETURN json_build_object('schema', full_schema);
END;
$$;

-- Function to run SQL with proper permissions
CREATE OR REPLACE FUNCTION public.run_sql(p_sql text)
RETURNS jsonb SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  result jsonb;
BEGIN
  -- Check if the SQL is a SELECT statement (safer to execute)
  IF lower(trim(p_sql)) ~* '^select' THEN
    EXECUTE 'WITH result AS (' || p_sql || ') SELECT jsonb_agg(row_to_json(result)) FROM result'
    INTO result;
    RETURN COALESCE(result, '[]'::jsonb);
  ELSE
    -- For non-SELECT statements, just execute and return success
    EXECUTE p_sql;
    RETURN jsonb_build_object('message', 'SQL executed successfully');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Return error details
  RETURN jsonb_build_object(
    'error', true,
    'message', SQLERRM,
    'code', SQLSTATE
  );
END;
$$;

-- Create migration_logs table to track migrations
CREATE TABLE IF NOT EXISTS public.migration_logs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  sql_content TEXT NOT NULL
);

-- Add comments
COMMENT ON TABLE public.migration_logs IS 'Tracks database migration history';
COMMENT ON FUNCTION public.get_table_summaries() IS 'Returns statistics and status information for all tables';
COMMENT ON FUNCTION public.find_schema_inconsistencies() IS 'Identifies potential issues in database schema design';
COMMENT ON FUNCTION public.export_full_schema() IS 'Exports the complete database schema as SQL';
COMMENT ON FUNCTION public.run_sql(text) IS 'Runs arbitrary SQL with proper permissions and returns results or error';

-- Add initial migration record for this file
INSERT INTO public.migration_logs (name, executed_at, success, sql_content)
VALUES (
  '20250301000000_create_database_manager_functions',
  now(),
  true,
  '-- Created database management functions for Supabase Manager UI'
);