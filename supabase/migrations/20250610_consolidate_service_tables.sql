-- Consolidate service_shared into sys_shared_services
-- Date: 2025-06-10
-- Purpose: Merge service_shared table into sys_shared_services for single source of truth

-- Step 1: Add missing columns to sys_shared_services
ALTER TABLE sys_shared_services 
ADD COLUMN IF NOT EXISTS used_by_apps text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS used_by_pipelines text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS service_name_normalized text;

-- Create index on normalized name for faster lookups
CREATE INDEX IF NOT EXISTS idx_sys_shared_services_normalized 
ON sys_shared_services(service_name_normalized);

-- Step 2: Create a name mapping function
CREATE OR REPLACE FUNCTION normalize_service_name(input_name text)
RETURNS text AS $$
DECLARE
    result text;
BEGIN
    -- Convert kebab-case to PascalCase
    -- ai-processing-service -> AiProcessingService
    result := replace(initcap(replace(input_name, '-', ' ')), ' ', '');
    
    -- Handle special cases
    CASE result
        WHEN 'AiService' THEN result := 'AiProcessingService';
        WHEN 'AudioService' THEN result := 'AudioService';
        WHEN 'AuthService' THEN result := 'AuthService';
        WHEN 'ClaudeService' THEN result := 'claudeService'; -- Special case
        WHEN 'GoogleDrive' THEN result := 'GoogleDriveService';
        WHEN 'SupabaseClient' THEN result := 'SupabaseClientService';
        ELSE result := result;
    END CASE;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Update normalized names in sys_shared_services
UPDATE sys_shared_services 
SET service_name_normalized = lower(replace(service_name, 'Service', '-service'))
WHERE service_name_normalized IS NULL;

-- Step 4: Migrate data from service_shared to sys_shared_services
DO $$
DECLARE
    service_record RECORD;
    normalized_name text;
    existing_id uuid;
BEGIN
    -- Loop through all service_shared records
    FOR service_record IN 
        SELECT * FROM service_shared 
        ORDER BY service_name
    LOOP
        -- Normalize the service name
        normalized_name := normalize_service_name(service_record.service_name);
        
        -- Check if service already exists in sys_shared_services
        SELECT id INTO existing_id 
        FROM sys_shared_services 
        WHERE service_name = normalized_name 
           OR service_name_normalized = service_record.service_name
        LIMIT 1;
        
        IF existing_id IS NOT NULL THEN
            -- Update existing record with additional data
            UPDATE sys_shared_services 
            SET 
                used_by_apps = COALESCE(service_record.used_by_apps, '{}'),
                used_by_pipelines = COALESCE(service_record.used_by_pipelines, '{}'),
                description = COALESCE(sys_shared_services.description, service_record.description),
                category = COALESCE(sys_shared_services.category, service_record.category),
                is_singleton = COALESCE(sys_shared_services.is_singleton, service_record.is_singleton),
                service_path = COALESCE(sys_shared_services.service_path, service_record.service_path)
            WHERE id = existing_id;
            
            RAISE NOTICE 'Updated existing service: % -> %', service_record.service_name, normalized_name;
        ELSE
            -- Insert new record
            INSERT INTO sys_shared_services (
                service_name,
                service_name_normalized,
                service_path,
                description,
                category,
                is_singleton,
                used_by_apps,
                used_by_pipelines,
                status,
                created_at,
                updated_at
            ) VALUES (
                normalized_name,
                service_record.service_name,
                COALESCE(service_record.service_path, service_record.service_name || '/'),
                service_record.description,
                service_record.category,
                COALESCE(service_record.is_singleton, false),
                COALESCE(service_record.used_by_apps, '{}'),
                COALESCE(service_record.used_by_pipelines, '{}'),
                'active',
                COALESCE(service_record.created_at, NOW()),
                NOW()
            );
            
            RAISE NOTICE 'Inserted new service: % -> %', service_record.service_name, normalized_name;
        END IF;
    END LOOP;
END $$;

-- Step 5: Create a mapping table for service IDs (temporary, for migration)
CREATE TEMP TABLE service_id_mapping AS
SELECT 
    ss.id as old_id,
    ss.service_name as old_name,
    sss.id as new_id,
    sss.service_name as new_name
FROM service_shared ss
LEFT JOIN sys_shared_services sss 
    ON sss.service_name = normalize_service_name(ss.service_name)
    OR sss.service_name_normalized = ss.service_name;

-- Step 6: Update foreign key relationships in worktree_service_mappings
UPDATE worktree_service_mappings wsm
SET service_id = sim.new_id
FROM service_id_mapping sim
WHERE wsm.service_id = sim.old_id
  AND sim.new_id IS NOT NULL;

-- Log any unmapped services
DO $$
DECLARE
    unmapped_count integer;
BEGIN
    SELECT COUNT(*) INTO unmapped_count
    FROM worktree_service_mappings wsm
    WHERE NOT EXISTS (
        SELECT 1 FROM sys_shared_services sss
        WHERE sss.id = wsm.service_id
    );
    
    IF unmapped_count > 0 THEN
        RAISE WARNING 'Found % unmapped service references in worktree_service_mappings', unmapped_count;
    END IF;
END $$;

-- Step 7: Update the foreign key constraint
ALTER TABLE worktree_service_mappings
DROP CONSTRAINT IF EXISTS worktree_service_mappings_service_id_fkey;

ALTER TABLE worktree_service_mappings
ADD CONSTRAINT worktree_service_mappings_service_id_fkey 
FOREIGN KEY (service_id) REFERENCES sys_shared_services(id) ON DELETE CASCADE;

-- Step 8: Drop the old table and clean up
DROP TABLE IF EXISTS service_shared CASCADE;

-- Drop the temporary function
DROP FUNCTION IF EXISTS normalize_service_name(text);

-- Update sys_table_definitions
DELETE FROM sys_table_definitions WHERE table_name = 'service_shared';

-- Update sys_table_migrations
INSERT INTO sys_table_migrations (old_name, new_name, migrated_at, notes)
VALUES ('service_shared', 'sys_shared_services', NOW(), 'Consolidated service tables into single sys_shared_services table');

-- Add helpful comment
COMMENT ON TABLE sys_shared_services IS 'Central registry of all shared services in the monorepo. Populated by populate-service-registry.ts';
COMMENT ON COLUMN sys_shared_services.service_name IS 'PascalCase service name as exported';
COMMENT ON COLUMN sys_shared_services.service_name_normalized IS 'Original kebab-case name for backwards compatibility';
COMMENT ON COLUMN sys_shared_services.used_by_apps IS 'List of apps that use this service';
COMMENT ON COLUMN sys_shared_services.used_by_pipelines IS 'List of CLI pipelines that use this service';