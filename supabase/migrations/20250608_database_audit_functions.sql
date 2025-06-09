-- Database Audit Functions for comprehensive table analysis

-- Function to get table columns with detailed info
CREATE OR REPLACE FUNCTION get_table_columns(schema_name text, table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  character_maximum_length integer,
  numeric_precision integer,
  numeric_scale integer,
  is_identity text,
  ordinal_position integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.character_maximum_length::integer,
    c.numeric_precision::integer,
    c.numeric_scale::integer,
    c.is_identity::text,
    c.ordinal_position::integer
  FROM information_schema.columns c
  WHERE c.table_schema = schema_name 
    AND c.table_name = get_table_columns.table_name
  ORDER BY c.ordinal_position;
END;
$$;

-- Function to get table constraints
CREATE OR REPLACE FUNCTION get_table_constraints(schema_name text, table_name text)
RETURNS TABLE (
  constraint_name text,
  constraint_type text,
  column_names text[],
  foreign_table_name text,
  foreign_column_names text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.constraint_name::text,
    tc.constraint_type::text,
    array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) as column_names,
    ccu.table_name::text as foreign_table_name,
    array_agg(DISTINCT ccu.column_name::text) as foreign_column_names
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.table_schema = schema_name 
    AND tc.table_name = get_table_constraints.table_name
  GROUP BY tc.constraint_name, tc.constraint_type, ccu.table_name;
END;
$$;

-- Function to get table indexes
CREATE OR REPLACE FUNCTION get_table_indexes(schema_name text, table_name text)
RETURNS TABLE (
  index_name text,
  is_unique boolean,
  is_primary boolean,
  column_names text[],
  index_type text,
  index_size bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.relname::text as index_name,
    ix.indisunique as is_unique,
    ix.indisprimary as is_primary,
    array_agg(a.attname::text ORDER BY array_position(ix.indkey, a.attnum)) as column_names,
    am.amname::text as index_type,
    pg_relation_size(i.oid) as index_size
  FROM pg_class t
  JOIN pg_index ix ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_am am ON i.relam = am.oid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = schema_name
    AND t.relname = get_table_indexes.table_name
    AND t.relkind = 'r'
  GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname, i.oid;
END;
$$;

-- Function to get RLS policies
CREATE OR REPLACE FUNCTION get_table_policies(schema_name text, table_name text)
RETURNS TABLE (
  policy_name text,
  command text,
  permissive text,
  roles text[],
  qual text,
  with_check text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pol.polname::text as policy_name,
    CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END::text as command,
    CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END::text as permissive,
    CASE 
      WHEN pol.polroles = '{0}' THEN ARRAY['public']
      ELSE ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles))
    END as roles,
    pg_get_expr(pol.polqual, pol.polrelid)::text as qual,
    pg_get_expr(pol.polwithcheck, pol.polrelid)::text as with_check
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = schema_name
    AND c.relname = get_table_policies.table_name;
END;
$$;

-- Function to get table triggers
CREATE OR REPLACE FUNCTION get_table_triggers(schema_name text, table_name text)
RETURNS TABLE (
  trigger_name text,
  event_manipulation text,
  event_object_table text,
  action_timing text,
  action_orientation text,
  action_statement text,
  is_enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tg.tgname::text as trigger_name,
    CASE
      WHEN tg.tgtype & 2 = 2 THEN 'INSERT'
      WHEN tg.tgtype & 4 = 4 THEN 'DELETE'
      WHEN tg.tgtype & 8 = 8 THEN 'UPDATE'
      WHEN tg.tgtype & 16 = 16 THEN 'TRUNCATE'
    END::text as event_manipulation,
    c.relname::text as event_object_table,
    CASE WHEN tg.tgtype & 1 = 1 THEN 'BEFORE' ELSE 'AFTER' END::text as action_timing,
    CASE WHEN tg.tgtype & 64 = 64 THEN 'STATEMENT' ELSE 'ROW' END::text as action_orientation,
    p.proname::text as action_statement,
    tg.tgenabled != 'D' as is_enabled
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = tg.tgfoid
  WHERE n.nspname = schema_name
    AND c.relname = get_table_triggers.table_name
    AND NOT tg.tgisinternal;
END;
$$;

-- Function to get foreign key details
CREATE OR REPLACE FUNCTION get_table_foreign_keys(schema_name text, table_name text)
RETURNS TABLE (
  constraint_name text,
  column_name text,
  foreign_table_schema text,
  foreign_table_name text,
  foreign_column_name text,
  delete_rule text,
  update_rule text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.constraint_name::text,
    kcu.column_name::text,
    ccu.table_schema::text as foreign_table_schema,
    ccu.table_name::text as foreign_table_name,
    ccu.column_name::text as foreign_column_name,
    rc.delete_rule::text,
    rc.update_rule::text
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
  WHERE tc.table_schema = schema_name
    AND tc.table_name = get_table_foreign_keys.table_name
    AND tc.constraint_type = 'FOREIGN KEY';
END;
$$;

-- Function to analyze function usage
CREATE OR REPLACE FUNCTION analyze_function_usage()
RETURNS TABLE (
  function_name text,
  function_schema text,
  argument_types text,
  return_type text,
  is_used boolean,
  used_in_views integer,
  used_in_functions integer,
  used_in_triggers integer,
  total_usage_count integer,
  can_be_safely_removed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH function_list AS (
    SELECT 
      p.proname as function_name,
      n.nspname as function_schema,
      pg_get_function_arguments(p.oid) as argument_types,
      pg_get_function_result(p.oid) as return_type,
      p.oid as function_oid,
      p.proname || '(' || COALESCE(pg_get_function_arguments(p.oid), '') || ')' as full_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'extensions')
      AND p.prokind = 'f'
  ),
  view_usage AS (
    SELECT 
      fl.function_oid,
      COUNT(DISTINCT v.oid) as view_count
    FROM function_list fl
    JOIN pg_class v ON v.relkind = 'v'
    JOIN pg_rewrite r ON r.ev_class = v.oid
    WHERE r.ev_action::text LIKE '%' || fl.function_name || '%'
    GROUP BY fl.function_oid
  ),
  function_usage AS (
    SELECT 
      fl.function_oid,
      COUNT(DISTINCT p2.oid) as function_count
    FROM function_list fl
    JOIN pg_proc p2 ON p2.oid != fl.function_oid
    WHERE p2.prosrc LIKE '%' || fl.function_name || '%'
    GROUP BY fl.function_oid
  ),
  trigger_usage AS (
    SELECT 
      p.oid as function_oid,
      COUNT(DISTINCT tg.oid) as trigger_count
    FROM pg_proc p
    JOIN pg_trigger tg ON tg.tgfoid = p.oid
    GROUP BY p.oid
  )
  SELECT 
    fl.function_name::text,
    fl.function_schema::text,
    fl.argument_types::text,
    fl.return_type::text,
    (COALESCE(vu.view_count, 0) + COALESCE(fu.function_count, 0) + COALESCE(tu.trigger_count, 0)) > 0 as is_used,
    COALESCE(vu.view_count, 0)::integer as used_in_views,
    COALESCE(fu.function_count, 0)::integer as used_in_functions,
    COALESCE(tu.trigger_count, 0)::integer as used_in_triggers,
    (COALESCE(vu.view_count, 0) + COALESCE(fu.function_count, 0) + COALESCE(tu.trigger_count, 0))::integer as total_usage_count,
    (COALESCE(vu.view_count, 0) + COALESCE(fu.function_count, 0) + COALESCE(tu.trigger_count, 0)) = 0 as can_be_safely_removed
  FROM function_list fl
  LEFT JOIN view_usage vu ON vu.function_oid = fl.function_oid
  LEFT JOIN function_usage fu ON fu.function_oid = fl.function_oid
  LEFT JOIN trigger_usage tu ON tu.function_oid = fl.function_oid
  ORDER BY 
    (COALESCE(vu.view_count, 0) + COALESCE(fu.function_count, 0) + COALESCE(tu.trigger_count, 0)),
    fl.function_schema,
    fl.function_name;
END;
$$;

-- Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
  ('public', 'get_table_columns', 'Function to retrieve detailed column information', 'Database audit support', CURRENT_DATE),
  ('public', 'get_table_constraints', 'Function to retrieve table constraints', 'Database audit support', CURRENT_DATE),
  ('public', 'get_table_indexes', 'Function to retrieve table indexes', 'Database audit support', CURRENT_DATE),
  ('public', 'get_table_policies', 'Function to retrieve RLS policies', 'Database audit support', CURRENT_DATE),
  ('public', 'get_table_triggers', 'Function to retrieve table triggers', 'Database audit support', CURRENT_DATE),
  ('public', 'get_table_foreign_keys', 'Function to retrieve foreign key details', 'Database audit support', CURRENT_DATE),
  ('public', 'analyze_function_usage', 'Function to analyze database function usage', 'Database cleanup support', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;