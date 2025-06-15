-- Create continuous improvement scenarios tracking tables
-- This migration creates tables to track available scenarios and their execution history

-- Create scenarios registry table
CREATE TABLE IF NOT EXISTS sys_continuous_improvement_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    status TEXT NOT NULL DEFAULT 'planned', -- planned, documented, automated
    documentation_path TEXT,
    script_path TEXT,
    complexity TEXT CHECK (complexity IN ('simple', 'medium', 'complex')),
    estimated_minutes INTEGER,
    steps_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create scenario execution history table
CREATE TABLE IF NOT EXISTS sys_continuous_improvement_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id TEXT NOT NULL REFERENCES sys_continuous_improvement_scenarios(scenario_id),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_by TEXT,
    parameters JSONB,
    success BOOLEAN NOT NULL DEFAULT false,
    duration_seconds INTEGER,
    error_message TEXT,
    output_summary TEXT,
    changes_made JSONB, -- Track what files/configs were modified
    git_commit TEXT
);

-- Create scenario steps table (for detailed tracking)
CREATE TABLE IF NOT EXISTS sys_continuous_improvement_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id TEXT NOT NULL REFERENCES sys_continuous_improvement_scenarios(scenario_id),
    step_number INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    step_type TEXT NOT NULL, -- manual, automated, validation
    description TEXT,
    file_path TEXT,
    code_snippet TEXT,
    is_automated BOOLEAN DEFAULT false,
    UNIQUE(scenario_id, step_number)
);

-- Insert the first scenario
INSERT INTO sys_continuous_improvement_scenarios (
    scenario_id,
    name,
    description,
    category,
    status,
    documentation_path,
    script_path,
    complexity,
    estimated_minutes,
    steps_count
) VALUES (
    'add-new-proxy-server',
    'Add New Proxy Server',
    'Comprehensive process for adding a new proxy server to the DHG monorepo infrastructure. Proxy servers provide HTTP endpoints for UI apps to interact with backend processes, file systems, and external services.',
    'Infrastructure',
    'automated',
    'docs/continuous-improvement/scenarios/add-new-proxy-server.md',
    'scripts/cli-pipeline/continuous/scenarios/add-new-proxy-server.ts',
    'medium',
    45,
    8
);

-- Insert steps for the add-new-proxy-server scenario
INSERT INTO sys_continuous_improvement_steps (scenario_id, step_number, step_name, step_type, description, file_path, is_automated) VALUES
('add-new-proxy-server', 1, 'Reserve Port Number', 'automated', 'Update CLAUDE.md Port Registry with new port reservation', 'CLAUDE.md', true),
('add-new-proxy-server', 2, 'Create Proxy Server Script', 'automated', 'Generate proxy server TypeScript file from template', 'scripts/cli-pipeline/proxy/start-{name}-proxy.ts', true),
('add-new-proxy-server', 3, 'Update package.json', 'automated', 'Add new script to run the proxy server', 'package.json', true),
('add-new-proxy-server', 4, 'Update start-all-proxy-servers.ts', 'automated', 'Add proxy to the automated startup list', 'scripts/cli-pipeline/proxy/start-all-proxy-servers.ts', true),
('add-new-proxy-server', 5, 'Create Database Migration', 'automated', 'Generate migration to add entry to sys_server_ports_registry', 'supabase/migrations/{timestamp}_add_{name}_proxy_port.sql', true),
('add-new-proxy-server', 6, 'Update proxy-server-health.test.ts', 'automated', 'Add health check test for new proxy', 'packages/shared/services/proxy-server/__tests__/proxy-server-health.test.ts', true),
('add-new-proxy-server', 7, 'Run Database Migration', 'manual', 'Execute the migration to update the database', NULL, false),
('add-new-proxy-server', 8, 'Test & Validate', 'validation', 'Start proxy and verify health endpoint responds correctly', NULL, false);

-- Create indexes for performance
CREATE INDEX idx_scenarios_category ON sys_continuous_improvement_scenarios(category);
CREATE INDEX idx_scenarios_status ON sys_continuous_improvement_scenarios(status);
CREATE INDEX idx_executions_scenario ON sys_continuous_improvement_executions(scenario_id);
CREATE INDEX idx_executions_date ON sys_continuous_improvement_executions(executed_at);
CREATE INDEX idx_steps_scenario ON sys_continuous_improvement_steps(scenario_id);

-- Add helpful comments
COMMENT ON TABLE sys_continuous_improvement_scenarios IS 'Registry of all continuous improvement scenarios with documentation and automation status';
COMMENT ON TABLE sys_continuous_improvement_executions IS 'History of scenario executions including success/failure and changes made';
COMMENT ON TABLE sys_continuous_improvement_steps IS 'Detailed breakdown of steps for each scenario to track automation progress';

-- Create a view for easy scenario overview
CREATE OR REPLACE VIEW sys_continuous_improvement_overview_view AS
SELECT 
    s.scenario_id,
    s.name,
    s.category,
    s.status,
    s.complexity,
    s.estimated_minutes,
    s.steps_count,
    COUNT(DISTINCT e.id) as execution_count,
    COUNT(DISTINCT e.id) FILTER (WHERE e.success = true) as successful_executions,
    MAX(e.executed_at) as last_executed,
    COUNT(DISTINCT st.id) FILTER (WHERE st.is_automated = true) as automated_steps_count,
    ROUND(COUNT(DISTINCT st.id) FILTER (WHERE st.is_automated = true)::numeric / NULLIF(s.steps_count, 0) * 100, 0) as automation_percentage
FROM sys_continuous_improvement_scenarios s
LEFT JOIN sys_continuous_improvement_executions e ON s.scenario_id = e.scenario_id
LEFT JOIN sys_continuous_improvement_steps st ON s.scenario_id = st.scenario_id
GROUP BY s.scenario_id, s.name, s.category, s.status, s.complexity, s.estimated_minutes, s.steps_count;

-- Grant permissions
GRANT SELECT ON sys_continuous_improvement_scenarios TO authenticated;
GRANT SELECT ON sys_continuous_improvement_executions TO authenticated;
GRANT SELECT ON sys_continuous_improvement_steps TO authenticated;
GRANT SELECT ON sys_continuous_improvement_overview_view TO authenticated;

GRANT INSERT, UPDATE ON sys_continuous_improvement_executions TO authenticated;