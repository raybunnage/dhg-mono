-- Migration: Create Documentation Search Functionality
-- Description: Functions and indexes for searching documentation

-- Create search indexes
CREATE INDEX idx_documentation_files_title_tsvector ON documentation_files 
USING GIN (to_tsvector('english', title));

CREATE INDEX idx_documentation_files_summary_tsvector ON documentation_files 
USING GIN (to_tsvector('english', summary));

CREATE INDEX idx_documentation_sections_heading_tsvector ON documentation_sections 
USING GIN (to_tsvector('english', heading));

CREATE INDEX idx_documentation_sections_summary_tsvector ON documentation_sections 
USING GIN (to_tsvector('english', summary));

-- Function to search documentation
CREATE OR REPLACE FUNCTION search_documentation(
  search_query TEXT,
  limit_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  path TEXT,
  section_heading TEXT,
  section_anchor TEXT,
  relevance FLOAT
) AS $$
BEGIN
  RETURN QUERY
  
  -- Search in document titles and summaries
  SELECT 
    df.id,
    'document'::TEXT as type,
    df.title,
    df.file_path as path,
    NULL::TEXT as section_heading,
    NULL::TEXT as section_anchor,
    ts_rank(to_tsvector('english', df.title || ' ' || COALESCE(df.summary, '')), 
            plainto_tsquery('english', search_query)) as relevance
  FROM documentation_files df
  WHERE 
    to_tsvector('english', df.title || ' ' || COALESCE(df.summary, '')) @@ 
    plainto_tsquery('english', search_query)
  
  UNION ALL
  
  -- Search in document sections
  SELECT 
    ds.id,
    'section'::TEXT as type,
    df.title,
    df.file_path as path,
    ds.heading as section_heading,
    ds.anchor_id as section_anchor,
    ts_rank(to_tsvector('english', ds.heading || ' ' || COALESCE(ds.summary, '')), 
            plainto_tsquery('english', search_query)) as relevance
  FROM documentation_sections ds
  JOIN documentation_files df ON ds.file_id = df.id
  WHERE 
    to_tsvector('english', ds.heading || ' ' || COALESCE(ds.summary, '')) @@ 
    plainto_tsquery('english', search_query)
  
  ORDER BY relevance DESC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql;

-- Function to find related documents
CREATE OR REPLACE FUNCTION find_related_documents(
  document_id UUID,
  limit_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  path TEXT,
  relation_type TEXT,
  relevance FLOAT
) AS $$
BEGIN
  RETURN QUERY
  
  -- First get explicitly related documents
  SELECT 
    df.id,
    df.title,
    df.file_path as path,
    dr.relation_type,
    1.0::FLOAT as relevance
  FROM documentation_relations dr
  JOIN documentation_files df ON dr.target_id = df.id
  WHERE dr.source_id = document_id
  
  UNION ALL
  
  -- Then get documents with similar tags
  SELECT 
    df2.id,
    df2.title,
    df2.file_path as path,
    'similar_tags'::TEXT as relation_type,
    -- Calculate similarity based on number of shared tags
    (SELECT COUNT(*) FROM 
      (SELECT UNNEST(df1.ai_generated_tags) INTERSECT SELECT UNNEST(df2.ai_generated_tags)) as shared_tags)::FLOAT / 
    (SELECT COUNT(*) FROM 
      (SELECT UNNEST(df1.ai_generated_tags) UNION SELECT UNNEST(df2.ai_generated_tags)) as all_tags)::FLOAT as relevance
  FROM documentation_files df1
  JOIN documentation_files df2 ON df1.id != df2.id
  WHERE 
    df1.id = document_id AND
    df2.id NOT IN (
      SELECT target_id FROM documentation_relations WHERE source_id = document_id
    ) AND
    df1.ai_generated_tags && df2.ai_generated_tags
  
  ORDER BY relevance DESC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql;

-- Function to search documents by tag
CREATE OR REPLACE FUNCTION search_documents_by_tag(
  tag_name TEXT,
  limit_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  path TEXT,
  tag_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    df.id,
    df.title,
    df.file_path as path,
    CASE 
      WHEN tag_name = ANY(df.manual_tags) THEN 'manual'
      ELSE 'ai_generated'
    END as tag_type
  FROM documentation_files df
  WHERE 
    tag_name = ANY(df.ai_generated_tags) OR
    tag_name = ANY(df.manual_tags)
  ORDER BY 
    -- Prioritize manual tags over AI-generated ones
    CASE WHEN tag_name = ANY(df.manual_tags) THEN 0 ELSE 1 END,
    df.title
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql; 