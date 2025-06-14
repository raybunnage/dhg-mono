-- Database Standards Helper Functions
-- These functions support automated standards enforcement and monitoring

-- Function to check if table has RLS enabled
CREATE OR REPLACE FUNCTION check_table_rls_status(p_table_name text)
RETURNS TABLE (rls_enabled boolean, policy_count int) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.relrowsecurity as rls_enabled,
    COUNT(pol.polname)::int as policy_count
  FROM pg_class c
  LEFT JOIN pg_policy pol ON pol.polrelid = c.oid
  LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = p_table_name
    AND n.nspname = 'public'
  GROUP BY c.relrowsecurity;
END;
$$ LANGUAGE plpgsql;

-- Function to check if trigger exists
CREATE OR REPLACE FUNCTION check_trigger_exists(p_table_name text, p_trigger_pattern text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = p_table_name
      AND n.nspname = 'public'
      AND t.tgname LIKE p_trigger_pattern
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get all user functions
CREATE OR REPLACE FUNCTION get_database_functions()
RETURNS TABLE (
  function_name text,
  return_type text,
  argument_types text,
  function_body text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.proname::text,
    pg_get_function_result(p.oid)::text,
    pg_get_function_arguments(p.oid)::text,
    pg_get_functiondef(p.oid)::text
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname NOT LIKE 'pg_%'
    AND p.proname NOT LIKE 'plpgsql_%'
  ORDER BY p.proname;
END;
$$ LANGUAGE plpgsql;

-- Standard updated_at function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get tables without RLS
CREATE OR REPLACE FUNCTION get_tables_without_rls()
RETURNS TABLE (table_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT c.relname::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity
    AND c.relname NOT LIKE 'pg_%'
    AND c.relname NOT LIKE '_prisma%'
  ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql;

-- Function to detect orphaned views
CREATE OR REPLACE FUNCTION find_orphaned_views()
RETURNS TABLE (
  view_name text,
  definition text,
  issue text
) AS $$
DECLARE
  v_record RECORD;
  v_test_query text;
  v_error text;
BEGIN
  FOR v_record IN 
    SELECT viewname, definition 
    FROM pg_views 
    WHERE schemaname = 'public'
  LOOP
    -- Test if view is valid
    v_test_query := 'SELECT * FROM ' || v_record.viewname || ' LIMIT 0';
    BEGIN
      EXECUTE v_test_query;
    EXCEPTION WHEN OTHERS THEN
      v_error := SQLERRM;
      RETURN QUERY SELECT 
        v_record.viewname::text,
        v_record.definition::text,
        v_error::text;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to find duplicate indexes
CREATE OR REPLACE FUNCTION find_duplicate_indexes()
RETURNS TABLE (
  table_name text,
  index1 text,
  index2 text,
  index_definition text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    idx1.tablename::text,
    idx1.indexname::text as index1,
    idx2.indexname::text as index2,
    idx1.indexdef::text
  FROM pg_indexes idx1
  JOIN pg_indexes idx2 ON 
    idx1.tablename = idx2.tablename AND
    idx1.indexname < idx2.indexname AND
    idx1.indexdef = idx2.indexdef
  WHERE idx1.schemaname = 'public';
END;
$$ LANGUAGE plpgsql;

-- Function to find unused indexes
CREATE OR REPLACE FUNCTION find_unused_indexes(days_threshold int DEFAULT 30)
RETURNS TABLE (
  schema_name text,
  table_name text,
  index_name text,
  index_scans bigint,
  index_size text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.schemaname::text,
    s.tablename::text,
    s.indexrelname::text,
    s.idx_scan,
    pg_size_pretty(pg_relation_size(s.indexrelid))::text
  FROM pg_stat_user_indexes s
  WHERE s.idx_scan = 0
    AND s.indexrelname NOT LIKE '%_pkey'
    AND s.indexrelname NOT LIKE '%_unique'
    AND s.schemaname = 'public'
    AND pg_relation_size(s.indexrelid) > 1024 * 1024 -- Only indexes > 1MB
  ORDER BY pg_relation_size(s.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check column naming standards
CREATE OR REPLACE FUNCTION check_column_standards(p_table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  issue text,
  suggestion text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    CASE
      -- Check snake_case
      WHEN c.column_name !~ '^[a-z]+(_[a-z0-9]+)*$' THEN 'Not in snake_case'
      -- Check boolean naming
      WHEN c.data_type = 'boolean' 
        AND c.column_name NOT LIKE 'is_%' 
        AND c.column_name NOT LIKE 'has_%' 
        AND c.column_name != 'active' THEN 'Boolean should start with is_ or has_'
      -- Check timestamp naming
      WHEN c.data_type LIKE '%timestamp%' 
        AND c.column_name NOT LIKE '%_at'
        AND c.column_name NOT IN ('timestamp', 'time') THEN 'Timestamp should end with _at'
      -- Check foreign key naming
      WHEN c.column_name LIKE '%_id' 
        AND c.data_type != 'uuid' THEN 'Foreign key should be UUID type'
      ELSE NULL
    END::text as issue,
    CASE
      WHEN c.column_name !~ '^[a-z]+(_[a-z0-9]+)*$' THEN 
        'Rename to: ' || lower(regexp_replace(c.column_name, '([A-Z])', '_\1', 'g'))
      WHEN c.data_type = 'boolean' 
        AND c.column_name NOT LIKE 'is_%' 
        AND c.column_name NOT LIKE 'has_%' THEN 
        'Rename to: is_' || c.column_name
      WHEN c.data_type LIKE '%timestamp%' 
        AND c.column_name NOT LIKE '%_at' THEN 
        'Rename to: ' || c.column_name || '_at'
      ELSE NULL
    END::text as suggestion
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table_name
    AND (
      c.column_name !~ '^[a-z]+(_[a-z0-9]+)*$'
      OR (c.data_type = 'boolean' 
          AND c.column_name NOT LIKE 'is_%' 
          AND c.column_name NOT LIKE 'has_%'
          AND c.column_name != 'active')
      OR (c.data_type LIKE '%timestamp%' 
          AND c.column_name NOT LIKE '%_at'
          AND c.column_name NOT IN ('timestamp', 'time'))
      OR (c.column_name LIKE '%_id' AND c.data_type != 'uuid')
    );
END;
$$ LANGUAGE plpgsql;

-- Function to find missing foreign key indexes
CREATE OR REPLACE FUNCTION find_missing_fk_indexes()
RETURNS TABLE (
  table_name text,
  column_name text,
  referenced_table text,
  suggested_index_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.table_name::text,
    kcu.column_name::text,
    ccu.table_name::text as referenced_table,
    'idx_' || tc.table_name || '_' || kcu.column_name as suggested_index_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tc.table_name
        AND a.attname = kcu.column_name
    );
END;
$$ LANGUAGE plpgsql;

-- Table to track function usage (for orphan detection)
CREATE TABLE IF NOT EXISTS sys_function_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  called_from TEXT,
  call_type TEXT CHECK (call_type IN ('function', 'view', 'trigger', 'application')),
  last_used TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(function_name, called_from)
);

-- Enable RLS on the tracking table
ALTER TABLE sys_function_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sys_function_usage" ON sys_function_usage FOR SELECT USING (true);
CREATE POLICY "Authenticated write sys_function_usage" ON sys_function_usage 
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Add index for performance
CREATE INDEX idx_sys_function_usage_last_used ON sys_function_usage(function_name, last_used DESC);

-- Function to analyze function dependencies
CREATE OR REPLACE FUNCTION analyze_function_dependencies()
RETURNS TABLE (
  function_name text,
  depends_on text[],
  used_by text[],
  is_orphaned boolean
) AS $$
BEGIN
  -- This would analyze pg_depend to find function relationships
  -- Placeholder for now
  RETURN QUERY
  SELECT 
    p.proname::text,
    NULL::text[],
    NULL::text[],
    false
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  LIMIT 0; -- Placeholder
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_table_rls_status IS 'Check if a table has RLS enabled and count policies';
COMMENT ON FUNCTION check_trigger_exists IS 'Check if a trigger matching pattern exists on table';
COMMENT ON FUNCTION get_database_functions IS 'Get all user-defined functions in public schema';
COMMENT ON FUNCTION get_tables_without_rls IS 'List all tables without row level security enabled';
COMMENT ON FUNCTION find_orphaned_views IS 'Find views that reference non-existent objects';
COMMENT ON FUNCTION find_duplicate_indexes IS 'Find indexes with identical definitions';
COMMENT ON FUNCTION find_unused_indexes IS 'Find indexes that haven''t been used';
COMMENT ON FUNCTION check_column_standards IS 'Check if columns follow naming standards';
COMMENT ON FUNCTION find_missing_fk_indexes IS 'Find foreign keys without indexes';