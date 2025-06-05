-- Add app field to dev_tasks table
ALTER TABLE dev_tasks 
ADD COLUMN IF NOT EXISTS app text;

-- Add comment for documentation
COMMENT ON COLUMN dev_tasks.app IS 'The application or CLI pipeline this task relates to';

-- Update existing tasks with a default app value if needed (optional)
-- UPDATE dev_tasks SET app = 'general' WHERE app IS NULL;