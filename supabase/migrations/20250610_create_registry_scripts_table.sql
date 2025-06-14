-- Create registry_scripts table for non-CLI pipeline script management

CREATE TABLE IF NOT EXISTS registry_scripts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    script_name text NOT NULL,
    shortcut_name text,
    script_type text DEFAULT 'pnpm' CHECK (script_type IN ('pnpm', 'standalone', 'npm', 'node')),
    package_location text NOT NULL,
    script_command text NOT NULL,
    description text,
    usage_frequency integer DEFAULT 0,
    last_used_at timestamptz,
    is_deprecated boolean DEFAULT false,
    dependencies text[],
    environment text DEFAULT 'any' CHECK (environment IN ('any', 'development', 'production', 'ci')),
    
    -- Legacy fields for compatibility
    file_path text NOT NULL,
    file_name text NOT NULL DEFAULT 'package.json',
    title text NOT NULL,
    language text DEFAULT 'json',
    summary text,
    ai_generated_tags text[],
    manual_tags text[],
    last_modified_at timestamptz DEFAULT now(),
    last_indexed_at timestamptz,
    file_hash text,
    metadata jsonb DEFAULT '{}',
    document_type_id uuid,
    ai_assessment jsonb,
    status text DEFAULT 'active',
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_registry_scripts_script_type ON registry_scripts(script_type);
CREATE INDEX IF NOT EXISTS idx_registry_scripts_package_location ON registry_scripts(package_location);
CREATE INDEX IF NOT EXISTS idx_registry_scripts_shortcut_name ON registry_scripts(shortcut_name) WHERE shortcut_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registry_scripts_deprecated ON registry_scripts(is_deprecated);
CREATE INDEX IF NOT EXISTS idx_registry_scripts_status ON registry_scripts(status);

-- Enable RLS
ALTER TABLE registry_scripts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON registry_scripts
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON registry_scripts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON registry_scripts
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create a view for easy querying of pnpm scripts
CREATE OR REPLACE VIEW registry_scripts_pnpm_view AS
SELECT 
    id,
    script_name,
    shortcut_name,
    package_location,
    script_command,
    description,
    usage_frequency,
    last_used_at,
    is_deprecated,
    dependencies,
    environment,
    created_at,
    updated_at
FROM registry_scripts 
WHERE script_type = 'pnpm' AND NOT is_deprecated
ORDER BY package_location, script_name;

-- Add table to sys_table_definitions
INSERT INTO sys_table_definitions (
    table_schema, 
    table_name, 
    description, 
    purpose, 
    created_date
) VALUES (
    'public', 
    'registry_scripts', 
    'Registry of non-CLI pipeline scripts (pnpm scripts, standalone files)',
    'Tracks and manages scripts outside the CLI pipeline system',
    CURRENT_DATE
) ON CONFLICT (table_schema, table_name) DO UPDATE SET
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose,
    last_modified = now();

-- Add view to sys_table_definitions
INSERT INTO sys_table_definitions (
    table_schema, 
    table_name, 
    description, 
    purpose, 
    created_date
) VALUES (
    'public', 
    'registry_scripts_pnpm_view', 
    'View of active pnpm scripts for easy management', 
    'Filtered view showing only active pnpm scripts with their shortcuts and metadata',
    CURRENT_DATE
) ON CONFLICT (table_schema, table_name) DO UPDATE SET
    description = EXCLUDED.description,
    purpose = EXCLUDED.purpose,
    last_modified = now();