-- Add git integration fields to dev_tasks
ALTER TABLE dev_tasks 
ADD COLUMN IF NOT EXISTS git_branch VARCHAR(255),
ADD COLUMN IF NOT EXISTS git_commit_start VARCHAR(40),
ADD COLUMN IF NOT EXISTS git_commit_current VARCHAR(40),
ADD COLUMN IF NOT EXISTS git_commits_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES dev_tasks(id),
ADD COLUMN IF NOT EXISTS is_subtask BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS testing_notes TEXT,
ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;

-- Update status enum to include new states
ALTER TABLE dev_tasks DROP CONSTRAINT IF EXISTS dev_tasks_status_check;
ALTER TABLE dev_tasks ADD CONSTRAINT dev_tasks_status_check 
  CHECK (status IS NULL OR status IN ('pending', 'in_progress', 'testing', 'revision', 'completed', 'merged', 'cancelled'));

-- Create table for tracking commits associated with tasks
CREATE TABLE IF NOT EXISTS dev_task_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
  commit_hash VARCHAR(40) NOT NULL,
  commit_message TEXT,
  files_changed INTEGER,
  insertions INTEGER,
  deletions INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_task_commits_task_id ON dev_task_commits(task_id);

-- Create table for tracking work sessions
CREATE TABLE IF NOT EXISTS dev_task_work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
  claude_session_id VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  summary TEXT,
  commands_used TEXT[],
  files_modified TEXT[],
  CONSTRAINT work_session_dates_check CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_work_sessions_task_id ON dev_task_work_sessions(task_id);

-- Add some helpful views
CREATE OR REPLACE VIEW dev_tasks_with_git AS
SELECT 
  t.*,
  COUNT(DISTINCT c.id) as total_commits,
  COUNT(DISTINCT s.id) as total_sessions,
  MAX(s.ended_at) as last_worked_on
FROM dev_tasks t
LEFT JOIN dev_task_commits c ON t.id = c.task_id
LEFT JOIN dev_task_work_sessions s ON t.id = s.task_id
GROUP BY t.id;

-- Add RLS policies for new tables
ALTER TABLE dev_task_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_task_work_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read commits and sessions (for now)
CREATE POLICY "dev_task_commits_read_all" ON dev_task_commits FOR SELECT USING (true);
CREATE POLICY "dev_task_commits_insert_all" ON dev_task_commits FOR INSERT WITH CHECK (true);

CREATE POLICY "dev_task_work_sessions_read_all" ON dev_task_work_sessions FOR SELECT USING (true);
CREATE POLICY "dev_task_work_sessions_insert_all" ON dev_task_work_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "dev_task_work_sessions_update_all" ON dev_task_work_sessions FOR UPDATE USING (true);

-- Add helpful comment
COMMENT ON COLUMN dev_tasks.git_branch IS 'Git branch name for this task';
COMMENT ON COLUMN dev_tasks.git_commit_start IS 'Starting commit hash when branch was created';
COMMENT ON COLUMN dev_tasks.git_commit_current IS 'Current HEAD commit hash for the branch';
COMMENT ON COLUMN dev_tasks.parent_task_id IS 'Reference to parent task if this is a subtask';
COMMENT ON COLUMN dev_tasks.testing_notes IS 'Notes from testing phase';
COMMENT ON COLUMN dev_tasks.revision_count IS 'Number of times task has been revised';

COMMENT ON TABLE dev_task_commits IS 'Tracks all git commits associated with a dev task';
COMMENT ON TABLE dev_task_work_sessions IS 'Tracks work sessions on dev tasks with summaries';