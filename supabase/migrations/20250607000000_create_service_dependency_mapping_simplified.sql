-- Migration: Create Service Dependency Mapping System (Simplified)
-- Description: Simplified tracking of relationships between apps, CLI pipelines, and shared services
-- Author: Development Team
-- Date: 2025-06-07

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
  port_number INTEGER, -- Default port if applicable
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
  command_count INTEGER DEFAULT 0, -- Number of commands in pipeline
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Unified Service Dependencies
-- Single table for all dependency relationships (simplified polymorphic design)
CREATE TABLE service_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dependent_id UUID NOT NULL, -- ID from registry_apps or registry_cli_pipelines
  dependent_type VARCHAR(50) NOT NULL, -- 'app' or 'pipeline'
  dependent_name VARCHAR(255) NOT NULL, -- Denormalized for easier querying
  service_id UUID REFERENCES registry_services(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL, -- Denormalized for easier querying
  dependency_type VARCHAR(100) NOT NULL, -- 'direct-import', 'adapter-usage', 'singleton-call'
  import_path TEXT, -- How it's imported, e.g., '@shared/services/supabase-client'
  usage_context TEXT, -- Where/how it's used
  usage_frequency VARCHAR(50), -- 'high', 'medium', 'low'
  is_critical BOOLEAN DEFAULT false, -- Is this a critical dependency?
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(dependent_id, dependent_type, service_id)
);

-- 5. Dependency Analysis Runs
-- Track when dependency analysis was last run
CREATE TABLE service_dependency_analysis_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_type VARCHAR(100) NOT NULL, -- 'full-scan', 'incremental', 'manual'
  target_type VARCHAR(100), -- 'apps', 'pipelines', 'services', 'all'
  items_scanned INTEGER,
  dependencies_found INTEGER,
  new_dependencies INTEGER, -- Number of new dependencies found
  removed_dependencies INTEGER, -- Number of dependencies no longer found
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

-- Service dependencies indexes
CREATE INDEX idx_service_dependencies_dependent ON service_dependencies(dependent_id, dependent_type);
CREATE INDEX idx_service_dependencies_service_id ON service_dependencies(service_id);
CREATE INDEX idx_service_dependencies_dependency_type ON service_dependencies(dependency_type);
CREATE INDEX idx_service_dependencies_is_critical ON service_dependencies(is_critical);
CREATE INDEX idx_service_dependencies_usage_frequency ON service_dependencies(usage_frequency);

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

-- SECTION: views
-- Create useful views for analysis

-- View: Unused Services
CREATE VIEW registry_unused_services_view AS
SELECT 
    rs.*,
    COALESCE(dep_count.count, 0) as dependency_count,
    CASE 
        WHEN COALESCE(dep_count.count, 0) = 0 AND rs.status = 'active' 
        THEN true 
        ELSE false 
    END as is_unused
FROM registry_services rs
LEFT JOIN (
    SELECT service_id, COUNT(*) as count
    FROM service_dependencies
    GROUP BY service_id
) dep_count ON rs.id = dep_count.service_id
WHERE rs.status != 'archived'
ORDER BY is_unused DESC, rs.service_name;

-- View: Service Usage Summary
CREATE VIEW registry_service_usage_summary_view AS
SELECT 
    rs.id,
    rs.service_name,
    rs.display_name,
    rs.service_type,
    rs.status,
    COUNT(DISTINCT CASE WHEN sd.dependent_type = 'app' THEN sd.dependent_id END) as app_count,
    COUNT(DISTINCT CASE WHEN sd.dependent_type = 'pipeline' THEN sd.dependent_id END) as pipeline_count,
    COUNT(DISTINCT sd.dependent_id) as total_dependents,
    COUNT(CASE WHEN sd.is_critical THEN 1 END) as critical_dependencies,
    STRING_AGG(DISTINCT CASE WHEN sd.dependent_type = 'app' THEN sd.dependent_name END, ', ') as apps_using,
    STRING_AGG(DISTINCT CASE WHEN sd.dependent_type = 'pipeline' THEN sd.dependent_name END, ', ') as pipelines_using
FROM registry_services rs
LEFT JOIN service_dependencies sd ON rs.id = sd.service_id
GROUP BY rs.id, rs.service_name, rs.display_name, rs.service_type, rs.status
ORDER BY total_dependents DESC, rs.service_name;

-- View: App Dependencies Overview
CREATE VIEW registry_app_dependencies_view AS
SELECT 
    ra.id,
    ra.app_name,
    ra.display_name,
    ra.app_type,
    ra.framework,
    COUNT(DISTINCT sd.service_id) as service_count,
    COUNT(CASE WHEN sd.is_critical THEN 1 END) as critical_services,
    STRING_AGG(DISTINCT sd.service_name, ', ' ORDER BY sd.service_name) as services_used
FROM registry_apps ra
LEFT JOIN service_dependencies sd ON ra.id = sd.dependent_id AND sd.dependent_type = 'app'
GROUP BY ra.id, ra.app_name, ra.display_name, ra.app_type, ra.framework
ORDER BY service_count DESC, ra.app_name;

-- View: Pipeline Coverage Gaps
CREATE VIEW registry_pipeline_coverage_gaps_view AS
WITH app_only_services AS (
    SELECT DISTINCT 
        sd.service_id,
        sd.service_name,
        rs.display_name,
        rs.service_type
    FROM service_dependencies sd
    JOIN registry_services rs ON sd.service_id = rs.id
    WHERE sd.dependent_type = 'app'
    AND NOT EXISTS (
        SELECT 1 
        FROM service_dependencies sd2 
        WHERE sd2.service_id = sd.service_id 
        AND sd2.dependent_type = 'pipeline'
    )
)
SELECT 
    aos.*,
    COUNT(DISTINCT sd.dependent_id) as app_usage_count,
    STRING_AGG(DISTINCT sd.dependent_name, ', ' ORDER BY sd.dependent_name) as used_by_apps
FROM app_only_services aos
JOIN service_dependencies sd ON aos.service_id = sd.service_id
GROUP BY aos.service_id, aos.service_name, aos.display_name, aos.service_type
ORDER BY app_usage_count DESC, aos.service_name;

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
        sd.service_name::TEXT,
        rs.display_name::TEXT,
        sd.dependency_type::TEXT,
        sd.usage_frequency::TEXT,
        sd.is_critical
    FROM service_dependencies sd
    JOIN registry_services rs ON sd.service_id = rs.id
    WHERE sd.dependent_type = 'app'
    AND sd.dependent_name = app_name_param
    ORDER BY sd.is_critical DESC, sd.service_name;
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
        sd.dependent_name::TEXT as app_name,
        ra.display_name::TEXT,
        sd.dependency_type::TEXT,
        sd.usage_frequency::TEXT,
        sd.is_critical
    FROM service_dependencies sd
    JOIN registry_apps ra ON sd.dependent_id = ra.id
    WHERE sd.dependent_type = 'app'
    AND sd.service_name = service_name_param
    ORDER BY sd.is_critical DESC, sd.dependent_name;
END;
$$ LANGUAGE plpgsql;

-- Function to find archivable services
CREATE OR REPLACE FUNCTION find_archivable_services(days_threshold INTEGER DEFAULT 90)
RETURNS TABLE (
    service_id UUID,
    service_name TEXT,
    service_type TEXT,
    last_command_usage TIMESTAMPTZ,
    dependency_count BIGINT,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH service_usage AS (
        SELECT 
            rs.id,
            rs.service_name,
            rs.service_type,
            COUNT(DISTINCT sd.dependent_id) as dep_count,
            MAX(ct.executed_at) as last_usage
        FROM registry_services rs
        LEFT JOIN service_dependencies sd ON rs.id = sd.service_id
        LEFT JOIN command_tracking ct ON ct.command_name LIKE '%' || rs.service_name || '%'
        WHERE rs.status = 'active'
        GROUP BY rs.id, rs.service_name, rs.service_type
    )
    SELECT 
        su.id,
        su.service_name::TEXT,
        su.service_type::TEXT,
        su.last_usage,
        su.dep_count,
        CASE 
            WHEN su.dep_count = 0 AND (su.last_usage IS NULL OR su.last_usage < NOW() - INTERVAL '1 day' * days_threshold)
                THEN 'Safe to archive - no dependencies and no recent usage'
            WHEN su.dep_count = 0 AND su.last_usage >= NOW() - INTERVAL '1 day' * days_threshold
                THEN 'Has no dependencies but recent usage - verify before archiving'
            WHEN su.dep_count > 0
                THEN 'In use - ' || su.dep_count || ' dependencies found'
            ELSE 'Review manually'
        END::TEXT as recommendation
    FROM service_usage su
    ORDER BY su.dep_count ASC, su.last_usage ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

-- SECTION: rls
-- Enable Row Level Security (following project patterns)

ALTER TABLE registry_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_cli_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_dependencies ENABLE ROW LEVEL SECURITY;
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

CREATE POLICY "Enable read access for all users" ON service_dependencies
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON service_dependencies
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON service_dependencies
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON service_dependencies
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
COMMENT ON TABLE service_dependencies IS 'Unified mapping of all service dependencies across apps and pipelines';
COMMENT ON TABLE service_dependency_analysis_runs IS 'Audit log of dependency scanning and analysis operations';

-- Add views to comment
COMMENT ON VIEW registry_unused_services_view IS 'Services with no dependencies that may be candidates for archiving';
COMMENT ON VIEW registry_service_usage_summary_view IS 'Summary of service usage across all apps and pipelines';
COMMENT ON VIEW registry_app_dependencies_view IS 'Overview of all services used by each application';
COMMENT ON VIEW registry_pipeline_coverage_gaps_view IS 'Services used in apps but not available via CLI pipelines';

-- Add this table to the table definitions registry
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'registry_services', 'Registry of all shared services in the monorepo', 'Service dependency mapping and architectural insight', CURRENT_DATE),
    ('public', 'registry_apps', 'Registry of all applications in the monorepo', 'Application dependency mapping and management', CURRENT_DATE),
    ('public', 'registry_cli_pipelines', 'Registry of all CLI pipelines', 'CLI pipeline dependency tracking and analysis', CURRENT_DATE),
    ('public', 'service_dependencies', 'Unified service dependency mapping', 'Track all service usage across apps and pipelines', CURRENT_DATE),
    ('public', 'service_dependency_analysis_runs', 'Audit log of dependency analysis operations', 'Tracking of dependency scanning activities', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO UPDATE
SET description = EXCLUDED.description,
    purpose = EXCLUDED.purpose,
    created_date = EXCLUDED.created_date;