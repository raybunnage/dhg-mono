-- Add file_size column to documentation_files table if it doesn't exist
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

        -- Copy data from size column in metadata if it exists
        UPDATE documentation_files
        SET file_size = (metadata->>'size')::BIGINT
        WHERE metadata->>'size' IS NOT NULL;
    END IF;
END $$;

-- Add a comment explaining the column
COMMENT ON COLUMN documentation_files.file_size IS 'Size of the file in bytes, moved from metadata.size to a dedicated column for better query performance';

-- Refresh the Supabase cache so API calls recognize the new column
-- This is important to avoid "Could not find column" errors
SELECT pg_notify('pgrst', 'reload schema');