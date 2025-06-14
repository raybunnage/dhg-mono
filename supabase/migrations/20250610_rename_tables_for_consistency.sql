-- Rename tables/views to follow consistent naming conventions
-- Date: 2025-06-10
-- Purpose: Improve database consistency by applying proper prefixes to tables

-- 1. Rename shared_services to service_shared
-- First check if the table has any dependencies (foreign keys, views, etc.)
DO $$
BEGIN
    -- Check if shared_services exists and service_shared doesn't
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_services' AND table_schema = 'public')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_shared' AND table_schema = 'public') THEN
        
        -- Rename the table
        ALTER TABLE shared_services RENAME TO service_shared;
        
        -- Update sys_table_definitions
        UPDATE sys_table_definitions 
        SET table_name = 'service_shared'
        WHERE table_name = 'shared_services';
        
        -- Update sys_table_migrations
        INSERT INTO sys_table_migrations (old_name, new_name, migrated_at, notes)
        VALUES ('shared_services', 'service_shared', NOW(), 'Apply service_ prefix for consistency');
        
        RAISE NOTICE 'Renamed shared_services to service_shared';
    END IF;
END $$;

-- 2. Rename task_criteria_inheritance to dev_task_criteria_inheritance
DO $$
BEGIN
    -- Check if task_criteria_inheritance exists and dev_task_criteria_inheritance doesn't
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_criteria_inheritance' AND table_schema = 'public')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dev_task_criteria_inheritance' AND table_schema = 'public') THEN
        
        -- Rename the table
        ALTER TABLE task_criteria_inheritance RENAME TO dev_task_criteria_inheritance;
        
        -- Update sys_table_definitions
        UPDATE sys_table_definitions 
        SET table_name = 'dev_task_criteria_inheritance'
        WHERE table_name = 'task_criteria_inheritance';
        
        -- Update sys_table_migrations
        INSERT INTO sys_table_migrations (old_name, new_name, migrated_at, notes)
        VALUES ('task_criteria_inheritance', 'dev_task_criteria_inheritance', NOW(), 'Apply dev_task_ prefix for consistency');
        
        RAISE NOTICE 'Renamed task_criteria_inheritance to dev_task_criteria_inheritance';
    END IF;
END $$;

-- 3. Rename success_criteria_templates to element_success_criteria_templates
DO $$
BEGIN
    -- Check if success_criteria_templates exists and element_success_criteria_templates doesn't
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'success_criteria_templates' AND table_schema = 'public')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'element_success_criteria_templates' AND table_schema = 'public') THEN
        
        -- Rename the table
        ALTER TABLE success_criteria_templates RENAME TO element_success_criteria_templates;
        
        -- Update sys_table_definitions
        UPDATE sys_table_definitions 
        SET table_name = 'element_success_criteria_templates'
        WHERE table_name = 'success_criteria_templates';
        
        -- Update sys_table_migrations
        INSERT INTO sys_table_migrations (old_name, new_name, migrated_at, notes)
        VALUES ('success_criteria_templates', 'element_success_criteria_templates', NOW(), 'Apply element_ prefix for consistency');
        
        RAISE NOTICE 'Renamed success_criteria_templates to element_success_criteria_templates';
    END IF;
END $$;

-- Handle any views that might reference these tables
-- Note: Views that reference renamed tables need to be recreated

-- Check and update any function that might reference these tables
-- We'll need to check the actual database for functions that use these tables

-- Add entries to sys_table_definitions if they don't exist
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'service_shared', 'Shared services registry and configuration', 'Service management and dependency tracking', CURRENT_DATE),
    ('public', 'dev_task_criteria_inheritance', 'Inheritance rules for dev task success criteria', 'Task management and criteria inheritance', CURRENT_DATE),
    ('public', 'element_success_criteria_templates', 'Templates for element success criteria', 'Element criteria template management', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE
SET description = EXCLUDED.description,
    purpose = EXCLUDED.purpose;

-- Note: After running this migration, we need to:
-- 1. Update supabase/types.ts by regenerating types
-- 2. Find and update all code references to these tables
-- 3. Update any stored procedures or functions that reference these tables