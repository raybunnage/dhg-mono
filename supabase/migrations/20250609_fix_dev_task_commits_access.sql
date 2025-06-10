-- Fix access to dev_task_commits table

-- First ensure RLS is enabled
ALTER TABLE dev_task_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_task_work_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "dev_task_commits_read_all" ON dev_task_commits;
DROP POLICY IF EXISTS "dev_task_commits_insert_all" ON dev_task_commits;
DROP POLICY IF EXISTS "dev_task_work_sessions_read_all" ON dev_task_work_sessions;
DROP POLICY IF EXISTS "dev_task_work_sessions_insert_all" ON dev_task_work_sessions;
DROP POLICY IF EXISTS "dev_task_work_sessions_update_all" ON dev_task_work_sessions;

-- Create more permissive policies
CREATE POLICY "Allow anonymous read access to commits" 
ON dev_task_commits FOR SELECT 
USING (true);

CREATE POLICY "Allow anonymous insert access to commits" 
ON dev_task_commits FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to commits" 
ON dev_task_commits FOR UPDATE 
USING (true);

CREATE POLICY "Allow anonymous delete access to commits" 
ON dev_task_commits FOR DELETE 
USING (true);

-- Same for work sessions
CREATE POLICY "Allow anonymous read access to work sessions" 
ON dev_task_work_sessions FOR SELECT 
USING (true);

CREATE POLICY "Allow anonymous insert access to work sessions" 
ON dev_task_work_sessions FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to work sessions" 
ON dev_task_work_sessions FOR UPDATE 
USING (true);

CREATE POLICY "Allow anonymous delete access to work sessions" 
ON dev_task_work_sessions FOR DELETE 
USING (true);

-- Grant permissions to anonymous role (used by anon key)
GRANT ALL ON dev_task_commits TO anon;
GRANT ALL ON dev_task_work_sessions TO anon;

-- Grant permissions to authenticated role
GRANT ALL ON dev_task_commits TO authenticated;
GRANT ALL ON dev_task_work_sessions TO authenticated;

-- Ensure the service role has access
GRANT ALL ON dev_task_commits TO service_role;
GRANT ALL ON dev_task_work_sessions TO service_role;