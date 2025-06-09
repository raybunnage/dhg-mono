-- Add task submission tracking fields to dev_tasks table
ALTER TABLE dev_tasks
ADD COLUMN IF NOT EXISTS submitted_to_claude BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS submitted_on_worktree TEXT,
ADD COLUMN IF NOT EXISTS has_commits BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_commit_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS progress_status TEXT CHECK (progress_status IN ('not_started', 'claude_submitted', 'in_development', 'has_commits', 'ready_for_review', 'completed'));

-- Add comments for documentation
COMMENT ON COLUMN dev_tasks.submitted_to_claude IS 'Whether this task has been submitted to Claude';
COMMENT ON COLUMN dev_tasks.submitted_at IS 'When the task was submitted to Claude';
COMMENT ON COLUMN dev_tasks.submitted_on_worktree IS 'The worktree where the task was submitted to Claude';
COMMENT ON COLUMN dev_tasks.has_commits IS 'Whether any git commits have been made for this task';
COMMENT ON COLUMN dev_tasks.last_commit_at IS 'Timestamp of the most recent commit for this task';
COMMENT ON COLUMN dev_tasks.progress_status IS 'Overall progress status of the task';

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_dev_tasks_submitted_to_claude ON dev_tasks(submitted_to_claude);
CREATE INDEX IF NOT EXISTS idx_dev_tasks_progress_status ON dev_tasks(progress_status);
CREATE INDEX IF NOT EXISTS idx_dev_tasks_submitted_on_worktree ON dev_tasks(submitted_on_worktree);

-- Update existing tasks to set initial progress_status based on current status
UPDATE dev_tasks
SET progress_status = CASE
  WHEN status = 'completed' THEN 'completed'
  WHEN status IN ('in_progress', 'testing', 'revision') THEN 'in_development'
  WHEN claude_request IS NOT NULL THEN 'claude_submitted'
  ELSE 'not_started'
END
WHERE progress_status IS NULL;

-- Update has_commits flag based on git_commits_count
UPDATE dev_tasks
SET has_commits = CASE
  WHEN git_commits_count > 0 THEN TRUE
  ELSE FALSE
END
WHERE has_commits IS NULL;