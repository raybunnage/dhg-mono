-- Create service dependency mapping system tables

-- 1. Registry of all shared services
CREATE TABLE IF NOT EXISTS sys_shared_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name TEXT NOT NULL UNIQUE,
  service_path TEXT NOT NULL, -- relative path from packages/shared/services/
  description TEXT,
  category TEXT, -- e.g., 'auth', 'database', 'ai', 'google', 'document', 'utility'
  is_singleton BOOLEAN DEFAULT false,
  has_browser_variant BOOLEAN DEFAULT false,
  dependencies JSONB DEFAULT '[]'::jsonb, -- array of service names this service depends on
  exports JSONB DEFAULT '[]'::jsonb, -- array of exported functions/classes
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'experimental')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Applications registry
CREATE TABLE IF NOT EXISTS sys_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_name TEXT NOT NULL UNIQUE,
  app_path TEXT NOT NULL, -- relative path from apps/
  description TEXT,
  app_type TEXT CHECK (app_type IN ('vite', 'node', 'hybrid')),
  primary_purpose TEXT,
  port_dev INTEGER,
  port_preview INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'experimental', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLI pipelines registry
CREATE TABLE IF NOT EXISTS sys_cli_pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_name TEXT NOT NULL UNIQUE,
  pipeline_path TEXT NOT NULL, -- relative path from scripts/cli-pipeline/
  description TEXT,
  shell_script TEXT, -- e.g., 'google-sync-cli.sh'
  commands JSONB DEFAULT '[]'::jsonb, -- array of available commands
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'experimental')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Application to service dependencies
CREATE TABLE IF NOT EXISTS sys_app_service_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID NOT NULL REFERENCES sys_applications(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES sys_shared_services(id) ON DELETE CASCADE,
  usage_type TEXT CHECK (usage_type IN ('direct', 'indirect', 'dev-only')),
  import_path TEXT, -- how it's imported in the app
  features_used JSONB DEFAULT '[]'::jsonb, -- specific functions/features used
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, service_id)
);

-- 5. CLI pipeline to service dependencies
CREATE TABLE IF NOT EXISTS sys_pipeline_service_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES sys_cli_pipelines(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES sys_shared_services(id) ON DELETE CASCADE,
  command_name TEXT, -- specific command that uses this service (null = used by multiple)
  usage_type TEXT CHECK (usage_type IN ('direct', 'indirect')),
  import_path TEXT,
  features_used JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pipeline_id, service_id, command_name)
);

-- 6. Service-to-service dependencies (for tracking internal dependencies)
CREATE TABLE IF NOT EXISTS sys_service_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES sys_shared_services(id) ON DELETE CASCADE,
  depends_on_service_id UUID NOT NULL REFERENCES sys_shared_services(id) ON DELETE CASCADE,
  dependency_type TEXT CHECK (dependency_type IN ('required', 'optional', 'dev-only')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, depends_on_service_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_app_service_deps_app ON sys_app_service_dependencies(app_id);
CREATE INDEX idx_app_service_deps_service ON sys_app_service_dependencies(service_id);
CREATE INDEX idx_pipeline_service_deps_pipeline ON sys_pipeline_service_dependencies(pipeline_id);
CREATE INDEX idx_pipeline_service_deps_service ON sys_pipeline_service_dependencies(service_id);
CREATE INDEX idx_service_deps_service ON sys_service_dependencies(service_id);
CREATE INDEX idx_service_deps_depends_on ON sys_service_dependencies(depends_on_service_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sys_shared_services_updated_at
  BEFORE UPDATE ON sys_shared_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sys_applications_updated_at
  BEFORE UPDATE ON sys_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sys_cli_pipelines_updated_at
  BEFORE UPDATE ON sys_cli_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create views for easy querying

-- View: Services with their dependencies count
CREATE OR REPLACE VIEW sys_service_dependency_summary AS
SELECT 
  s.id,
  s.service_name,
  s.category,
  s.description,
  s.is_singleton,
  s.has_browser_variant,
  s.status,
  COUNT(DISTINCT asd.app_id) as used_by_apps_count,
  COUNT(DISTINCT psd.pipeline_id) as used_by_pipelines_count,
  COUNT(DISTINCT sd.depends_on_service_id) as depends_on_count,
  COUNT(DISTINCT sd2.service_id) as depended_by_count
FROM sys_shared_services s
LEFT JOIN sys_app_service_dependencies asd ON s.id = asd.service_id
LEFT JOIN sys_pipeline_service_dependencies psd ON s.id = psd.service_id
LEFT JOIN sys_service_dependencies sd ON s.id = sd.service_id
LEFT JOIN sys_service_dependencies sd2 ON s.id = sd2.depends_on_service_id
GROUP BY s.id;

-- View: Application dependencies
CREATE OR REPLACE VIEW sys_app_dependencies_view AS
SELECT 
  a.app_name,
  a.app_type,
  a.description as app_description,
  s.service_name,
  s.category as service_category,
  asd.usage_type,
  asd.import_path,
  asd.features_used
FROM sys_applications a
JOIN sys_app_service_dependencies asd ON a.id = asd.app_id
JOIN sys_shared_services s ON asd.service_id = s.id
ORDER BY a.app_name, s.category, s.service_name;

-- View: Pipeline dependencies
CREATE OR REPLACE VIEW sys_pipeline_dependencies_view AS
SELECT 
  p.pipeline_name,
  p.description as pipeline_description,
  psd.command_name,
  s.service_name,
  s.category as service_category,
  psd.usage_type,
  psd.import_path,
  psd.features_used
FROM sys_cli_pipelines p
JOIN sys_pipeline_service_dependencies psd ON p.id = psd.pipeline_id
JOIN sys_shared_services s ON psd.service_id = s.id
ORDER BY p.pipeline_name, psd.command_name, s.service_name;

-- RLS policies
ALTER TABLE sys_shared_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_cli_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_app_service_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_pipeline_service_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_service_dependencies ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Allow authenticated read access" ON sys_shared_services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON sys_applications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON sys_cli_pipelines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON sys_app_service_dependencies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON sys_pipeline_service_dependencies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON sys_service_dependencies
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users who are in allowed emails to manage data
CREATE POLICY "Allow allowed users full access" ON sys_shared_services
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true));

CREATE POLICY "Allow allowed users full access" ON sys_applications
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true));

CREATE POLICY "Allow allowed users full access" ON sys_cli_pipelines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true));

CREATE POLICY "Allow allowed users full access" ON sys_app_service_dependencies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true));

CREATE POLICY "Allow allowed users full access" ON sys_pipeline_service_dependencies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true));

CREATE POLICY "Allow allowed users full access" ON sys_service_dependencies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_allowed_emails WHERE email = auth.jwt()->>'email' AND is_active = true));

-- Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
  ('public', 'sys_shared_services', 'Registry of all shared services in packages/shared/services', 'Track and manage shared service definitions', CURRENT_DATE),
  ('public', 'sys_applications', 'Registry of all applications in the monorepo', 'Track applications and their configurations', CURRENT_DATE),
  ('public', 'sys_cli_pipelines', 'Registry of all CLI pipeline scripts', 'Track CLI pipelines and their commands', CURRENT_DATE),
  ('public', 'sys_app_service_dependencies', 'Mapping of applications to services they use', 'Track which services each app depends on', CURRENT_DATE),
  ('public', 'sys_pipeline_service_dependencies', 'Mapping of CLI pipelines to services they use', 'Track which services each pipeline/command uses', CURRENT_DATE),
  ('public', 'sys_service_dependencies', 'Service-to-service dependency mapping', 'Track internal dependencies between services', CURRENT_DATE);

-- Initial population helper function
CREATE OR REPLACE FUNCTION populate_initial_services() RETURNS void AS $$
BEGIN
  -- Core singleton services
  INSERT INTO sys_shared_services (service_name, service_path, description, category, is_singleton, has_browser_variant)
  VALUES 
    ('SupabaseClientService', 'supabase-client.ts', 'Singleton Supabase client for server/CLI environments', 'database', true, true),
    ('claudeService', 'claude-service/', 'Claude AI API service singleton', 'ai', true, false),
    ('GoogleDriveService', 'google-drive/', 'Google Drive API integration service', 'google', false, true),
    ('AuthService', 'auth-service/', 'Authentication service with browser support', 'auth', false, true),
    ('DocumentTypeService', 'document-type-service/', 'Document type management and classification', 'document', false, false),
    ('PromptService', 'prompt-service/', 'Prompt management and template service', 'ai', false, false),
    ('FileService', 'file-service/', 'File system operations service', 'utility', false, false),
    ('GitService', 'git-service/', 'Git operations service', 'utility', false, false),
    ('CommandTrackingService', 'tracking-service/', 'CLI command usage tracking', 'utility', false, false),
    ('FilterService', 'filter-service/', 'User filter and profile management', 'utility', false, false)
  ON CONFLICT (service_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Run initial population
SELECT populate_initial_services();