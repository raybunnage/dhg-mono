-- Fix the sys_detect_database_changes function to work with current schema

-- Drop and recreate the function with proper column references
DROP FUNCTION IF EXISTS sys_detect_database_changes();

CREATE OR REPLACE FUNCTION sys_detect_database_changes()
RETURNS TABLE (
  change_type TEXT,
  object_name TEXT,
  details JSONB
) AS $$
BEGIN
  -- Check for new tables
  RETURN QUERY
  SELECT 
    'table_created'::TEXT,
    t.table_name::TEXT,
    jsonb_build_object(
      'schema', t.table_schema,
      'table_type', t.table_type,
      'created_approximate', NOW()
    )
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (
      SELECT 1 FROM sys_table_definitions std
      WHERE std.table_name = t.table_name
      AND std.table_schema = t.table_schema
    );
    
  -- Check for new views
  RETURN QUERY
  SELECT 
    'view_created'::TEXT,
    v.table_name::TEXT,
    jsonb_build_object(
      'schema', v.table_schema,
      'table_type', 'VIEW',
      'created_approximate', NOW()
    )
  FROM information_schema.views v
  WHERE v.table_schema = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM sys_table_definitions std
      WHERE std.table_name = v.table_name
      AND std.table_schema = v.table_schema
    );
END;
$$ LANGUAGE plpgsql;

-- Also add a helpful view to see what tables are missing definitions
CREATE OR REPLACE VIEW sys_tables_missing_definitions_view AS
SELECT 
  t.table_schema,
  t.table_name,
  t.table_type,
  CASE 
    WHEN t.table_name LIKE 'sys_%' THEN 'system'
    WHEN t.table_name LIKE 'auth_%' THEN 'auth'
    WHEN t.table_name LIKE 'command_%' THEN 'command'
    ELSE 'other'
  END as category
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND NOT EXISTS (
    SELECT 1 FROM sys_table_definitions std
    WHERE std.table_name = t.table_name
    AND std.table_schema = t.table_schema
  )
ORDER BY t.table_name;

COMMENT ON VIEW sys_tables_missing_definitions_view IS 'Shows all tables that don''t have entries in sys_table_definitions';