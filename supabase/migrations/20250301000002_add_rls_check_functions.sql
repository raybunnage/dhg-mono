-- Add RPC functions for checking RLS policies
-- These functions will be used by the SupabaseTableInspector component

-- Function to check if RLS is enabled for a table
CREATE OR REPLACE FUNCTION public.check_rls_enabled(table_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_enabled boolean;
BEGIN
  SELECT relrowsecurity INTO is_enabled
  FROM pg_class
  WHERE oid = (table_name::regclass)::oid;
  
  RETURN is_enabled;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error checking RLS status: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.check_rls_enabled(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rls_enabled(text) TO anon;

-- Function to get RLS policies for a table
CREATE OR REPLACE FUNCTION public.get_rls_policies(table_name text)
RETURNS TABLE (
  policyname text,
  tablename text,
  schemaname text,
  roles text[],
  cmd text,
  qual text,
  with_check text,
  permissive text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.policyname::text,
    p.tablename::text,
    p.schemaname::text,
    p.roles::text[],
    p.cmd::text,
    p.qual::text,
    p.with_check::text,
    p.permissive::text
  FROM pg_policies p
  WHERE p.tablename = table_name
  ORDER BY p.policyname;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error getting RLS policies: %', SQLERRM;
    RETURN;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_rls_policies(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rls_policies(text) TO anon;

-- Function to get table permissions
CREATE OR REPLACE FUNCTION public.get_table_permissions(table_name text)
RETURNS TABLE (
  grantee text,
  privilege_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.grantee::text,
    g.privilege_type::text
  FROM information_schema.role_table_grants g
  WHERE g.table_name = table_name
  AND g.table_schema = 'public'
  ORDER BY g.grantee, g.privilege_type;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error getting table permissions: %', SQLERRM;
    RETURN;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_table_permissions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_permissions(text) TO anon; 