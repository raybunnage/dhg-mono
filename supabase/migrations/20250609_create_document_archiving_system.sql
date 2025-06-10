-- Create document archiving system
-- Migration: 20250609_create_document_archiving_system.sql

-- Document archiving tracking table
CREATE TABLE doc_archives (
  archive_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_path TEXT NOT NULL,
  archived_path TEXT NOT NULL,
  archive_reason TEXT NOT NULL,
  archived_by TEXT,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  replacement_doc_path TEXT, -- Link to living document that replaces this
  restoration_notes TEXT,
  metadata JSONB,
  CONSTRAINT doc_archives_original_path_unique UNIQUE(original_path)
);

-- Archive validation and tracking
CREATE TABLE doc_archive_validation (
  validation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  archive_id UUID REFERENCES doc_archives(archive_id) ON DELETE CASCADE,
  validation_status TEXT CHECK (validation_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  validator TEXT,
  validation_notes TEXT,
  validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Archive access tracking (to understand which archived docs are still needed)
CREATE TABLE doc_archive_access (
  access_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  archive_id UUID REFERENCES doc_archives(archive_id) ON DELETE CASCADE,
  accessed_by TEXT,
  access_purpose TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  found_useful BOOLEAN
);

-- Living document coverage tracking (maps what archives are covered by living docs)
CREATE TABLE doc_archive_coverage (
  coverage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  archive_id UUID REFERENCES doc_archives(archive_id) ON DELETE CASCADE,
  living_doc_path TEXT NOT NULL,
  coverage_type TEXT CHECK (coverage_type IN ('full', 'partial', 'referenced')),
  coverage_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_doc_archives_original_path ON doc_archives(original_path);
CREATE INDEX idx_doc_archives_archived_at ON doc_archives(archived_at);
CREATE INDEX idx_doc_archives_archive_reason ON doc_archives(archive_reason);
CREATE INDEX idx_doc_archive_validation_status ON doc_archive_validation(validation_status);
CREATE INDEX idx_doc_archive_access_archive_id ON doc_archive_access(archive_id);
CREATE INDEX idx_doc_archive_coverage_living_doc ON doc_archive_coverage(living_doc_path);

-- Add RLS policies for security
ALTER TABLE doc_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_archive_validation ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_archive_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_archive_coverage ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read archive information
CREATE POLICY "Enable read access for authenticated users" ON doc_archives
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON doc_archive_validation
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON doc_archive_access
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON doc_archive_coverage
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert archive records
CREATE POLICY "Enable insert for authenticated users" ON doc_archives
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON doc_archive_validation
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON doc_archive_access
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON doc_archive_coverage
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update archive records
CREATE POLICY "Enable update for authenticated users" ON doc_archives
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON doc_archive_validation
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON doc_archive_coverage
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Function to get archive statistics
CREATE OR REPLACE FUNCTION get_archive_statistics()
RETURNS TABLE (
  total_archives BIGINT,
  archives_by_reason JSONB,
  archives_by_month JSONB,
  pending_validations BIGINT,
  coverage_stats JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM doc_archives) as total_archives,
    
    (SELECT jsonb_object_agg(archive_reason, count)
     FROM (
       SELECT archive_reason, COUNT(*) as count
       FROM doc_archives 
       GROUP BY archive_reason
     ) reasons) as archives_by_reason,
    
    (SELECT jsonb_object_agg(archive_month, count)
     FROM (
       SELECT DATE_TRUNC('month', archived_at)::TEXT as archive_month, COUNT(*) as count
       FROM doc_archives 
       GROUP BY DATE_TRUNC('month', archived_at)
       ORDER BY archive_month
     ) months) as archives_by_month,
    
    (SELECT COUNT(*) FROM doc_archive_validation WHERE validation_status = 'pending') as pending_validations,
    
    (SELECT jsonb_object_agg(coverage_type, count)
     FROM (
       SELECT coverage_type, COUNT(*) as count
       FROM doc_archive_coverage 
       GROUP BY coverage_type
     ) coverage) as coverage_stats;
END;
$$;

-- Function to find potential archive candidates based on access patterns
CREATE OR REPLACE FUNCTION find_archive_candidates(
  days_since_access INTEGER DEFAULT 90,
  exclude_patterns TEXT[] DEFAULT ARRAY['continuously-updated', 'CLAUDE.md']
)
RETURNS TABLE (
  doc_path TEXT,
  last_access DATE,
  access_count BIGINT,
  suggested_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This is a placeholder function that would integrate with actual file access tracking
  -- For now, it returns an empty result set
  RETURN QUERY
  SELECT 
    NULL::TEXT as doc_path,
    NULL::DATE as last_access,
    NULL::BIGINT as access_count,
    NULL::TEXT as suggested_reason
  WHERE FALSE;
END;
$$;

-- Function to validate archive coverage
CREATE OR REPLACE FUNCTION validate_archive_coverage()
RETURNS TABLE (
  archive_id UUID,
  original_path TEXT,
  has_coverage BOOLEAN,
  coverage_gaps TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    da.archive_id,
    da.original_path,
    EXISTS(SELECT 1 FROM doc_archive_coverage dac WHERE dac.archive_id = da.archive_id) as has_coverage,
    ARRAY[]::TEXT[] as coverage_gaps -- Placeholder for detailed gap analysis
  FROM doc_archives da
  ORDER BY da.archived_at DESC;
END;
$$;

-- Add table definitions for the new tables
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
  ('public', 'doc_archives', 'Tracks archived documents with metadata and replacement links', 'Document archiving system - main tracking table', CURRENT_DATE),
  ('public', 'doc_archive_validation', 'Approval workflow for document archival decisions', 'Document archiving system - validation workflow', CURRENT_DATE),
  ('public', 'doc_archive_access', 'Tracks access to archived documents to understand usage patterns', 'Document archiving system - usage analytics', CURRENT_DATE),
  ('public', 'doc_archive_coverage', 'Maps archived documents to living documents that cover their content', 'Document archiving system - coverage tracking', CURRENT_DATE);

-- Add comments to tables for documentation
COMMENT ON TABLE doc_archives IS 'Main table for tracking archived documents with metadata and replacement information';
COMMENT ON TABLE doc_archive_validation IS 'Approval workflow for document archival decisions with validation status';
COMMENT ON TABLE doc_archive_access IS 'Tracks when archived documents are accessed to understand ongoing utility';
COMMENT ON TABLE doc_archive_coverage IS 'Maps archived documents to living documents that provide coverage of their content';

-- Add comments to key columns
COMMENT ON COLUMN doc_archives.replacement_doc_path IS 'Path to living document or other document that replaces this archived content';
COMMENT ON COLUMN doc_archives.metadata IS 'JSON metadata including document type, size, key topics, etc.';
COMMENT ON COLUMN doc_archive_coverage.coverage_type IS 'Type of coverage: full (completely covered), partial (some content covered), referenced (mentioned but not detailed)';