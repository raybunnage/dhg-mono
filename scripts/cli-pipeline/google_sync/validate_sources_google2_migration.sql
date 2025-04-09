-- Validation script to ensure the migration was successful

-- 1. Check record counts match
SELECT
    (SELECT COUNT(*) FROM sources_google) AS original_count,
    (SELECT COUNT(*) FROM sources_google2) AS new_count,
    (SELECT COUNT(*) FROM sources_google) = (SELECT COUNT(*) FROM sources_google2) AS counts_match;

-- 2. Check ID integrity (all ids from original are in new table)
SELECT COUNT(*) AS missing_ids
FROM sources_google sg
LEFT JOIN sources_google2 sg2 ON sg.id = sg2.id
WHERE sg2.id IS NULL;

-- 3. Check root_drive_id improvement
SELECT 
    (SELECT COUNT(*) FROM sources_google WHERE root_drive_id IS NOT NULL AND root_drive_id \!= '') AS original_with_root,
    (SELECT COUNT(*) FROM sources_google2 WHERE root_drive_id IS NOT NULL AND root_drive_id \!= '') AS new_with_root;

-- 4. Verify path completeness
SELECT 
    COUNT(*) AS missing_paths
FROM sources_google2 
WHERE path IS NULL OR path = '';

-- 5. Verify Dynamic Healing files
SELECT COUNT(*) AS dhg_files_count
FROM sources_google2 
WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

-- 6. Check mime type breakdown of Dynamic Healing files
SELECT mime_type, COUNT(*) AS count
FROM sources_google2 
WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
GROUP BY mime_type
ORDER BY COUNT(*) DESC;

-- 7. Check main_video_id assignment
SELECT 
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE main_video_id IS NOT NULL) AS records_with_main_video_id,
    COUNT(*) FILTER (WHERE mime_type = 'video/mp4') AS mp4_files,
    COUNT(*) FILTER (WHERE mime_type = 'video/mp4' AND main_video_id IS NOT NULL) AS mp4_with_main_video
FROM sources_google2
WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

-- 8. Check expert_document relationship integrity
SELECT COUNT(*) AS broken_relationships
FROM expert_documents ed
LEFT JOIN sources_google2 sg ON ed.source_id = sg.id
WHERE sg.id IS NULL AND ed.source_id IS NOT NULL;

-- 9. Detect orphaned files (files without root_drive_id)
SELECT COUNT(*) AS orphaned_files
FROM sources_google2
WHERE root_drive_id IS NULL OR root_drive_id = '';

-- 10. Check potentially broken presentations (presentations without main_video_id)
SELECT COUNT(*) AS presentations_without_video
FROM sources_google2
WHERE 
    root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
    AND mime_type = 'application/vnd.google-apps.folder'
    AND main_video_id IS NULL
    AND parent_folder_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
