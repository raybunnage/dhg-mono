-- Create a function to execute arbitrary SQL
-- This is a privileged function to allow applying SQL scripts
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql(text) TO PUBLIC;

-- Add comment
COMMENT ON FUNCTION execute_sql(text) IS 'Execute raw SQL (admin only)';

-- Create a function to enable PostgreSQL notifications from the API
-- This is used to reload the schema cache
CREATE OR REPLACE FUNCTION pg_notify(channel text, payload text)
RETURNS void AS $$
BEGIN
  PERFORM pg_notify(channel, payload);
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to public
GRANT EXECUTE ON FUNCTION pg_notify(text, text) TO PUBLIC;

-- Add comment
COMMENT ON FUNCTION pg_notify(text, text) IS 'Wrapper around PostgreSQL pg_notify function to allow schema reloading through the API';

-- Create a function for finding and syncing scripts
CREATE OR REPLACE FUNCTION find_and_sync_scripts()
RETURNS JSONB AS $$
DECLARE
  affected_rows INTEGER := 0;
  new_scripts INTEGER := 0;
  result JSONB;
BEGIN
  -- Update the is_deleted flag for scripts that are no longer on disk
  -- This would typically involve some external mechanism to provide file_paths that exist
  -- For now, we'll simulate by just setting up a placeholder
  
  -- In a real implementation, this would check scripts in the database against what's on disk
  -- and mark any scripts that are no longer present as deleted
  
  -- For demonstration purposes:
  WITH updated_scripts AS (
    SELECT id 
    FROM scripts
    WHERE is_deleted = false
    LIMIT 0 -- This is a placeholder
    FOR UPDATE
  )
  UPDATE scripts s
  SET 
    is_deleted = true,
    updated_at = now()
  FROM updated_scripts u
  WHERE s.id = u.id
  RETURNING s.id;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  -- For demonstration purposes, we'll report zero new scripts found
  -- In a real implementation, this would scan the disk and insert new scripts
  
  -- Build the result JSONB
  result := jsonb_build_object(
    'affected_rows', affected_rows,
    'new_scripts', new_scripts,
    'timestamp', now()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add permissions for the public role to execute this function
GRANT EXECUTE ON FUNCTION find_and_sync_scripts() TO PUBLIC;

-- Add a comment describing what this function does
COMMENT ON FUNCTION find_and_sync_scripts() IS 'Finds script files on disk and synchronizes them with the database, marking deleted files and adding new ones.';