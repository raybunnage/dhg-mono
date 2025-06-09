-- Create function to update task progress status
CREATE OR REPLACE FUNCTION update_task_progress_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If task is marked as completed or merged, set progress to completed
  IF NEW.status IN ('completed', 'merged') THEN
    NEW.progress_status = 'completed';
    RETURN NEW;
  END IF;
  
  -- If claude_request is set and we're not already in a later stage
  IF NEW.claude_request IS NOT NULL AND 
     (NEW.progress_status IS NULL OR NEW.progress_status = 'not_started') THEN
    NEW.progress_status = 'claude_submitted';
    NEW.submitted_to_claude = TRUE;
    IF NEW.submitted_at IS NULL THEN
      NEW.submitted_at = NOW();
    END IF;
  END IF;
  
  -- If there are commits, update to has_commits
  IF NEW.git_commits_count > 0 THEN
    NEW.has_commits = TRUE;
    NEW.progress_status = 'has_commits';
    IF NEW.last_commit_at IS NULL AND NEW.git_commit_current IS NOT NULL THEN
      NEW.last_commit_at = NEW.updated_at;
    END IF;
  END IF;
  
  -- If status is in_progress/testing/revision, set to in_development
  IF NEW.status IN ('in_progress', 'testing', 'revision') AND 
     (NEW.progress_status IS NULL OR NEW.progress_status IN ('not_started', 'claude_submitted')) THEN
    NEW.progress_status = 'in_development';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update progress status
DROP TRIGGER IF EXISTS update_task_progress_status_trigger ON dev_tasks;
CREATE TRIGGER update_task_progress_status_trigger
  BEFORE INSERT OR UPDATE ON dev_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_progress_status();

-- Update existing tasks to populate the new fields based on current data
UPDATE dev_tasks
SET 
  submitted_to_claude = CASE WHEN claude_request IS NOT NULL THEN TRUE ELSE FALSE END,
  submitted_at = CASE WHEN claude_request IS NOT NULL THEN created_at ELSE NULL END,
  submitted_on_worktree = worktree_path,
  has_commits = CASE WHEN git_commits_count > 0 THEN TRUE ELSE FALSE END,
  last_commit_at = CASE WHEN git_commit_current IS NOT NULL THEN updated_at ELSE NULL END
WHERE submitted_to_claude IS NULL;