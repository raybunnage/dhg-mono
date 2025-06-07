-- Migration: Add _view suffix to all database views
-- Description: Rename views to have consistent _view suffix for better clarity
-- Author: Claude Code Assistant
-- Date: 2025-06-06

-- SECTION: functions
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

-- SECTION: custom
-- Rename all views using DO block
DO $$
DECLARE
    v_record RECORD;
    v_success BOOLEAN;
    v_total INTEGER := 0;
    v_renamed INTEGER := 0;
BEGIN
    -- Create temporary table for mapping within the DO block
    CREATE TEMPORARY TABLE view_rename_mapping (
        old_name TEXT PRIMARY KEY,
        new_name TEXT NOT NULL,
        view_schema TEXT NOT NULL
    );
    
    -- Insert all views that need renaming (based on current database state)
    INSERT INTO view_rename_mapping (old_name, new_name, view_schema) VALUES
        -- Command views (these exist and need _view suffix)
        ('command_refactor_status_summary', 'command_refactor_status_summary_view', 'public'),
        ('commands_needing_attention', 'command_refactor_needing_attention_view', 'public'),
        
        -- Development views (exists and needs _view suffix)
        ('dev_tasks_with_git', 'dev_tasks_with_git_view', 'public'),
        
        -- Document views (exists and needs _view suffix)
        ('doc_continuous_status', 'doc_continuous_status_view', 'public'),
        
        -- Learning views (already renamed to learn_user_progress, needs _view suffix)
        ('learn_user_progress', 'learn_user_progress_view', 'public'),
        
        -- AI views (exists and needs _view suffix)
        ('recent_ai_work_summaries', 'ai_work_summaries_recent_view', 'public'),
        
        -- Media content view (already has _view suffix, will be skipped)
        ('media_content_view', 'media_content_view', 'public');
    
    -- Process each view
    FOR v_record IN 
        SELECT * FROM view_rename_mapping 
        ORDER BY old_name
    LOOP
        v_total := v_total + 1;
        
        -- Skip if old and new names are the same
        IF v_record.old_name = v_record.new_name THEN
            RAISE NOTICE 'View %.% already has correct name, skipping', v_record.view_schema, v_record.old_name;
            CONTINUE;
        END IF;
        
        -- Try to rename the view
        SELECT rename_view_safely(
            v_record.old_name, 
            v_record.new_name, 
            v_record.view_schema
        ) INTO v_success;
        
        IF v_success THEN
            v_renamed := v_renamed + 1;
            
            -- Record the migration if sys_table_migrations exists
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'sys_table_migrations'
            ) THEN
                -- Check column existence before inserting
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'sys_table_migrations'
                    AND column_name = 'old_table_name'
                ) THEN
                    INSERT INTO sys_table_migrations (old_table_name, new_table_name, migration_date, migration_type, notes)
                    VALUES (
                        CASE WHEN v_record.view_schema = 'public' THEN v_record.old_name ELSE v_record.view_schema || '.' || v_record.old_name END,
                        CASE WHEN v_record.view_schema = 'public' THEN v_record.new_name ELSE v_record.view_schema || '.' || v_record.new_name END,
                        CURRENT_DATE,
                        'rename_view',
                        'Added _view suffix for consistency'
                    );
                ELSE
                    RAISE NOTICE 'sys_table_migrations exists but lacks expected columns';
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'View renaming complete: % of % views renamed', v_renamed, v_total;
    
    -- Clean up temporary table
    DROP TABLE view_rename_mapping;
END $$;

-- Clean up function
DROP FUNCTION IF EXISTS rename_view_safely(TEXT, TEXT, TEXT);

-- SECTION: comments
-- Add comments to document the renaming

COMMENT ON SCHEMA public IS 'Public schema - views now follow naming convention with _view suffix';