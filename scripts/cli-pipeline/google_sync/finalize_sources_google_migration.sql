-- Only run this after thorough validation!
-- This script finalizes the migration by renaming tables and creating a compatibility view

-- Split into separate statements to be executed one at a time

-- 1. Rename the original table (keep it as a backup)
ALTER TABLE google_sources RENAME TO google_sources_deprecated;

-- 2. Apply the updated schema to google_sources
-- (No rename required since we are directly working with google_sources now)

-- 3. Create a view for backward compatibility
CREATE OR REPLACE VIEW google_sources_legacy_view AS
SELECT
    id,
    drive_id,
    name,
    mime_type,
    parent_folder_id AS parent_id,
    is_deleted AS deleted,
    root_drive_id,
    path,
    metadata,
    size AS size_bytes,
    modified_time,
    web_view_link,
    thumbnail_link,
    content_extracted,
    extracted_content,
    document_type_id,
    created_at,
    updated_at,
    last_indexed,
    main_video_id
FROM
    google_sources;

-- 4. Ensure all critical indexes exist
-- These should already exist on our table
CREATE INDEX IF NOT EXISTS google_sources_drive_id_idx ON google_sources(drive_id);
CREATE INDEX IF NOT EXISTS google_sources_root_drive_id_idx ON google_sources(root_drive_id);
CREATE INDEX IF NOT EXISTS google_sources_parent_folder_id_idx ON google_sources(parent_folder_id);
CREATE INDEX IF NOT EXISTS google_sources_mime_type_idx ON google_sources(mime_type);
CREATE INDEX IF NOT EXISTS google_sources_path_idx ON google_sources(path);
CREATE INDEX IF NOT EXISTS google_sources_name_idx ON google_sources(name);
CREATE INDEX IF NOT EXISTS google_sources_document_type_id_idx ON google_sources(document_type_id);