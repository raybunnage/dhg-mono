-- Create dev_tasks tables for Claude Code task management system
-- Phase 1: Basic task tracking

-- Simple task tracking
CREATE TABLE IF NOT EXISTS dev_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  task_type VARCHAR(50) DEFAULT 'feature' CHECK (task_type IN ('bug', 'feature', 'refactor', 'question')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  
  -- Claude interaction
  claude_request TEXT, -- What you copy to Claude
  claude_response TEXT, -- Claude's response/summary
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id)
);

-- Simple tagging
CREATE TABLE IF NOT EXISTS dev_task_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique tags per task
  UNIQUE(task_id, tag)
);

-- Track affected files (manual entry)
CREATE TABLE IF NOT EXISTS dev_task_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  action VARCHAR(20) DEFAULT 'modified' CHECK (action IN ('created', 'modified', 'deleted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_dev_tasks_status ON dev_tasks(status);
CREATE INDEX idx_dev_tasks_priority ON dev_tasks(priority);
CREATE INDEX idx_dev_tasks_created_at ON dev_tasks(created_at DESC);
CREATE INDEX idx_dev_tasks_created_by ON dev_tasks(created_by);
CREATE INDEX idx_dev_task_tags_task_id ON dev_task_tags(task_id);
CREATE INDEX idx_dev_task_tags_tag ON dev_task_tags(tag);
CREATE INDEX idx_dev_task_files_task_id ON dev_task_files(task_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dev_tasks_updated_at
  BEFORE UPDATE ON dev_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE dev_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_task_files ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage their own tasks
CREATE POLICY "Users can view all tasks" ON dev_tasks
  FOR SELECT USING (true);

CREATE POLICY "Users can create tasks" ON dev_tasks
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own tasks" ON dev_tasks
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own tasks" ON dev_tasks
  FOR DELETE USING (auth.uid() = created_by);

-- Tags and files follow task permissions
CREATE POLICY "Users can view all tags" ON dev_task_tags
  FOR SELECT USING (true);

CREATE POLICY "Users can manage tags on their tasks" ON dev_task_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM dev_tasks 
      WHERE dev_tasks.id = dev_task_tags.task_id 
      AND dev_tasks.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view all files" ON dev_task_files
  FOR SELECT USING (true);

CREATE POLICY "Users can manage files on their tasks" ON dev_task_files
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM dev_tasks 
      WHERE dev_tasks.id = dev_task_files.task_id 
      AND dev_tasks.created_by = auth.uid()
    )
  );

-- Track this migration
INSERT INTO sys_table_migrations (old_name, new_name, migrated_at, notes)
VALUES 
  ('dev_tasks', 'dev_tasks', NOW(), 'Initial creation - Phase 1 Claude Code task management'),
  ('dev_task_tags', 'dev_task_tags', NOW(), 'Initial creation - Task tagging system'),
  ('dev_task_files', 'dev_task_files', NOW(), 'Initial creation - Track affected files');

-- Add helpful comments
COMMENT ON TABLE dev_tasks IS 'Tracks Claude Code development tasks and interactions';
COMMENT ON COLUMN dev_tasks.claude_request IS 'The formatted request text copied to Claude Code';
COMMENT ON COLUMN dev_tasks.claude_response IS 'Claude''s response or work summary';
COMMENT ON TABLE dev_task_tags IS 'Tags for categorizing and searching tasks';
COMMENT ON TABLE dev_task_files IS 'Files affected by task implementation (manually tracked)';