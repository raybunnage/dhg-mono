-- Only run this after thorough validation!
-- This script finalizes the migration by renaming tables and creating a compatibility view

-- Split into separate statements to be executed one at a time

-- 1. Rename the original table (keep it as a backup)
ALTER TABLE sources_google RENAME TO sources_google_deprecated;

-- 2. Apply the updated schema to sources_google
-- (No rename required since we are directly working with sources_google now)

-- 3. Create a view for backward compatibility
CREATE OR REPLACE VIEW sources_google_legacy_view AS
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
    expert_id,
    created_at,
    updated_at,
    last_indexed,
    main_video_id
FROM
    sources_google;

-- 4. Ensure all critical indexes exist
-- These should already exist on our table
CREATE INDEX IF NOT EXISTS sources_google_drive_id_idx ON sources_google(drive_id);
CREATE INDEX IF NOT EXISTS sources_google_root_drive_id_idx ON sources_google(root_drive_id);
CREATE INDEX IF NOT EXISTS sources_google_parent_folder_id_idx ON sources_google(parent_folder_id);
CREATE INDEX IF NOT EXISTS sources_google_mime_type_idx ON sources_google(mime_type);
CREATE INDEX IF NOT EXISTS sources_google_path_idx ON sources_google(path);
CREATE INDEX IF NOT EXISTS sources_google_name_idx ON sources_google(name);
CREATE INDEX IF NOT EXISTS sources_google_document_type_id_idx ON sources_google(document_type_id);
CREATE INDEX IF NOT EXISTS sources_google_expert_id_idx ON sources_google(expert_id);