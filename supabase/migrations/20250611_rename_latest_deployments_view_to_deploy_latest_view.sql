-- Rename latest_deployments_view to deploy_latest_view
-- This follows the database naming convention with proper prefix

-- Drop the old view
DROP VIEW IF EXISTS latest_deployments_view;

-- Create the new view with the correct name
CREATE OR REPLACE VIEW deploy_latest_view AS
SELECT DISTINCT ON (deployment_type)
    *
FROM deployment_runs
WHERE status = 'completed'
ORDER BY deployment_type, created_at DESC;

-- Update the sys_table_definitions entry to reflect the new name
UPDATE sys_table_definitions 
SET table_name = 'deploy_latest_view',
    description = 'Shows the most recent successful deployment per type (renamed from latest_deployments_view)',
    purpose = 'Current deployment state - follows deploy_ prefix convention'
WHERE table_schema = 'public' 
  AND table_name = 'latest_deployments_view';

-- Add a note about the migration for future reference
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES (
    'public', 
    'sys_view_migrations', 
    'Tracks view name changes - latest_deployments_view renamed to deploy_latest_view', 
    'Database migration history tracking', 
    CURRENT_DATE
) ON CONFLICT (table_schema, table_name) DO UPDATE SET
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;