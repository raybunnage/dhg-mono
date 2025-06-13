-- Create service cleanup tracking system
-- This tracks all cleanup tasks for each service to ensure systematic completion

-- Create enum for task types
CREATE TYPE service_cleanup_task_type AS ENUM (
  'migration',
  'documentation', 
  'testing',
  'archival',
  'verification',
  'monitoring'
);

-- Create enum for task status
CREATE TYPE service_cleanup_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'blocked'
);

-- Create enum for priority
CREATE TYPE service_cleanup_priority AS ENUM (
  'low',
  'medium', 
  'high',
  'critical'
);

-- Create the tracking table
CREATE TABLE IF NOT EXISTS sys_service_cleanup_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  task_type service_cleanup_task_type NOT NULL,
  task_description TEXT NOT NULL,
  status service_cleanup_status NOT NULL DEFAULT 'pending',
  priority service_cleanup_priority NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  dependencies TEXT[], -- Array of task descriptions this depends on
  assigned_to TEXT,
  
  -- Ensure unique tasks per service
  UNIQUE(service_name, task_description)
);

-- Create indexes for performance
CREATE INDEX idx_cleanup_tasks_service ON sys_service_cleanup_tasks(service_name);
CREATE INDEX idx_cleanup_tasks_status ON sys_service_cleanup_tasks(status);
CREATE INDEX idx_cleanup_tasks_priority ON sys_service_cleanup_tasks(priority);

-- Create a view for active tasks
CREATE VIEW sys_service_cleanup_active_tasks_view AS
SELECT 
  t.*,
  s.usage_count,
  s.category as service_category,
  s.is_singleton,
  s.has_tests
FROM sys_service_cleanup_tasks t
LEFT JOIN sys_shared_services s ON s.service_name = t.service_name
WHERE t.status IN ('pending', 'in_progress')
ORDER BY 
  CASE t.priority 
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  t.created_at;

-- Create a summary view
CREATE VIEW sys_service_cleanup_summary_view AS
SELECT 
  service_name,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
  COUNT(*) FILTER (WHERE status = 'blocked') as blocked_tasks,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100, 
    2
  ) as completion_percentage,
  MAX(completed_at) as last_completed_at,
  MIN(created_at) as cleanup_started_at
FROM sys_service_cleanup_tasks
GROUP BY service_name
ORDER BY completion_percentage DESC, service_name;

-- Add RLS policies
ALTER TABLE sys_service_cleanup_tasks ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Enable read access for all users" ON sys_service_cleanup_tasks
  FOR SELECT USING (true);

-- Only allow updates from authenticated users
CREATE POLICY "Enable update for authenticated users" ON sys_service_cleanup_tasks
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON sys_service_cleanup_tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Function to check task dependencies
CREATE OR REPLACE FUNCTION check_task_dependencies(
  p_service_name TEXT,
  p_task_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_dependencies TEXT[];
  v_dep TEXT;
  v_completed_count INT;
BEGIN
  -- Get dependencies for this task
  SELECT dependencies INTO v_dependencies
  FROM sys_service_cleanup_tasks
  WHERE service_name = p_service_name 
  AND task_description = p_task_description;
  
  -- If no dependencies, return true
  IF v_dependencies IS NULL OR array_length(v_dependencies, 1) IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if all dependencies are completed
  SELECT COUNT(*) INTO v_completed_count
  FROM sys_service_cleanup_tasks
  WHERE service_name = p_service_name
  AND task_description = ANY(v_dependencies)
  AND status = 'completed';
  
  -- Return true if all dependencies are completed
  RETURN v_completed_count = array_length(v_dependencies, 1);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update started_at timestamp
CREATE OR REPLACE FUNCTION update_cleanup_task_started_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'in_progress' AND NEW.status = 'in_progress' THEN
    NEW.started_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_started_at
  BEFORE UPDATE ON sys_service_cleanup_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_cleanup_task_started_at();

-- Insert metadata about this table
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES (
  'public', 
  'sys_service_cleanup_tasks',
  'Tracks cleanup tasks for shared services migration and maintenance',
  'Ensures systematic completion of all service cleanup activities',
  CURRENT_DATE
);

-- Grant access to views
GRANT SELECT ON sys_service_cleanup_active_tasks_view TO authenticated;
GRANT SELECT ON sys_service_cleanup_summary_view TO authenticated;