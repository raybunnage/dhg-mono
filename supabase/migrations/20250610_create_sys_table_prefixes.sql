-- Create sys_table_prefixes table to track and manage table naming conventions
-- This table helps maintain consistent naming patterns across the database

-- ============================================================================
-- TABLE: sys_table_prefixes
-- ============================================================================
CREATE TABLE IF NOT EXISTS sys_table_prefixes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefix VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    domain VARCHAR(100) NOT NULL,
    example_tables TEXT[],
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add comment
COMMENT ON TABLE sys_table_prefixes IS 'Registry of approved table prefixes and their domains';
COMMENT ON COLUMN sys_table_prefixes.prefix IS 'The prefix including underscore (e.g., sys_, command_)';
COMMENT ON COLUMN sys_table_prefixes.domain IS 'The functional domain this prefix represents';
COMMENT ON COLUMN sys_table_prefixes.example_tables IS 'Array of example table names using this prefix';

-- ============================================================================
-- INITIAL DATA: Populate with existing prefixes
-- ============================================================================
INSERT INTO sys_table_prefixes (prefix, description, domain, example_tables) VALUES
    ('sys_', 'System configuration and metadata tables', 'system', 
     ARRAY['sys_table_definitions', 'sys_table_migrations', 'sys_server_ports_registry', 'sys_table_prefixes']),
    
    ('command_', 'CLI command registry and tracking', 'cli', 
     ARRAY['command_pipelines', 'command_definitions', 'command_pipeline_tables', 'command_history']),
    
    ('dev_', 'Development task management', 'development', 
     ARRAY['dev_tasks', 'dev_task_commits', 'dev_task_success_criteria']),
    
    ('doc_', 'Documentation management', 'documentation', 
     ARRAY['doc_files', 'doc_continuous_monitoring', 'doc_assessment_history']),
    
    ('media_', 'Media file tracking and analytics', 'media', 
     ARRAY['media_transcription_status', 'media_sessions', 'media_events']),
    
    ('auth_', 'Authentication and authorization', 'auth', 
     ARRAY['auth_allowed_emails', 'auth_audit_log', 'auth_user_profiles']),
    
    ('email_', 'Email management system', 'email', 
     ARRAY['email_addresses', 'email_messages', 'email_concepts']),
    
    ('google_', 'Google Drive integration', 'google', 
     ARRAY['google_auth_tokens', 'google_drive_filter_profiles', 'google_expert_documents']),
    
    ('presentation_', 'Presentation management', 'presentations', 
     ARRAY['presentation_summaries', 'presentation_assets']),
    
    ('script_', 'Script management', 'scripts', 
     ARRAY['script_sync_status', 'script_analysis_results']),
    
    ('work_', 'Work tracking and summaries', 'work', 
     ARRAY['work_summaries', 'worktree_definitions', 'worktree_mappings']),
    
    ('prompt_', 'AI prompt management', 'ai', 
     ARRAY['prompt_queries', 'prompt_templates', 'prompt_template_associations']),
    
    ('batch_', 'Batch processing', 'processing', 
     ARRAY['batch_items', 'batch_processing_tasks']),
    
    ('filter_', 'Filtering and profiles', 'filtering', 
     ARRAY['filter_tables', 'filter_profiles']);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_sys_table_prefixes_active ON sys_table_prefixes(active);
CREATE INDEX idx_sys_table_prefixes_domain ON sys_table_prefixes(domain);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE sys_table_prefixes ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access for table prefixes" ON sys_table_prefixes
    FOR SELECT USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER update_sys_table_prefixes_updated_at
    BEFORE UPDATE ON sys_table_prefixes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION check_table_prefix_exists(table_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    prefix_exists BOOLEAN;
BEGIN
    -- Extract prefix (everything before the first underscore + underscore)
    SELECT EXISTS (
        SELECT 1 
        FROM sys_table_prefixes 
        WHERE active = true 
        AND table_name LIKE prefix || '%'
    ) INTO prefix_exists;
    
    RETURN prefix_exists;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_table_prefix_exists IS 'Checks if a table name uses an approved prefix';

-- ============================================================================
-- VIEW: Active prefixes with usage counts
-- ============================================================================
CREATE OR REPLACE VIEW sys_table_prefix_usage_view AS
SELECT 
    p.prefix,
    p.description,
    p.domain,
    COUNT(DISTINCT td.table_name) as table_count,
    p.example_tables
FROM sys_table_prefixes p
LEFT JOIN sys_table_definitions td 
    ON td.table_name LIKE p.prefix || '%'
    AND td.table_schema = 'public'
WHERE p.active = true
GROUP BY p.id, p.prefix, p.description, p.domain, p.example_tables
ORDER BY table_count DESC;