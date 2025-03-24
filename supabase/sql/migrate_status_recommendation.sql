-- Create a stored procedure to handle the status recommendation migration
CREATE OR REPLACE FUNCTION migrate_status_recommendation()
RETURNS void AS $$
DECLARE
  rec RECORD;
  total_updated INT := 0;
  status_rec TEXT;
BEGIN
  -- First update from the direct status_recommendation in metadata
  UPDATE documentation_files 
  SET status_recommendation = metadata->>'status_recommendation'
  WHERE metadata->>'status_recommendation' IS NOT NULL
  AND status_recommendation IS NULL;
  
  GET DIAGNOSTICS rec = ROW_COUNT;
  total_updated := total_updated + rec;
  RAISE NOTICE 'Updated % rows from direct metadata status', rec;
  
  -- Then update from ai_assessment.status_recommendation structure
  UPDATE documentation_files 
  SET status_recommendation = metadata->'ai_assessment'->>'status_recommendation'
  WHERE metadata->'ai_assessment'->>'status_recommendation' IS NOT NULL
  AND status_recommendation IS NULL;
  
  GET DIAGNOSTICS rec = ROW_COUNT;
  total_updated := total_updated + rec;
  RAISE NOTICE 'Updated % rows from ai_assessment structure', rec;
  
  -- Update from processed_content.assessment.status_recommendation structure
  UPDATE documentation_files 
  SET status_recommendation = metadata->'processed_content'->'assessment'->>'status_recommendation'
  WHERE metadata->'processed_content'->'assessment'->>'status_recommendation' IS NOT NULL
  AND status_recommendation IS NULL;
  
  GET DIAGNOSTICS rec = ROW_COUNT;
  total_updated := total_updated + rec;
  RAISE NOTICE 'Updated % rows from processed_content.assessment structure', rec;
  
  -- Handle the case when status recommendation is inside processed_content directly
  UPDATE documentation_files 
  SET status_recommendation = metadata->'processed_content'->>'status_recommendation'
  WHERE metadata->'processed_content'->>'status_recommendation' IS NOT NULL
  AND status_recommendation IS NULL;
  
  GET DIAGNOSTICS rec = ROW_COUNT;
  total_updated := total_updated + rec;
  RAISE NOTICE 'Updated % rows from processed_content direct', rec;
  
  -- Standardize status values to uppercase for consistency
  UPDATE documentation_files 
  SET status_recommendation = UPPER(status_recommendation)
  WHERE status_recommendation IS NOT NULL;
  
  GET DIAGNOSTICS rec = ROW_COUNT;
  total_updated := total_updated + rec;
  RAISE NOTICE 'Standardized % values to uppercase', rec;
  
  -- Set default values for null status_recommendation if document is old
  UPDATE documentation_files
  SET status_recommendation = 'REVIEW'
  WHERE status_recommendation IS NULL
  AND created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS rec = ROW_COUNT;
  total_updated := total_updated + rec;
  RAISE NOTICE 'Set % old documents to REVIEW', rec;
  
  -- Log how many records were updated and the distribution of status values
  RAISE NOTICE 'Total records updated: %', total_updated;
  
  RAISE NOTICE 'Status distribution:';
  FOR status_rec IN (
    SELECT 
      status_recommendation, 
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM documentation_files WHERE status_recommendation IS NOT NULL), 2) as percentage
    FROM documentation_files
    WHERE status_recommendation IS NOT NULL
    GROUP BY status_recommendation
    ORDER BY count DESC
  ) LOOP
    RAISE NOTICE '%', status_rec;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT migrate_status_recommendation();