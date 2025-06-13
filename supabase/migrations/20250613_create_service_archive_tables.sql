-- Create service archive tables for tracking archived/deprecated services
-- This allows us to maintain historical records of services that have been removed or replaced

-- Create table for archived services
CREATE TABLE IF NOT EXISTS sys_archived_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  service_path TEXT NOT NULL,
  archived_path TEXT NOT NULL,
  archive_reason TEXT NOT NULL,
  archive_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  archived_by TEXT DEFAULT current_user,
  
  -- Service metadata at time of archival
  final_usage_count INTEGER,
  final_status TEXT,
  replacement_service TEXT, -- If replaced by another service
  
  -- Archive details
  git_commit_hash TEXT, -- Commit where service was archived
  original_created_date DATE,
  total_lifetime_days INTEGER,
  
  -- Migration information
  migration_notes TEXT,
  cleanup_completed BOOLEAN DEFAULT false,
  cleanup_checkpoint_stage TEXT,
  
  -- Service snapshot
  service_snapshot JSONB, -- Full snapshot of service metadata before archival
  
  UNIQUE(service_name, archive_date)
);

-- Create index for lookups
CREATE INDEX idx_archived_services_name ON sys_archived_services(service_name);
CREATE INDEX idx_archived_services_date ON sys_archived_services(archive_date);
CREATE INDEX idx_archived_services_replacement ON sys_archived_services(replacement_service);

-- Create table for archived service code
CREATE TABLE IF NOT EXISTS sys_archived_service_code (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  archived_service_id UUID REFERENCES sys_archived_services(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_content TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  language TEXT DEFAULT 'typescript',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(archived_service_id, file_path)
);

-- Create view for archived services summary
CREATE VIEW sys_archived_services_summary_view AS
SELECT 
  s.service_name,
  s.archive_date,
  s.archive_reason,
  s.replacement_service,
  s.final_usage_count,
  s.total_lifetime_days,
  COUNT(c.id) as archived_files_count,
  SUM(c.file_size) as total_archived_size
FROM sys_archived_services s
LEFT JOIN sys_archived_service_code c ON c.archived_service_id = s.id
GROUP BY s.id, s.service_name, s.archive_date, s.archive_reason, 
         s.replacement_service, s.final_usage_count, s.total_lifetime_days
ORDER BY s.archive_date DESC;

-- Function to archive a service
CREATE OR REPLACE FUNCTION archive_service(
  p_service_name TEXT,
  p_archive_reason TEXT,
  p_replacement_service TEXT DEFAULT NULL,
  p_migration_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_service_id UUID;
  v_service_data RECORD;
  v_archive_id UUID;
BEGIN
  -- Get current service data
  SELECT * INTO v_service_data
  FROM sys_shared_services
  WHERE service_name = p_service_name;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service % not found in sys_shared_services', p_service_name;
  END IF;
  
  -- Create archive record
  INSERT INTO sys_archived_services (
    service_name,
    service_path,
    archived_path,
    archive_reason,
    replacement_service,
    final_usage_count,
    final_status,
    migration_notes,
    service_snapshot,
    original_created_date,
    total_lifetime_days
  ) VALUES (
    p_service_name,
    v_service_data.service_path,
    '.archived_scripts/' || p_service_name || '.' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '.ts',
    p_archive_reason,
    p_replacement_service,
    v_service_data.usage_count,
    v_service_data.status,
    p_migration_notes,
    row_to_json(v_service_data),
    v_service_data.created_at::DATE,
    CURRENT_DATE - v_service_data.created_at::DATE
  ) RETURNING id INTO v_archive_id;
  
  -- Mark original service as archived
  UPDATE sys_shared_services
  SET status = 'archived',
      notes = COALESCE(notes || E'\n', '') || 'Archived on ' || CURRENT_DATE || ': ' || p_archive_reason
  WHERE service_name = p_service_name;
  
  RETURN v_archive_id;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE sys_archived_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_archived_service_code ENABLE ROW LEVEL SECURITY;

-- Read access for all
CREATE POLICY "Enable read access for all users" ON sys_archived_services
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON sys_archived_service_code
  FOR SELECT USING (true);

-- Write access for authenticated only
CREATE POLICY "Enable insert for authenticated users" ON sys_archived_services
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON sys_archived_service_code
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Grant access to views
GRANT SELECT ON sys_archived_services_summary_view TO authenticated;

-- Add metadata
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
  ('public', 'sys_archived_services', 'Tracks archived/deprecated shared services', 'Maintains historical record of removed services', CURRENT_DATE),
  ('public', 'sys_archived_service_code', 'Stores archived service source code', 'Preserves code for reference and potential restoration', CURRENT_DATE);