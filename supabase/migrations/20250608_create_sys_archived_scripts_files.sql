-- Create sys_archived_scripts_files table for tracking archived scripts
CREATE TABLE IF NOT EXISTS sys_archived_scripts_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Archive identification
  archive_id TEXT NOT NULL,
  archive_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Script identification
  original_path TEXT NOT NULL,
  archived_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_extension TEXT,
  file_size_bytes INTEGER,
  
  -- Script metadata
  script_type TEXT CHECK (script_type IN ('cli_pipeline', 'root_script', 'python', 'app_script', 'other')),
  pipeline_name TEXT,
  command_name TEXT,
  
  -- Usage tracking
  last_modified TIMESTAMPTZ,
  last_used TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  last_command TEXT,
  
  -- Archive metadata
  archive_reason TEXT,
  replacement_command TEXT,
  restored BOOLEAN DEFAULT FALSE,
  restored_date TIMESTAMPTZ,
  restored_by TEXT,
  
  -- Standard fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_sys_archived_scripts_archive_id ON sys_archived_scripts_files(archive_id);
CREATE INDEX idx_sys_archived_scripts_original_path ON sys_archived_scripts_files(original_path);
CREATE INDEX idx_sys_archived_scripts_pipeline ON sys_archived_scripts_files(pipeline_name);
CREATE INDEX idx_sys_archived_scripts_restored ON sys_archived_scripts_files(restored);
CREATE INDEX idx_sys_archived_scripts_archive_date ON sys_archived_scripts_files(archive_date);

-- Add RLS policies
ALTER TABLE sys_archived_scripts_files ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Enable read access for all users" ON sys_archived_scripts_files
  FOR SELECT USING (true);

-- Only authenticated users can insert
CREATE POLICY "Enable insert for authenticated users" ON sys_archived_scripts_files
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated users can update
CREATE POLICY "Enable update for authenticated users" ON sys_archived_scripts_files
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Add table to sys_table_definitions
INSERT INTO sys_table_definitions (
  table_schema,
  table_name,
  description,
  purpose,
  created_date
) VALUES (
  'public',
  'sys_archived_scripts_files',
  'Tracks scripts that have been archived for cleanup, including their original location, archive location, and usage history',
  'Script deprecation and cleanup tracking - maintains audit trail of archived scripts with ability to restore',
  CURRENT_DATE
) ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Add helpful comment
COMMENT ON TABLE sys_archived_scripts_files IS 'Tracks archived scripts from the monorepo cleanup process. Includes usage data, archive locations, and restoration capability.';

-- Create a view for easy querying of unrestored archives
CREATE OR REPLACE VIEW sys_archived_scripts_active_view AS
SELECT 
  asf.*,
  CASE 
    WHEN last_used IS NULL THEN 'never_used'
    WHEN last_used > NOW() - INTERVAL '30 days' THEN 'recently_used'
    WHEN last_used > NOW() - INTERVAL '90 days' THEN 'inactive'
    ELSE 'dormant'
  END as usage_status,
  NOW() - archive_date as time_archived
FROM sys_archived_scripts_files asf
WHERE restored = FALSE
ORDER BY archive_date DESC;

-- Grant appropriate permissions
GRANT SELECT ON sys_archived_scripts_active_view TO authenticated;

-- Add view to sys_table_definitions
INSERT INTO sys_table_definitions (
  table_schema,
  table_name,
  description,
  purpose,
  created_date,
  object_type
) VALUES (
  'public',
  'sys_archived_scripts_active_view',
  'View of currently archived (non-restored) scripts with usage status',
  'Simplified view for querying archived scripts that have not been restored',
  CURRENT_DATE,
  'view'
) ON CONFLICT (table_schema, table_name) DO NOTHING;