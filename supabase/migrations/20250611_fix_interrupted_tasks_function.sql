-- Fix the get_interrupted_claude_tasks function type mismatch
DROP FUNCTION IF EXISTS get_interrupted_claude_tasks(TEXT, INT);

CREATE OR REPLACE FUNCTION get_interrupted_claude_tasks(
  p_worktree TEXT DEFAULT NULL,
  p_timeout_minutes INT DEFAULT 30
) RETURNS TABLE(
  task_id UUID,
  title VARCHAR(255),  -- Match the actual column type
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