-- Add status field to command_definitions table to track active/deprecated commands
-- This helps maintain an accurate registry as commands are refactored or removed

-- Add status column with default 'active'
ALTER TABLE command_definitions 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' 
CHECK (status IN ('active', 'deprecated', 'removed', 'maintenance'));

-- Add is_hidden column for commands that should not be shown in UI
ALTER TABLE command_definitions
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Add deprecated_at timestamp to track when commands were deprecated
ALTER TABLE command_definitions
ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMP WITH TIME ZONE;

-- Add last_verified_at to track when we last verified the command exists
ALTER TABLE command_definitions
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_command_definitions_status ON command_definitions(status);
CREATE INDEX IF NOT EXISTS idx_command_definitions_hidden ON command_definitions(is_hidden);

-- Update function to get only active commands for a pipeline
CREATE OR REPLACE FUNCTION get_active_pipeline_commands(p_pipeline_id UUID)
RETURNS TABLE (
    id UUID,
    command_name VARCHAR,
    description TEXT,
    usage_pattern TEXT,
    example_usage TEXT,
    display_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cd.id,
        cd.command_name,
        cd.description,
        cd.usage_pattern,
        cd.example_usage,
        cd.display_order
    FROM command_definitions cd
    WHERE cd.pipeline_id = p_pipeline_id
      AND cd.status = 'active'
      AND cd.is_hidden = FALSE
    ORDER BY cd.display_order, cd.command_name;
END;
$$ LANGUAGE plpgsql;

-- Function to mark commands as deprecated when they're removed during refactoring
CREATE OR REPLACE FUNCTION deprecate_missing_commands(
    p_pipeline_id UUID,
    p_current_commands TEXT[]
) RETURNS INTEGER AS $$
DECLARE
    v_deprecated_count INTEGER;
BEGIN
    -- Mark commands as deprecated if they're not in the current list
    UPDATE command_definitions
    SET 
        status = 'deprecated',
        deprecated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE pipeline_id = p_pipeline_id
      AND command_name NOT IN (SELECT unnest(p_current_commands))
      AND status = 'active';
    
    GET DIAGNOSTICS v_deprecated_count = ROW_COUNT;
    
    -- Mark existing commands as verified
    UPDATE command_definitions
    SET 
        last_verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE pipeline_id = p_pipeline_id
      AND command_name IN (SELECT unnest(p_current_commands))
      AND status = 'active';
    
    RETURN v_deprecated_count;
END;
$$ LANGUAGE plpgsql;

-- Update the pipeline statistics function to only count active commands
CREATE OR REPLACE FUNCTION get_pipeline_statistics(p_pipeline_id UUID DEFAULT NULL)
RETURNS TABLE (
    pipeline_id UUID,
    pipeline_name VARCHAR,
    total_commands BIGINT,
    active_commands BIGINT,
    deprecated_commands BIGINT,
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
        COUNT(DISTINCT cd.id) FILTER (WHERE cd.status = 'active') as active_commands,
        COUNT(DISTINCT cd.id) FILTER (WHERE cd.status = 'deprecated') as deprecated_commands,
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

-- Add helpful comments
COMMENT ON COLUMN command_definitions.status IS 'Command status: active, deprecated, removed, or maintenance';
COMMENT ON COLUMN command_definitions.is_hidden IS 'Whether to hide this command from UI displays';
COMMENT ON COLUMN command_definitions.deprecated_at IS 'When this command was marked as deprecated';
COMMENT ON COLUMN command_definitions.last_verified_at IS 'When we last verified this command exists in the CLI script';