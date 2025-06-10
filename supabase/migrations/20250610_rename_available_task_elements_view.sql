-- Rename available_task_elements_view to dev_task_available_elements_view
-- This follows our naming convention where views must use the prefix of their primary table

-- Drop the old view
DROP VIEW IF EXISTS available_task_elements_view;

-- Create the new view with the correct name
CREATE OR REPLACE VIEW dev_task_available_elements_view AS
SELECT 
    'app_feature' as element_type,
    af.id as element_id,
    af.app_name as category,
    af.feature_type as subcategory,
    af.feature_name as name,
    af.file_path as path,
    af.description
FROM app_features af
WHERE af.is_active = true

UNION ALL

SELECT 
    'cli_command' as element_type,
    cd.id as element_id,
    cp.name as category,
    cp.display_name as subcategory,
    cd.command_name as name,
    cd.file_path as path,
    cd.description
FROM command_definitions cd
JOIN command_pipelines cp ON cd.pipeline_id = cp.id
WHERE cd.is_active = true AND cp.status = 'active'

UNION ALL

SELECT 
    'shared_service' as element_type,
    ss.id as element_id,
    'shared_services' as category,
    ss.category as subcategory,
    ss.name as name,
    ss.file_path as path,
    ss.description
FROM shared_services ss
WHERE ss.is_active = true;

-- Grant appropriate permissions
GRANT SELECT ON dev_task_available_elements_view TO anon, authenticated;

-- Update sys_table_definitions to reflect the new name
UPDATE sys_table_definitions 
SET table_name = 'dev_task_available_elements_view',
    description = 'View showing available task elements (app features, CLI commands, services) for dev task selection',
    last_modified = CURRENT_TIMESTAMP
WHERE table_name = 'available_task_elements_view' AND object_type = 'view';

-- If the update didn't affect any rows (meaning the old name wasn't in sys_table_definitions),
-- insert the new view definition
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date)
VALUES ('public', 'dev_task_available_elements_view', 'view', 
        'View showing available task elements (app features, CLI commands, services) for dev task selection', 
        'Provides a unified view of all available elements that can be associated with dev tasks',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE 
SET object_type = 'view',
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose,
    last_modified = CURRENT_TIMESTAMP;

-- Add a comment to the view
COMMENT ON VIEW dev_task_available_elements_view IS 'Unified view of app features, CLI commands, and shared services available for dev task element selection';