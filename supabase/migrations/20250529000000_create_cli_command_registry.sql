-- Create CLI command registry tables for tracking and managing CLI pipelines and commands

-- Drop existing command_categories if it exists with different schema
DROP TABLE IF EXISTS command_categories CASCADE;

-- Create command categories table
CREATE TABLE command_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6B7280', -- Hex color for UI display
    icon VARCHAR(50), -- Icon name for UI display
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create command pipelines table
CREATE TABLE IF NOT EXISTS command_pipelines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'google_sync', 'document'
    display_name VARCHAR(200) NOT NULL, -- e.g., 'Google Drive Sync Pipeline'
    description TEXT,
    category_id UUID REFERENCES command_categories(id) ON DELETE SET NULL,
    script_path VARCHAR(500) NOT NULL, -- e.g., 'scripts/cli-pipeline/google_sync/google-sync-cli.sh'
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'maintenance')),
    usage_example TEXT, -- Example command usage
    guidance TEXT, -- Additional guidance for users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at TIMESTAMP WITH TIME ZONE -- When we last scanned for commands
);

-- Create command definitions table
CREATE TABLE IF NOT EXISTS command_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pipeline_id UUID NOT NULL REFERENCES command_pipelines(id) ON DELETE CASCADE,
    command_name VARCHAR(100) NOT NULL, -- e.g., 'sync', 'health-check'
    description TEXT,
    usage_pattern TEXT, -- e.g., 'sync [--force] [--limit <n>]'
    example_usage TEXT, -- e.g., './google-sync-cli.sh sync --limit 10'
    requires_auth BOOLEAN DEFAULT TRUE,
    requires_google_api BOOLEAN DEFAULT FALSE,
    is_dangerous BOOLEAN DEFAULT FALSE, -- For commands that modify data
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pipeline_id, command_name)
);

-- Create command pipeline tables interaction tracking
CREATE TABLE IF NOT EXISTS command_pipeline_tables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pipeline_id UUID NOT NULL REFERENCES command_pipelines(id) ON DELETE CASCADE,
    table_name VARCHAR(200) NOT NULL,
    operation_type VARCHAR(50) DEFAULT 'read' CHECK (operation_type IN ('read', 'write', 'both')),
    description TEXT, -- How this table is used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pipeline_id, table_name)
);

-- Create command dependencies table (which services/tools a command uses)
CREATE TABLE IF NOT EXISTS command_dependencies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    command_id UUID NOT NULL REFERENCES command_definitions(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) NOT NULL CHECK (dependency_type IN ('service', 'api', 'tool', 'env_var')),
    dependency_name VARCHAR(200) NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(command_id, dependency_type, dependency_name)
);

-- Create indexes for performance
CREATE INDEX idx_command_pipelines_category ON command_pipelines(category_id);
CREATE INDEX idx_command_pipelines_status ON command_pipelines(status);
CREATE INDEX idx_command_definitions_pipeline ON command_definitions(pipeline_id);
CREATE INDEX idx_command_pipeline_tables_pipeline ON command_pipeline_tables(pipeline_id);
CREATE INDEX idx_command_dependencies_command ON command_dependencies(command_id);

-- Insert default categories
INSERT INTO command_categories (name, description, color, icon, display_order) VALUES
    ('data_sync', 'Data synchronization and import/export pipelines', '#3B82F6', 'sync', 1),
    ('document_processing', 'Document classification, analysis, and processing', '#10B981', 'document', 2),
    ('database_management', 'Database operations and maintenance', '#EF4444', 'database', 3),
    ('authentication', 'User authentication and access control', '#F59E0B', 'shield', 4),
    ('monitoring', 'System monitoring and health checks', '#8B5CF6', 'chart', 5),
    ('development', 'Development tools and utilities', '#EC4899', 'code', 6),
    ('media', 'Media processing and management', '#14B8A6', 'video', 7),
    ('ai_services', 'AI and machine learning services', '#6366F1', 'brain', 8)
ON CONFLICT (name) DO NOTHING;

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_command_categories_updated_at BEFORE UPDATE ON command_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_command_pipelines_updated_at BEFORE UPDATE ON command_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_command_definitions_updated_at BEFORE UPDATE ON command_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies (permissive for now, can be tightened later)
ALTER TABLE command_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_pipeline_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_dependencies ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow read access to command registry" ON command_categories
    FOR SELECT USING (true);
CREATE POLICY "Allow read access to command pipelines" ON command_pipelines
    FOR SELECT USING (true);
CREATE POLICY "Allow read access to command definitions" ON command_definitions
    FOR SELECT USING (true);
CREATE POLICY "Allow read access to command pipeline tables" ON command_pipeline_tables
    FOR SELECT USING (true);
CREATE POLICY "Allow read access to command dependencies" ON command_dependencies
    FOR SELECT USING (true);

-- Only admins can modify (we'll implement proper admin check later)
CREATE POLICY "Allow admin write to command categories" ON command_categories
    FOR ALL USING (true);
CREATE POLICY "Allow admin write to command pipelines" ON command_pipelines
    FOR ALL USING (true);
CREATE POLICY "Allow admin write to command definitions" ON command_definitions
    FOR ALL USING (true);
CREATE POLICY "Allow admin write to command pipeline tables" ON command_pipeline_tables
    FOR ALL USING (true);
CREATE POLICY "Allow admin write to command dependencies" ON command_dependencies
    FOR ALL USING (true);

-- Function to get pipeline statistics
CREATE OR REPLACE FUNCTION get_pipeline_statistics(p_pipeline_id UUID DEFAULT NULL)
RETURNS TABLE (
    pipeline_id UUID,
    pipeline_name VARCHAR,
    total_commands BIGINT,
    tables_accessed BIGINT,
    last_used TIMESTAMP WITH TIME ZONE,
    total_executions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.id,
        cp.name,
        COUNT(DISTINCT cd.id) as total_commands,
        COUNT(DISTINCT cpt.id) as tables_accessed,
        MAX(ct.executed_at) as last_used,
        COUNT(ct.id) as total_executions
    FROM command_pipelines cp
    LEFT JOIN command_definitions cd ON cd.pipeline_id = cp.id
    LEFT JOIN command_pipeline_tables cpt ON cpt.pipeline_id = cp.id
    LEFT JOIN command_tracking ct ON ct.pipeline_name = cp.name
    WHERE p_pipeline_id IS NULL OR cp.id = p_pipeline_id
    GROUP BY cp.id, cp.name;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-discover commands from a pipeline script (placeholder for future implementation)
CREATE OR REPLACE FUNCTION discover_pipeline_commands(p_pipeline_name VARCHAR, p_script_content TEXT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- This is a placeholder for future implementation
    -- Would parse the script content to extract commands
    v_result := jsonb_build_object(
        'pipeline_name', p_pipeline_name,
        'commands_found', 0,
        'message', 'Auto-discovery not yet implemented'
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON TABLE command_categories IS 'Categories for organizing CLI pipelines by function';
COMMENT ON TABLE command_pipelines IS 'Registry of all CLI pipeline scripts in the system';
COMMENT ON TABLE command_definitions IS 'Individual commands available within each CLI pipeline';
COMMENT ON TABLE command_pipeline_tables IS 'Database tables that each pipeline interacts with';
COMMENT ON TABLE command_dependencies IS 'External dependencies (services, APIs, tools) required by commands';
COMMENT ON FUNCTION get_pipeline_statistics IS 'Get usage statistics for CLI pipelines';