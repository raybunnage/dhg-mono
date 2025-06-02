-- Migration: Add Table Creation Date Tracking
-- Description: Updates sys_table_definitions with creation dates and adds event trigger for future tables

-- 1. Update existing tables with creation dates based on migration history
UPDATE sys_table_definitions SET created_date = '2024-05-17' WHERE table_name IN (
  'doc_files', 'documentation_relations', 'documentation_sections', 'documentation_processing_queue'
);

UPDATE sys_table_definitions SET created_date = '2024-05-25' WHERE table_name = 'google_auth_tokens';

UPDATE sys_table_definitions SET created_date = '2025-01-31' WHERE table_name IN (
  'auth_user_profiles', 'learn_media_sessions', 'learn_media_playback_events', 'media_bookmarks',
  'learn_topics', 'learn_document_concepts', 'learn_user_scores', 'learn_user_analytics',
  'learn_user_interests', 'learn_subject_classifications', 'learn_document_classifications',
  'learn_media_topic_segments'
);

UPDATE sys_table_definitions SET created_date = '2025-02-17' WHERE table_name = 'function_registry';

UPDATE sys_table_definitions SET created_date = '2025-02-26' WHERE table_name = 'google_sync_history';

UPDATE sys_table_definitions SET created_date = '2025-03-01' WHERE table_name IN (
  'command_labels', 'command_groups', 'command_metrics', 'command_documentation'
);

UPDATE sys_table_definitions SET created_date = '2025-05-22' WHERE table_name IN (
  'auth_audit_log', 'auth_cli_tokens'
);

UPDATE sys_table_definitions SET created_date = '2025-05-23' WHERE table_name = 'auth_allowed_emails';

UPDATE sys_table_definitions SET created_date = '2025-05-27' WHERE table_name IN (
  'sys_table_migrations', 'command_tracking'
);

UPDATE sys_table_definitions SET created_date = '2025-05-29' WHERE table_name IN (
  'command_pipelines', 'command_definitions', 'command_pipeline_tables', 'command_refactor_tracking',
  'ai_work_summaries', 'dev_tasks', 'dev_task_files', 'dev_task_commands', 'dev_task_related',
  'sys_monitoring_checks', 'sys_monitoring_alerts', 'sys_monitoring_logs'
);

UPDATE sys_table_definitions SET created_date = '2025-06-01' WHERE table_name IN (
  'command_history', 'command_execution_logs', 'command_error_patterns'
);

UPDATE sys_table_definitions SET created_date = '2025-06-02' WHERE table_name = 'dev_task_copies';

UPDATE sys_table_definitions SET created_date = '2025-06-03' WHERE table_name = 'sys_table_definitions';

-- For tables without clear migration dates, set approximate dates based on project history
UPDATE sys_table_definitions SET created_date = '2024-01-01' WHERE created_date IS NULL AND table_name IN (
  'google_sources', 'google_sources_experts', 'expert_profiles', 'google_expert_documents',
  'document_types', 'google_sync_statistics', 'scripts_registry', 'batch_processing',
  'email_messages', 'media_presentations', 'media_presentation_assets'
);

-- AI/Prompt tables (estimated)
UPDATE sys_table_definitions SET created_date = '2024-06-01' WHERE created_date IS NULL AND table_name IN (
  'ai_prompts', 'ai_prompt_categories', 'ai_prompt_relationships', 'ai_prompt_output_templates',
  'ai_prompt_template_associations'
);

-- Filter tables (estimated)
UPDATE sys_table_definitions SET created_date = '2024-09-01' WHERE created_date IS NULL AND table_name IN (
  'filter_user_profiles', 'filter_user_profile_drives'
);

-- System tables (estimated)
UPDATE sys_table_definitions SET created_date = '2024-03-01' WHERE created_date IS NULL AND table_name IN (
  'sys_mime_types', 'expert_profile_aliases', 'expert_citation_aliases'
);

-- 2. Note: Event triggers require superuser permissions in Supabase
-- For future table tracking, we recommend:
-- - Adding created_date to sys_table_definitions when creating new tables
-- - Using migration filenames to track creation dates
-- - Updating CLAUDE.md with guidance to include creation dates in new table migrations

-- 3. Add created_by column to sys_table_definitions if it doesn't exist
ALTER TABLE sys_table_definitions 
ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 4. Update the get_table_info_with_definitions function to include creation info
-- Drop the existing function first to change its signature
DROP FUNCTION IF EXISTS get_table_info_with_definitions();

CREATE OR REPLACE FUNCTION get_table_info_with_definitions()
RETURNS TABLE (
    table_schema text,
    table_name text,
    table_type text,
    row_count bigint,
    size_pretty text,
    total_size_pretty text,
    description text,
    purpose text,
    created_date date,
    created_by text,
    notes text
) AS $$
BEGIN
    RETURN QUERY
    WITH table_sizes AS (
        SELECT 
            n.nspname AS schema_name,
            c.relname AS table_name,
            pg_size_pretty(pg_relation_size(c.oid)) AS size_pretty,
            pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size_pretty
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'v', 'm')
            AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ),
    row_counts AS (
        SELECT 
            schemaname AS schema_name,
            tablename AS table_name,
            n_live_tup AS row_count
        FROM pg_stat_user_tables
    )
    SELECT 
        c.table_schema::text,
        c.table_name::text,
        c.table_type::text,
        COALESCE(rc.row_count, 0) AS row_count,
        COALESCE(ts.size_pretty, '0 bytes') AS size_pretty,
        COALESCE(ts.total_size_pretty, '0 bytes') AS total_size_pretty,
        td.description,
        td.purpose,
        td.created_date,
        td.created_by,
        td.notes
    FROM information_schema.tables c
    LEFT JOIN table_sizes ts ON ts.schema_name = c.table_schema AND ts.table_name = c.table_name
    LEFT JOIN row_counts rc ON rc.schema_name = c.table_schema AND rc.table_name = c.table_name
    LEFT JOIN sys_table_definitions td ON td.table_schema = c.table_schema AND td.table_name = c.table_name
    WHERE c.table_schema IN ('public')
        OR (c.table_schema = 'auth' AND c.table_name = 'users')
    ORDER BY c.table_schema, c.table_name;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION get_table_info_with_definitions() IS 'Returns comprehensive table information including metadata from sys_table_definitions';