-- Function to get unclassified documents with content
CREATE OR REPLACE FUNCTION get_unclassified_documents_with_content(entity_type_param TEXT, limit_param INTEGER)
RETURNS SETOF google_expert_documents AS $$
BEGIN
  RETURN QUERY
  SELECT ed.*
  FROM google_expert_documents ed
  WHERE 
    ed.processed_content IS NOT NULL
    AND ed.source_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM learn_document_classifications tc 
      WHERE tc.entity_id = ed.id 
      AND tc.entity_type = entity_type_param
    )
  ORDER BY ed.updated_at DESC
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;