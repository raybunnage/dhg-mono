-- Add missing views to sys_table_definitions
-- These views exist in the database but aren't tracked

-- available_task_elements_view
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date)
VALUES ('public', 'available_task_elements_view', 'view', 
        'View showing available task elements for selection', 
        'Provides a unified view of app features, CLI commands, and services for task element selection',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE 
SET object_type = 'view',
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;

-- cli_commands_ordered_view
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date)
VALUES ('public', 'cli_commands_ordered_view', 'view', 
        'View showing CLI commands in execution order', 
        'Orders CLI commands by their sequence for proper execution flow',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE 
SET object_type = 'view',
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;

-- elements_with_criteria_view
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date)
VALUES ('public', 'elements_with_criteria_view', 'view', 
        'View showing elements with their success criteria counts', 
        'Aggregates success criteria and quality gates for task elements',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE 
SET object_type = 'view',
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;

-- dev_task_elements_view
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date)
VALUES ('public', 'dev_task_elements_view', 'view', 
        'View showing dev tasks with their associated elements', 
        'Links dev tasks to their specific app features, CLI commands, or services',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE 
SET object_type = 'view',
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;

-- dev_tasks_enhanced_view
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date)
VALUES ('public', 'dev_tasks_enhanced_view', 'view', 
        'Enhanced view of dev tasks with additional metadata', 
        'Provides comprehensive dev task information including worktree and git data',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE 
SET object_type = 'view',
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;

-- dev_tasks_with_continuous_docs_view
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date)
VALUES ('public', 'dev_tasks_with_continuous_docs_view', 'view', 
        'View linking dev tasks with continuous documentation', 
        'Shows dev tasks and their associated living documentation',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE 
SET object_type = 'view',
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;

-- app_hierarchy_view
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date)
VALUES ('public', 'app_hierarchy_view', 'view', 
        'View showing app feature hierarchy', 
        'Displays hierarchical structure of app features and components',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE 
SET object_type = 'view',
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;

-- element_hierarchy_view
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date)
VALUES ('public', 'element_hierarchy_view', 'view', 
        'View showing element hierarchy across all types', 
        'Unified hierarchical view of app features, CLI commands, and services',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE 
SET object_type = 'view',
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;

-- worktree_assignments_complete_view
INSERT INTO sys_table_definitions (table_schema, table_name, object_type, description, purpose, created_date)
VALUES ('public', 'worktree_assignments_complete_view', 'view', 
        'View showing complete worktree assignment information', 
        'Comprehensive view of worktree assignments with task counts and status',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE 
SET object_type = 'view',
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;