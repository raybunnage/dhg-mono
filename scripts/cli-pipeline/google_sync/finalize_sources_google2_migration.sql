-- Only run this after thorough validation!
-- This script finalizes the migration by renaming tables and creating a compatibility view

-- Split into separate statements to be executed one at a time

-- 1. Rename the original table (keep it as a backup)
ALTER TABLE sources_google RENAME TO sources_google_deprecated;

-- 2. Rename the new table to the original name
ALTER TABLE sources_google2 RENAME TO sources_google;

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

-- 4. Recreate any critical indexes that might be missing
-- These should already exist on our new table, but this ensures they're named correctly
ALTER INDEX IF EXISTS sources_google2_drive_id_idx RENAME TO sources_google_drive_id_idx;
ALTER INDEX IF EXISTS sources_google2_root_drive_id_idx RENAME TO sources_google_root_drive_id_idx;
ALTER INDEX IF EXISTS sources_google2_parent_folder_id_idx RENAME TO sources_google_parent_folder_id_idx;
ALTER INDEX IF EXISTS sources_google2_mime_type_idx RENAME TO sources_google_mime_type_idx;
ALTER INDEX IF EXISTS sources_google2_path_idx RENAME TO sources_google_path_idx;
ALTER INDEX IF EXISTS sources_google2_name_idx RENAME TO sources_google_name_idx;
ALTER INDEX IF EXISTS sources_google2_document_type_id_idx RENAME TO sources_google_document_type_id_idx;
ALTER INDEX IF EXISTS sources_google2_expert_id_idx RENAME TO sources_google_expert_id_idx;