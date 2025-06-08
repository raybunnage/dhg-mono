-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.worktree_pipeline_mappings CASCADE;
DROP TABLE IF EXISTS public.worktree_app_mappings CASCADE;
DROP TABLE IF EXISTS public.worktree_definitions CASCADE;

-- Create worktree mappings tables with correct structure
CREATE TABLE IF NOT EXISTS public.worktree_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    alias TEXT NOT NULL,
    emoji TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    display_order INTEGER DEFAULT 0 NOT NULL,
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
CREATE INDEX idx_worktree_app_mappings_worktree_id ON public.worktree_app_mappings(worktree_id);
CREATE INDEX idx_worktree_pipeline_mappings_worktree_id ON public.worktree_pipeline_mappings(worktree_id);

-- Enable RLS
ALTER TABLE public.worktree_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worktree_app_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worktree_pipeline_mappings ENABLE ROW LEVEL SECURITY;

-- Create admin policies
CREATE POLICY "Admins can view worktree definitions" ON public.worktree_definitions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth_user_profiles
            WHERE user_id = auth.uid()
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can manage worktree definitions" ON public.worktree_definitions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth_user_profiles
            WHERE user_id = auth.uid()
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can view worktree app mappings" ON public.worktree_app_mappings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth_user_profiles
            WHERE user_id = auth.uid()
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can manage worktree app mappings" ON public.worktree_app_mappings
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth_user_profiles
            WHERE user_id = auth.uid()
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can view worktree pipeline mappings" ON public.worktree_pipeline_mappings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth_user_profiles
            WHERE user_id = auth.uid()
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can manage worktree pipeline mappings" ON public.worktree_pipeline_mappings
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth_user_profiles
            WHERE user_id = auth.uid()
            AND is_admin = true
        )
    );

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_worktree_definitions_updated_at BEFORE UPDATE ON public.worktree_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();