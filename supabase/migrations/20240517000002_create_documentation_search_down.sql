-- Migration: Drop Documentation Search Functionality (Down Migration)
-- Description: Reverts the creation of documentation search functionality

-- Drop functions
DROP FUNCTION IF EXISTS search_documents_by_tag(TEXT, INTEGER);
DROP FUNCTION IF EXISTS find_related_documents(UUID, INTEGER);
DROP FUNCTION IF EXISTS search_documentation(TEXT, INTEGER);

-- Drop indexes
DROP INDEX IF EXISTS idx_documentation_sections_summary_tsvector;
DROP INDEX IF EXISTS idx_documentation_sections_heading_tsvector;
DROP INDEX IF EXISTS idx_documentation_files_summary_tsvector;
DROP INDEX IF EXISTS idx_documentation_files_title_tsvector; 