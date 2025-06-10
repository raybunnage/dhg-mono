-- Migration: Fix RLS audit to exclude views
-- Description: Views cannot have RLS policies, so exclude them from RLS audits
-- Created: 2025-06-09

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.get_tables_without_rls();

-- Create an improved function that properly excludes views from RLS checks
CREATE OR REPLACE FUNCTION public.get_tables_without_rls()
RETURNS TABLE (
  schema_name text,
  table_name text,
  table_type text,
  row_count bigint,
  size_pretty text
) 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql 
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.nspname::text as schema_name,
    c.relname::text as table_name,
    CASE c.relkind
      WHEN 'r' THEN 'table'
      WHEN 'p' THEN 'partitioned table'
      WHEN 'm' THEN 'materialized view'
      ELSE 'other'
    END::text as table_type,
    COALESCE(s.n_live_tup, 0)::bigint as row_count,
    pg_size_pretty(pg_total_relation_size(c.oid))::text as size_pretty
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
  WHERE 
    -- Only check tables and partitioned tables (not views)
    c.relkind IN ('r', 'p')
    -- Exclude system schemas
    AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
    -- Only tables without RLS enabled
    AND c.relrowsecurity = false
    -- Exclude temp tables
    AND n.nspname NOT LIKE 'pg_temp%'
    -- Exclude toast tables
    AND n.nspname NOT LIKE 'pg_toast%'
  ORDER BY n.nspname, c.relname;
END;
$$;

-- Create a function to check if an object supports RLS
CREATE OR REPLACE FUNCTION public.can_have_rls(p_schema text, p_object_name text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_relkind char;
BEGIN
  -- Get the object type
  SELECT c.relkind INTO v_relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = p_schema
    AND c.relname = p_object_name;
    
  -- Only regular tables and partitioned tables can have RLS
  -- Views (v), materialized views (m), and other types cannot
  RETURN v_relkind IN ('r', 'p');
END;
$$;

-- Create a comprehensive RLS audit function
CREATE OR REPLACE FUNCTION public.audit_rls_status()
RETURNS TABLE (
  schema_name text,
  object_name text,
  object_type text,
  has_rls boolean,
  rls_supported boolean,
  policy_count integer,
  recommendation text
) 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql 
AS $$
BEGIN
  RETURN QUERY
  WITH object_info AS (
    SELECT 
      n.nspname as schema_name,
      c.relname as object_name,
      CASE c.relkind
        WHEN 'r' THEN 'table'
        WHEN 'p' THEN 'partitioned table'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized view'
        WHEN 'f' THEN 'foreign table'
        ELSE 'other'
      END as object_type,
      c.relrowsecurity as has_rls,
      c.relkind IN ('r', 'p') as rls_supported,
      c.oid as object_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
      AND n.nspname NOT LIKE 'pg_temp%'
      AND n.nspname NOT LIKE 'pg_toast%'
  ),
  policy_counts AS (
    SELECT 
      polrelid,
      COUNT(*) as policy_count
    FROM pg_policy
    GROUP BY polrelid
  )
  SELECT 
    oi.schema_name::text,
    oi.object_name::text,
    oi.object_type::text,
    oi.has_rls,
    oi.rls_supported,
    COALESCE(pc.policy_count, 0)::integer as policy_count,
    CASE 
      WHEN NOT oi.rls_supported THEN 'N/A - ' || oi.object_type || 's cannot have RLS'
      WHEN oi.has_rls AND pc.policy_count > 0 THEN 'OK - RLS enabled with ' || pc.policy_count || ' policies'
      WHEN oi.has_rls AND pc.policy_count = 0 THEN 'WARNING - RLS enabled but no policies defined'
      WHEN NOT oi.has_rls AND oi.schema_name = 'public' THEN 'REVIEW - Consider enabling RLS for security'
      ELSE 'OK - No RLS needed'
    END::text as recommendation
  FROM object_info oi
  LEFT JOIN policy_counts pc ON pc.polrelid = oi.object_oid
  ORDER BY 
    CASE 
      WHEN oi.has_rls AND pc.policy_count = 0 THEN 1  -- Warnings first
      WHEN NOT oi.has_rls AND oi.rls_supported AND oi.schema_name = 'public' THEN 2  -- Reviews second
      ELSE 3  -- Everything else
    END,
    oi.schema_name,
    oi.object_name;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_tables_without_rls() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_have_rls(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_rls_status() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.get_tables_without_rls() IS 'Returns only tables (not views) that lack RLS policies';
COMMENT ON FUNCTION public.can_have_rls(text, text) IS 'Checks if a database object can have RLS policies (only regular and partitioned tables)';
COMMENT ON FUNCTION public.audit_rls_status() IS 'Comprehensive RLS audit that properly handles views and other non-RLS objects';

-- Update the get_all_tables_with_metadata function to clarify RLS status for views
DROP FUNCTION IF EXISTS public.get_all_tables_with_metadata();

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
  rls_status text,
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
      c.relname::text AS table_name,
      n.nspname::text AS table_schema,
      CASE c.relkind
        WHEN 'r' THEN 'table'
        WHEN 'p' THEN 'partitioned table'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized view'
        ELSE 'other'
      END::text AS table_type,
      COALESCE(s.n_live_tup, 0)::bigint AS row_count,
      pg_size_pretty(pg_total_relation_size(c.oid))::text AS size_pretty,
      pg_total_relation_size(c.oid)::bigint AS size_bytes,
      (
        SELECT COUNT(*)::integer 
        FROM information_schema.columns col 
        WHERE col.table_schema = n.nspname 
        AND col.table_name = c.relname
      ) AS column_count,
      EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc 
        WHERE tc.table_schema = n.nspname 
        AND tc.table_name = c.relname 
        AND tc.constraint_type = 'PRIMARY KEY'
      ) AS has_primary_key,
      c.relrowsecurity AS has_rls,
      CASE 
        WHEN c.relkind = 'v' THEN 'N/A (view)'
        WHEN c.relkind = 'm' THEN 'N/A (materialized view)'
        WHEN c.relrowsecurity THEN 'Enabled'
        ELSE 'Disabled'
      END::text as rls_status,
      s.last_vacuum AS created_at,
      GREATEST(s.last_vacuum, s.last_autovacuum, s.last_analyze, s.last_autoanalyze) AS updated_at,
      obj_description(c.oid, 'pg_class')::text AS description
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_catalog.pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname IN ('public', 'auth')
      AND c.relkind IN ('r', 'p', 'v', 'm')  -- Include tables, partitioned tables, views, materialized views
      AND c.relname NOT LIKE 'pg_%'
      AND c.relname NOT LIKE 'sql_%'
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

GRANT EXECUTE ON FUNCTION public.get_all_tables_with_metadata() TO authenticated;

-- Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
  ('public', 'get_tables_without_rls', 'Function to find tables lacking RLS (excludes views)', 'RLS audit support', CURRENT_DATE),
  ('public', 'can_have_rls', 'Function to check if object supports RLS', 'RLS audit support', CURRENT_DATE),
  ('public', 'audit_rls_status', 'Comprehensive RLS audit function', 'RLS audit support', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;