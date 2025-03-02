-- Migration: Drop Documentation Processing Functions (Down Migration)
-- Description: Reverts the creation of documentation processing functions

-- Drop functions in reverse order of dependencies
DROP FUNCTION IF EXISTS get_next_file_for_processing();
DROP FUNCTION IF EXISTS update_document_ai_metadata(UUID, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS register_document_relation(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS register_document_section(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS register_markdown_file(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS extract_filename(TEXT); 