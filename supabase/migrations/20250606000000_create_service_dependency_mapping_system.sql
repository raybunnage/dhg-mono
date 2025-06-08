-- Migration: Create Service Dependency Mapping System
-- Description: Comprehensive tracking of relationships between apps, CLI pipelines, commands, and shared services
-- Author: Claude Code Assistant
-- Date: 2025-06-06

-- SECTION: extensions
-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SECTION: tables

-- 1. Services Registry
-- Catalog of all shared services in the monorepo
CREATE TABLE registry_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  package_path TEXT NOT NULL, -- e.g., 'packages/shared/services/supabase-client'
  service_file VARCHAR(255), -- e.g., 'supabase-client-service.ts'
  service_type VARCHAR(100) NOT NULL, -- 'singleton', 'adapter', 'utility', 'helper'
  export_type VARCHAR(100), -- 'class', 'function', 'object', 'constant'
  is_singleton BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'deprecated', 'archived'
  version VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Apps Registry  
-- Registry of all applications in the monorepo
CREATE TABLE registry_apps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  app_path TEXT NOT NULL, -- e.g., 'apps/dhg-hub'
  app_type VARCHAR(100) NOT NULL, -- 'vite-app', 'node-service', 'cli-tool'
  framework VARCHAR(100), -- 'react', 'node', 'express'
  package_manager VARCHAR(50) DEFAULT 'pnpm',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLI Pipelines Registry
-- Registry of all CLI pipelines
CREATE TABLE registry_cli_pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  pipeline_path TEXT NOT NULL, -- e.g., 'scripts/cli-pipeline/database'
  main_script VARCHAR(255), -- e.g., 'database-cli.sh'
  domain VARCHAR(100), -- 'database', 'google_sync', 'ai', etc.
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CLI Commands Registry
-- Registry of individual commands within CLI pipelines
CREATE TABLE registry_cli_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID REFERENCES registry_cli_pipelines(id) ON DELETE CASCADE,
  command_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  command_script VARCHAR(255), -- e.g., 'connection-test.ts'
  command_type VARCHAR(100), -- 'typescript', 'bash', 'node'
  is_primary BOOLEAN DEFAULT false, -- Main commands vs helper commands
  usage_frequency INTEGER DEFAULT 0, -- From command tracking
  success_rate DECIMAL(5,2), -- From command tracking
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pipeline_id, command_name)
);

-- 5. App Service Dependencies
-- Maps applications to the services they use
CREATE TABLE service_app_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID REFERENCES registry_apps(id) ON DELETE CASCADE,
  service_id UUID REFERENCES registry_services(id) ON DELETE CASCADE,
  dependency_type VARCHAR(100) NOT NULL, -- 'direct-import', 'adapter-usage', 'singleton-call'
  import_path TEXT, -- How it's imported, e.g., '@shared/services/supabase-client'
  usage_context TEXT, -- Where/how it's used
  usage_frequency VARCHAR(50), -- 'high', 'medium', 'low', 'occasional'
  is_critical BOOLEAN DEFAULT false, -- Is this a critical dependency?
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(app_id, service_id)
);

-- 6. Pipeline Service Dependencies
-- Maps CLI pipelines to the services they use
CREATE TABLE service_pipeline_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID REFERENCES registry_cli_pipelines(id) ON DELETE CASCADE,
  service_id UUID REFERENCES registry_services(id) ON DELETE CASCADE,
  dependency_type VARCHAR(100) NOT NULL,
  import_path TEXT,
  usage_context TEXT,
  usage_frequency VARCHAR(50),
  is_critical BOOLEAN DEFAULT false,
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(pipeline_id, service_id)
);

-- 7. Command Service Dependencies
-- Maps individual CLI commands to specific services (most granular level)
CREATE TABLE service_command_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  command_id UUID REFERENCES registry_cli_commands(id) ON DELETE CASCADE,
  service_id UUID REFERENCES registry_services(id) ON DELETE CASCADE,
  dependency_type VARCHAR(100) NOT NULL,
  import_path TEXT,
  usage_context TEXT, -- Specific function calls, etc.
  is_critical BOOLEAN DEFAULT false,
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(command_id, service_id)
);

-- 8. Service Exports
-- Track what each service exports (for comprehensive dependency analysis)
CREATE TABLE service_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID REFERENCES registry_services(id) ON DELETE CASCADE,
  export_name VARCHAR(255) NOT NULL,
  export_type VARCHAR(100), -- 'function', 'class', 'constant', 'type'
  is_default BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, export_name)
);

-- 9. Dependency Analysis Runs
-- Track when dependency analysis was last run
CREATE TABLE service_dependency_analysis_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_type VARCHAR(100) NOT NULL, -- 'full-scan', 'incremental', 'manual'
  target_type VARCHAR(100), -- 'apps', 'pipelines', 'services', 'all'
  items_scanned INTEGER,
  dependencies_found INTEGER,
  errors_encountered INTEGER,
  run_duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
  notes TEXT
);

-- SECTION: indexes
-- Create indexes for better query performance

-- Services registry indexes
CREATE INDEX idx_registry_services_service_type ON registry_services(service_type);
CREATE INDEX idx_registry_services_status ON registry_services(status);
CREATE INDEX idx_registry_services_package_path ON registry_services(package_path);

-- Apps registry indexes  
CREATE INDEX idx_registry_apps_app_type ON registry_apps(app_type);
CREATE INDEX idx_registry_apps_status ON registry_apps(status);
CREATE INDEX idx_registry_apps_framework ON registry_apps(framework);

-- CLI pipelines registry indexes
CREATE INDEX idx_registry_cli_pipelines_domain ON registry_cli_pipelines(domain);
CREATE INDEX idx_registry_cli_pipelines_status ON registry_cli_pipelines(status);

-- CLI commands registry indexes
CREATE INDEX idx_registry_cli_commands_pipeline_id ON registry_cli_commands(pipeline_id);
CREATE INDEX idx_registry_cli_commands_command_type ON registry_cli_commands(command_type);
CREATE INDEX idx_registry_cli_commands_is_primary ON registry_cli_commands(is_primary);
CREATE INDEX idx_registry_cli_commands_status ON registry_cli_commands(status);

-- Dependencies indexes
CREATE INDEX idx_service_app_dependencies_app_id ON service_app_dependencies(app_id);
CREATE INDEX idx_service_app_dependencies_service_id ON service_app_dependencies(service_id);
CREATE INDEX idx_service_app_dependencies_dependency_type ON service_app_dependencies(dependency_type);
CREATE INDEX idx_service_app_dependencies_is_critical ON service_app_dependencies(is_critical);

CREATE INDEX idx_service_pipeline_dependencies_pipeline_id ON service_pipeline_dependencies(pipeline_id);
CREATE INDEX idx_service_pipeline_dependencies_service_id ON service_pipeline_dependencies(service_id);
CREATE INDEX idx_service_pipeline_dependencies_dependency_type ON service_pipeline_dependencies(dependency_type);

CREATE INDEX idx_service_command_dependencies_command_id ON service_command_dependencies(command_id);
CREATE INDEX idx_service_command_dependencies_service_id ON service_command_dependencies(service_id);
CREATE INDEX idx_service_command_dependencies_dependency_type ON service_command_dependencies(dependency_type);

-- Service exports indexes
CREATE INDEX idx_service_exports_service_id ON service_exports(service_id);
CREATE INDEX idx_service_exports_export_type ON service_exports(export_type);
CREATE INDEX idx_service_exports_is_default ON service_exports(is_default);

-- Analysis runs indexes
CREATE INDEX idx_service_dependency_analysis_runs_run_type ON service_dependency_analysis_runs(run_type);
CREATE INDEX idx_service_dependency_analysis_runs_status ON service_dependency_analysis_runs(status);
CREATE INDEX idx_service_dependency_analysis_runs_started_at ON service_dependency_analysis_runs(started_at);

-- SECTION: triggers
-- Create updated_at triggers for timestamp maintenance

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_registry_services_updated_at 
    BEFORE UPDATE ON registry_services 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registry_apps_updated_at 
    BEFORE UPDATE ON registry_apps 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registry_cli_pipelines_updated_at 
    BEFORE UPDATE ON registry_cli_pipelines 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registry_cli_commands_updated_at 
    BEFORE UPDATE ON registry_cli_commands 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- SECTION: functions
-- Helper functions for common operations

-- Function to get service dependencies for an app
CREATE OR REPLACE FUNCTION get_app_service_dependencies(app_name_param TEXT)
RETURNS TABLE (
    service_name TEXT,
    display_name TEXT,
    dependency_type TEXT,
    usage_frequency TEXT,
    is_critical BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.service_name::TEXT,
        sr.display_name::TEXT,
        asd.dependency_type::TEXT,
        asd.usage_frequency::TEXT,
        asd.is_critical
    FROM service_app_dependencies asd
    JOIN registry_apps ar ON asd.app_id = ar.id
    JOIN registry_services sr ON asd.service_id = sr.id
    WHERE ar.app_name = app_name_param
    ORDER BY asd.is_critical DESC, sr.service_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get apps using a specific service
CREATE OR REPLACE FUNCTION get_service_usage_by_apps(service_name_param TEXT)
RETURNS TABLE (
    app_name TEXT,
    display_name TEXT,
    dependency_type TEXT,
    usage_frequency TEXT,
    is_critical BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ar.app_name::TEXT,
        ar.display_name::TEXT,
        asd.dependency_type::TEXT,
        asd.usage_frequency::TEXT,
        asd.is_critical
    FROM service_app_dependencies asd
    JOIN registry_apps ar ON asd.app_id = ar.id
    JOIN registry_services sr ON asd.service_id = sr.id
    WHERE sr.service_name = service_name_param
    ORDER BY asd.is_critical DESC, ar.app_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get pipeline dependencies summary
CREATE OR REPLACE FUNCTION get_pipeline_dependencies_summary()
RETURNS TABLE (
    pipeline_name TEXT,
    domain TEXT,
    service_count BIGINT,
    critical_dependencies BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cpr.pipeline_name::TEXT,
        cpr.domain::TEXT,
        COUNT(psd.service_id) as service_count,
        COUNT(CASE WHEN psd.is_critical THEN 1 END) as critical_dependencies
    FROM registry_cli_pipelines cpr
    LEFT JOIN service_pipeline_dependencies psd ON cpr.id = psd.pipeline_id
    GROUP BY cpr.id, cpr.pipeline_name, cpr.domain
    ORDER BY critical_dependencies DESC, service_count DESC;
END;
$$ LANGUAGE plpgsql;

-- SECTION: rls
-- Enable Row Level Security (following project patterns)

ALTER TABLE registry_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_cli_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_cli_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_app_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_pipeline_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_command_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_dependency_analysis_runs ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for all tables (following project patterns)
CREATE POLICY "Enable read access for all users" ON registry_services
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON registry_services
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON registry_services
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON registry_services
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON registry_apps
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON registry_apps
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON registry_apps
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON registry_apps
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON registry_cli_pipelines
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON registry_cli_pipelines
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON registry_cli_pipelines
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON registry_cli_pipelines
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON registry_cli_commands
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON registry_cli_commands
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON registry_cli_commands
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON registry_cli_commands
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON service_app_dependencies
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON service_app_dependencies
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON service_app_dependencies
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON service_app_dependencies
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON service_pipeline_dependencies
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON service_pipeline_dependencies
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON service_pipeline_dependencies
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON service_pipeline_dependencies
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON service_command_dependencies
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON service_command_dependencies
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON service_command_dependencies
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON service_command_dependencies
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON service_exports
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON service_exports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON service_exports
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON service_exports
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users" ON service_dependency_analysis_runs
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON service_dependency_analysis_runs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON service_dependency_analysis_runs
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON service_dependency_analysis_runs
    FOR DELETE USING (auth.role() = 'authenticated');

-- SECTION: comments
-- Add table comments for documentation

COMMENT ON TABLE registry_services IS 'Registry of all shared services in the monorepo with metadata and versioning';
COMMENT ON TABLE registry_apps IS 'Registry of all applications in the monorepo with type and framework information';
COMMENT ON TABLE registry_cli_pipelines IS 'Registry of all CLI pipelines with domain classification';
COMMENT ON TABLE registry_cli_commands IS 'Registry of individual commands within CLI pipelines with usage statistics';
COMMENT ON TABLE service_app_dependencies IS 'Mapping of applications to shared services they depend on';
COMMENT ON TABLE service_pipeline_dependencies IS 'Mapping of CLI pipelines to shared services they depend on';
COMMENT ON TABLE service_command_dependencies IS 'Granular mapping of individual commands to specific services';
COMMENT ON TABLE service_exports IS 'Catalog of what each service exports for dependency analysis';
COMMENT ON TABLE service_dependency_analysis_runs IS 'Audit log of dependency scanning and analysis operations';

-- Add this table to the table definitions registry
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'registry_services', 'Registry of all shared services in the monorepo', 'Service dependency mapping and architectural insight', CURRENT_DATE),
    ('public', 'registry_apps', 'Registry of all applications in the monorepo', 'Application dependency mapping and management', CURRENT_DATE),
    ('public', 'registry_cli_pipelines', 'Registry of all CLI pipelines', 'CLI pipeline dependency tracking and analysis', CURRENT_DATE),
    ('public', 'registry_cli_commands', 'Registry of individual commands within CLI pipelines', 'Granular command-level dependency mapping', CURRENT_DATE),
    ('public', 'service_app_dependencies', 'Mapping of applications to shared services', 'Application-service dependency relationships', CURRENT_DATE),
    ('public', 'service_pipeline_dependencies', 'Mapping of CLI pipelines to shared services', 'Pipeline-service dependency relationships', CURRENT_DATE),
    ('public', 'service_command_dependencies', 'Mapping of commands to specific services', 'Command-level service dependency tracking', CURRENT_DATE),
    ('public', 'service_exports', 'Catalog of service exports', 'Service export tracking for dependency analysis', CURRENT_DATE),
    ('public', 'service_dependency_analysis_runs', 'Audit log of dependency analysis operations', 'Tracking of dependency scanning activities', CURRENT_DATE);