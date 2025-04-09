-- Phase 2: Enhanced recursive relationship fixing and main_video_id association
-- This phase builds on the initial data copy to establish proper hierarchical relationships

-- Step 1: Enhanced recursive CTE to build proper paths with full hierarchy detection
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

-- Step 2: Additional comprehensive fix for files by pattern matching
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

-- Step 3: Special fix for transcript files that might be outside the hierarchy
UPDATE sources_google2 s2
SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
WHERE 
    (
        name ILIKE '%transcript%' OR
        path ILIKE '%transcript%'
    )
    AND mime_type IN ('text/plain', 'application/vnd.google-apps.document')
    AND (root_drive_id IS NULL OR root_drive_id = '' OR root_drive_id = drive_id);

-- Step 4: Find main_video_id for each presentation folder
-- First identify the presentation folders directly under Dynamic Healing root
WITH presentation_folders AS (
    SELECT 
        id,
        drive_id,
        name,
        path
    FROM 
        sources_google2
    WHERE 
        mime_type = 'application/vnd.google-apps.folder'
        AND parent_folder_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
        AND root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
)
-- For each presentation folder, find its MP4 file and update all related records
UPDATE sources_google2 sg2
SET main_video_id = mp4_files.id
FROM (
    -- Find all MP4 files for each presentation folder
    SELECT 
        pf.drive_id AS folder_id,
        videos.id,
        videos.drive_id,
        videos.name
    FROM 
        presentation_folders pf
    JOIN 
        sources_google2 videos ON 
            (videos.path LIKE (pf.path || '/%') OR videos.parent_folder_id = pf.drive_id)
            AND videos.mime_type = 'video/mp4'
            AND videos.is_deleted = false
) mp4_files
WHERE 
    -- Match all files belonging to the same presentation (same path prefix)
    (sg2.path LIKE (SELECT path || '/%' FROM presentation_folders WHERE drive_id = mp4_files.folder_id)
     OR sg2.parent_folder_id = mp4_files.folder_id)
    AND sg2.root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

-- Step 5: Handle nested presentation folders that aren't direct children of the root
-- This ensures we catch presentations that might be in deeper subfolders
WITH mp4_files AS (
    -- First identify all MP4 files under the Dynamic Healing root
    SELECT 
        id,
        drive_id,
        name,
        parent_folder_id,
        path,
        -- Extract parent folder path
        substring(path from '^(.*/)[^/]+$') AS parent_path
    FROM 
        sources_google2
    WHERE 
        mime_type = 'video/mp4'
        AND root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
        AND is_deleted = false
        -- Only include files that haven't been processed yet
        AND id NOT IN (
            SELECT DISTINCT main_video_id 
            FROM sources_google2 
            WHERE main_video_id IS NOT NULL
        )
)
-- Update all files under the same parent folder with the MP4 file's ID
UPDATE sources_google2 sg2
SET main_video_id = mp4.id
FROM mp4_files mp4
WHERE 
    sg2.path LIKE (mp4.parent_path || '%')
    AND sg2.root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
    AND sg2.main_video_id IS NULL;

-- Step 6: Handle any transcripts that might be related to video files
-- If a transcript refers to a video by name, link it to that video's main_video_id
UPDATE sources_google2 transcript
SET main_video_id = video.main_video_id
FROM sources_google2 video
WHERE 
    transcript.mime_type IN ('text/plain', 'application/vnd.google-apps.document')
    AND transcript.name ILIKE '%transcript%'
    AND transcript.main_video_id IS NULL
    AND video.mime_type = 'video/mp4'
    -- Match transcript name to video name (removing _transcript suffix)
    AND replace(transcript.name, '_transcript', '') ILIKE ('%' || replace(video.name, '.mp4', '') || '%')
    AND transcript.root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
    AND video.root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
