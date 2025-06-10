-- Add worktree column to ai_work_summaries table
ALTER TABLE ai_work_summaries
ADD COLUMN IF NOT EXISTS worktree TEXT,
ADD COLUMN IF NOT EXISTS worktree_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN ai_work_summaries.worktree IS 'The git worktree where this work summary was created';
COMMENT ON COLUMN ai_work_summaries.worktree_path IS 'The filesystem path to the worktree';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_ai_work_summaries_worktree ON ai_work_summaries(worktree);