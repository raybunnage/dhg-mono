-- Create a simpler function to get views with their info
CREATE OR REPLACE FUNCTION get_all_views_with_info()
RETURNS TABLE (
    view_name text,
    view_schema text,
    is_updatable boolean,
    is_insertable boolean,
    has_rls boolean,
    table_dependencies text[],
    suggested_prefix text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    prefixes text[] := ARRAY['ai_', 'auth_', 'batch_', 'command_', 'dev_', 'doc_', 
                             'email_', 'expert_', 'filter_', 'google_', 'learn_', 
                             'media_', 'scripts_', 'sys_'];
BEGIN
    RETURN QUERY
    WITH view_data AS (
        SELECT * FROM get_database_views_info()
    )
    SELECT 
        vd.view_name,
        vd.view_schema,
        vd.is_updatable,
        vd.is_insertable,
        vd.has_rls,
        vd.table_dependencies,
        CASE 
            -- First check if view name has a prefix
            WHEN vd.view_name LIKE 'ai_%' THEN 'ai_'
            WHEN vd.view_name LIKE 'auth_%' THEN 'auth_'
            WHEN vd.view_name LIKE 'batch_%' THEN 'batch_'
            WHEN vd.view_name LIKE 'command_%' THEN 'command_'
            WHEN vd.view_name LIKE 'dev_%' THEN 'dev_'
            WHEN vd.view_name LIKE 'doc_%' THEN 'doc_'
            WHEN vd.view_name LIKE 'email_%' THEN 'email_'
            WHEN vd.view_name LIKE 'expert_%' THEN 'expert_'
            WHEN vd.view_name LIKE 'filter_%' THEN 'filter_'
            WHEN vd.view_name LIKE 'google_%' THEN 'google_'
            WHEN vd.view_name LIKE 'learn_%' THEN 'learn_'
            WHEN vd.view_name LIKE 'media_%' THEN 'media_'
            WHEN vd.view_name LIKE 'scripts_%' THEN 'scripts_'
            WHEN vd.view_name LIKE 'sys_%' THEN 'sys_'
            -- Then check dependencies
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%ai_%') THEN 'ai_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%auth_%') THEN 'auth_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%batch_%') THEN 'batch_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%command_%') THEN 'command_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%dev_%') THEN 'dev_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%doc_%') THEN 'doc_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%email_%') THEN 'email_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%expert_%') THEN 'expert_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%filter_%') THEN 'filter_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%google_%') THEN 'google_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%learn_%') THEN 'learn_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%media_%') THEN 'media_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%scripts_%') THEN 'scripts_'
            WHEN EXISTS (SELECT 1 FROM unnest(vd.table_dependencies) AS dep WHERE dep LIKE '%sys_%') THEN 'sys_'
            ELSE 'other'
        END AS suggested_prefix
    FROM view_data vd
    ORDER BY suggested_prefix, vd.view_name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_all_views_with_info() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_views_with_info() TO anon;

-- Add comment
COMMENT ON FUNCTION get_all_views_with_info() IS 'Returns all database views with their info and suggested prefix based on name or dependencies';