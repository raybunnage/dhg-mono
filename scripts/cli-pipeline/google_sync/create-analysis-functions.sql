-- Function to get skip reason counts
CREATE OR REPLACE FUNCTION get_skip_reason_counts()
RETURNS TABLE (
  processing_skip_reason TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ed.processing_skip_reason,
    COUNT(*) as count
  FROM 
    expert_documents ed
  WHERE 
    ed.google_file_id IS NOT NULL
  GROUP BY 
    ed.processing_skip_reason
  ORDER BY 
    count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get file extension and skip reason counts
CREATE OR REPLACE FUNCTION get_extension_skip_reason_counts()
RETURNS TABLE (
  processing_skip_reason TEXT,
  file_extension TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ed.processing_skip_reason,
    sg.file_extension,
    COUNT(*) as count
  FROM 
    expert_documents ed
  JOIN 
    google_sources sg ON ed.google_file_id = sg.file_id
  GROUP BY 
    ed.processing_skip_reason, sg.file_extension
  ORDER BY 
    sg.file_extension, count DESC;
END;
$$ LANGUAGE plpgsql;