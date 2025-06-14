-- Helper functions for querying table information

-- Get all public tables
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE (table_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT t.tablename::text
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql;

-- Get columns for a table
CREATE OR REPLACE FUNCTION get_table_columns(p_table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.attname::text as column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod)::text as data_type,
    CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END::text as is_nullable,
    pg_get_expr(d.adbin, d.adrelid)::text as column_default
  FROM pg_attribute a
  LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
  WHERE a.attrelid = p_table_name::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY a.attnum;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_public_tables IS 'Get all tables in public schema';
COMMENT ON FUNCTION get_table_columns IS 'Get column information for a specific table';