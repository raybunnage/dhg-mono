-- Create service testing infrastructure tables
-- Migration: 20250610_create_service_testing_tables.sql

-- Test execution tracking
CREATE TABLE sys_service_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('unit', 'integration', 'contract')),
  status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed', 'skipped')),
  execution_time_ms INTEGER,
  error_message TEXT,
  test_details JSONB,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint (will be added after we ensure sys_shared_services has the right structure)
-- ALTER TABLE sys_service_test_runs 
-- ADD CONSTRAINT fk_service_test_runs_service 
-- FOREIGN KEY (service_name) REFERENCES sys_shared_services(service_name);

-- Test result aggregation view
CREATE VIEW sys_service_test_health_view AS
SELECT 
  s.service_name,
  s.category,
  s.used_by_apps,
  s.used_by_pipelines,
  COUNT(tr.id) as total_runs,
  COUNT(CASE WHEN tr.status = 'passed' THEN 1 END) as passed_runs,
  COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failed_runs,
  AVG(tr.execution_time_ms) as avg_execution_time,
  MAX(tr.executed_at) as last_test_run,
  CASE 
    WHEN COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) = 0 THEN 'healthy'
    WHEN COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) <= 2 THEN 'warning'
    ELSE 'critical'
  END as health_status,
  CASE 
    WHEN array_length(s.used_by_apps, 1) >= 5 THEN 'critical'
    WHEN array_length(s.used_by_apps, 1) >= 2 THEN 'important'
    ELSE 'standard'
  END as test_priority
FROM sys_shared_services s
LEFT JOIN sys_service_test_runs tr ON tr.service_name = s.service_name
WHERE s.status = 'active'
  AND (tr.executed_at > NOW() - INTERVAL '7 days' OR tr.executed_at IS NULL)
GROUP BY s.service_name, s.category, s.used_by_apps, s.used_by_pipelines;

-- Enhanced service registry view for test planning
CREATE VIEW sys_service_testing_view AS
SELECT 
  ss.service_name,
  ss.category,
  ss.used_by_apps,
  ss.used_by_pipelines,
  ss.last_validated,
  ss.status,
  CASE 
    WHEN array_length(ss.used_by_apps, 1) >= 5 THEN 'critical'
    WHEN array_length(ss.used_by_apps, 1) >= 2 THEN 'important'
    ELSE 'standard'
  END as test_priority,
  COALESCE(array_length(ss.used_by_apps, 1), 0) + 
  COALESCE(array_length(ss.used_by_pipelines, 1), 0) as total_usage_count
FROM sys_shared_services ss
WHERE ss.status = 'active'
ORDER BY test_priority DESC, total_usage_count DESC, ss.service_name;

-- RLS policies for test tables
ALTER TABLE sys_service_test_runs ENABLE ROW LEVEL SECURITY;

-- Allow read access for all authenticated users
CREATE POLICY "Enable read access for authenticated users" ON sys_service_test_runs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow insert/update for authenticated users (test runners)
CREATE POLICY "Enable insert for authenticated users" ON sys_service_test_runs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON sys_service_test_runs
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Add indexes for performance
CREATE INDEX idx_service_test_runs_service_name ON sys_service_test_runs(service_name);
CREATE INDEX idx_service_test_runs_status ON sys_service_test_runs(status);
CREATE INDEX idx_service_test_runs_executed_at ON sys_service_test_runs(executed_at);
CREATE INDEX idx_service_test_runs_test_type ON sys_service_test_runs(test_type);

-- Add table to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
  ('public', 'sys_service_test_runs', 'Tracks execution results of shared service tests', 'Testing infrastructure for monitoring service reliability', CURRENT_DATE),
  ('public', 'sys_service_test_health_view', 'Aggregated view of service test health and performance', 'Testing dashboard and monitoring', CURRENT_DATE),
  ('public', 'sys_service_testing_view', 'Enhanced service registry for test planning and prioritization', 'Test orchestration and planning', CURRENT_DATE);