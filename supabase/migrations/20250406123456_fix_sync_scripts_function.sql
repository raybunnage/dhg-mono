-- This migration fixes the find_and_sync_scripts function to properly handle 
-- an array of script file paths and insert them into the database

-- First drop the existing function (all versions)
DROP FUNCTION IF EXISTS find_and_sync_scripts();
DROP FUNCTION IF EXISTS find_and_sync_scripts(jsonb);
DROP FUNCTION IF EXISTS find_and_sync_scripts(text);
DROP FUNCTION IF EXISTS find_and_sync_scripts(text[]);

-- Create the new function with parameter for existing files
CREATE OR REPLACE FUNCTION find_and_sync_scripts(existing_files_json text[])
RETURNS JSONB AS $$
DECLARE
  file_path TEXT;
  new_files INTEGER := 0;
  deleted_scripts INTEGER := 0;
  result JSONB;
  file_language TEXT;
  file_basename TEXT;
  file_title TEXT;
BEGIN
  -- Clean up scripts that no longer exist on disk (full delete, not soft delete)
  WITH deleted_records AS (
    DELETE FROM scripts
    WHERE file_path IS NOT NULL 
      AND file_path != ''
      AND NOT (file_path = ANY(existing_files_json))
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_scripts FROM deleted_records;
  
  -- Insert new scripts that exist on disk but not in the database
  FOREACH file_path IN ARRAY existing_files_json
  LOOP
    -- Skip if this file path already exists in the database
    IF NOT EXISTS (SELECT 1 FROM scripts WHERE file_path = file_path) THEN
      -- Extract the file extension to determine language
      file_language := CASE 
        WHEN file_path LIKE '%.sh' THEN 'bash'
        WHEN file_path LIKE '%.js' THEN 'javascript'
        WHEN file_path LIKE '%.ts' THEN 'typescript'
        WHEN file_path LIKE '%.py' THEN 'python'
        WHEN file_path LIKE '%.rb' THEN 'ruby'
        WHEN file_path LIKE '%.sql' THEN 'sql'
        ELSE 'unknown'
      END;
      
      -- Extract basename for title
      file_basename := split_part(file_path, '/', -1);
      file_title := regexp_replace(file_basename, '\.[^.]*$', '');
      
      -- Insert the new script record
      INSERT INTO scripts (
        file_path, 
        title,
        language,
        created_at,
        updated_at,
        last_modified_at,
        metadata
      ) VALUES (
        file_path,
        file_title,
        file_language,
        now(),
        now(),
        now(),
        jsonb_build_object('source', 'cli_sync', 'sync_date', now())
      );
      
      new_files := new_files + 1;
    END IF;
  END LOOP;
  
  -- Build and return the result JSON
  result := jsonb_build_object(
    'new_scripts', new_files,
    'deleted_scripts', deleted_scripts,
    'total_files_processed', array_length(existing_files_json, 1),
    'timestamp', now()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add permissions for the public role to execute this function
GRANT EXECUTE ON FUNCTION find_and_sync_scripts(text[]) TO PUBLIC;

-- Add a comment describing what this function does
COMMENT ON FUNCTION find_and_sync_scripts(text[]) IS 'Synchronizes script files between disk and the database by comparing with the provided list of existing file paths.';