-- Create worktree mappings tables
CREATE TABLE IF NOT EXISTS public.worktree_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    alias_number TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table to map apps to worktrees
CREATE TABLE IF NOT EXISTS public.worktree_app_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worktree_id UUID NOT NULL REFERENCES worktree_definitions(id) ON DELETE CASCADE,
    app_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(worktree_id, app_name)
);

-- Table to map CLI pipelines to worktrees
CREATE TABLE IF NOT EXISTS public.worktree_pipeline_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worktree_id UUID NOT NULL REFERENCES worktree_definitions(id) ON DELETE CASCADE,
    pipeline_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(worktree_id, pipeline_name)
);

-- Create indexes for performance
CREATE INDEX idx_worktree_app_mappings_worktree ON worktree_app_mappings(worktree_id);
CREATE INDEX idx_worktree_pipeline_mappings_worktree ON worktree_pipeline_mappings(worktree_id);

-- Add RLS policies
ALTER TABLE worktree_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worktree_app_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE worktree_pipeline_mappings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Anyone can view worktree definitions" ON worktree_definitions
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view worktree app mappings" ON worktree_app_mappings
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view worktree pipeline mappings" ON worktree_pipeline_mappings
    FOR SELECT USING (true);

-- Only admins can modify
CREATE POLICY "Only admins can modify worktree definitions" ON worktree_definitions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth_user_profiles
            WHERE auth_user_profiles.user_id = auth.uid()
            AND auth_user_profiles.is_admin = true
        )
    );

CREATE POLICY "Only admins can modify worktree app mappings" ON worktree_app_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth_user_profiles
            WHERE auth_user_profiles.user_id = auth.uid()
            AND auth_user_profiles.is_admin = true
        )
    );

CREATE POLICY "Only admins can modify worktree pipeline mappings" ON worktree_pipeline_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth_user_profiles
            WHERE auth_user_profiles.user_id = auth.uid()
            AND auth_user_profiles.is_admin = true
        )
    );

-- Insert default worktree definitions
INSERT INTO worktree_definitions (path, alias_number, alias_name, emoji, description) VALUES
    ('/Users/raybunnage/Documents/github/dhg-mono', 'c1', 'cdev', '🟢', 'Main development branch'),
    ('/Users/raybunnage/Documents/github/dhg-mono-admin-code', 'c2', 'cadmin', '🔵', 'Admin code features'),
    ('/Users/raybunnage/Documents/github/dhg-mono-dhg-hub', 'c3', 'chub', '🟣', 'Hub application development'),
    ('/Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs', 'c4', 'cdocs', '🟠', 'Documentation and continuous docs'),
    ('/Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app', 'c5', 'cgmail', '🔴', 'Gmail integration and research'),
    ('/Users/raybunnage/Documents/github/dhg-mono-improve-audio', 'c6', 'caudio', '🟡', 'Audio app improvements'),
    ('/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines', 'c7', 'ccli', '🔷', 'CLI pipeline improvements'),
    ('/Users/raybunnage/Documents/github/dhg-mono-improve-google', 'c8', 'cgoogle', '🩷', 'Google integration features'),
    ('/Users/raybunnage/Documents/github/dhg-mono-improve-suite', 'c9', 'csuite', '🟩', 'Admin suite improvements'),
    ('/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks', 'c0', 'cfix', '🟪', 'Bug fixes and integration');

-- Add updated_at trigger
CREATE TRIGGER update_worktree_definitions_updated_at
    BEFORE UPDATE ON worktree_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add to sys_table_definitions for tracking
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'worktree_definitions', 'Worktree path and alias definitions', 'Store worktree metadata and identification', CURRENT_DATE),
    ('public', 'worktree_app_mappings', 'Maps apps to worktrees', 'Define which apps belong to which worktrees', CURRENT_DATE),
    ('public', 'worktree_pipeline_mappings', 'Maps CLI pipelines to worktrees', 'Define which CLI pipelines belong to which worktrees', CURRENT_DATE);

-- Down migration
-- DROP TABLE IF EXISTS public.worktree_pipeline_mappings CASCADE;
-- DROP TABLE IF EXISTS public.worktree_app_mappings CASCADE;
-- DROP TABLE IF EXISTS public.worktree_definitions CASCADE;