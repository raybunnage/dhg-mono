-- Create system for archiving documents
-- This table tracks all archived documentation files with metadata about when and why they were archived

CREATE TABLE IF NOT EXISTS sys_archived_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('living_doc', 'technical_spec', 'guide', 'report', 'solution', 'feature_doc', 'other')),
  archive_reason TEXT NOT NULL,
  superseded_by TEXT, -- Path to the document that replaces this one
  content TEXT, -- Store the actual content for historical reference
  metadata JSONB DEFAULT '{}',
  archive_date TIMESTAMPTZ DEFAULT NOW(),
  archived_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_sys_archived_documents_original_path ON sys_archived_documents(original_path);
CREATE INDEX idx_sys_archived_documents_document_type ON sys_archived_documents(document_type);
CREATE INDEX idx_sys_archived_documents_archive_date ON sys_archived_documents(archive_date DESC);
CREATE INDEX idx_sys_archived_documents_superseded_by ON sys_archived_documents(superseded_by);

-- Enable RLS
ALTER TABLE sys_archived_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON sys_archived_documents
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON sys_archived_documents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON sys_archived_documents
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Create updated_at trigger
CREATE TRIGGER update_sys_archived_documents_updated_at 
BEFORE UPDATE ON sys_archived_documents 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'sys_archived_documents', 'Tracks all archived documentation files with metadata', 'Document archiving and version history', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Create a view for easy access to archived living docs
CREATE OR REPLACE VIEW sys_archived_living_docs_view AS
SELECT 
  id,
  original_path,
  file_name,
  archive_reason,
  superseded_by,
  archive_date,
  archived_by,
  jsonb_extract_path_text(metadata, 'last_updated') as last_updated_when_archived,
  jsonb_extract_path_text(metadata, 'priority') as priority_when_archived,
  jsonb_extract_path_text(metadata, 'status') as status_when_archived
FROM sys_archived_documents
WHERE document_type = 'living_doc'
ORDER BY archive_date DESC;

-- Add view to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'sys_archived_living_docs_view', 'View of archived living documentation files', 'Easy access to archived living docs', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;