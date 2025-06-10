-- Create table for storing test results
CREATE TABLE IF NOT EXISTS sys_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_suite_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'passed', 'failed', 'error')),
  duration_ms INTEGER,
  output TEXT,
  error_output TEXT,
  command TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_test_results_suite_id ON sys_test_results(test_suite_id);
CREATE INDEX idx_test_results_created_at ON sys_test_results(created_at DESC);
CREATE INDEX idx_test_results_status ON sys_test_results(status);

-- Create updated_at trigger
CREATE TRIGGER update_sys_test_results_updated_at
  BEFORE UPDATE ON sys_test_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE sys_test_results ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read test results
CREATE POLICY "Enable read access for all users" ON sys_test_results
  FOR SELECT USING (true);

-- Only allow authenticated users to insert results
CREATE POLICY "Enable insert for authenticated users only" ON sys_test_results
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only allow authenticated users to update results
CREATE POLICY "Enable update for authenticated users only" ON sys_test_results
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'sys_test_results', 'Test execution results and history', 'Stores results from test suite executions including output, duration, and status', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;