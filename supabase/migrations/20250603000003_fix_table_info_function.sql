-- Fix the get_table_info_with_definitions function
-- The previous version had an error with column names

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_table_info_with_definitions();

-- Create the corrected function
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
) AS $$
BEGIN
    RETURN QUERY
    WITH table_sizes AS (
        SELECT 
            n.nspname AS schema_name,
            c.relname AS table_name,
            pg_size_pretty(pg_relation_size(c.oid)) AS size_pretty,
            pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size_pretty
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'v', 'm')
            AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ),
    row_counts AS (
        SELECT 
            schemaname AS schema_name,
            tablename AS table_name,
            n_live_tup AS row_count
        FROM pg_stat_user_tables
    )
    SELECT 
        c.table_schema::text,
        c.table_name::text,
        c.table_type::text,
        COALESCE(rc.row_count, 0) AS row_count,
        COALESCE(ts.size_pretty, '0 bytes') AS size_pretty,
        COALESCE(ts.total_size_pretty, '0 bytes') AS total_size_pretty,
        td.description,
        td.purpose,
        td.created_date,
        td.created_by,
        td.notes
    FROM information_schema.tables c
    LEFT JOIN table_sizes ts ON ts.schema_name = c.table_schema AND ts.table_name = c.table_name
    LEFT JOIN row_counts rc ON rc.schema_name = c.table_schema AND rc.table_name = c.table_name
    LEFT JOIN sys_table_definitions td ON td.table_schema = c.table_schema AND td.table_name = c.table_name
    WHERE c.table_schema IN ('public')
        OR (c.table_schema = 'auth' AND c.table_name = 'users')
    ORDER BY c.table_schema, c.table_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_table_info_with_definitions() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_table_info_with_definitions() IS 'Returns comprehensive table information including metadata from sys_table_definitions with creation dates and descriptions';