-- Create table to track archived CLI pipeline files with usage metadata
CREATE TABLE IF NOT EXISTS sys_archived_cli_pipeline_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pipeline_name TEXT NOT NULL,
    command_name TEXT NOT NULL,
    original_file_path TEXT NOT NULL,
    archived_file_path TEXT NOT NULL,
    last_used_date TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    archived_date TIMESTAMPTZ DEFAULT NOW(),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(pipeline_name, command_name, original_file_path)
);

-- Create index for faster lookups
CREATE INDEX idx_sys_archived_cli_pipeline_files_pipeline 
    ON sys_archived_cli_pipeline_files(pipeline_name);

CREATE INDEX idx_sys_archived_cli_pipeline_files_archived_date 
    ON sys_archived_cli_pipeline_files(archived_date);

-- Add RLS policies
ALTER TABLE sys_archived_cli_pipeline_files ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Enable read access for all users" ON sys_archived_cli_pipeline_files
    FOR SELECT USING (true);

-- Authenticated write access
CREATE POLICY "Enable write for authenticated users" ON sys_archived_cli_pipeline_files
    FOR ALL USING (auth.role() = 'authenticated');

-- Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'sys_archived_cli_pipeline_files', 
        'Tracks archived CLI pipeline files with usage statistics and archival metadata',
        'Records when CLI commands are archived, their usage history, and file paths for organized cleanup efforts',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;