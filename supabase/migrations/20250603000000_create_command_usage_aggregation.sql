-- Create a function to get aggregated command usage statistics
CREATE OR REPLACE FUNCTION get_command_usage_stats()
RETURNS TABLE (
  pipeline_name text,
  command_name text,
  execution_count bigint,
  success_count bigint,
  failure_count bigint,
  last_executed timestamptz,
  avg_duration_ms numeric
) 
LANGUAGE sql
STABLE
AS $$
  SELECT 
    ct.pipeline_name,
    ct.command_name,
    COUNT(*)::bigint as execution_count,
    COUNT(CASE WHEN ct.status = 'success' THEN 1 END)::bigint as success_count,
    COUNT(CASE WHEN ct.status IN ('error', 'failed') THEN 1 END)::bigint as failure_count,
    MAX(ct.execution_time) as last_executed,
    AVG(ct.duration_ms)::numeric as avg_duration_ms
  FROM command_tracking ct
  GROUP BY ct.pipeline_name, ct.command_name
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_command_usage_stats() TO authenticated;

-- Create an index to speed up the aggregation
CREATE INDEX IF NOT EXISTS idx_command_tracking_pipeline_command 
ON command_tracking(pipeline_name, command_name);