-- Only adds file_size column if it doesn't exist, doesn't modify data
DO $$
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'documentation_files'
        AND column_name = 'file_size'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE documentation_files
        ADD COLUMN file_size BIGINT;
        
        -- Add a comment to explain the column
        COMMENT ON COLUMN documentation_files.file_size IS 'Size of the file in bytes, dedicated column for better query performance';
    ELSE
        -- If column exists, run an innocuous update to trigger schema refresh
        RAISE NOTICE 'Column file_size already exists, refreshing schema cache';
        COMMENT ON COLUMN documentation_files.file_size IS 'Size of the file in bytes, dedicated column for better query performance';
    END IF;
END $$;

-- Explicitly refresh the schema cache
SELECT pg_notify('pgrst', 'reload schema');