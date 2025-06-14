-- MIGRATION: create_sys_server_ports_registry
-- VERSION: 20250610000000
-- DESCRIPTION: Create server ports registry for dynamic port management and health monitoring

-- This table allows frontend apps to discover server ports at runtime
-- and provides health check status for each service

-- SECTION: tables
CREATE TABLE IF NOT EXISTS sys_server_ports_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  protocol TEXT DEFAULT 'http' CHECK (protocol IN ('http', 'https', 'ws', 'wss')),
  host TEXT DEFAULT 'localhost',
  port INTEGER NOT NULL CHECK (port > 0 AND port < 65536),
  base_path TEXT DEFAULT '',
  environment TEXT DEFAULT 'development' CHECK (environment IN ('development', 'staging', 'production')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  health_check_endpoint TEXT DEFAULT '/health',
  last_health_check TIMESTAMPTZ,
  last_health_status TEXT CHECK (last_health_status IN ('healthy', 'unhealthy', 'unknown')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SECTION: indexes
CREATE INDEX idx_sys_server_ports_registry_service_name ON sys_server_ports_registry(service_name);
CREATE INDEX idx_sys_server_ports_registry_environment ON sys_server_ports_registry(environment);
CREATE INDEX idx_sys_server_ports_registry_status ON sys_server_ports_registry(status);

-- SECTION: rls
ALTER TABLE sys_server_ports_registry ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Everyone can read active services
CREATE POLICY "Enable read access for active services" ON sys_server_ports_registry
  FOR SELECT USING (status = 'active');

-- Only authenticated users can update (for health checks)
CREATE POLICY "Enable update for authenticated users" ON sys_server_ports_registry
  FOR UPDATE USING (auth.role() = 'authenticated');

-- SECTION: custom
-- Insert default development services
INSERT INTO sys_server_ports_registry (service_name, display_name, description, port, environment) VALUES
  ('md-server', 'Markdown Server', 'Serves markdown documentation files', 3001, 'development'),
  ('script-server', 'Script Server', 'Serves script files for viewing', 3002, 'development'),
  ('docs-archive-server', 'Docs Archive Server', 'Serves archived documentation', 3003, 'development'),
  ('git-server', 'Git Server', 'Provides git repository information', 3005, 'development'),
  ('continuous-docs-server', 'Continuous Docs Server', 'Manages continuous documentation updates', 3008, 'development'),
  ('git-api-server', 'Git API Server', 'Executes git-related CLI commands', 3009, 'development')
ON CONFLICT (service_name) DO NOTHING;

-- SECTION: views
CREATE OR REPLACE VIEW sys_active_servers_view AS
SELECT 
  service_name,
  display_name,
  protocol || '://' || host || ':' || port || base_path as base_url,
  port,
  status,
  last_health_check,
  last_health_status
FROM sys_server_ports_registry
WHERE status = 'active'
  AND environment = COALESCE(current_setting('app.environment', true), 'development');

-- Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'sys_server_ports_registry', 'Dynamic server port registry for frontend service discovery', 'Allows UI components to discover backend service ports at runtime instead of hardcoding them', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- SECTION: functions
CREATE OR REPLACE FUNCTION update_sys_server_ports_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SECTION: triggers
CREATE TRIGGER update_sys_server_ports_registry_updated_at
  BEFORE UPDATE ON sys_server_ports_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_sys_server_ports_registry_updated_at();