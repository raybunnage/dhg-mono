-- Complete the dev task lifecycle tracking system
-- This migration adds the remaining pieces from the V2 specification

-- 1. Add tracking columns to dev_tasks table
ALTER TABLE dev_tasks 
ADD COLUMN IF NOT EXISTS work_summary_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_work_summary_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validation_submission_id UUID,
ADD COLUMN IF NOT EXISTS test_submission_id UUID,
ADD COLUMN IF NOT EXISTS documentation_submission_id UUID;

-- 2. Create work_summary_todos table
CREATE TABLE IF NOT EXISTS work_summary_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_summary_id UUID REFERENCES ai_work_summaries(id) ON DELETE CASCADE,
  todo_text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  sequence_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT unique_todo_order UNIQUE (work_summary_id, sequence_order)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_summary_todos_work_summary_id ON work_summary_todos(work_summary_id);
CREATE INDEX IF NOT EXISTS idx_work_summary_todos_completed ON work_summary_todos(completed);

-- 3. Create task_todo_templates table (for automated todo creation)
CREATE TABLE IF NOT EXISTS task_todo_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL, -- 'feature', 'bugfix', 'refactor', etc.
  todo_text TEXT NOT NULL,
  sequence_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique order per task type
  CONSTRAINT unique_template_order UNIQUE (task_type, sequence_order)
);

-- Insert default todo templates
INSERT INTO task_todo_templates (task_type, todo_text, sequence_order) VALUES
  ('feature', 'Review requirements and acceptance criteria', 1),
  ('feature', 'Write unit tests for new functionality', 2),
  ('feature', 'Update documentation', 3),
  ('feature', 'Get code review approval', 4),
  ('bugfix', 'Reproduce the bug', 1),
  ('bugfix', 'Write test to catch the bug', 2),
  ('bugfix', 'Fix the bug', 3),
  ('bugfix', 'Verify fix doesn''t break other functionality', 4),
  ('refactor', 'Ensure all tests pass before refactoring', 1),
  ('refactor', 'Refactor code incrementally', 2),
  ('refactor', 'Run tests after each change', 3),
  ('refactor', 'Update documentation if needed', 4)
ON CONFLICT (task_type, sequence_order) DO NOTHING;

-- 4. Update the comprehensive tracking view
DROP VIEW IF EXISTS work_summary_tracking_view;

CREATE OR REPLACE VIEW work_summary_tracking_view AS
SELECT 
  ws.id,
  ws.title,
  ws.summary_content,
  ws.work_date,
  ws.category,
  ws.worktree,
  ws.created_at,
  
  -- Dev task info
  dt.id as dev_task_id,
  dt.title as dev_task_title,
  dt.status as dev_task_status,
  dt.priority as dev_task_priority,
  
  -- Submission info
  dt.claude_submission_timestamp as submission_timestamp,
  dt.claude_submission_worktree as submission_worktree,
  dt.git_commit_current as git_commit,
  dt.worktree as git_branch,
  
  -- Validation info
  wsv.validated_at,
  wsv.validation_status,
  wsv.validation_summary,
  jsonb_array_length(wsv.issues) as issue_count,
  
  -- Test results
  tr.passed_count,
  tr.failed_count,
  tr.coverage_percentage,
  tr.report_url as test_report_url,
  
  -- Todo progress
  COUNT(DISTINCT wst.id) as total_todos,
  COUNT(DISTINCT wst.id) FILTER (WHERE wst.completed = true) as completed_todos,
  
  -- Follow-up tasks (using existing dev_follow_up_tasks table)
  COUNT(DISTINCT dft.id) as follow_up_count,
  COUNT(DISTINCT dft.id) FILTER (WHERE ft.status = 'completed') as completed_follow_ups,
  
  -- Computed fields
  CASE 
    WHEN dt.claude_submission_timestamp IS NOT NULL THEN true 
    ELSE false 
  END as has_submission,
  CASE 
    WHEN wsv.id IS NOT NULL THEN true 
    ELSE false 
  END as has_validation,
  CASE 
    WHEN tr.id IS NOT NULL THEN true 
    ELSE false 
  END as has_tests,
  CASE
    WHEN tr.failed_count > 0 THEN true
    WHEN wsv.validation_status = 'issues_found' THEN true
    WHEN COUNT(DISTINCT dft.id) > COUNT(DISTINCT dft.id) FILTER (WHERE ft.status = 'completed') THEN true
    ELSE false
  END as needs_action

FROM ai_work_summaries ws
LEFT JOIN dev_tasks dt ON ws.dev_task_id = dt.id
LEFT JOIN work_summary_validations wsv ON ws.id = wsv.work_summary_id
LEFT JOIN test_results tr ON ws.id = tr.work_summary_id
LEFT JOIN work_summary_todos wst ON ws.id = wst.work_summary_id
LEFT JOIN dev_follow_up_tasks dft ON dt.id = dft.original_task_id
LEFT JOIN dev_tasks ft ON dft.follow_up_task_id = ft.id
GROUP BY ws.id, dt.id, wsv.id, tr.id;

-- 5. Create enhanced functions
-- Function to create work summary with task linking
CREATE OR REPLACE FUNCTION create_work_summary_with_task_link(
  p_title TEXT,
  p_content TEXT,
  p_task_id UUID,
  p_worktree TEXT,
  p_git_commit TEXT,
  p_category TEXT DEFAULT 'feature'
) RETURNS UUID AS $$
DECLARE
  v_summary_id UUID;
  v_task_type TEXT;
BEGIN
  -- Create work summary
  INSERT INTO ai_work_summaries (
    title,
    summary_content,
    dev_task_id,
    worktree,
    category,
    created_at
  ) VALUES (
    p_title,
    p_content,
    p_task_id,
    p_worktree,
    p_category,
    NOW()
  ) RETURNING id INTO v_summary_id;
  
  -- Update task tracking
  UPDATE dev_tasks 
  SET 
    work_summary_count = COALESCE(work_summary_count, 0) + 1,
    last_work_summary_at = NOW(),
    git_commit_current = p_git_commit
  WHERE id = p_task_id;
  
  -- Determine task type based on category
  v_task_type := CASE 
    WHEN p_category = 'bug_fix' THEN 'bugfix'
    WHEN p_category = 'refactor' THEN 'refactor'
    ELSE 'feature'
  END;
  
  -- Create initial todos from template
  INSERT INTO work_summary_todos (work_summary_id, todo_text, sequence_order)
  SELECT v_summary_id, todo_text, sequence_order
  FROM task_todo_templates
  WHERE task_type = v_task_type AND is_active = true
  ORDER BY sequence_order;
  
  RETURN v_summary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a follow-up task (adapting to existing table structure)
CREATE OR REPLACE FUNCTION create_follow_up_task(
  p_parent_task_id UUID,
  p_title TEXT,
  p_follow_up_type TEXT,
  p_priority TEXT DEFAULT 'medium',
  p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_follow_up_id UUID;
BEGIN
  -- Create the follow-up task
  INSERT INTO dev_tasks (
    title,
    status,
    priority,
    description,
    parent_task_id,
    created_at
  ) VALUES (
    p_title,
    'created',
    p_priority,
    p_description,
    p_parent_task_id,
    NOW()
  ) RETURNING id INTO v_follow_up_id;
  
  -- Link to parent using existing dev_follow_up_tasks table
  INSERT INTO dev_follow_up_tasks (
    original_task_id,
    follow_up_task_id,
    follow_up_type,
    follow_up_summary
  ) VALUES (
    p_parent_task_id,
    v_follow_up_id,
    p_follow_up_type,
    p_description
  );
  
  RETURN v_follow_up_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Add RLS policies
ALTER TABLE work_summary_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_todo_templates ENABLE ROW LEVEL SECURITY;

-- Policies for work_summary_todos
CREATE POLICY "Allow authenticated read work_summary_todos" ON work_summary_todos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert work_summary_todos" ON work_summary_todos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update work_summary_todos" ON work_summary_todos
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Policies for task_todo_templates
CREATE POLICY "Allow all read task_todo_templates" ON task_todo_templates
  FOR SELECT USING (true);

CREATE POLICY "Service role full access task_todo_templates" ON task_todo_templates
  FOR ALL USING (auth.role() = 'service_role');

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE ON work_summary_todos TO authenticated;
GRANT SELECT ON task_todo_templates TO authenticated;
GRANT EXECUTE ON FUNCTION create_work_summary_with_task_link TO authenticated;
GRANT EXECUTE ON FUNCTION create_follow_up_task TO authenticated;

-- 8. Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
  ('public', 'work_summary_todos', 'Todo items associated with work summaries', 'Task checklist and progress tracking', CURRENT_DATE),
  ('public', 'task_todo_templates', 'Templates for auto-generating todos based on task type', 'Automated todo creation', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE work_summary_todos IS 'Tracks todo items associated with work summaries for progress monitoring';
COMMENT ON TABLE task_todo_templates IS 'Templates for automatically creating todos when work summaries are created';
COMMENT ON FUNCTION create_work_summary_with_task_link IS 'Creates a work summary linked to a dev task with automatic todo generation';
COMMENT ON FUNCTION create_follow_up_task IS 'Creates a follow-up task linked to a parent task';