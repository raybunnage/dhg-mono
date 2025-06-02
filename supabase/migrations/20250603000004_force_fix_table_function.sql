-- Force fix the get_table_info_with_definitions function
-- Drop and recreate to ensure clean state

-- First drop the function completely
DROP FUNCTION IF EXISTS get_table_info_with_definitions() CASCADE;

-- Wait a moment for the drop to complete
DO $$ BEGIN PERFORM pg_sleep(0.1); END $$;

-- Now create the correct version
CREATE OR REPLACE FUNCTION get_table_info_with_definitions()
RETURNS TABLE (
    table_schema text,
    table_name text,
    table_type text,
    row_count bigint,
    size_pretty text,
    total_size_pretty text,
    description text,
    purpose text,
    created_date date,
    created_by text,
    notes text
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH table_stats AS (
        SELECT 
            n.nspname AS schema_name,
            c.relname AS table_name,
            pg_size_pretty(pg_relation_size(c.oid)) AS size_pretty,
            pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size_pretty,
            s.n_live_tup AS row_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.schemaname = n.nspname AND s.relname = c.relname
        WHERE c.relkind IN ('r', 'v', 'm')
            AND n.nspname IN ('public', 'auth')
    )
    SELECT 
        ist.table_schema::text,
        ist.table_name::text,
        ist.table_type::text,
        COALESCE(ts.row_count, 0)::bigint AS row_count,
        COALESCE(ts.size_pretty, '0 bytes')::text AS size_pretty,
        COALESCE(ts.total_size_pretty, '0 bytes')::text AS total_size_pretty,
        td.description::text,
        td.purpose::text,
        td.created_date,
        td.created_by::text,
        td.notes::text
    FROM information_schema.tables ist
    LEFT JOIN table_stats ts ON ts.schema_name = ist.table_schema AND ts.table_name = ist.table_name
    LEFT JOIN sys_table_definitions td ON td.table_schema = ist.table_schema AND td.table_name = ist.table_name
    WHERE (ist.table_schema = 'public')
        OR (ist.table_schema = 'auth' AND ist.table_name = 'users')
    ORDER BY 
        ist.table_schema,
        CASE 
            WHEN ist.table_name LIKE 'ai_%' THEN 1
            WHEN ist.table_name LIKE 'auth_%' THEN 2
            WHEN ist.table_name LIKE 'batch_%' THEN 3
            WHEN ist.table_name LIKE 'command_%' THEN 4
            WHEN ist.table_name LIKE 'dev_%' THEN 5
            WHEN ist.table_name LIKE 'doc_%' THEN 6
            WHEN ist.table_name LIKE 'email_%' THEN 7
            WHEN ist.table_name LIKE 'expert_%' THEN 8
            WHEN ist.table_name LIKE 'filter_%' THEN 9
            WHEN ist.table_name LIKE 'google_%' THEN 10
            WHEN ist.table_name LIKE 'learn_%' THEN 11
            WHEN ist.table_name LIKE 'media_%' THEN 12
            WHEN ist.table_name LIKE 'scripts_%' THEN 13
            WHEN ist.table_name LIKE 'sys_%' THEN 14
            ELSE 15
        END,
        ist.table_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_table_info_with_definitions() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_info_with_definitions() TO anon;

-- Add comment
COMMENT ON FUNCTION get_table_info_with_definitions() IS 'Returns comprehensive table information including metadata from sys_table_definitions with creation dates and descriptions - fixed version';