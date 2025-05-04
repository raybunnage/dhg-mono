-- This is a simpler migration that just updates the active_scripts_view
-- and removes the dependence on is_deleted

-- First drop the view
DROP VIEW IF EXISTS active_scripts_view;

-- Then recreate it without the WHERE clause that references is_deleted
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