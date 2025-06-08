-- Create table to track archived package files
CREATE TABLE IF NOT EXISTS sys_archived_package_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name TEXT NOT NULL,
  original_path TEXT NOT NULL,
  archived_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  last_modified TIMESTAMPTZ,
  archive_reason TEXT,
  dependencies_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'system'
);

-- Add comments for documentation
COMMENT ON TABLE sys_archived_package_files IS 'Tracks files archived from packages folder for cleanup and historical reference';
COMMENT ON COLUMN sys_archived_package_files.package_name IS 'Name of the package that was archived (e.g., cli-pipeline, dal, modal)';
COMMENT ON COLUMN sys_archived_package_files.original_path IS 'Original file path before archiving';
COMMENT ON COLUMN sys_archived_package_files.archived_path IS 'New path after archiving to .archived_packages';
COMMENT ON COLUMN sys_archived_package_files.file_type IS 'Type of file (e.g., typescript, python, json)';
COMMENT ON COLUMN sys_archived_package_files.archive_reason IS 'Reason for archiving (e.g., no active usage, deprecated, migrated)';
COMMENT ON COLUMN sys_archived_package_files.dependencies_count IS 'Number of dependencies found at time of archiving';

-- Create index for common queries
CREATE INDEX idx_sys_archived_package_files_package_name ON sys_archived_package_files(package_name);
CREATE INDEX idx_sys_archived_package_files_created_at ON sys_archived_package_files(created_at);

-- Add RLS policies (public read, authenticated write)
ALTER TABLE sys_archived_package_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON sys_archived_package_files
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON sys_archived_package_files
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add entry to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'sys_archived_package_files', 'Tracks archived package files from cleanup operations', 'Historical reference and cleanup tracking for monorepo packages', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;