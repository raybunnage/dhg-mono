-- Create command_tracking table for tracking CLI pipeline command executions
CREATE TABLE IF NOT EXISTS command_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  pipeline_name TEXT NOT NULL,
  command_name TEXT NOT NULL,
  execution_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
  records_affected INTEGER,
  affected_entity TEXT,
  summary TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for faster querying
CREATE INDEX IF NOT EXISTS command_tracking_pipeline_name_idx ON command_tracking (pipeline_name);
CREATE INDEX IF NOT EXISTS command_tracking_status_idx ON command_tracking (status);
CREATE INDEX IF NOT EXISTS command_tracking_execution_time_idx ON command_tracking (execution_time DESC);

-- Create RLS policy to allow authenticated users to view command history
ALTER TABLE command_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view CLI command tracking"
ON command_tracking
FOR SELECT
TO authenticated
USING (true);

-- Create RLS policy to allow service role to insert/update command history
CREATE POLICY "Allow service role to insert/update CLI command tracking"
ON command_tracking
FOR ALL
TO service_role
USING (true);

-- Create function to get command execution stats
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