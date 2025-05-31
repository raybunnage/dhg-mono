-- Migration: Enhance doc_files table for documentation management system
-- Date: 2025-06-01
-- Purpose: Add fields to support auto-updates, importance scoring, and better tracking

-- Add new columns to doc_files table
ALTER TABLE doc_files 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS auto_update_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS update_frequency INTERVAL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS update_source TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 3 CHECK (importance_score >= 1 AND importance_score <= 5),
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_doc_files_importance_score ON doc_files(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_doc_files_auto_update ON doc_files(auto_update_enabled) WHERE auto_update_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_doc_files_tags ON doc_files USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_doc_files_last_synced ON doc_files(last_synced_at);

-- Create a function to increment view count
CREATE OR REPLACE FUNCTION increment_doc_view_count(doc_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE doc_files 
    SET view_count = view_count + 1,
        updated_at = NOW()
    WHERE id = doc_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get documents needing auto-update
CREATE OR REPLACE FUNCTION get_docs_needing_update()
RETURNS TABLE (
    id UUID,
    file_path TEXT,
    update_source TEXT,
    update_frequency INTERVAL,
    last_synced_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        df.id,
        df.file_path,
        df.update_source,
        df.update_frequency,
        df.last_synced_at
    FROM doc_files df
    WHERE df.auto_update_enabled = TRUE
      AND df.update_frequency IS NOT NULL
      AND df.update_source IS NOT NULL
      AND (df.last_synced_at + df.update_frequency) < NOW()
    ORDER BY df.importance_score DESC, df.last_synced_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to search documents by tags
CREATE OR REPLACE FUNCTION search_docs_by_tags(search_tags TEXT[])
RETURNS TABLE (
    id UUID,
    file_path TEXT,
    title TEXT,
    tags TEXT[],
    importance_score INTEGER,
    document_type_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        df.id,
        df.file_path,
        df.title,
        df.tags,
        df.importance_score,
        df.document_type_id
    FROM doc_files df
    WHERE df.tags && search_tags  -- Array overlap operator
    ORDER BY df.importance_score DESC, df.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comment to explain the new columns
COMMENT ON COLUMN doc_files.last_synced_at IS 'Last time this document was synced from filesystem';
COMMENT ON COLUMN doc_files.auto_update_enabled IS 'Whether this document should be automatically updated';
COMMENT ON COLUMN doc_files.update_frequency IS 'How often to update (e.g., ''1 day''::interval)';
COMMENT ON COLUMN doc_files.update_source IS 'Source for auto-updates (e.g., cli_pipelines, apps_directory)';
COMMENT ON COLUMN doc_files.importance_score IS 'Document importance from 1 (low) to 5 (high)';
COMMENT ON COLUMN doc_files.view_count IS 'Number of times document has been viewed';
COMMENT ON COLUMN doc_files.tags IS 'Array of tags for filtering and organization';