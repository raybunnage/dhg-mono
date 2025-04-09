-- Phase 1: Initial data migration with metadata cleanup
-- Copy and clean basic data from original table with complete data cleanup

INSERT INTO public.sources_google2 (
    -- Core identity fields
    id, name, mime_type, drive_id,
    
    -- Enhanced hierarchy fields
    root_drive_id, parent_folder_id, path, is_root,
    
    -- Set path_array and path_depth from path
    path_array, path_depth,
    
    -- Soft delete
    is_deleted,
    
    -- Metadata and file attributes
    metadata, size, modified_time, web_view_link, thumbnail_link,
    
    -- Processing fields
    content_extracted, extracted_content,
    
    -- Foreign keys
    document_type_id, expert_id,
    
    -- Timestamps
    created_at, updated_at, last_indexed
)
SELECT 
    -- Core identity fields
    id, name, mime_type, drive_id,
    
    -- Enhanced hierarchy - CRITICAL: Set default root_drive_id for Dynamic Healing Group folder
    COALESCE(root_drive_id, 
             CASE WHEN drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' THEN drive_id
                  WHEN path LIKE '%Dynamic Healing Discussion Group%' THEN '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
                  ELSE drive_id END) AS root_drive_id,
                  
    -- Use parent_id as parent_folder_id
    parent_id,
    
    -- Paths - COALESCE ensures no NULLs
    COALESCE(path, '/' || name) AS path,
    is_root,
    
    -- Parse path into array and compute depth 
    string_to_array(COALESCE(path, '/' || name), '/') AS path_array,
    array_length(string_to_array(COALESCE(path, '/' || name), '/'), 1) AS path_depth,
    
    -- Convert deleted to is_deleted
    COALESCE(deleted, false) AS is_deleted,
    
    -- Metadata and file attributes
    metadata,
    COALESCE(size, size_bytes, (metadata->>'size')::bigint) AS size,
    modified_time, web_view_link, thumbnail_link,
    
    -- Processing fields
    content_extracted, extracted_content,
    
    -- Foreign keys
    document_type_id, expert_id,
    
    -- Timestamps
    created_at, updated_at, last_indexed
FROM 
    public.sources_google;
    
-- Fix paths that don't start with a slash
UPDATE public.sources_google2
SET path = '/' || path
WHERE path NOT LIKE '/%';

-- Regenerate path_array for any rows where it might be wrong
UPDATE public.sources_google2
SET path_array = string_to_array(path, '/'),
    path_depth = array_length(string_to_array(path, '/'), 1);

-- Add a special update to fix any remaining null root_drive_id values
UPDATE public.sources_google2
SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
WHERE root_drive_id IS NULL 
  OR root_drive_id = '';
