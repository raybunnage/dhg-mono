-- Update continuous improvement scenarios with new documented scenarios

-- Insert new scenarios
INSERT INTO sys_continuous_improvement_scenarios (
    scenario_id,
    name,
    description,
    category,
    status,
    documentation_path,
    complexity,
    estimated_minutes,
    steps_count
) VALUES 
(
    'add-new-shared-service',
    'Add New Shared Service',
    'Create shared services with singleton/DI patterns and cross-env compatibility',
    'Development',
    'documented',
    'docs/continuous-improvement/scenarios/add-new-shared-service.md',
    'medium',
    45,
    10
),
(
    'modify-database-tables',
    'Modify Database Tables',
    'Add/modify tables following naming conventions and migration best practices',
    'Database',
    'documented',
    'docs/continuous-improvement/scenarios/modify-database-tables.md',
    'complex',
    60,
    10
),
(
    'add-new-app-page',
    'Add New App Page',
    'Add pages to apps with proper routing, services, and UI patterns',
    'UI Development',
    'documented',
    'docs/continuous-improvement/scenarios/add-new-app-page.md',
    'medium',
    45,
    10
),
(
    'add-new-tests',
    'Add New Tests',
    'Add comprehensive tests (unit/integration/e2e) to any component',
    'Testing',
    'documented',
    'docs/continuous-improvement/scenarios/add-new-tests.md',
    'medium',
    60,
    7
)
ON CONFLICT (scenario_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    status = EXCLUDED.status,
    documentation_path = EXCLUDED.documentation_path,
    complexity = EXCLUDED.complexity,
    estimated_minutes = EXCLUDED.estimated_minutes,
    steps_count = EXCLUDED.steps_count,
    updated_at = CURRENT_TIMESTAMP;

-- Insert steps for add-new-shared-service
INSERT INTO sys_continuous_improvement_steps (scenario_id, step_number, step_name, step_type, description, is_automated) VALUES
('add-new-shared-service', 1, 'Determine Service Type', 'manual', 'Decide between infrastructure (singleton) or business (DI) service', false),
('add-new-shared-service', 2, 'Create Service Directory', 'automated', 'Create directory structure in packages/shared/services', true),
('add-new-shared-service', 3, 'Create Service Files', 'automated', 'Generate service class and index files from templates', true),
('add-new-shared-service', 4, 'Create Test File', 'automated', 'Generate test file with basic test structure', true),
('add-new-shared-service', 5, 'Update Shared Index', 'automated', 'Export service from shared services index', true),
('add-new-shared-service', 6, 'Add Type Definitions', 'manual', 'Create TypeScript types if needed', false),
('add-new-shared-service', 7, 'Update package.json', 'automated', 'Add exports if new category', true),
('add-new-shared-service', 8, 'Create Documentation', 'manual', 'Document service purpose and API', false),
('add-new-shared-service', 9, 'Add to Registry', 'automated', 'Create database migration for service registry', true),
('add-new-shared-service', 10, 'Test Integration', 'validation', 'Run tests and verify integration', false)
ON CONFLICT (scenario_id, step_number) DO NOTHING;

-- Insert steps for modify-database-tables
INSERT INTO sys_continuous_improvement_steps (scenario_id, step_number, step_name, step_type, description, is_automated) VALUES
('modify-database-tables', 1, 'Check Naming Conventions', 'manual', 'Verify table prefix exists in sys_table_prefixes', false),
('modify-database-tables', 2, 'Design Schema', 'manual', 'Plan table structure, keys, and relationships', false),
('modify-database-tables', 3, 'Create Migration', 'automated', 'Generate migration file from template', true),
('modify-database-tables', 4, 'Add Down Migration', 'manual', 'Create rollback section', false),
('modify-database-tables', 5, 'Test Migration', 'validation', 'Validate and test migration locally', false),
('modify-database-tables', 6, 'Update Types', 'automated', 'Regenerate TypeScript types', true),
('modify-database-tables', 7, 'Create Type Guards', 'manual', 'Add type guards if needed', false),
('modify-database-tables', 8, 'Update Services', 'manual', 'Update service layer to use new table', false),
('modify-database-tables', 9, 'Create Tests', 'manual', 'Add integration tests for RLS and operations', false),
('modify-database-tables', 10, 'Document Changes', 'manual', 'Document table purpose and usage', false)
ON CONFLICT (scenario_id, step_number) DO NOTHING;

-- Insert steps for add-new-app-page
INSERT INTO sys_continuous_improvement_steps (scenario_id, step_number, step_name, step_type, description, is_automated) VALUES
('add-new-app-page', 1, 'Analyze App Structure', 'manual', 'Review router, navigation, and existing pages', false),
('add-new-app-page', 2, 'Create Page Component', 'automated', 'Generate page component from template', true),
('add-new-app-page', 3, 'Add Route', 'automated', 'Add route to router configuration', true),
('add-new-app-page', 4, 'Update Navigation', 'automated', 'Add link to navigation/menu', true),
('add-new-app-page', 5, 'Create Sub-components', 'manual', 'Create list, form, detail components as needed', false),
('add-new-app-page', 6, 'Integrate Services', 'manual', 'Connect to shared services for data', false),
('add-new-app-page', 7, 'Add State Management', 'manual', 'Implement state management if complex', false),
('add-new-app-page', 8, 'Style the Page', 'manual', 'Apply consistent styling and responsive design', false),
('add-new-app-page', 9, 'Add States', 'manual', 'Implement loading, error, and empty states', false),
('add-new-app-page', 10, 'Test Page', 'validation', 'Test navigation, data, and responsiveness', false)
ON CONFLICT (scenario_id, step_number) DO NOTHING;

-- Insert steps for add-new-tests
INSERT INTO sys_continuous_improvement_steps (scenario_id, step_number, step_name, step_type, description, is_automated) VALUES
('add-new-tests', 1, 'Identify Test Areas', 'manual', 'Determine what needs testing', false),
('add-new-tests', 2, 'Create Test File', 'automated', 'Generate test file with proper structure', true),
('add-new-tests', 3, 'Add Unit Tests', 'automated', 'Create tests for public methods', true),
('add-new-tests', 4, 'Add Integration Tests', 'manual', 'Create tests for external dependencies', false),
('add-new-tests', 5, 'Create Test Utilities', 'manual', 'Add mocks and test helpers', false),
('add-new-tests', 6, 'Configure Tests', 'automated', 'Update test configuration if needed', true),
('add-new-tests', 7, 'Run Tests', 'validation', 'Execute tests and check coverage', false)
ON CONFLICT (scenario_id, step_number) DO NOTHING;

-- Add helpful view for scenario dependencies
CREATE OR REPLACE VIEW sys_scenario_dependencies_view AS
WITH scenario_keywords AS (
    SELECT 
        scenario_id,
        name,
        CASE 
            WHEN scenario_id = 'add-new-proxy-server' THEN ARRAY['proxy', 'server', 'endpoint', 'http']
            WHEN scenario_id = 'add-new-shared-service' THEN ARRAY['service', 'shared', 'reusable', 'common']
            WHEN scenario_id = 'modify-database-tables' THEN ARRAY['database', 'table', 'schema', 'migration']
            WHEN scenario_id = 'add-new-app-page' THEN ARRAY['page', 'ui', 'component', 'interface']
            WHEN scenario_id = 'add-new-tests' THEN ARRAY['test', 'coverage', 'unit', 'integration']
            ELSE ARRAY[]::text[]
        END as keywords,
        CASE
            WHEN scenario_id = 'add-new-proxy-server' THEN ARRAY['add-new-shared-service', 'add-new-tests']
            WHEN scenario_id = 'add-new-shared-service' THEN ARRAY['add-new-tests', 'modify-database-tables']
            WHEN scenario_id = 'modify-database-tables' THEN ARRAY['add-new-shared-service', 'add-new-app-page']
            WHEN scenario_id = 'add-new-app-page' THEN ARRAY['add-new-shared-service', 'add-new-tests', 'add-new-proxy-server']
            ELSE ARRAY[]::text[]
        END as suggests
    FROM sys_continuous_improvement_scenarios
)
SELECT * FROM scenario_keywords;

COMMENT ON VIEW sys_scenario_dependencies_view IS 'Shows scenario keywords and dependencies for intelligent suggestion system';