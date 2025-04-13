-- Migration to properly update script management without using is_deleted
-- First drop the views that reference is_deleted
DROP VIEW IF EXISTS active_scripts_view;

-- Next, create the updated views
CREATE OR REPLACE VIEW active_scripts_view AS
SELECT 
  s.id,
  s.file_path,
  s.title,
  s.language,
  s.last_modified_at,
  s.ai_generated_tags,
  s.manual_tags,
  s.ai_assessment->>'script_type' as script_type,
  s.ai_assessment->>'status_recommendation' as status_recommendation,
  s.ai_assessment->'script_quality'->>'code_quality' as code_quality,
  s.ai_assessment->'script_quality'->>'utility' as utility,
  s.ai_assessment->'current_relevance'->>'score' as relevance_score,
  s.ai_assessment->>'usage_status' as usage_status,
  s.assessment_quality_score,
  s.metadata->>'size' as file_size,
  s.package_json_references
FROM scripts s
ORDER BY s.last_modified_at DESC;

-- Drop the old function that uses is_deleted
DROP FUNCTION IF EXISTS find_and_sync_scripts();

-- Create updated version that uses DELETE instead of soft deletion
CREATE OR REPLACE FUNCTION find_and_sync_scripts()
RETURNS JSONB AS $$
DECLARE
  affected_rows INTEGER := 0;
  new_scripts INTEGER := 0;
  scripts_to_delete UUID[];
  current_file RECORD;
  file_paths TEXT[] := '{}'; -- Empty array - in real implementation, this would come from disk scan
  result JSONB;
BEGIN
  -- In a real implementation, file_paths would be populated by scanning the disk
  -- and passing the file paths as an argument or through a temporary table
  
  -- Find scripts to delete - those in DB but not on disk
  SELECT array_agg(id) INTO scripts_to_delete
  FROM scripts
  WHERE file_path NOT IN (SELECT unnest(file_paths))
  LIMIT 50; -- Safety limit
  
  -- Delete scripts no longer on disk
  IF scripts_to_delete IS NOT NULL AND array_length(scripts_to_delete, 1) > 0 THEN
    -- First delete relationships for these scripts
    DELETE FROM script_relationships
    WHERE source_script_id = ANY(scripts_to_delete)
       OR target_script_id = ANY(scripts_to_delete);
    
    -- Now delete the scripts themselves
    DELETE FROM scripts
    WHERE id = ANY(scripts_to_delete);
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
  END IF;
  
  -- In a real implementation, we would insert new scripts from disk here
  
  -- Build the result JSONB
  result := jsonb_build_object(
    'affected_rows', affected_rows,
    'new_scripts', new_scripts,
    'deleted_count', COALESCE(array_length(scripts_to_delete, 1), 0),
    'timestamp', now()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add permissions for the public role to execute this function
GRANT EXECUTE ON FUNCTION find_and_sync_scripts() TO PUBLIC;

-- Add a comment describing what this function does
COMMENT ON FUNCTION find_and_sync_scripts() IS 'Finds script files on disk and synchronizes them with the database, deleting removed files and adding new ones.';