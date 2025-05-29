-- Down migration for dev_tasks tables

-- Remove from tracking
DELETE FROM sys_table_migrations 
WHERE new_name IN ('dev_tasks', 'dev_task_tags', 'dev_task_files');

-- Drop policies
DROP POLICY IF EXISTS "Users can view all tasks" ON dev_tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON dev_tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON dev_tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON dev_tasks;
DROP POLICY IF EXISTS "Users can view all tags" ON dev_task_tags;
DROP POLICY IF EXISTS "Users can manage tags on their tasks" ON dev_task_tags;
DROP POLICY IF EXISTS "Users can view all files" ON dev_task_files;
DROP POLICY IF EXISTS "Users can manage files on their tasks" ON dev_task_files;

-- Drop trigger
DROP TRIGGER IF EXISTS update_dev_tasks_updated_at ON dev_tasks;

-- Drop tables (cascade will handle foreign keys)
DROP TABLE IF EXISTS dev_task_files CASCADE;
DROP TABLE IF EXISTS dev_task_tags CASCADE;
DROP TABLE IF EXISTS dev_tasks CASCADE;