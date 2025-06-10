-- Add fields for better worktree tracking in dev_tasks
-- These fields help track how worktree assignments were made

-- Add assignment metadata to dev_tasks
ALTER TABLE dev_tasks 
ADD COLUMN IF NOT EXISTS worktree_assignment_method TEXT,
ADD COLUMN IF NOT EXISTS worktree_assignment_confidence INTEGER,
ADD COLUMN IF NOT EXISTS worktree_assignment_reason TEXT,
ADD COLUMN IF NOT EXISTS worktree_assigned_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_dev_tasks_worktree_path ON dev_tasks(worktree_path);
CREATE INDEX IF NOT EXISTS idx_dev_tasks_worktree_assignment_method ON dev_tasks(worktree_assignment_method);

-- Create a table to track commit analysis history
CREATE TABLE IF NOT EXISTS dev_task_commit_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
  commit_hash TEXT NOT NULL,
  worktree_path TEXT,
  commit_date TIMESTAMP WITH TIME ZONE,
  commit_message TEXT,
  files_changed TEXT[],
  confidence_score INTEGER,
  match_reasons TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_commit_analysis_task_id ON dev_task_commit_analysis(task_id);
CREATE INDEX IF NOT EXISTS idx_commit_analysis_commit_hash ON dev_task_commit_analysis(commit_hash);

-- Add comment explaining the fields
COMMENT ON COLUMN dev_tasks.worktree_assignment_method IS 'How the worktree was assigned: explicit (Task ID in commit), inferred (based on analysis), manual';
COMMENT ON COLUMN dev_tasks.worktree_assignment_confidence IS 'Confidence score (0-100) for inferred assignments';
COMMENT ON COLUMN dev_tasks.worktree_assignment_reason IS 'Explanation of why this worktree was assigned';
COMMENT ON COLUMN dev_tasks.worktree_assigned_at IS 'When the worktree assignment was made';