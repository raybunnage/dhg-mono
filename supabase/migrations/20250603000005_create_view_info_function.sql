-- Create a function to get database views information
CREATE OR REPLACE FUNCTION get_database_views_info()
RETURNS TABLE (
    view_name text,
    view_schema text,
    view_definition text,
    is_insertable boolean,
    is_updatable boolean,
    is_deletable boolean,
    has_rls boolean,
    table_dependencies text[]
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH view_info AS (
        SELECT 
            c.relname AS view_name,
            n.nspname AS view_schema,
            pg_get_viewdef(c.oid, true) AS view_definition,
            v.is_insertable_into = 'YES' AS is_insertable,
            v.is_updatable = 'YES' AS is_updatable,
            v.is_trigger_deletable = 'YES' AS is_deletable,
            c.relrowsecurity AS has_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN information_schema.views v ON v.table_name = c.relname AND v.table_schema = n.nspname
        WHERE c.relkind = 'v'
            AND n.nspname IN ('public', 'auth')
    ),
    view_dependencies AS (
        SELECT DISTINCT
            dependent_ns.nspname || '.' || dependent_view.relname AS view_full_name,
            source_ns.nspname || '.' || source_table.relname AS table_full_name
        FROM pg_depend
        JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
        JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
        JOIN pg_class AS source_table ON pg_depend.refobjid = source_table.oid
        JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
        JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
        WHERE dependent_view.relkind = 'v'
            AND source_table.relkind IN ('r', 'v')
            AND dependent_ns.nspname IN ('public', 'auth')
            AND source_ns.nspname NOT IN ('pg_catalog', 'information_schema')
    )
    SELECT 
        vi.view_name::text,
        vi.view_schema::text,
        vi.view_definition::text,
        vi.is_insertable,
        vi.is_updatable,
        vi.is_deletable,
        vi.has_rls,
        COALESCE(
            ARRAY_AGG(DISTINCT vd.table_full_name) FILTER (WHERE vd.table_full_name IS NOT NULL),
            ARRAY[]::text[]
        ) AS table_dependencies
    FROM view_info vi
    LEFT JOIN view_dependencies vd ON vd.view_full_name = vi.view_schema || '.' || vi.view_name
    GROUP BY 
        vi.view_name, 
        vi.view_schema, 
        vi.view_definition, 
        vi.is_insertable, 
        vi.is_updatable, 
        vi.is_deletable,
        vi.has_rls
    ORDER BY vi.view_schema, vi.view_name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_database_views_info() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_views_info() TO anon;

-- Add comment
COMMENT ON FUNCTION get_database_views_info() IS 'Returns comprehensive information about database views including their dependencies and features';