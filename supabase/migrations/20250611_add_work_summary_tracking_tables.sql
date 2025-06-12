-- Add work summary tracking tables and fields
-- This migration enhances work summaries with full task lifecycle tracking

-- Add tracking fields to ai_work_summaries if they don't exist
ALTER TABLE ai_work_summaries 
ADD COLUMN IF NOT EXISTS dev_task_id UUID REFERENCES dev_tasks(id),
ADD COLUMN IF NOT EXISTS validation_status TEXT CHECK (validation_status IN ('pending', 'validated', 'failed', 'issues_found')),
ADD COLUMN IF NOT EXISTS has_tests BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS test_results_id UUID;

-- Create index for task lookups
CREATE INDEX IF NOT EXISTS idx_ai_work_summaries_dev_task_id ON ai_work_summaries(dev_task_id);

-- Create work summary validations table
CREATE TABLE IF NOT EXISTS work_summary_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_summary_id UUID REFERENCES ai_work_summaries(id) ON DELETE CASCADE,
  dev_task_id UUID REFERENCES dev_tasks(id),
  validated_at TIMESTAMPTZ DEFAULT NOW(),
  validation_status TEXT NOT NULL CHECK (validation_status IN ('pending', 'passed', 'failed', 'issues_found')),
  validation_summary TEXT,
  issues JSONB DEFAULT '[]',
  validator_type TEXT DEFAULT 'manual', -- 'manual', 'automated', 'ai_assisted'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create test results table for tracking test outcomes
CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dev_task_id UUID REFERENCES dev_tasks(id),
  work_summary_id UUID REFERENCES ai_work_summaries(id),
  test_suite_name TEXT,
  passed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  coverage_percentage DECIMAL(5,2),
  execution_time_ms INTEGER,
  report_url TEXT,
  test_output JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Git commit tracking is already in dev_tasks table (claude_submission_worktree, etc)

-- Create a view for work summary tracking dashboard
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
  
  -- Subtask progress (subtasks are tracked within dev_tasks table)
  0 as total_subtasks,
  0 as completed_subtasks,
  
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
    ELSE false
  END as needs_action

FROM ai_work_summaries ws
LEFT JOIN dev_tasks dt ON ws.dev_task_id = dt.id
LEFT JOIN work_summary_validations wsv ON ws.id = wsv.work_summary_id
LEFT JOIN test_results tr ON ws.id = tr.work_summary_id
GROUP BY ws.id, dt.id, wsv.id, tr.id;

-- Add RLS policies
ALTER TABLE work_summary_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read validation and test data
CREATE POLICY "Allow authenticated read work_summary_validations" ON work_summary_validations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read test_results" ON test_results
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can do everything
CREATE POLICY "Service role full access work_summary_validations" ON work_summary_validations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access test_results" ON test_results
  FOR ALL USING (auth.role() = 'service_role');

-- Add entries to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
  ('public', 'work_summary_validations', 'Tracks validation status and results for work summaries', 'Quality assurance and validation tracking', CURRENT_DATE),
  ('public', 'test_results', 'Stores test execution results linked to dev tasks and work summaries', 'Test outcome tracking and coverage monitoring', CURRENT_DATE),
  ('public', 'work_summary_tracking_view', 'Comprehensive view of work summary lifecycle tracking', 'Dashboard and reporting for work summary status', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Create function to get work summary tracking data
CREATE OR REPLACE FUNCTION get_work_summary_tracking(summary_id UUID)
RETURNS TABLE (
  dev_task_id UUID,
  dev_task_title TEXT,
  dev_task_status TEXT,
  submission_timestamp TIMESTAMPTZ,
  submission_worktree TEXT,
  git_commit TEXT,
  has_validation BOOLEAN,
  validation_status TEXT,
  validation_summary TEXT,
  issue_count INTEGER,
  has_tests BOOLEAN,
  test_passed INTEGER,
  test_failed INTEGER,
  test_coverage DECIMAL,
  subtask_total INTEGER,
  subtask_completed INTEGER,
  needs_action BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wstv.dev_task_id,
    wstv.dev_task_title,
    wstv.dev_task_status,
    wstv.submission_timestamp,
    wstv.submission_worktree,
    wstv.git_commit,
    wstv.has_validation,
    wstv.validation_status,
    wstv.validation_summary,
    wstv.issue_count,
    wstv.has_tests,
    wstv.passed_count,
    wstv.failed_count,
    wstv.coverage_percentage,
    wstv.total_subtasks,
    wstv.completed_subtasks,
    wstv.needs_action
  FROM work_summary_tracking_view wstv
  WHERE wstv.id = summary_id;
END;
$$ LANGUAGE plpgsql;