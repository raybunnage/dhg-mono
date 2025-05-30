-- Drop continuous monitoring system tables

-- Drop policies
DROP POLICY IF EXISTS "Allow all for monitoring_runs" ON sys_monitoring_runs;
DROP POLICY IF EXISTS "Allow all for monitoring_findings" ON sys_monitoring_findings;
DROP POLICY IF EXISTS "Allow all for monitoring_metrics" ON sys_monitoring_metrics;
DROP POLICY IF EXISTS "Allow all for monitoring_configs" ON sys_monitoring_configs;

-- Drop trigger
DROP TRIGGER IF EXISTS update_monitoring_configs_updated_at ON sys_monitoring_configs;
DROP FUNCTION IF EXISTS update_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_monitoring_runs_folder;
DROP INDEX IF EXISTS idx_monitoring_runs_status;
DROP INDEX IF EXISTS idx_monitoring_findings_type;
DROP INDEX IF EXISTS idx_monitoring_metrics_folder;
DROP INDEX IF EXISTS idx_monitoring_metrics_type;

-- Drop tables in reverse order due to foreign key constraints
DROP TABLE IF EXISTS sys_monitoring_configs;
DROP TABLE IF EXISTS sys_monitoring_metrics;
DROP TABLE IF EXISTS sys_monitoring_findings;
DROP TABLE IF EXISTS sys_monitoring_runs;