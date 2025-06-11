-- Add fields to track Claude task submissions and enable recovery
ALTER TABLE dev_tasks
ADD COLUMN IF NOT EXISTS claude_raw_task TEXT,
ADD COLUMN IF NOT EXISTS claude_submission_id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS claude_submission_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS claude_submission_worktree TEXT,
ADD COLUMN IF NOT EXISTS claude_submission_status TEXT DEFAULT 'submitted' CHECK (claude_submission_status IN ('submitted', 'processing', 'interrupted', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS claude_last_activity TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS claude_recovery_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN dev_tasks.claude_raw_task IS 'The raw task text pasted into Claude Code, preserving original formatting';
COMMENT ON COLUMN dev_tasks.claude_submission_id IS 'Unique ID for this specific Claude submission (allows multiple submissions per task)';
COMMENT ON COLUMN dev_tasks.claude_submission_timestamp IS 'When the task was submitted to Claude Code';
COMMENT ON COLUMN dev_tasks.claude_submission_worktree IS 'The worktree where Claude Code is processing this task';
COMMENT ON COLUMN dev_tasks.claude_submission_status IS 'Current status of the Claude Code processing';
COMMENT ON COLUMN dev_tasks.claude_last_activity IS 'Last time we detected Claude Code activity on this task';
COMMENT ON COLUMN dev_tasks.claude_recovery_notes IS 'Notes for resuming interrupted work (uncommitted files, last action, etc)';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_dev_tasks_claude_submission_status ON dev_tasks(claude_submission_status);
CREATE INDEX IF NOT EXISTS idx_dev_tasks_claude_submission_timestamp ON dev_tasks(claude_submission_timestamp);
CREATE INDEX IF NOT EXISTS idx_dev_tasks_claude_submission_worktree ON dev_tasks(claude_submission_worktree);

-- Create a view for tracking active Claude submissions
CREATE OR REPLACE VIEW dev_tasks_claude_active_view AS
SELECT 
  id,
  title,
  task_type,
  priority,
  status,
  claude_submission_id,
  claude_submission_timestamp,
  claude_submission_worktree,
  claude_submission_status,
  claude_last_activity,
  EXTRACT(EPOCH FROM (NOW() - claude_last_activity))/60 as minutes_since_activity,
  claude_recovery_notes,
  git_branch,
  git_commits_count,
  substring(claude_raw_task, 1, 200) || CASE WHEN length(claude_raw_task) > 200 THEN '...' ELSE '' END as task_preview
FROM dev_tasks
WHERE claude_submission_status IN ('submitted', 'processing', 'interrupted')
ORDER BY claude_submission_timestamp DESC;

COMMENT ON VIEW dev_tasks_claude_active_view IS 'View of currently active or interrupted Claude Code submissions';

-- Create a function to mark a task as submitted to Claude
CREATE OR REPLACE FUNCTION submit_task_to_claude(
  p_task_id UUID,
  p_raw_task TEXT,
  p_worktree TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  UPDATE dev_tasks
  SET 
    claude_raw_task = p_raw_task,
    claude_submission_id = gen_random_uuid(),
    claude_submission_timestamp = NOW(),
    claude_submission_worktree = COALESCE(p_worktree, worktree),
    claude_submission_status = 'submitted',
    claude_last_activity = NOW(),
    submitted_to_claude = TRUE,
    submitted_at = NOW(),
    submitted_on_worktree = COALESCE(p_worktree, worktree),
    progress_status = 'claude_submitted'
  WHERE id = p_task_id
  RETURNING json_build_object(
    'task_id', id,
    'submission_id', claude_submission_id,
    'worktree', claude_submission_worktree,
    'timestamp', claude_submission_timestamp
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION submit_task_to_claude IS 'Mark a task as submitted to Claude Code and store the raw task text';

-- Create a function to update Claude activity
CREATE OR REPLACE FUNCTION update_claude_activity(
  p_task_id UUID,
  p_status TEXT DEFAULT 'processing',
  p_recovery_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE dev_tasks
  SET 
    claude_last_activity = NOW(),
    claude_submission_status = p_status,
    claude_recovery_notes = COALESCE(p_recovery_notes, claude_recovery_notes)
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_claude_activity IS 'Update the last activity timestamp for a Claude submission';

-- Create a function to get interrupted tasks
CREATE OR REPLACE FUNCTION get_interrupted_claude_tasks(
  p_worktree TEXT DEFAULT NULL,
  p_timeout_minutes INT DEFAULT 30
) RETURNS TABLE(
  task_id UUID,
  title TEXT,
  submission_id UUID,
  worktree TEXT,
  minutes_inactive NUMERIC,
  recovery_notes TEXT,
  raw_task TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.id as task_id,
    dt.title,
    dt.claude_submission_id as submission_id,
    dt.claude_submission_worktree as worktree,
    ROUND(EXTRACT(EPOCH FROM (NOW() - dt.claude_last_activity))/60, 2) as minutes_inactive,
    dt.claude_recovery_notes as recovery_notes,
    dt.claude_raw_task as raw_task
  FROM dev_tasks dt
  WHERE 
    dt.claude_submission_status IN ('submitted', 'processing')
    AND (p_worktree IS NULL OR dt.claude_submission_worktree = p_worktree)
    AND EXTRACT(EPOCH FROM (NOW() - dt.claude_last_activity))/60 > p_timeout_minutes
  ORDER BY dt.claude_submission_timestamp DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_interrupted_claude_tasks IS 'Get tasks that appear to be interrupted based on inactivity timeout';