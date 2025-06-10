-- Add worktree column to dev_tasks table
ALTER TABLE dev_tasks
ADD COLUMN IF NOT EXISTS worktree TEXT;

-- Add comment for documentation
COMMENT ON COLUMN dev_tasks.worktree IS 'The git worktree where this task is being worked on';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_dev_tasks_worktree ON dev_tasks(worktree);