-- Simple export function without complex argument handling
-- Run this directly in the Supabase SQL editor

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.export_all_functions_to_json();

-- Create a simpler version that avoids the problematic generate_series
CREATE OR REPLACE FUNCTION public.export_all_functions_to_json()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    WITH function_info AS (
        SELECT
            n.nspname AS schema_name,
            p.proname AS function_name,
            pg_get_function_arguments(p.oid) AS arguments,
            CASE
                WHEN p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype THEN 'trigger'
                ELSE pg_get_function_result(p.oid)
            END AS return_type,
            p.prosrc AS function_body,
            obj_description(p.oid, 'pg_proc') AS description,
            p.provolatile AS volatility,
            pg_catalog.pg_get_userbyid(p.proowner) AS owner,
            p.prosecdef AS security_definer
        FROM
            pg_catalog.pg_proc p
            INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE
            n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND p.prokind = 'f'  -- Only regular functions, not aggregates or procedures
    )
    SELECT json_agg(
        json_build_object(
            'schema', schema_name,
            'name', function_name,
            'arguments', arguments,
            'return_type', return_type,
            'body', function_body,
            'description', description,
            'volatility', volatility,
            'owner', owner,
            'security_definer', security_definer
        )
    ) INTO result
    FROM function_info;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the function
GRANT EXECUTE ON FUNCTION public.export_all_functions_to_json() TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_all_functions_to_json() TO service_role;

-- Comment on function
COMMENT ON FUNCTION public.export_all_functions_to_json() IS 
'Exports all PostgreSQL functions in the database to a JSON format, including their definitions, arguments, return types, and other metadata.';