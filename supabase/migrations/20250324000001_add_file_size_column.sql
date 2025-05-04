-- Migration to add a file_size column to the documentation_files table
-- This solves the schema cache issue where scripts expect a file_size column

-- First, add the file_size column if it doesn't exist
DO $$
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'documentation_files'
        AND column_name = 'file_size'
    ) THEN
        -- Add the new column
        ALTER TABLE documentation_files
        ADD COLUMN file_size BIGINT;
        
        -- Add a comment explaining the column
        COMMENT ON COLUMN documentation_files.file_size IS 'Size of the file in bytes, dedicated column for better query performance';
        
        -- Copy data from metadata.file_size or metadata.size to the new column
        UPDATE documentation_files
        SET file_size = (metadata->>'file_size')::BIGINT
        WHERE metadata->>'file_size' IS NOT NULL;
        
        -- Also check the legacy size field in metadata
        UPDATE documentation_files
        SET file_size = (metadata->>'size')::BIGINT
        WHERE file_size IS NULL AND metadata->>'size' IS NOT NULL;
    END IF;
END $$;

-- Force a refresh of the schema cache
SELECT pg_notify('pgrst', 'reload schema');