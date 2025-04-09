-- Phase 2: Enhanced recursive relationship fixing and main_video_id association
-- This phase builds on the initial data copy to establish proper hierarchical relationships

-- Step 1: Fix paths that don't start with a slash
UPDATE public.sources_google2
SET path = '/' || path
WHERE path NOT LIKE '/%';

-- Step 2: Regenerate path_array for any rows where it might be wrong
UPDATE public.sources_google2
SET path_array = string_to_array(path, '/'),
    path_depth = array_length(string_to_array(path, '/'), 1);

-- Step 3: Add a special update to fix any remaining null root_drive_id values
UPDATE public.sources_google2
SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
WHERE root_drive_id IS NULL 
  OR root_drive_id = '';

-- Step 4: Enhanced recursive CTE to build proper paths with full hierarchy detection
WITH RECURSIVE folder_hierarchy AS (
    -- Base case: root folders (multiple identification approaches)
    SELECT 
        id, 
        drive_id,
        name,
        parent_folder_id,
        '/' || name AS path,
        1 AS level,
        drive_id AS root_drive_id,
        NULL::uuid AS main_video_id  -- Start with NULL main_video_id
    FROM 
        sources_google2
    WHERE 
        mime_type = 'application/vnd.google-apps.folder'
        AND (
            is_root = true OR  -- Explicit roots
            parent_folder_id IS NULL OR -- No parent
            drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' OR -- Dynamic Healing folder
            parent_folder_id NOT IN (SELECT drive_id FROM sources_google2) -- External parent
        )
    
    UNION ALL
    
    -- Recursive case: child folders/files with full path and root inheritance
    SELECT 
        c.id,
        c.drive_id, 
        c.name,
        c.parent_folder_id,
        p.path || '/' || c.name AS path,
        p.level + 1,
        p.root_drive_id, -- Inherit root_drive_id from parent
        p.main_video_id  -- Inherit main_video_id from parent (will be updated later)
    FROM 
        sources_google2 c
    JOIN 
        folder_hierarchy p ON c.parent_folder_id = p.drive_id
)
-- Update both paths and root_drive_id in one operation
UPDATE sources_google2 s2
SET 
    path = fh.path,
    root_drive_id = fh.root_drive_id,
    path_array = string_to_array(fh.path, '/'),
    path_depth = array_length(string_to_array(fh.path, '/'), 1)
FROM folder_hierarchy fh
WHERE s2.id = fh.id;

-- Step 5: Additional comprehensive fix for files by pattern matching
-- This catches any files the hierarchy didn't fix
UPDATE sources_google2 s2
SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
WHERE 
    (
        path LIKE '%Dynamic Healing%' OR
        path LIKE '%/Dynamic-Healing%' OR
        path LIKE '%/dynamic_healing%' OR
        name LIKE '%Dynamic Healing%' OR
        mime_type IN ('video/mp4', 'audio/x-m4a', 'text/plain') -- Known types in Dynamic Healing
    )
    AND (root_drive_id IS NULL OR root_drive_id = '' OR root_drive_id = drive_id);

-- Step 6: Special fix for transcript files that might be outside the hierarchy
UPDATE sources_google2 s2
SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
WHERE 
    (
        name ILIKE '%transcript%' OR
        path ILIKE '%transcript%'
    )
    AND mime_type IN ('text/plain', 'application/vnd.google-apps.document')
    AND (root_drive_id IS NULL OR root_drive_id = '' OR root_drive_id = drive_id);

-- Step 7: Find main_video_id for each presentation folder
-- First identify the presentation folders directly under Dynamic Healing root
-- We'll do it in simpler separate statements to avoid complex blocks

-- Find main_video_id for files in the roots we have
UPDATE sources_google2 s2
SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
WHERE 
    path LIKE '%/Dynamic Healing Discussion Group/%'
    AND root_drive_id IS NULL;

-- Also add Polyvagal Steering Group if needed
UPDATE sources_google2 s2
SET root_drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'
WHERE 
    path LIKE '%/Polyvagal Steering Group/%'
    AND root_drive_id IS NULL;

-- Link any transcript files to their video files based on name matching
UPDATE sources_google2 transcript
SET main_video_id = video.id
FROM sources_google2 video
WHERE 
    transcript.mime_type IN ('text/plain', 'application/vnd.google-apps.document')
    AND transcript.name ILIKE '%transcript%'
    AND transcript.main_video_id IS NULL
    AND video.mime_type = 'video/mp4'
    AND replace(transcript.name, '_transcript', '') ILIKE ('%' || replace(video.name, '.mp4', '') || '%')
    AND (
        (transcript.root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' AND video.root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
        OR
        (transcript.root_drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc' AND video.root_drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc')
    );