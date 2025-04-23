-- Function to find duplicate expert documents by source_id
CREATE OR REPLACE FUNCTION find_duplicate_expert_documents(result_limit integer DEFAULT 50)
RETURNS TABLE (
  source_id uuid,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ed.source_id,
    COUNT(*) as count
  FROM 
    expert_documents ed
  WHERE 
    ed.source_id IS NOT NULL
  GROUP BY 
    ed.source_id
  HAVING 
    COUNT(*) > 1
  ORDER BY 
    COUNT(*) DESC
  LIMIT 
    result_limit;
END;
$$ LANGUAGE plpgsql;