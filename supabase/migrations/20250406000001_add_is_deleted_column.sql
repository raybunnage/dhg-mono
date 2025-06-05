-- Migration to add is_deleted column to scripts table
-- This fixes an issue where the find_and_sync_scripts function was trying to use a non-existent column

-- Add the is_deleted column to the scripts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'scripts' AND column_name = 'is_deleted'
    ) THEN
        ALTER TABLE scripts ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;
        
        -- Add an index on the new column for better performance
        CREATE INDEX idx_scripts_is_deleted ON scripts(is_deleted);
        
        -- Add a comment describing the column
        COMMENT ON COLUMN scripts.is_deleted IS 'Whether the script file has been deleted';
    END IF;
END
$$;