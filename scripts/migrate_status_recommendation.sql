-- Migrate status_recommendation from different locations in metadata to the new column

-- First update from the direct status_recommendation in metadata
UPDATE documentation_files 
SET status_recommendation = metadata->>'status_recommendation'
WHERE metadata->>'status_recommendation' IS NOT NULL
AND status_recommendation IS NULL;

-- Then update from ai_assessment.status_recommendation structure
UPDATE documentation_files 
SET status_recommendation = metadata->'ai_assessment'->>'status_recommendation'
WHERE metadata->'ai_assessment'->>'status_recommendation' IS NOT NULL
AND status_recommendation IS NULL;

-- Finally update from processed_content.assessment.status_recommendation structure
UPDATE documentation_files 
SET status_recommendation = metadata->'processed_content'->'assessment'->>'status_recommendation'
WHERE metadata->'processed_content'->'assessment'->>'status_recommendation' IS NOT NULL
AND status_recommendation IS NULL;

-- Log how many records were updated
SELECT 'Number of records with status_recommendation: ' || COUNT(*) as status_count
FROM documentation_files
WHERE status_recommendation IS NOT NULL;