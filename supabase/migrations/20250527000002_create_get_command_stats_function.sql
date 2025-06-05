-- Create or replace the get_command_stats function to use the command_tracking table
CREATE OR REPLACE FUNCTION get_command_stats()
RETURNS TABLE (
  pipeline_name TEXT,
  command_name TEXT,
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  running_executions BIGINT,
  avg_duration_ms NUMERIC,
  last_execution TIMESTAMP WITH TIME ZONE
) LANGUAGE SQL STABLE
AS $$
  SELECT 
    pipeline_name,
    command_name,
    COUNT(*) AS total_executions,
    COUNT(*) FILTER (WHERE status = 'success') AS successful_executions,
    COUNT(*) FILTER (WHERE status = 'error') AS failed_executions,
    COUNT(*) FILTER (WHERE status = 'running') AS running_executions,
    AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS avg_duration_ms,
    MAX(execution_time) AS last_execution
  FROM 
    command_tracking
  GROUP BY 
    pipeline_name, command_name
  ORDER BY 
    MAX(execution_time) DESC NULLS LAST
$$;