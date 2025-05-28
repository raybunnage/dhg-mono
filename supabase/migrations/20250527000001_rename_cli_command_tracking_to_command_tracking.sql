-- Rename cli_command_tracking table to command_tracking
ALTER TABLE cli_command_tracking RENAME TO command_tracking;

-- Update indexes
ALTER INDEX cli_command_tracking_pipeline_name_idx RENAME TO command_tracking_pipeline_name_idx;
ALTER INDEX cli_command_tracking_status_idx RENAME TO command_tracking_status_idx;
ALTER INDEX cli_command_tracking_execution_time_idx RENAME TO command_tracking_execution_time_idx;

-- Update the function to use the new table name
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

-- Drop the old function if it exists
DROP FUNCTION IF EXISTS get_cli_command_stats();

-- Update RLS policies with new table name
DROP POLICY IF EXISTS "Allow authenticated users to view CLI command tracking" ON command_tracking;
DROP POLICY IF EXISTS "Allow service role to insert/update CLI command tracking" ON command_tracking;

CREATE POLICY "Allow authenticated users to view command tracking"
ON command_tracking
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow service role to insert/update command tracking"
ON command_tracking
FOR ALL
TO service_role
USING (true);