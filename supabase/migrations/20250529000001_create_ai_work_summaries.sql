-- Create table to track AI work summaries
CREATE TABLE IF NOT EXISTS ai_work_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary_content TEXT NOT NULL,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  commands TEXT[], -- Array of commands worked on
  ui_components TEXT[], -- Array of UI components worked on
  files_modified TEXT[], -- Array of files modified
  metadata JSONB, -- Additional structured data
  tags TEXT[], -- Searchable tags
  category TEXT, -- 'refactoring', 'bug_fix', 'feature', 'documentation', etc.
  status TEXT DEFAULT 'completed', -- 'completed', 'in_progress', 'needs_review'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better search performance
CREATE INDEX idx_ai_work_summaries_work_date ON ai_work_summaries(work_date DESC);
CREATE INDEX idx_ai_work_summaries_title ON ai_work_summaries USING gin(to_tsvector('english', title));
CREATE INDEX idx_ai_work_summaries_content ON ai_work_summaries USING gin(to_tsvector('english', summary_content));
CREATE INDEX idx_ai_work_summaries_commands ON ai_work_summaries USING gin(commands);
CREATE INDEX idx_ai_work_summaries_tags ON ai_work_summaries USING gin(tags);
CREATE INDEX idx_ai_work_summaries_category ON ai_work_summaries(category);

-- Add comment to explain the table
COMMENT ON TABLE ai_work_summaries IS 'Tracks AI assistant work summaries for better visibility and searchability';

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_work_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_ai_work_summaries_updated_at
  BEFORE UPDATE ON ai_work_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_work_summaries_updated_at();

-- Create full-text search function
CREATE OR REPLACE FUNCTION search_ai_work_summaries(search_query TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  summary_content TEXT,
  work_date DATE,
  commands TEXT[],
  tags TEXT[],
  category TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.title,
    s.summary_content,
    s.work_date,
    s.commands,
    s.tags,
    s.category,
    ts_rank(
      to_tsvector('english', s.title || ' ' || s.summary_content || ' ' || COALESCE(array_to_string(s.commands, ' '), '') || ' ' || COALESCE(array_to_string(s.tags, ' '), '')),
      plainto_tsquery('english', search_query)
    ) as rank
  FROM ai_work_summaries s
  WHERE 
    to_tsvector('english', s.title || ' ' || s.summary_content || ' ' || COALESCE(array_to_string(s.commands, ' '), '') || ' ' || COALESCE(array_to_string(s.tags, ' '), ''))
    @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, s.work_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Create view for recent summaries
CREATE OR REPLACE VIEW recent_ai_work_summaries AS
SELECT 
  id,
  title,
  LEFT(summary_content, 200) || CASE WHEN LENGTH(summary_content) > 200 THEN '...' ELSE '' END as summary_preview,
  work_date,
  commands,
  ui_components,
  tags,
  category,
  status,
  created_at
FROM ai_work_summaries
ORDER BY work_date DESC, created_at DESC
LIMIT 50;

-- Add RLS policies
ALTER TABLE ai_work_summaries ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (since it's for tracking work)
CREATE POLICY "Allow all operations on ai_work_summaries" ON ai_work_summaries
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Insert today's work as examples
INSERT INTO ai_work_summaries (title, summary_content, work_date, commands, tags, category, metadata) VALUES
(
  'Fixed process-new-files-enhanced Batch Processing Issue',
  'The process-new-files-enhanced command was creating 673 duplicate expert documents instead of just 7 new ones. The issue was that it was trying to check all file IDs in a single Supabase IN query, which exceeded the database limit and failed silently. Fixed by implementing batch processing to check IDs in groups of 100.',
  CURRENT_DATE,
  ARRAY['process-new-files-enhanced'],
  ARRAY['bug_fix', 'batch_processing', 'google_sync', 'expert_documents'],
  'bug_fix',
  '{"files_affected": 673, "files_should_process": 7, "batch_size": 100}'::jsonb
),
(
  'Created refresh-main-video-id Command',
  'Created a new command that automatically finds the MP4 file within a high-level folder and updates the main_video_id for the folder and all its nested contents. This fixes orphaned video ID references that occur when video files are deleted and re-synced with new IDs.',
  CURRENT_DATE,
  ARRAY['refresh-main-video-id'],
  ARRAY['new_feature', 'video_management', 'google_sync'],
  'feature',
  '{"folders_fixed": ["2025-05-07 - Raison - Depression a survival strategy", "2025-05-21 - Busse - Review of spinal injections"]}'::jsonb
),
(
  'Created Command Refactor Tracking System',
  'Built a comprehensive database-backed system to track the refactoring status of google sync CLI commands. Includes a dedicated table (command_refactor_tracking), CLI pipeline with multiple commands (status, list, update, test-complete, sign-off, show, needs-work, add-note), and views for monitoring progress. Currently tracking 23 commands.',
  CURRENT_DATE,
  ARRAY['refactor-tracking-cli', 'database-cli'],
  ARRAY['new_feature', 'tracking_system', 'refactoring', 'cli_pipeline'],
  'feature',
  '{"total_commands": 23, "commands_completed": 0, "new_tables": ["command_refactor_tracking"], "new_views": ["command_refactor_status_summary", "commands_needing_attention"]}'::jsonb
);