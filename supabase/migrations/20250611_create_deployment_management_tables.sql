-- Create deployment management tables
-- These tables track deployment runs, validations, and history

-- Create deployment_runs table to track all deployments
CREATE TABLE IF NOT EXISTS deployment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id TEXT UNIQUE NOT NULL,
  branch_from TEXT NOT NULL,
  branch_to TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'validating', 'deploying', 'completed', 'failed', 'rolled_back')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deployment_type TEXT NOT NULL CHECK (deployment_type IN ('staging', 'production')),
  commit_hash TEXT,
  deployment_url TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create deployment_validations table to track validation steps
CREATE TABLE IF NOT EXISTS deployment_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_run_id UUID REFERENCES deployment_runs(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL CHECK (validation_type IN ('typescript', 'dependencies', 'env', 'tests', 'build')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'passed', 'failed', 'skipped')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  details JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create deployment_rollbacks table to track rollback operations
CREATE TABLE IF NOT EXISTS deployment_rollbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_run_id UUID REFERENCES deployment_runs(id),
  rollback_from_commit TEXT NOT NULL,
  rollback_to_commit TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('initiated', 'in_progress', 'completed', 'failed')),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create deployment_health_checks table
CREATE TABLE IF NOT EXISTS deployment_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_run_id UUID REFERENCES deployment_runs(id),
  check_type TEXT NOT NULL,
  endpoint TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'healthy', 'unhealthy', 'timeout')),
  response_time_ms INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_deployment_runs_status ON deployment_runs(status);
CREATE INDEX idx_deployment_runs_created_at ON deployment_runs(created_at DESC);
CREATE INDEX idx_deployment_validations_deployment_run_id ON deployment_validations(deployment_run_id);
CREATE INDEX idx_deployment_validations_status ON deployment_validations(status);
CREATE INDEX idx_deployment_rollbacks_deployment_run_id ON deployment_rollbacks(deployment_run_id);
CREATE INDEX idx_deployment_health_checks_deployment_run_id ON deployment_health_checks(deployment_run_id);

-- Create updated_at trigger for deployment_runs
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deployment_runs_updated_at 
BEFORE UPDATE ON deployment_runs 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Create views for easier querying
CREATE OR REPLACE VIEW deployment_status_view AS
SELECT 
    dr.id,
    dr.deployment_id,
    dr.branch_from,
    dr.branch_to,
    dr.status,
    dr.deployment_type,
    dr.started_at,
    dr.completed_at,
    dr.commit_hash,
    dr.deployment_url,
    dr.error_message,
    EXTRACT(EPOCH FROM (COALESCE(dr.completed_at, NOW()) - dr.started_at))::INTEGER as duration_seconds,
    COUNT(DISTINCT dv.id) as validation_count,
    COUNT(DISTINCT dv.id) FILTER (WHERE dv.status = 'passed') as validations_passed,
    COUNT(DISTINCT dv.id) FILTER (WHERE dv.status = 'failed') as validations_failed,
    COUNT(DISTINCT dhc.id) as health_check_count,
    COUNT(DISTINCT dhc.id) FILTER (WHERE dhc.status = 'healthy') as health_checks_passed
FROM deployment_runs dr
LEFT JOIN deployment_validations dv ON dr.id = dv.deployment_run_id
LEFT JOIN deployment_health_checks dhc ON dr.id = dhc.deployment_run_id
GROUP BY dr.id;

-- Create view for latest deployment per type
CREATE OR REPLACE VIEW latest_deployments_view AS
SELECT DISTINCT ON (deployment_type)
    *
FROM deployment_runs
WHERE status = 'completed'
ORDER BY deployment_type, created_at DESC;

-- Add RLS policies
ALTER TABLE deployment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_rollbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_health_checks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read deployment data
CREATE POLICY "Allow authenticated read deployment_runs" ON deployment_runs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read deployment_validations" ON deployment_validations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read deployment_rollbacks" ON deployment_rollbacks
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read deployment_health_checks" ON deployment_health_checks
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can do everything
CREATE POLICY "Service role full access deployment_runs" ON deployment_runs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access deployment_validations" ON deployment_validations
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access deployment_rollbacks" ON deployment_rollbacks
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access deployment_health_checks" ON deployment_health_checks
    FOR ALL USING (auth.role() = 'service_role');

-- Add entries to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'deployment_runs', 'Tracks all deployment operations from development to production', 'Deployment management and history', CURRENT_DATE),
    ('public', 'deployment_validations', 'Tracks validation steps for each deployment', 'Pre-deployment validation tracking', CURRENT_DATE),
    ('public', 'deployment_rollbacks', 'Records rollback operations and their status', 'Deployment rollback tracking', CURRENT_DATE),
    ('public', 'deployment_health_checks', 'Post-deployment health check results', 'Production health monitoring', CURRENT_DATE),
    ('public', 'deployment_status_view', 'Aggregated view of deployment status with validation counts', 'Deployment dashboard data', CURRENT_DATE),
    ('public', 'latest_deployments_view', 'Shows the most recent successful deployment per type', 'Current deployment state', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;