-- Individual counts for display
SELECT 'In metadata direct' as location, COUNT(*) as count 
FROM documentation_files 
WHERE metadata->>'status_recommendation' IS NOT NULL;

SELECT 'In ai_assessment' as location, COUNT(*) as count 
FROM documentation_files 
WHERE metadata->'ai_assessment'->>'status_recommendation' IS NOT NULL;

SELECT 'In processed_content.assessment' as location, COUNT(*) as count 
FROM documentation_files 
WHERE metadata->'processed_content'->'assessment'->>'status_recommendation' IS NOT NULL;

SELECT 'In processed_content direct' as location, COUNT(*) as count 
FROM documentation_files 
WHERE metadata->'processed_content'->>'status_recommendation' IS NOT NULL;

SELECT 'Records with status_recommendation field populated' as location, COUNT(*) as count 
FROM documentation_files 
WHERE status_recommendation IS NOT NULL;

-- Total unique records with status in metadata
SELECT 'Total unique records with status in metadata' as metric, COUNT(*) as count 
FROM documentation_files
WHERE metadata->>'status_recommendation' IS NOT NULL 
   OR metadata->'ai_assessment'->>'status_recommendation' IS NOT NULL
   OR metadata->'processed_content'->'assessment'->>'status_recommendation' IS NOT NULL
   OR metadata->'processed_content'->>'status_recommendation' IS NOT NULL;

-- Records that need migration
SELECT 'Records still needing migration' as metric, COUNT(*) as count
FROM documentation_files
WHERE (
    metadata->>'status_recommendation' IS NOT NULL 
    OR metadata->'ai_assessment'->>'status_recommendation' IS NOT NULL
    OR metadata->'processed_content'->'assessment'->>'status_recommendation' IS NOT NULL
    OR metadata->'processed_content'->>'status_recommendation' IS NOT NULL
) AND status_recommendation IS NULL;

-- Run the migration steps again
UPDATE documentation_files 
SET status_recommendation = metadata->>'status_recommendation'
WHERE metadata->>'status_recommendation' IS NOT NULL
AND status_recommendation IS NULL;

UPDATE documentation_files 
SET status_recommendation = metadata->'ai_assessment'->>'status_recommendation'
WHERE metadata->'ai_assessment'->>'status_recommendation' IS NOT NULL
AND status_recommendation IS NULL;

UPDATE documentation_files 
SET status_recommendation = metadata->'processed_content'->'assessment'->>'status_recommendation'
WHERE metadata->'processed_content'->'assessment'->>'status_recommendation' IS NOT NULL
AND status_recommendation IS NULL;

UPDATE documentation_files 
SET status_recommendation = metadata->'processed_content'->>'status_recommendation'
WHERE metadata->'processed_content'->>'status_recommendation' IS NOT NULL
AND status_recommendation IS NULL;

UPDATE documentation_files 
SET status_recommendation = UPPER(status_recommendation)
WHERE status_recommendation IS NOT NULL;

-- Final counts after migration
SELECT 'After migration - Records with status_recommendation field populated' as metric, COUNT(*) as count 
FROM documentation_files 
WHERE status_recommendation IS NOT NULL;

SELECT 'After migration - Records still needing migration' as metric, COUNT(*) as count
FROM documentation_files
WHERE (
    metadata->>'status_recommendation' IS NOT NULL 
    OR metadata->'ai_assessment'->>'status_recommendation' IS NOT NULL
    OR metadata->'processed_content'->'assessment'->>'status_recommendation' IS NOT NULL
    OR metadata->'processed_content'->>'status_recommendation' IS NOT NULL
) AND status_recommendation IS NULL;
