-- Rename scripts_registry to registry_scripts for naming consistency
-- and enhance it for non-CLI pipeline script management

-- First, check if the old table exists and rename it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scripts_registry') THEN
        -- Rename the table
        ALTER TABLE scripts_registry RENAME TO registry_scripts;
        
        -- Update table definitions tracking
        UPDATE sys_table_definitions 
        SET table_name = 'registry_scripts',
            description = 'Registry of non-CLI pipeline scripts (pnpm scripts, standalone files)',
            purpose = 'Tracks and manages scripts outside the CLI pipeline system',
            last_modified = now()
        WHERE table_name = 'scripts_registry';
        
        -- Record the migration
        INSERT INTO sys_table_migrations (
            old_table_name, 
            new_table_name, 
            migration_reason, 
            migration_date
        ) VALUES (
            'scripts_registry', 
            'registry_scripts', 
            'Rename for naming consistency and clarify purpose for non-CLI scripts',
            now()
        );
    END IF;
END $$;

-- Now enhance the table structure for pnpm script management
ALTER TABLE registry_scripts 
    ADD COLUMN IF NOT EXISTS script_name text,
    ADD COLUMN IF NOT EXISTS shortcut_name text,
    ADD COLUMN IF NOT EXISTS script_type text DEFAULT 'pnpm' CHECK (script_type IN ('pnpm', 'standalone', 'npm', 'node')),
    ADD COLUMN IF NOT EXISTS package_location text,
    ADD COLUMN IF NOT EXISTS script_command text,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS usage_frequency integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
    ADD COLUMN IF NOT EXISTS is_deprecated boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS dependencies text[],
    ADD COLUMN IF NOT EXISTS environment text DEFAULT 'any' CHECK (environment IN ('any', 'development', 'production', 'ci'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_registry_scripts_script_type ON registry_scripts(script_type);
CREATE INDEX IF NOT EXISTS idx_registry_scripts_package_location ON registry_scripts(package_location);
CREATE INDEX IF NOT EXISTS idx_registry_scripts_shortcut_name ON registry_scripts(shortcut_name) WHERE shortcut_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registry_scripts_deprecated ON registry_scripts(is_deprecated);

-- Update RLS policies to match new table name
DROP POLICY IF EXISTS "Enable read access for all users" ON registry_scripts;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON registry_scripts;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON registry_scripts;

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