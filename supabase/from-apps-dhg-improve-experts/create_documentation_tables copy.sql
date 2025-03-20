-- Create the documentation_files table
CREATE TABLE IF NOT EXISTS documentation_files (
  id UUID PRIMARY KEY, 
  file_path TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  file_hash TEXT,
  last_modified_at TIMESTAMPTZ NOT NULL,
  last_indexed_at TIMESTAMPTZ NOT NULL,
  ai_generated_tags TEXT[],
  manual_tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the documentation_sections table
CREATE TABLE IF NOT EXISTS documentation_sections (
  id UUID PRIMARY KEY,
  file_id UUID REFERENCES documentation_files(id) ON DELETE CASCADE,
  heading TEXT NOT NULL,
  anchor_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  position INTEGER NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the documentation_relations table
CREATE TABLE IF NOT EXISTS documentation_relations (
  id UUID PRIMARY KEY,
  source_id UUID REFERENCES documentation_files(id) ON DELETE CASCADE,
  target_id UUID REFERENCES documentation_files(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the documentation_processing_queue table
CREATE TABLE IF NOT EXISTS documentation_processing_queue (
  id UUID PRIMARY KEY,
  file_id UUID REFERENCES documentation_files(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE documentation_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentation_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentation_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentation_processing_queue ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" 
  ON documentation_files FOR ALL 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" 
  ON documentation_sections FOR ALL 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" 
  ON documentation_relations FOR ALL 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" 
  ON documentation_processing_queue FOR ALL 
  USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX idx_documentation_files_file_path ON documentation_files(file_path);
CREATE INDEX idx_documentation_sections_file_id ON documentation_sections(file_id);
CREATE INDEX idx_documentation_relations_source_id ON documentation_relations(source_id);
CREATE INDEX idx_documentation_relations_target_id ON documentation_relations(target_id);
CREATE INDEX idx_documentation_processing_queue_status ON documentation_processing_queue(status);