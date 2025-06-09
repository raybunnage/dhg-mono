-- Add service mappings to worktree system
-- This allows assigning shared services to specific worktrees for focused development

-- Create table for service definitions
CREATE TABLE IF NOT EXISTS shared_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(255) NOT NULL UNIQUE,
    service_path VARCHAR(500),
    description TEXT,
    category VARCHAR(100), -- 'authentication', 'database', 'ai', 'file-management', etc.
    dependencies TEXT[], -- List of other services this depends on
    used_by_apps TEXT[], -- List of apps that use this service
    used_by_pipelines TEXT[], -- List of CLI pipelines that use this service
    is_singleton BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create mapping table for worktree to service assignments
CREATE TABLE IF NOT EXISTS worktree_service_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worktree_id UUID REFERENCES worktree_definitions(id) ON DELETE CASCADE,
    service_id UUID REFERENCES shared_services(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(255),
    notes TEXT,
    UNIQUE(worktree_id, service_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_worktree_service_mappings_worktree ON worktree_service_mappings(worktree_id);
CREATE INDEX IF NOT EXISTS idx_worktree_service_mappings_service ON worktree_service_mappings(service_id);
CREATE INDEX IF NOT EXISTS idx_shared_services_category ON shared_services(category);

-- Create a view to easily see all worktree assignments including services
CREATE OR REPLACE VIEW worktree_assignments_complete_view AS
SELECT 
    wd.id as worktree_id,
    wd.path as worktree_path,
    wd.alias_name as worktree_alias,
    wd.emoji as worktree_emoji,
    wd.description as worktree_description,
    -- Apps
    array_agg(DISTINCT wam.app_name) FILTER (WHERE wam.app_name IS NOT NULL) as assigned_apps,
    -- Pipelines
    array_agg(DISTINCT wpm.pipeline_name) FILTER (WHERE wpm.pipeline_name IS NOT NULL) as assigned_pipelines,
    -- Services
    array_agg(DISTINCT ss.service_name) FILTER (WHERE ss.service_name IS NOT NULL) as assigned_services,
    -- Counts
    COUNT(DISTINCT wam.app_name) as app_count,
    COUNT(DISTINCT wpm.pipeline_name) as pipeline_count,
    COUNT(DISTINCT wsm.service_id) as service_count
FROM worktree_definitions wd
LEFT JOIN worktree_app_mappings wam ON wd.id = wam.worktree_id
LEFT JOIN worktree_pipeline_mappings wpm ON wd.id = wpm.worktree_id
LEFT JOIN worktree_service_mappings wsm ON wd.id = wsm.worktree_id
LEFT JOIN shared_services ss ON wsm.service_id = ss.id
GROUP BY wd.id, wd.path, wd.alias_name, wd.emoji, wd.description
ORDER BY wd.alias_number;

-- Insert the existing services
INSERT INTO shared_services (service_name, service_path, description, category, is_singleton) VALUES
-- AI & Processing Services
('ai-processing-service', 'packages/shared/services/ai-processing-service', 'Handles AI processing tasks and Claude API interactions', 'ai', false),
('claude-service', 'packages/shared/services/claude-service', 'Claude AI API integration service', 'ai', true),
('prompt-service', 'packages/shared/services/prompt-service', 'Manages prompts and prompt templates for AI operations', 'ai', false),
('unified-classification-service', 'packages/shared/services/unified-classification-service', 'Unified document and content classification', 'ai', false),

-- Authentication & User Services
('auth-service', 'packages/shared/services/auth-service', 'Authentication service for browser and server environments', 'authentication', true),
('light-auth-enhanced-service', 'packages/shared/services/light-auth-enhanced-service', 'Lightweight authentication service with enhanced features', 'authentication', true),
('user-profile-service', 'packages/shared/services/user-profile-service', 'User profile management service', 'authentication', false),

-- Database & Data Services
('database-service', 'packages/shared/services/database-service', 'Database operations and query management', 'database', true),
('supabase-client', 'packages/shared/services/supabase-client', 'Supabase client singleton service', 'database', true),
('supabase-service', 'packages/shared/services/supabase-service', 'Supabase service wrapper', 'database', true),
('supabase-helpers', 'packages/shared/services/supabase-helpers', 'Supabase utility functions', 'database', false),
('batch-database-service', 'packages/shared/services/batch-database-service.ts', 'Batch database operations service', 'database', false),
('batch-processing-service', 'packages/shared/services/batch-processing-service.ts', 'Batch processing for large operations', 'database', false),

-- File & Media Services
('file-service', 'packages/shared/services/file-service', 'File operations and management', 'file-management', false),
('file-system-service', 'packages/shared/services/file-system-service.ts', 'File system operations wrapper', 'file-management', false),
('folder-hierarchy-service', 'packages/shared/services/folder-hierarchy-service.ts', 'Folder hierarchy management', 'file-management', false),
('audio-service', 'packages/shared/services/audio-service', 'Audio file processing and management', 'media', false),
('audio-transcription', 'packages/shared/services/audio-transcription', 'Audio transcription service', 'media', false),
('media-tracking-service', 'packages/shared/services/media-tracking-service', 'Media file tracking and metadata', 'media', false),
('pdf-processor-service', 'packages/shared/services/pdf-processor-service', 'PDF processing and extraction', 'media', false),

-- Google Services
('google-drive', 'packages/shared/services/google-drive', 'Google Drive API integration', 'integration', false),
('google-drive-explorer', 'packages/shared/services/google-drive-explorer', 'Google Drive file exploration', 'integration', false),

-- Document Services
('document-classification-service', 'packages/shared/services/document-classification-service', 'Document classification and categorization', 'document', false),
('document-pipeline', 'packages/shared/services/document-pipeline', 'Document processing pipeline', 'document', false),
('document-type-service', 'packages/shared/services/document-type-service', 'Document type detection and management', 'document', false),
('classify-service', 'packages/shared/services/classify-service.ts', 'Content classification service', 'document', false),

-- CLI & Pipeline Services
('cli-registry-service', 'packages/shared/services/cli-registry-service', 'CLI command registry and management', 'cli', false),
('script-pipeline', 'packages/shared/services/script-pipeline', 'Script execution pipeline', 'cli', false),
('tracking-service', 'packages/shared/services/tracking-service', 'Command and operation tracking', 'cli', false),

-- Utility Services
('converter-service', 'packages/shared/services/converter-service', 'Data format conversion service', 'utility', false),
('formatter-service', 'packages/shared/services/formatter-service', 'Data formatting service', 'utility', false),
('filter-service', 'packages/shared/services/filter-service', 'Data filtering service', 'utility', false),
('env-config-service', 'packages/shared/services/env-config-service', 'Environment configuration management', 'utility', true),
('git-service', 'packages/shared/services/git-service', 'Git operations service', 'utility', false),
('report-service', 'packages/shared/services/report-service', 'Report generation service', 'utility', false)
ON CONFLICT (service_name) DO NOTHING;

-- Add RLS policies
ALTER TABLE shared_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE worktree_service_mappings ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Enable read access for all users" ON shared_services
    FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON worktree_service_mappings
    FOR SELECT USING (true);

-- Allow authenticated users to manage mappings
CREATE POLICY "Enable all operations for authenticated users" ON shared_services
    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all operations for authenticated users" ON worktree_service_mappings
    FOR ALL USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE shared_services IS 'Registry of all shared services in the monorepo';
COMMENT ON TABLE worktree_service_mappings IS 'Maps shared services to worktrees for focused development';
COMMENT ON COLUMN shared_services.category IS 'Service category: ai, authentication, database, file-management, media, integration, document, cli, utility';
COMMENT ON COLUMN shared_services.is_singleton IS 'Whether this service uses the singleton pattern';

-- Update timestamp trigger for shared_services
CREATE TRIGGER update_shared_services_updated_at
    BEFORE UPDATE ON shared_services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();