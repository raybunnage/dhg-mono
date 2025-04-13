-- Remove RPC functions for checking RLS policies

-- Drop the functions
DROP FUNCTION IF EXISTS public.check_rls_enabled(text);
DROP FUNCTION IF EXISTS public.get_rls_policies(text);
DROP FUNCTION IF EXISTS public.get_table_permissions(text); 