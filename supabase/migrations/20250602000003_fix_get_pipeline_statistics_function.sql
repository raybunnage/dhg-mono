-- Fix get_pipeline_statistics function
-- The function was referenced in the code but may be missing or have incorrect parameters

-- Drop existing function if it exists with wrong signature
DROP FUNCTION IF EXISTS get_pipeline_statistics(UUID);

-- Create or replace the function with correct signature
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
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.id as pipeline_id,
        cp.name as pipeline_name,
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
    WHERE (p_pipeline_id IS NULL OR cp.id = p_pipeline_id)
    GROUP BY cp.id, cp.name
    ORDER BY cp.name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_pipeline_statistics(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_pipeline_statistics(UUID) IS 'Get statistics for CLI pipelines including command counts and usage data';