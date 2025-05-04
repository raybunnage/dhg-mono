-- Function to extract and count tags from documentation_files
CREATE OR REPLACE FUNCTION public.get_tag_counts(is_deleted_exists boolean)
RETURNS TABLE (tag text, count bigint) AS $$
BEGIN
  IF is_deleted_exists THEN
    RETURN QUERY
    WITH tag_array AS (
      -- Get tags from ai_generated_tags
      SELECT unnest(ai_generated_tags) AS tag_value
      FROM documentation_files
      WHERE NOT is_deleted
      UNION ALL
      -- Get tags from manual_tags
      SELECT unnest(manual_tags) AS tag_value
      FROM documentation_files
      WHERE NOT is_deleted
    )
    SELECT tag_value, COUNT(*) AS count
    FROM tag_array
    WHERE tag_value IS NOT NULL AND tag_value \!= ''
    GROUP BY tag_value
    ORDER BY count DESC, tag_value;
  ELSE
    RETURN QUERY
    WITH tag_array AS (
      -- Get tags from ai_generated_tags
      SELECT unnest(ai_generated_tags) AS tag_value
      FROM documentation_files
      UNION ALL
      -- Get tags from manual_tags
      SELECT unnest(manual_tags) AS tag_value
      FROM documentation_files
    )
    SELECT tag_value, COUNT(*) AS count
    FROM tag_array
    WHERE tag_value IS NOT NULL AND tag_value \!= ''
    GROUP BY tag_value
    ORDER BY count DESC, tag_value;
  END IF;
END;
$$ LANGUAGE plpgsql;
