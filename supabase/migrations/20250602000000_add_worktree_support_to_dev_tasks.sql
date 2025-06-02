-- Add worktree support to dev_tasks table
ALTER TABLE dev_tasks 
ADD COLUMN IF NOT EXISTS worktree_path VARCHAR(255),
ADD COLUMN IF NOT EXISTS worktree_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS work_mode VARCHAR(50) DEFAULT 'single-file',
ADD COLUMN IF NOT EXISTS requires_branch BOOLEAN DEFAULT false;

-- Add check constraint for work_mode
ALTER TABLE dev_tasks DROP CONSTRAINT IF EXISTS dev_tasks_work_mode_check;
ALTER TABLE dev_tasks ADD CONSTRAINT dev_tasks_work_mode_check 
  CHECK (work_mode IN ('single-file', 'feature', 'exploration', 'cross-repo'));

-- Add comment to explain fields
COMMENT ON COLUMN dev_tasks.worktree_path IS 'Relative path to git worktree directory (e.g., ../dhg-mono-auth)';
COMMENT ON COLUMN dev_tasks.worktree_active IS 'Whether a worktree is currently active for this task';
COMMENT ON COLUMN dev_tasks.work_mode IS 'Type of work: single-file (quick fix), feature (needs branch), exploration (research), cross-repo (spans multiple repos)';
COMMENT ON COLUMN dev_tasks.requires_branch IS 'Whether this task requires a git branch (opt-in)';