-- Migration: Create Documentation Processing Functions
-- Description: Functions for processing markdown files and managing documentation metadata

-- Function to extract a filename from a path
CREATE OR REPLACE FUNCTION extract_filename(file_path TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN substring(file_path from '([^/]+)(?:\.[^.]+)?$');
END;
$$ LANGUAGE plpgsql;

-- Function to register a markdown file in the system
CREATE OR REPLACE FUNCTION register_markdown_file(
  p_file_path TEXT,
  p_title TEXT DEFAULT NULL,
  p_file_hash TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  v_file_id UUID;
  v_title TEXT;
BEGIN
  -- Determine title if not provided
  IF p_title IS NULL THEN
    v_title := extract_filename(p_file_path);
  ELSE
    v_title := p_title;
  END IF;

  -- Check if file already exists
  SELECT id INTO v_file_id FROM documentation_files WHERE file_path = p_file_path;
  
  IF v_file_id IS NULL THEN
    -- Insert new file record
    INSERT INTO documentation_files (
      file_path,
      title,
      last_modified_at,
      last_indexed_at,
      file_hash,
      metadata
    ) VALUES (
      p_file_path,
      v_title,
      now(),
      now(),
      p_file_hash,
      p_metadata
    )
    RETURNING id INTO v_file_id;
  ELSE
    -- Update existing file record
    UPDATE documentation_files
    SET
      title = v_title,
      last_modified_at = now(),
      last_indexed_at = now(),
      file_hash = COALESCE(p_file_hash, file_hash),
      metadata = COALESCE(p_metadata, metadata)
    WHERE id = v_file_id;
  END IF;
  
  -- Queue for AI processing
  PERFORM queue_documentation_file_for_processing(v_file_id);
  
  RETURN v_file_id;
END;
$$ LANGUAGE plpgsql;

-- Function to register a section within a document
CREATE OR REPLACE FUNCTION register_document_section(
  p_file_id UUID,
  p_heading TEXT,
  p_level INTEGER,
  p_position INTEGER,
  p_anchor_id TEXT,
  p_summary TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_section_id UUID;
BEGIN
  -- Check if section already exists
  SELECT id INTO v_section_id 
  FROM documentation_sections 
  WHERE file_id = p_file_id AND anchor_id = p_anchor_id;
  
  IF v_section_id IS NULL THEN
    -- Insert new section
    INSERT INTO documentation_sections (
      file_id,
      heading,
      level,
      position,
      anchor_id,
      summary
    ) VALUES (
      p_file_id,
      p_heading,
      p_level,
      p_position,
      p_anchor_id,
      p_summary
    )
    RETURNING id INTO v_section_id;
  ELSE
    -- Update existing section
    UPDATE documentation_sections
    SET
      heading = p_heading,
      level = p_level,
      position = p_position,
      summary = COALESCE(p_summary, summary)
    WHERE id = v_section_id;
  END IF;
  
  RETURN v_section_id;
END;
$$ LANGUAGE plpgsql;

-- Function to register a relationship between documents
CREATE OR REPLACE FUNCTION register_document_relation(
  p_source_id UUID,
  p_target_id UUID,
  p_relation_type TEXT
)
RETURNS UUID AS $$
DECLARE
  v_relation_id UUID;
BEGIN
  -- Check if relation already exists
  SELECT id INTO v_relation_id 
  FROM documentation_relations 
  WHERE source_id = p_source_id AND target_id = p_target_id AND relation_type = p_relation_type;
  
  IF v_relation_id IS NULL THEN
    -- Insert new relation
    INSERT INTO documentation_relations (
      source_id,
      target_id,
      relation_type
    ) VALUES (
      p_source_id,
      p_target_id,
      p_relation_type
    )
    RETURNING id INTO v_relation_id;
  END IF;
  
  RETURN v_relation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update document AI-generated metadata
CREATE OR REPLACE FUNCTION update_document_ai_metadata(
  p_file_id UUID,
  p_summary TEXT,
  p_ai_generated_tags TEXT[]
)
RETURNS VOID AS $$
BEGIN
  UPDATE documentation_files
  SET
    summary = p_summary,
    ai_generated_tags = p_ai_generated_tags
  WHERE id = p_file_id;
  
  -- Mark processing as complete
  UPDATE documentation_processing_queue
  SET
    status = 'completed',
    updated_at = now()
  WHERE file_id = p_file_id AND status = 'processing';
END;
$$ LANGUAGE plpgsql;

-- Function to get the next file for AI processing
CREATE OR REPLACE FUNCTION get_next_file_for_processing()
RETURNS TABLE (
  queue_id UUID,
  file_id UUID,
  file_path TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH next_file AS (
    SELECT 
      dpq.id as queue_id,
      dpq.file_id,
      df.file_path
    FROM documentation_processing_queue dpq
    JOIN documentation_files df ON dpq.file_id = df.id
    WHERE dpq.status = 'pending'
    ORDER BY dpq.priority DESC, dpq.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE documentation_processing_queue dpq
  SET 
    status = 'processing',
    attempts = attempts + 1,
    last_attempt_at = now()
  FROM next_file
  WHERE dpq.id = next_file.queue_id
  RETURNING next_file.queue_id, next_file.file_id, next_file.file_path;
END;
$$ LANGUAGE plpgsql; 