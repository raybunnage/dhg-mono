-- Create table for living docs metadata
CREATE TABLE IF NOT EXISTS doc_living_docs_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT UNIQUE NOT NULL,
  description TEXT,
  update_frequency TEXT CHECK (update_frequency IN ('daily', 'weekly', 'on-change')),
  last_updated TIMESTAMP WITH TIME ZONE,
  priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT CHECK (status IN ('active', 'draft', 'archived')),
  category TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_living_docs_category ON doc_living_docs_metadata(category);
CREATE INDEX IF NOT EXISTS idx_living_docs_priority ON doc_living_docs_metadata(priority);
CREATE INDEX IF NOT EXISTS idx_living_docs_status ON doc_living_docs_metadata(status);
CREATE INDEX IF NOT EXISTS idx_living_docs_updated ON doc_living_docs_metadata(last_updated DESC);

-- Add RLS policies
ALTER TABLE doc_living_docs_metadata ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Enable read access for all users" ON doc_living_docs_metadata
  FOR SELECT USING (true);

-- Allow authenticated users to update
CREATE POLICY "Enable update for authenticated users" ON doc_living_docs_metadata
  FOR UPDATE WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to insert
CREATE POLICY "Enable insert for authenticated users" ON doc_living_docs_metadata
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add comment
COMMENT ON TABLE doc_living_docs_metadata IS 'Metadata for living documentation files including update frequency and categorization';