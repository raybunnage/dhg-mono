-- Up Migration
DO $$ 
BEGIN
    -- First check if any critical data needs to be migrated
    IF EXISTS (
        SELECT 1 FROM repository_metadata 
        WHERE metadata::text != '{}'::text
        AND metadata::text != 'null'
    ) THEN
        -- Move any important metadata to function_registry if needed
        UPDATE function_registry fr
        SET metadata = fr.metadata || rm.metadata
        FROM repository_metadata rm
        WHERE rm.function_id = fr.id
        AND rm.metadata IS NOT NULL;
    END IF;

    -- Drop the table
    DROP TABLE IF EXISTS repository_metadata;
END $$;

-- Down Migration
BEGIN;
    -- Recreate table if we need to rollback
    CREATE TABLE IF NOT EXISTS repository_metadata (
        id text PRIMARY KEY,
        function_id text REFERENCES function_registry(id),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
    );
COMMIT; 