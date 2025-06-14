-- Create git checkpoint tracking for service cleanup
-- Enables rollback and progress tracking across worktrees

-- Create table for tracking git checkpoints
CREATE TABLE IF NOT EXISTS sys_service_cleanup_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN (
    'pre-cleanup',
    'migration-complete',
    'imports-updated',
    'tests-added',
    'validation-passed',
    'visual-confirmed',
    'production-verified',
    'cleanup-finalized'
  )),
  commit_hash TEXT NOT NULL,
  commit_message TEXT NOT NULL,
  worktree TEXT NOT NULL DEFAULT 'main',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT current_user,
  
  -- Ensure we track each stage per service
  UNIQUE(service_name, stage, worktree)
);

-- Create index for quick lookups
CREATE INDEX idx_cleanup_checkpoints_service ON sys_service_cleanup_checkpoints(service_name);
CREATE INDEX idx_cleanup_checkpoints_worktree ON sys_service_cleanup_checkpoints(worktree);

-- Create view for checkpoint progress
CREATE VIEW sys_service_cleanup_progress_view AS
WITH stage_order AS (
  SELECT 
    unnest(ARRAY[
      'pre-cleanup',
      'migration-complete', 
      'imports-updated',
      'tests-added',
      'validation-passed',
      'visual-confirmed',
      'production-verified',
      'cleanup-finalized'
    ]) AS stage,
    generate_series(1, 8) AS stage_number
)
SELECT 
  c.service_name,
  c.worktree,
  MAX(so.stage_number) as latest_stage_number,
  MAX(so.stage) as latest_stage,
  COUNT(*) as checkpoints_created,
  MAX(c.created_at) as last_checkpoint_at,
  CASE 
    WHEN MAX(so.stage_number) = 8 THEN 'completed'
    WHEN MAX(so.stage_number) >= 5 THEN 'testing'
    WHEN MAX(so.stage_number) >= 2 THEN 'in_progress'
    ELSE 'started'
  END as cleanup_status
FROM sys_service_cleanup_checkpoints c
JOIN stage_order so ON so.stage = c.stage
GROUP BY c.service_name, c.worktree;

-- Create view for worktree comparison
CREATE VIEW sys_worktree_cleanup_comparison_view AS
SELECT 
  w1.service_name,
  w1.worktree as worktree_1,
  w1.latest_stage as worktree_1_stage,
  w2.worktree as worktree_2,
  w2.latest_stage as worktree_2_stage,
  ABS(w1.latest_stage_number - w2.latest_stage_number) as stage_difference,
  CASE 
    WHEN w1.latest_stage_number = w2.latest_stage_number THEN 'in_sync'
    WHEN ABS(w1.latest_stage_number - w2.latest_stage_number) <= 2 THEN 'close'
    ELSE 'diverged'
  END as sync_status
FROM sys_service_cleanup_progress_view w1
JOIN sys_service_cleanup_progress_view w2 
  ON w1.service_name = w2.service_name 
  AND w1.worktree < w2.worktree;

-- Add checkpoint tracking to cleanup tasks table
ALTER TABLE sys_service_cleanup_tasks
ADD COLUMN IF NOT EXISTS last_checkpoint_stage TEXT,
ADD COLUMN IF NOT EXISTS last_checkpoint_hash TEXT,
ADD COLUMN IF NOT EXISTS last_checkpoint_at TIMESTAMP WITH TIME ZONE;

-- Function to update task checkpoint status
CREATE OR REPLACE FUNCTION update_cleanup_task_checkpoint()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the cleanup task with latest checkpoint info
  UPDATE sys_service_cleanup_tasks
  SET 
    last_checkpoint_stage = NEW.stage,
    last_checkpoint_hash = NEW.commit_hash,
    last_checkpoint_at = NEW.created_at
  WHERE service_name = NEW.service_name;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update task checkpoint status
CREATE TRIGGER update_task_checkpoint_status
  AFTER INSERT ON sys_service_cleanup_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_cleanup_task_checkpoint();

-- RLS policies
ALTER TABLE sys_service_cleanup_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON sys_service_cleanup_checkpoints
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON sys_service_cleanup_checkpoints
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Grant access to views
GRANT SELECT ON sys_service_cleanup_progress_view TO authenticated;
GRANT SELECT ON sys_worktree_cleanup_comparison_view TO authenticated;

-- Insert metadata
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES (
  'public',
  'sys_service_cleanup_checkpoints',
  'Tracks git commit checkpoints during service cleanup process',
  'Enables safe rollback and progress tracking across parallel worktrees',
  CURRENT_DATE
);