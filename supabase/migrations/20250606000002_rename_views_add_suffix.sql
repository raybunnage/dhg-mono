-- Migration: Add _view suffix to all database views
-- Description: Rename views to have consistent _view suffix for better clarity
-- Author: Claude Code Assistant
-- Date: 2025-06-06

-- SECTION: custom
-- Create a temporary mapping table for view renames
CREATE TEMPORARY TABLE view_rename_mapping (
    old_name TEXT PRIMARY KEY,
    new_name TEXT NOT NULL,
    view_schema TEXT NOT NULL,
    primary_table TEXT,
    renamed BOOLEAN DEFAULT FALSE
);

-- Insert all views that need renaming
INSERT INTO view_rename_mapping (old_name, new_name, view_schema, primary_table) VALUES
    -- Command views
    ('command_refactor_status_summary', 'command_refactor_status_summary_view', 'public', 'command_refactor_tracking'),
    ('command_suggestions', 'command_suggestions_view', 'public', 'command_tracking'),
    ('commands_needing_attention', 'command_refactor_needing_attention_view', 'public', 'command_refactor_tracking'),
    
    -- Development views
    ('dev_tasks_with_git', 'dev_tasks_with_git_view', 'public', 'dev_tasks'),
    
    -- Document views
    ('doc_continuous_status', 'doc_continuous_status_view', 'public', 'doc_continuous_tracking'),
    
    -- Email views
    ('email_with_sources', 'email_messages_with_sources_view', 'public', 'email_messages'),
    
    -- Learning views
    ('user_learning_progress', 'learn_user_progress_view', 'public', 'learn_user_analytics'),
    
    -- Media views (these are compatibility views from migration)
    ('media_bookmarks', 'learn_media_bookmarks_view', 'public', 'learn_media_bookmarks'),
    ('media_playback_events', 'learn_media_playback_events_view', 'public', 'learn_media_playback_events'),
    ('media_sessions', 'learn_media_sessions_view', 'public', 'learn_media_sessions'),
    ('media_topic_segments', 'learn_media_topic_segments_view', 'public', 'learn_media_topic_segments'),
    
    -- System/Registry views
    ('active_scripts_view', 'registry_scripts_active_view', 'public', 'registry_scripts'),
    ('function_registry_view', 'registry_functions_view', 'public', 'function_registry'),
    ('function_history_view', 'sys_function_history_view', 'public', 'function_registry'),
    
    -- Batch processing views
    ('batch_processing_status', 'batch_processing_status_view', 'public', 'batch_processing'),
    
    -- AI views
    ('recent_ai_work_summaries', 'ai_work_summaries_recent_view', 'public', 'ai_work_summaries'),
    
    -- Public schema views
    ('page_guts_view', 'sys_page_guts_view', 'public', 'pages'),
    ('pending_access_requests', 'auth_pending_access_requests_view', 'public', 'access_requests'),
    ('professional_profiles', 'expert_professional_profiles_view', 'public', 'expert_profiles'),
    ('user_details', 'auth_user_details_view', 'public', 'auth.users'),
    
    -- Backup schema views
    ('backup_inventory', 'backup_inventory_view', 'backup', 'information_schema.tables');

-- Function to safely rename a view
CREATE OR REPLACE FUNCTION rename_view_safely(
    p_old_name TEXT,
    p_new_name TEXT,
    p_schema TEXT DEFAULT 'public'
) RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
    v_definition TEXT;
BEGIN
    -- Check if old view exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.views 
        WHERE table_schema = p_schema 
        AND table_name = p_old_name
    ) INTO v_exists;
    
    IF NOT v_exists THEN
        RAISE NOTICE 'View %.% does not exist, skipping', p_schema, p_old_name;
        RETURN FALSE;
    END IF;
    
    -- Check if new view already exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.views 
        WHERE table_schema = p_schema 
        AND table_name = p_new_name
    ) INTO v_exists;
    
    IF v_exists THEN
        RAISE NOTICE 'View %.% already exists, skipping rename', p_schema, p_new_name;
        RETURN FALSE;
    END IF;
    
    -- Get view definition
    SELECT pg_get_viewdef(c.oid, true) 
    INTO v_definition
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = p_schema
    AND c.relname = p_old_name
    AND c.relkind = 'v';
    
    -- Create new view with same definition
    EXECUTE format('CREATE VIEW %I.%I AS %s', p_schema, p_new_name, v_definition);
    
    -- Copy view comments if any
    EXECUTE format(
        'SELECT obj_description(c.oid, ''pg_class'') 
         FROM pg_class c 
         JOIN pg_namespace n ON n.oid = c.relnamespace 
         WHERE n.nspname = %L AND c.relname = %L',
        p_schema, p_old_name
    ) INTO v_definition;
    
    IF v_definition IS NOT NULL THEN
        EXECUTE format('COMMENT ON VIEW %I.%I IS %L', p_schema, p_new_name, v_definition);
    END IF;
    
    -- Drop old view
    EXECUTE format('DROP VIEW %I.%I CASCADE', p_schema, p_old_name);
    
    RAISE NOTICE 'Successfully renamed view %.% to %.%', p_schema, p_old_name, p_schema, p_new_name;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- SECTION: views
-- Rename all views based on mapping table

DO $$
DECLARE
    v_record RECORD;
    v_success BOOLEAN;
    v_total INTEGER := 0;
    v_renamed INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT * FROM view_rename_mapping 
        WHERE NOT renamed
        ORDER BY old_name
    LOOP
        v_total := v_total + 1;
        
        -- Try to rename the view
        SELECT rename_view_safely(
            v_record.old_name, 
            v_record.new_name, 
            v_record.view_schema
        ) INTO v_success;
        
        IF v_success THEN
            v_renamed := v_renamed + 1;
            UPDATE view_rename_mapping 
            SET renamed = TRUE 
            WHERE old_name = v_record.old_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'View renaming complete: % of % views renamed', v_renamed, v_total;
END $$;

-- SECTION: custom
-- Record all successful renames in sys_table_migrations

INSERT INTO sys_table_migrations (old_table_name, new_table_name, migration_date, migration_type, notes)
SELECT 
    CASE WHEN view_schema = 'public' THEN old_name ELSE view_schema || '.' || old_name END,
    CASE WHEN view_schema = 'public' THEN new_name ELSE view_schema || '.' || new_name END,
    CURRENT_DATE,
    'rename_view',
    'Added _view suffix for consistency'
FROM view_rename_mapping
WHERE renamed = TRUE;

-- Show summary of changes
SELECT 
    'Renamed Views Summary' as report_type,
    COUNT(*) FILTER (WHERE renamed = TRUE) as successfully_renamed,
    COUNT(*) FILTER (WHERE renamed = FALSE) as skipped,
    COUNT(*) as total_views
FROM view_rename_mapping;

-- Clean up
DROP FUNCTION IF EXISTS rename_view_safely(TEXT, TEXT, TEXT);

-- SECTION: comments
-- Add comments to document the renaming

COMMENT ON SCHEMA public IS 'Public schema - all views now follow naming convention with _view suffix';