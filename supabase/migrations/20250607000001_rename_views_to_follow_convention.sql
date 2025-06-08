-- Rename views to follow naming convention (all views should end with _view)

-- 1. Drop dependent objects first (if any)
-- Note: We need to handle any dependencies before dropping views

-- 2. Drop the old views
DROP VIEW IF EXISTS sys_database_objects_info CASCADE;
DROP VIEW IF EXISTS sys_service_dependency_summary CASCADE;

-- 3. Recreate with correct names

-- sys_database_objects_info_view (renamed from sys_database_objects_info)
CREATE OR REPLACE VIEW sys_database_objects_info_view AS
SELECT 
    td.*,
    CASE 
        WHEN td.object_type = 'view' THEN
            EXISTS (
                SELECT 1 
                FROM information_schema.views v
                WHERE v.table_schema = td.table_schema 
                AND v.table_name = td.table_name
                AND v.is_updatable = 'YES'
            )
        ELSE NULL
    END as is_currently_updatable,
    CASE 
        WHEN td.object_type = 'view' THEN
            EXISTS (
                SELECT 1 
                FROM information_schema.views v
                WHERE v.table_schema = td.table_schema 
                AND v.table_name = td.table_name
                AND v.is_insertable_into = 'YES'
            )
        ELSE NULL
    END as is_currently_insertable,
    CASE 
        WHEN td.object_type = 'table' THEN
            (
                SELECT COUNT(*)::integer 
                FROM information_schema.columns c
                WHERE c.table_schema = td.table_schema 
                AND c.table_name = td.table_name
            )
        ELSE NULL
    END as column_count,
    CASE 
        WHEN td.object_type = 'table' THEN
            (
                SELECT array_agg(c.column_name ORDER BY c.ordinal_position)
                FROM information_schema.columns c
                WHERE c.table_schema = td.table_schema 
                AND c.table_name = td.table_name
            )
        ELSE NULL
    END as column_names
FROM sys_table_definitions td
ORDER BY 
    td.object_type,
    td.table_schema,
    td.table_name;

-- sys_service_dependency_summary_view (renamed from sys_service_dependency_summary)
CREATE OR REPLACE VIEW sys_service_dependency_summary_view AS
SELECT 
  s.id,
  s.service_name,
  s.category,
  s.description,
  s.is_singleton,
  s.has_browser_variant,
  s.status,
  COUNT(DISTINCT asd.app_id) as used_by_apps_count,
  COUNT(DISTINCT psd.pipeline_id) as used_by_pipelines_count,
  COUNT(DISTINCT sd.depends_on_service_id) as depends_on_count,
  COUNT(DISTINCT sd2.service_id) as depended_by_count
FROM sys_shared_services s
LEFT JOIN sys_app_service_dependencies asd ON s.id = asd.service_id
LEFT JOIN sys_pipeline_service_dependencies psd ON s.id = psd.service_id
LEFT JOIN sys_service_dependencies sd ON s.id = sd.service_id
LEFT JOIN sys_service_dependencies sd2 ON s.id = sd2.depends_on_service_id
GROUP BY s.id;

-- 4. Update sys_table_definitions with the new view names
UPDATE sys_table_definitions 
SET table_name = 'sys_database_objects_info_view'
WHERE table_name = 'sys_database_objects_info' 
AND object_type = 'view';

UPDATE sys_table_definitions 
SET table_name = 'sys_service_dependency_summary_view'
WHERE table_name = 'sys_service_dependency_summary' 
AND object_type = 'view';

-- 5. Grant permissions (if needed)
GRANT SELECT ON sys_database_objects_info_view TO authenticated;
GRANT SELECT ON sys_service_dependency_summary_view TO authenticated;