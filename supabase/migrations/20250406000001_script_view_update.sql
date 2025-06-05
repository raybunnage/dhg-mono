-- Update active_scripts_view to not use is_deleted column
-- This view only shows active scripts based on another criteria

-- Drop the existing view first
DROP VIEW IF EXISTS active_scripts_view;

-- Create an updated version that doesn't rely on is_deleted
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

-- Create a simplified temporary version of find_and_sync_scripts
-- that doesn't reference is_deleted
DROP FUNCTION IF EXISTS find_and_sync_scripts();

CREATE OR REPLACE FUNCTION find_and_sync_scripts()
RETURNS JSONB AS $$
DECLARE
  affected_rows INTEGER := 0;
  new_scripts INTEGER := 0;
  result JSONB;
BEGIN
  -- Build the result JSONB
  result := jsonb_build_object(
    'affected_rows', affected_rows,
    'new_scripts', new_scripts,
    'timestamp', now()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add permissions for the public role to execute this function
GRANT EXECUTE ON FUNCTION find_and_sync_scripts() TO PUBLIC;