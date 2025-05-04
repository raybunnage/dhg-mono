-- Add is_deleted column to documentation_files table
ALTER TABLE documentation_files ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Create index for faster queries filtering by is_deleted
CREATE INDEX IF NOT EXISTS idx_documentation_files_is_deleted ON documentation_files(is_deleted);

-- Update any existing queries to filter out deleted files
-- Typically you would add WHERE is_deleted = FALSE to your SELECT queries
COMMENT ON COLUMN documentation_files.is_deleted IS 'Soft delete flag - set to TRUE to mark a file as deleted without removing it from the database';