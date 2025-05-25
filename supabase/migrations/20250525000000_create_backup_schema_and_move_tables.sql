-- Migration: Create backup schema and move all backup tables
-- Description: Implement proper backup strategy by moving all backup tables to a dedicated schema

-- Step 1: Create backup schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS backup;

-- Grant appropriate permissions on the backup schema
GRANT USAGE ON SCHEMA backup TO postgres, anon, authenticated, service_role;
GRANT CREATE ON SCHEMA backup TO postgres;

-- Step 2: Move all backup tables from public schema to backup schema
-- Note: Using ALTER TABLE ... SET SCHEMA preserves all data, indexes, and constraints

-- Document-related backups
ALTER TABLE IF EXISTS public.document_types_backup_2025_05_02 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.documentation_files_backup_20250324 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.expert_documents_backup_2025_05_02 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.expert_documents_backup_2025_05_05 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.experts_backup_2025_05_02 SET SCHEMA backup;

-- Presentation-related backups
ALTER TABLE IF EXISTS public.presentation_assets_backup_20250522 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.presentation_assets_backup_2025_05_02 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.presentations_backup_20250521 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.presentations_backup_20250522 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.presentations_backup_2025_05_02 SET SCHEMA backup;

-- Prompt-related backups
ALTER TABLE IF EXISTS public.prompt_output_templates SET SCHEMA backup;
ALTER TABLE IF EXISTS public.prompt_template_associations SET SCHEMA backup;
ALTER TABLE IF EXISTS public.prompts_backup_2025_05_02 SET SCHEMA backup;

-- Other backups
ALTER TABLE IF EXISTS public.scripts_backup_20250216 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.sources_google_backup_2025_04_08 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.sources_google_backup_2025_05_02 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.sources_google_experts_backup_2025_05_02 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.subject_classifications_backup_2025_05_02 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.sync_history_backup SET SCHEMA backup;
ALTER TABLE IF EXISTS public.table_classifications_backup_2025_05_02 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.user_profiles_v2 SET SCHEMA backup;
ALTER TABLE IF EXISTS public.view_backups SET SCHEMA backup;

-- Step 3: Skip realtime schema backups (no permission to move them)
-- These appear to be empty message tables from April 2025 in the realtime schema
-- They cannot be moved due to permission restrictions on the realtime schema

-- Step 4: Create a backup metadata table to track backups
CREATE TABLE IF NOT EXISTS backup.backup_metadata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_table_name TEXT NOT NULL,
    backup_table_name TEXT NOT NULL,
    backup_date TIMESTAMPTZ NOT NULL,
    row_count INTEGER,
    backup_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT current_user
);

-- Step 5: Populate backup metadata for existing backups
INSERT INTO backup.backup_metadata (original_table_name, backup_table_name, backup_date, row_count, backup_reason)
VALUES
    ('document_types', 'document_types_backup_2025_05_02', '2025-05-02'::timestamptz, 99, 'Pre-migration backup'),
    ('documentation_files', 'documentation_files_backup_20250324', '2025-03-24'::timestamptz, 171, 'Pre-migration backup'),
    ('expert_documents', 'expert_documents_backup_2025_05_02', '2025-05-02'::timestamptz, 723, 'Pre-migration backup'),
    ('expert_documents', 'expert_documents_backup_2025_05_05', '2025-05-05'::timestamptz, 723, 'Pre-migration backup'),
    ('experts', 'experts_backup_2025_05_02', '2025-05-02'::timestamptz, 120, 'Pre-migration backup'),
    ('presentation_assets', 'presentation_assets_backup_20250522', '2025-05-22'::timestamptz, 432, 'Pre-migration backup'),
    ('presentation_assets', 'presentation_assets_backup_2025_05_02', '2025-05-02'::timestamptz, 382, 'Pre-migration backup'),
    ('presentations', 'presentations_backup_20250521', '2025-05-21'::timestamptz, 117, 'Pre-migration backup'),
    ('presentations', 'presentations_backup_20250522', '2025-05-22'::timestamptz, 135, 'Pre-migration backup'),
    ('presentations', 'presentations_backup_2025_05_02', '2025-05-02'::timestamptz, 117, 'Pre-migration backup'),
    ('prompts', 'prompts_backup_2025_05_02', '2025-05-02'::timestamptz, 9, 'Pre-migration backup'),
    ('scripts', 'scripts_backup_20250216', '2025-02-16'::timestamptz, 73, 'Pre-migration backup'),
    ('sources_google', 'sources_google_backup_2025_04_08', '2025-04-08'::timestamptz, 1025, 'Pre-migration backup'),
    ('sources_google', 'sources_google_backup_2025_05_02', '2025-05-02'::timestamptz, 845, 'Pre-migration backup'),
    ('sources_google_experts', 'sources_google_experts_backup_2025_05_02', '2025-05-02'::timestamptz, 831, 'Pre-migration backup'),
    ('subject_classifications', 'subject_classifications_backup_2025_05_02', '2025-05-02'::timestamptz, 34, 'Pre-migration backup'),
    ('sync_history', 'sync_history_backup', NOW(), 17, 'Pre-migration backup'),
    ('table_classifications', 'table_classifications_backup_2025_05_02', '2025-05-02'::timestamptz, 5482, 'Pre-migration backup'),
    ('user_profiles', 'user_profiles_v2', NOW(), 2, 'Version 2 migration'),
    ('views', 'view_backups', NOW(), 1, 'View definitions backup');

-- Step 6: Create a function to create timestamped backups in the backup schema
CREATE OR REPLACE FUNCTION backup.create_table_backup(
    p_table_name TEXT,
    p_reason TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_backup_table_name TEXT;
    v_row_count INTEGER;
BEGIN
    -- Generate backup table name with timestamp
    v_backup_table_name := p_table_name || '_backup_' || TO_CHAR(NOW(), 'YYYY_MM_DD_HH24MISS');
    
    -- Create the backup table
    EXECUTE format('CREATE TABLE backup.%I AS SELECT * FROM public.%I', v_backup_table_name, p_table_name);
    
    -- Get row count
    EXECUTE format('SELECT COUNT(*) FROM backup.%I', v_backup_table_name) INTO v_row_count;
    
    -- Record in metadata
    INSERT INTO backup.backup_metadata (original_table_name, backup_table_name, backup_date, row_count, backup_reason)
    VALUES (p_table_name, v_backup_table_name, NOW(), v_row_count, p_reason);
    
    RETURN v_backup_table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create a view to easily see all backups
CREATE OR REPLACE VIEW backup.backup_inventory AS
SELECT 
    bm.original_table_name,
    bm.backup_table_name,
    bm.backup_date,
    bm.row_count,
    bm.backup_reason,
    bm.created_at,
    bm.created_by,
    pg_size_pretty(pg_total_relation_size('backup.' || bm.backup_table_name)) as backup_size
FROM backup.backup_metadata bm
ORDER BY bm.original_table_name, bm.backup_date DESC;

-- Grant access to the backup inventory view
GRANT SELECT ON backup.backup_inventory TO postgres, authenticated, service_role;

-- Step 8: Add comment explaining the backup schema
COMMENT ON SCHEMA backup IS 'Dedicated schema for all database backups. Use backup.create_table_backup() function to create new backups.';