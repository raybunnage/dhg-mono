-- Remove duplicate Claude service entries and standardize on lowercase 'claudeService'

-- First, let's check what we have
DO $$
DECLARE
    claude_service_count INTEGER;
BEGIN
    -- Count how many Claude service entries we have
    SELECT COUNT(*) INTO claude_service_count
    FROM sys_shared_services
    WHERE service_name IN ('claudeService', 'ClaudeService');
    
    RAISE NOTICE 'Found % Claude service entries', claude_service_count;
    
    -- If we have duplicates, consolidate usage data into the lowercase version
    IF claude_service_count > 1 THEN
        -- Update the lowercase entry with combined usage data
        UPDATE sys_shared_services
        SET 
            used_by_apps = ARRAY(
                SELECT DISTINCT unnest(
                    COALESCE(lower_entry.used_by_apps, '{}') || 
                    COALESCE(upper_entry.used_by_apps, '{}')
                )
                FROM sys_shared_services lower_entry
                CROSS JOIN sys_shared_services upper_entry
                WHERE lower_entry.service_name = 'claudeService'
                AND upper_entry.service_name = 'ClaudeService'
            ),
            used_by_pipelines = ARRAY(
                SELECT DISTINCT unnest(
                    COALESCE(lower_entry.used_by_pipelines, '{}') || 
                    COALESCE(upper_entry.used_by_pipelines, '{}')
                )
                FROM sys_shared_services lower_entry
                CROSS JOIN sys_shared_services upper_entry
                WHERE lower_entry.service_name = 'claudeService'
                AND upper_entry.service_name = 'ClaudeService'
            ),
            description = 'AI integration service for Claude API - Singleton service following CLAUDE.md pattern',
            updated_at = NOW()
        WHERE service_name = 'claudeService';
        
        -- Delete the uppercase entry
        DELETE FROM sys_shared_services
        WHERE service_name = 'ClaudeService';
        
        RAISE NOTICE 'Consolidated Claude service entries into lowercase claudeService';
    END IF;
END $$;

-- Ensure we have the correct entry
INSERT INTO sys_shared_services (
    service_name,
    service_path,
    description,
    category,
    is_singleton,
    has_browser_variant,
    environment_type,
    environment_config
) VALUES (
    'claudeService',
    'packages/shared/services/claude-service/claude-service.ts',
    'AI integration service for Claude API - Singleton service following CLAUDE.md pattern',
    'ai',
    true,
    false,
    'universal',
    jsonb_build_object(
        'supportsNode', true,
        'supportsBrowser', true,
        'requiresProxy', false,
        'requiresAuth', true
    )
) ON CONFLICT (service_name) DO UPDATE
SET 
    description = EXCLUDED.description,
    environment_type = EXCLUDED.environment_type,
    environment_config = EXCLUDED.environment_config,
    updated_at = NOW();

-- Update any references to ClaudeService in dependencies JSON column
UPDATE sys_shared_services
SET dependencies = 
    CASE 
        WHEN dependencies::text LIKE '%ClaudeService%' 
        THEN replace(dependencies::text, '"ClaudeService"', '"claudeService"')::jsonb
        ELSE dependencies
    END
WHERE dependencies IS NOT NULL 
  AND dependencies::text LIKE '%ClaudeService%';

-- Final verification
DO $$
DECLARE
    final_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO final_count
    FROM sys_shared_services
    WHERE service_name IN ('claudeService', 'ClaudeService');
    
    IF final_count = 1 THEN
        RAISE NOTICE 'Success: Only one Claude service entry remains (claudeService)';
    ELSE
        RAISE EXCEPTION 'Error: Expected 1 Claude service entry but found %', final_count;
    END IF;
END $$;