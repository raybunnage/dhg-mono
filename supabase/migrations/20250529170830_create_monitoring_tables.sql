-- Create continuous monitoring system tables

-- Main monitoring runs table
CREATE TABLE IF NOT EXISTS sys_monitoring_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_path TEXT NOT NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('manual', 'scheduled', 'watch')),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  findings JSONB NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT -- CLI user or 'system' for automated runs
);

-- Individual findings for detailed tracking
CREATE TABLE IF NOT EXISTS sys_monitoring_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES sys_monitoring_runs(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error')),
  file_path TEXT NOT NULL,
  line_number INTEGER,
  description TEXT NOT NULL,
  suggestion TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Metrics tracking over time
CREATE TABLE IF NOT EXISTS sys_monitoring_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_path TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Monitoring configurations
CREATE TABLE IF NOT EXISTS sys_monitoring_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  folder_path TEXT NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitoring_runs_folder ON sys_monitoring_runs(folder_path);
CREATE INDEX IF NOT EXISTS idx_monitoring_runs_status ON sys_monitoring_runs(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_findings_type ON sys_monitoring_findings(finding_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_folder ON sys_monitoring_metrics(folder_path);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_type ON sys_monitoring_metrics(metric_type);

-- Add update trigger for monitoring_configs
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_monitoring_configs_updated_at
    BEFORE UPDATE ON sys_monitoring_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON sys_monitoring_runs TO authenticated;
GRANT SELECT, INSERT ON sys_monitoring_findings TO authenticated;
GRANT SELECT, INSERT ON sys_monitoring_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON sys_monitoring_configs TO authenticated;

-- Add RLS policies (permissive for now, can be tightened later)
ALTER TABLE sys_monitoring_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_monitoring_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_monitoring_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_monitoring_configs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write monitoring data
CREATE POLICY "Allow all for monitoring_runs" ON sys_monitoring_runs
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for monitoring_findings" ON sys_monitoring_findings
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for monitoring_metrics" ON sys_monitoring_metrics
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for monitoring_configs" ON sys_monitoring_configs
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);