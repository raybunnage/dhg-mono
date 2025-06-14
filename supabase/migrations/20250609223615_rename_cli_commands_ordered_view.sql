-- Rename cli_commands_ordered_view to follow proper naming convention
-- The view should use the command_ prefix like other command-related tables

-- Drop the old view
DROP VIEW IF EXISTS cli_commands_ordered_view;

-- Create the view with the proper name
CREATE OR REPLACE VIEW command_commands_ordered_view AS
SELECT 
    cd.id,
    cd.command_name,
    cd.description,
    cp.name as pipeline_name,
    cd.display_order,
    cd.typical_sequence,
    cd.usage_frequency,
    COUNT(esc.id) as criteria_count
FROM command_definitions cd
JOIN command_pipelines cp ON cd.pipeline_id = cp.id
LEFT JOIN element_success_criteria esc 
    ON esc.element_type = 'cli_command' AND esc.element_id = cd.id
WHERE cp.status = 'active'
GROUP BY cd.id, cd.command_name, cd.description, cp.name, 
         cd.display_order, cd.typical_sequence, cd.usage_frequency
ORDER BY cp.name, COALESCE(cd.typical_sequence, cd.display_order, 999);

-- Update sys_table_definitions if it has an entry
UPDATE sys_table_definitions 
SET table_name = 'command_commands_ordered_view'
WHERE table_name = 'cli_commands_ordered_view';

-- Add entry if it doesn't exist
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'command_commands_ordered_view', 'Ordered view of CLI commands with usage metrics', 'Command pipeline management', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Update any references in dev_task_elements_view if needed
-- (The existing view doesn't reference cli_commands_ordered_view, so no updates needed)