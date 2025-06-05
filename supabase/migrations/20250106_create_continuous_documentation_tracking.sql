-- Create continuous documentation tracking tables
-- This migration sets up tables to track and automate continuous documentation updates

-- Create table to track documents that need continuous updates
CREATE TABLE IF NOT EXISTS doc_continuous_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_path TEXT NOT NULL UNIQUE,
  document_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('apps', 'cli-pipelines', 'project-instructions', 'technical-specs', 'solution-guides', 'deployment', 'general')),
  update_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (update_frequency IN ('daily', 'weekly', 'on-change', 'manual')),
  last_updated_at TIMESTAMP WITH TIME ZONE,
  next_update_at TIMESTAMP WITH TIME ZONE,
  source_paths TEXT[], -- Array of source file paths to monitor
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table to track update history
CREATE TABLE IF NOT EXISTS doc_continuous_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_id UUID REFERENCES doc_continuous_tracking(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL CHECK (update_type IN ('scheduled', 'manual', 'on-change')),
  changes_detected BOOLEAN DEFAULT false,
  changes_summary TEXT,
  sections_updated TEXT[],
  update_status TEXT NOT NULL CHECK (update_status IN ('pending', 'in-progress', 'completed', 'failed')),
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_doc_continuous_tracking_category ON doc_continuous_tracking(category);
CREATE INDEX idx_doc_continuous_tracking_enabled ON doc_continuous_tracking(enabled);
CREATE INDEX idx_doc_continuous_tracking_next_update ON doc_continuous_tracking(next_update_at);
CREATE INDEX idx_doc_continuous_updates_tracking_id ON doc_continuous_updates(tracking_id);
CREATE INDEX idx_doc_continuous_updates_status ON doc_continuous_updates(update_status);

-- Create function to calculate next update time
CREATE OR REPLACE FUNCTION calculate_next_update(
  last_update TIMESTAMP WITH TIME ZONE,
  frequency TEXT
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  CASE frequency
    WHEN 'daily' THEN
      RETURN last_update + INTERVAL '1 day';
    WHEN 'weekly' THEN
      RETURN last_update + INTERVAL '7 days';
    WHEN 'on-change' THEN
      RETURN last_update + INTERVAL '1 hour'; -- Check hourly for changes
    ELSE
      RETURN NULL; -- Manual updates don't have scheduled time
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION update_continuous_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.last_updated_at IS NOT NULL AND NEW.update_frequency != 'manual' THEN
    NEW.next_update_at = calculate_next_update(NEW.last_updated_at, NEW.update_frequency);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_continuous_tracking_timestamp
BEFORE UPDATE ON doc_continuous_tracking
FOR EACH ROW
EXECUTE FUNCTION update_continuous_tracking_timestamp();

-- Insert initial tracking records for our consolidated documents
INSERT INTO doc_continuous_tracking (file_path, document_name, category, update_frequency, source_paths, metadata) VALUES
(
  'docs/continuously-updated/apps-documentation.md',
  'DHG Monorepo Applications Documentation',
  'apps',
  'weekly',
  ARRAY[
    'docs/apps/',
    'docs/technical-specs/dhg-*.md',
    'docs/code-documentation/dhg-*.md',
    'apps/*/README.md',
    'apps/*/package.json'
  ],
  jsonb_build_object(
    'description', 'Consolidated documentation for all applications in the DHG monorepo',
    'auto_sections', ARRAY['Recent Updates', 'Technical Stack', 'Key Features', 'Database Integration'],
    'table_of_contents', true
  )
),
(
  'docs/continuously-updated/cli-pipelines-documentation.md',
  'DHG CLI Pipelines Documentation',
  'cli-pipelines',
  'weekly',
  ARRAY[
    'docs/cli-pipeline/',
    'scripts/cli-pipeline/*/README.md',
    'scripts/cli-pipeline/*/*.sh',
    'scripts/cli-pipeline/*/package.json'
  ],
  jsonb_build_object(
    'description', 'Consolidated documentation for all CLI pipelines',
    'auto_sections', ARRAY['Key Commands', 'Recent Updates', 'Database Tables', 'Integration Points'],
    'table_of_contents', true
  )
);

-- Create function to get documents due for update
CREATE OR REPLACE FUNCTION get_documents_due_for_update()
RETURNS TABLE (
  id UUID,
  file_path TEXT,
  document_name TEXT,
  category TEXT,
  update_frequency TEXT,
  last_updated_at TIMESTAMP WITH TIME ZONE,
  source_paths TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.file_path,
    t.document_name,
    t.category,
    t.update_frequency,
    t.last_updated_at,
    t.source_paths
  FROM doc_continuous_tracking t
  WHERE t.enabled = true
    AND t.update_frequency != 'manual'
    AND (
      t.next_update_at IS NULL 
      OR t.next_update_at <= NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to record update attempt
CREATE OR REPLACE FUNCTION record_documentation_update(
  p_tracking_id UUID,
  p_update_type TEXT,
  p_changes_detected BOOLEAN DEFAULT false,
  p_changes_summary TEXT DEFAULT NULL,
  p_sections_updated TEXT[] DEFAULT NULL,
  p_status TEXT DEFAULT 'completed',
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_update_id UUID;
BEGIN
  -- Insert update record
  INSERT INTO doc_continuous_updates (
    tracking_id,
    update_type,
    changes_detected,
    changes_summary,
    sections_updated,
    update_status,
    error_message,
    started_at,
    completed_at
  ) VALUES (
    p_tracking_id,
    p_update_type,
    p_changes_detected,
    p_changes_summary,
    p_sections_updated,
    p_status,
    p_error_message,
    NOW() - INTERVAL '1 minute', -- Assume 1 minute processing time
    NOW()
  ) RETURNING id INTO v_update_id;
  
  -- Update tracking record if successful
  IF p_status = 'completed' THEN
    UPDATE doc_continuous_tracking
    SET last_updated_at = NOW()
    WHERE id = p_tracking_id;
  END IF;
  
  RETURN v_update_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for documentation update status
CREATE OR REPLACE VIEW doc_continuous_status AS
SELECT 
  t.id,
  t.file_path,
  t.document_name,
  t.category,
  t.update_frequency,
  t.enabled,
  t.last_updated_at,
  t.next_update_at,
  CASE 
    WHEN t.update_frequency = 'manual' THEN 'Manual updates only'
    WHEN t.next_update_at IS NULL THEN 'Never updated'
    WHEN t.next_update_at <= NOW() THEN 'Update due'
    ELSE 'Up to date'
  END as status,
  (
    SELECT COUNT(*) 
    FROM doc_continuous_updates u 
    WHERE u.tracking_id = t.id AND u.changes_detected = true
  ) as total_updates_with_changes,
  (
    SELECT u.completed_at 
    FROM doc_continuous_updates u 
    WHERE u.tracking_id = t.id 
    ORDER BY u.completed_at DESC 
    LIMIT 1
  ) as last_check_at
FROM doc_continuous_tracking t;

-- Add metadata to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
  ('public', 'doc_continuous_tracking', 'Tracks documents that require continuous updates', 'Automated documentation maintenance', CURRENT_DATE),
  ('public', 'doc_continuous_updates', 'History of documentation update attempts', 'Audit trail for documentation changes', CURRENT_DATE);

-- Add RLS policies
ALTER TABLE doc_continuous_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_continuous_updates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated users to read continuous tracking" ON doc_continuous_tracking
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read update history" ON doc_continuous_updates
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only allow service role to modify
CREATE POLICY "Only service role can modify tracking" ON doc_continuous_tracking
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Only service role can modify updates" ON doc_continuous_updates
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON doc_continuous_tracking TO authenticated;
GRANT SELECT ON doc_continuous_updates TO authenticated;
GRANT SELECT ON doc_continuous_status TO authenticated;
GRANT ALL ON doc_continuous_tracking TO service_role;
GRANT ALL ON doc_continuous_updates TO service_role;