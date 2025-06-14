-- Migration: Add CLI Pipeline Test Tracking
-- Description: Add test result tracking and coverage reporting for CLI pipelines
-- Created: 2025-06-11

-- Create test results table
CREATE TABLE IF NOT EXISTS cli_pipeline_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES command_pipelines(id) ON DELETE CASCADE,
  command_id UUID REFERENCES command_definitions(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL CHECK (test_type IN ('existence', 'usage', 'integration', 'unit')),
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
  details JSONB DEFAULT '{}',
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add test tracking columns to command_pipelines
ALTER TABLE command_pipelines 
ADD COLUMN IF NOT EXISTS test_coverage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_test_run TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS test_status TEXT CHECK (test_status IN ('passed', 'failed', 'partial', 'untested'));

-- Add test tracking columns to command_definitions
ALTER TABLE command_definitions
ADD COLUMN IF NOT EXISTS has_tests BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS test_coverage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_test_run TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_results_pipeline_id ON cli_pipeline_test_results(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_test_results_command_id ON cli_pipeline_test_results(command_id);
CREATE INDEX IF NOT EXISTS idx_test_results_executed_at ON cli_pipeline_test_results(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON cli_pipeline_test_results(status);

-- Create view for pipeline test summary
CREATE OR REPLACE VIEW command_pipeline_test_summary_view AS
SELECT 
  cp.id,
  cp.name as pipeline_name,
  cp.display_name,
  cp.test_status,
  cp.test_coverage,
  cp.last_test_run,
  COUNT(DISTINCT cd.id) as total_commands,
  COUNT(DISTINCT cd.id) FILTER (WHERE cd.has_tests = true) as commands_with_tests,
  COUNT(DISTINCT tr.id) FILTER (WHERE tr.status = 'passed') as passed_tests,
  COUNT(DISTINCT tr.id) FILTER (WHERE tr.status = 'failed') as failed_tests,
  MAX(tr.executed_at) as most_recent_test
FROM command_pipelines cp
LEFT JOIN command_definitions cd ON cd.pipeline_id = cp.id
LEFT JOIN cli_pipeline_test_results tr ON tr.pipeline_id = cp.id
GROUP BY cp.id, cp.name, cp.display_name, cp.test_status, cp.test_coverage, cp.last_test_run;

-- Create function to update test coverage
CREATE OR REPLACE FUNCTION update_pipeline_test_coverage(p_pipeline_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_commands INTEGER;
  v_tested_commands INTEGER;
  v_coverage DECIMAL(5,2);
  v_status TEXT;
BEGIN
  -- Get total commands
  SELECT COUNT(*) INTO v_total_commands
  FROM command_definitions
  WHERE pipeline_id = p_pipeline_id;
  
  -- Get tested commands (have at least one test result)
  SELECT COUNT(DISTINCT command_id) INTO v_tested_commands
  FROM cli_pipeline_test_results
  WHERE pipeline_id = p_pipeline_id;
  
  -- Calculate coverage
  IF v_total_commands > 0 THEN
    v_coverage := (v_tested_commands::DECIMAL / v_total_commands) * 100;
  ELSE
    v_coverage := 0;
  END IF;
  
  -- Determine status
  IF v_coverage = 100 THEN
    v_status := 'passed';
  ELSIF v_coverage >= 80 THEN
    v_status := 'partial';
  ELSIF v_coverage > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'untested';
  END IF;
  
  -- Update pipeline
  UPDATE command_pipelines
  SET 
    test_coverage = v_coverage,
    test_status = v_status,
    last_test_run = NOW(),
    updated_at = NOW()
  WHERE id = p_pipeline_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update coverage after test results
CREATE OR REPLACE FUNCTION trigger_update_test_coverage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update pipeline coverage
  PERFORM update_pipeline_test_coverage(NEW.pipeline_id);
  
  -- Update command has_tests flag
  IF NEW.command_id IS NOT NULL THEN
    UPDATE command_definitions
    SET 
      has_tests = TRUE,
      last_test_run = NEW.executed_at,
      updated_at = NOW()
    WHERE id = NEW.command_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_test_coverage_after_insert
AFTER INSERT ON cli_pipeline_test_results
FOR EACH ROW
EXECUTE FUNCTION trigger_update_test_coverage();

-- Add RLS policies
ALTER TABLE cli_pipeline_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON cli_pipeline_test_results
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON cli_pipeline_test_results
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON cli_pipeline_test_results
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Insert initial test data for demonstration
-- This shows untested pipelines
UPDATE command_pipelines
SET test_status = 'untested'
WHERE test_status IS NULL;

-- Add comment
COMMENT ON TABLE cli_pipeline_test_results IS 'Stores test results for CLI pipeline commands';
COMMENT ON COLUMN cli_pipeline_test_results.test_type IS 'Type of test: existence, usage, integration, unit';
COMMENT ON COLUMN cli_pipeline_test_results.status IS 'Test result status: passed, failed, skipped, error';
COMMENT ON COLUMN command_pipelines.test_coverage IS 'Percentage of commands that have been tested';
COMMENT ON COLUMN command_pipelines.test_status IS 'Overall test status: passed, failed, partial, untested';