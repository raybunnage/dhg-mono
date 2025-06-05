-- Drop existing functions if they exist (from previous migration)
DROP FUNCTION IF EXISTS public.get_all_tables_with_metadata();
DROP FUNCTION IF EXISTS public.get_table_columns(text);
DROP FUNCTION IF EXISTS public.get_table_row_count(text);

-- Create a function to dynamically list all tables with their metadata
CREATE OR REPLACE FUNCTION public.get_all_tables_with_metadata()
RETURNS TABLE (
  table_name text,
  table_schema text,
  table_type text,
  row_count bigint,
  size_pretty text,
  size_bytes bigint,
  column_count integer,
  has_primary_key boolean,
  has_rls boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  description text
) 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql 
AS $$
BEGIN
  RETURN QUERY
  WITH table_info AS (
    SELECT 
      t.tablename::text AS table_name,
      t.schemaname::text AS table_schema,
      'BASE TABLE'::text AS table_type,
      COALESCE(s.n_live_tup, 0)::bigint AS row_count,
      pg_size_pretty(pg_total_relation_size(c.oid))::text AS size_pretty,
      pg_total_relation_size(c.oid)::bigint AS size_bytes,
      (
        SELECT COUNT(*)::integer 
        FROM information_schema.columns col 
        WHERE col.table_schema = t.schemaname 
        AND col.table_name = t.tablename
      ) AS column_count,
      EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc 
        WHERE tc.table_schema = t.schemaname 
        AND tc.table_name = t.tablename 
        AND tc.constraint_type = 'PRIMARY KEY'
      ) AS has_primary_key,
      c.relrowsecurity AS has_rls,
      s.last_vacuum AS created_at, -- Using as proxy since we don't track actual creation time
      GREATEST(s.last_vacuum, s.last_autovacuum, s.last_analyze, s.last_autoanalyze) AS updated_at,
      obj_description(c.oid, 'pg_class')::text AS description
    FROM pg_catalog.pg_tables t
    JOIN pg_catalog.pg_class c ON c.relname = t.tablename
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
    LEFT JOIN pg_catalog.pg_stat_user_tables s ON s.relname = t.tablename AND s.schemaname = t.schemaname
    WHERE t.schemaname IN ('public', 'auth') -- Include both public and auth schemas
      AND t.tablename NOT LIKE 'pg_%' -- Exclude PostgreSQL system tables
      AND t.tablename NOT LIKE 'sql_%' -- Exclude SQL implementation tables
  )
  SELECT * FROM table_info
  ORDER BY 
    CASE 
      WHEN table_info.table_name LIKE 'ai_%' THEN 1
      WHEN table_info.table_name LIKE 'auth_%' THEN 2
      WHEN table_info.table_name LIKE 'batch_%' THEN 3
      WHEN table_info.table_name LIKE 'command_%' THEN 4
      WHEN table_info.table_name LIKE 'dev_%' THEN 5
      WHEN table_info.table_name LIKE 'doc_%' THEN 6
      WHEN table_info.table_name LIKE 'email_%' THEN 7
      WHEN table_info.table_name LIKE 'expert_%' THEN 8
      WHEN table_info.table_name LIKE 'filter_%' THEN 9
      WHEN table_info.table_name LIKE 'google_%' THEN 10
      WHEN table_info.table_name LIKE 'learn_%' THEN 11
      WHEN table_info.table_name LIKE 'media_%' THEN 12
      WHEN table_info.table_name LIKE 'scripts_%' THEN 13
      WHEN table_info.table_name LIKE 'sys_%' THEN 14
      ELSE 15
    END,
    table_info.table_name;
END;
$$;

-- Create a function to get table columns dynamically
CREATE OR REPLACE FUNCTION public.get_table_columns(p_table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  ordinal_position integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT 
    column_name::text,
    data_type::text,
    is_nullable::text,
    column_default::text,
    ordinal_position::integer
  FROM information_schema.columns
  WHERE table_schema IN ('public', 'auth')
    AND table_name = p_table_name
  ORDER BY ordinal_position;
$$;

-- Create a function to get row count with RLS handling
CREATE OR REPLACE FUNCTION public.get_table_row_count(p_table_name text)
RETURNS bigint
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count bigint;
  v_query text;
BEGIN
  -- Build the query dynamically
  v_query := format('SELECT COUNT(*) FROM %I', p_table_name);
  
  -- Execute the query
  EXECUTE v_query INTO v_count;
  
  RETURN COALESCE(v_count, 0);
EXCEPTION
  WHEN insufficient_privilege THEN
    -- If RLS prevents access, try to get count from pg_stat_user_tables
    SELECT n_live_tup INTO v_count
    FROM pg_stat_user_tables
    WHERE relname = p_table_name;
    
    RETURN COALESCE(v_count, 0);
  WHEN OTHERS THEN
    -- Return 0 for any other errors
    RETURN 0;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_tables_with_metadata() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_row_count(text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.get_all_tables_with_metadata() IS 'Returns metadata for all database tables including row counts, sizes, and structure information';
COMMENT ON FUNCTION public.get_table_columns(text) IS 'Returns column information for a specific table';
COMMENT ON FUNCTION public.get_table_row_count(text) IS 'Returns row count for a table, handling RLS restrictions gracefully';