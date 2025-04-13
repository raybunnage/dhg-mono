-- Migration: Create Documentation Management System Tables
-- Description: Sets up tables for tracking markdown documentation files and their metadata

-- Documentation files table - stores metadata about markdown files
CREATE TABLE documentation_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  ai_generated_tags TEXT[],
  manual_tags TEXT[],
  last_modified_at TIMESTAMPTZ NOT NULL,
  last_indexed_at TIMESTAMPTZ NOT NULL,
  file_hash TEXT, -- For detecting changes
  metadata JSONB, -- Extracted frontmatter, headings, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documentation relations table - tracks relationships between documents
CREATE TABLE documentation_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES documentation_files(id) ON DELETE CASCADE NOT NULL,
  target_id UUID REFERENCES documentation_files(id) ON DELETE CASCADE NOT NULL,
  relation_type TEXT NOT NULL, -- 'reference', 'related', etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Prevent duplicate relations
  CONSTRAINT unique_documentation_relation UNIQUE (source_id, target_id, relation_type)
);

-- Documentation sections table - tracks sections within documents
CREATE TABLE documentation_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES documentation_files(id) ON DELETE CASCADE NOT NULL,
  heading TEXT NOT NULL,
  level INTEGER NOT NULL, -- h1, h2, etc.
  position INTEGER NOT NULL, -- Order in document
  anchor_id TEXT NOT NULL, -- For direct linking
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Ensure unique anchors within a document
  CONSTRAINT unique_section_anchor UNIQUE (file_id, anchor_id)
);

-- Documentation processing queue - tracks files that need AI processing
CREATE TABLE documentation_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES documentation_files(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  priority INTEGER NOT NULL DEFAULT 1,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_documentation_files_path ON documentation_files (file_path);
CREATE INDEX idx_documentation_files_tags ON documentation_files USING GIN (ai_generated_tags, manual_tags);
CREATE INDEX idx_documentation_sections_file_id ON documentation_sections (file_id);
CREATE INDEX idx_documentation_processing_queue_status ON documentation_processing_queue (status, priority);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update the updated_at column
CREATE TRIGGER update_documentation_files_updated_at
BEFORE UPDATE ON documentation_files
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documentation_sections_updated_at
BEFORE UPDATE ON documentation_sections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documentation_processing_queue_updated_at
BEFORE UPDATE ON documentation_processing_queue
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a function to add a file to the processing queue
CREATE OR REPLACE FUNCTION queue_documentation_file_for_processing(file_id UUID, priority INTEGER DEFAULT 1)
RETURNS UUID AS $$
DECLARE
  queue_id UUID;
BEGIN
  -- Check if file is already in queue
  SELECT id INTO queue_id FROM documentation_processing_queue 
  WHERE file_id = queue_documentation_file_for_processing.file_id AND status IN ('pending', 'processing');
  
  IF queue_id IS NULL THEN
    -- Add to queue if not already there
    INSERT INTO documentation_processing_queue (file_id, priority)
    VALUES (file_id, priority)
    RETURNING id INTO queue_id;
  ELSE
    -- Update priority if already in queue
    UPDATE documentation_processing_queue
    SET priority = GREATEST(priority, queue_documentation_file_for_processing.priority)
    WHERE id = queue_id;
  END IF;
  
  RETURN queue_id;
END;
$$ LANGUAGE plpgsql; 