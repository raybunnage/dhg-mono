-- Validation script to ensure the migration was successful

-- Run each of these statements separately to see the results
-- Modified to improve SQL compatibility with Supabase's RPC execute_sql function

-- 1. Check record counts match
SELECT
    (SELECT COUNT(*) FROM sources_google) AS original_count,
    (SELECT COUNT(*) FROM sources_google_new) AS new_count;

-- 2. Check if counts match
SELECT 
    (SELECT COUNT(*) FROM sources_google) = (SELECT COUNT(*) FROM sources_google_new) AS counts_match;

-- 3. Check ID integrity (all ids from original are in new table)
SELECT COUNT(*) AS missing_ids
FROM sources_google sg
LEFT JOIN sources_google_new sg2 ON sg.id = sg2.id
WHERE sg2.id IS NULL;

-- 4. Check root_drive_id improvement
SELECT 
    (SELECT COUNT(*) FROM sources_google WHERE root_drive_id IS NOT NULL AND root_drive_id != '') AS original_with_root,
    (SELECT COUNT(*) FROM sources_google_new WHERE root_drive_id IS NOT NULL AND root_drive_id != '') AS new_with_root;

-- 5. Verify path completeness
SELECT 
    COUNT(*) AS missing_paths
FROM sources_google_new 
WHERE path IS NULL OR path = '';

-- 6. Verify Dynamic Healing files
SELECT COUNT(*) AS dhg_files_count
FROM sources_google_new 
WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

-- 7. Verify Polyvagal Steering Group files
SELECT COUNT(*) AS pvsg_files_count
FROM sources_google_new 
WHERE root_drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc';

-- 8. Check mime type breakdown of Dynamic Healing files
SELECT mime_type, COUNT(*) AS count
FROM sources_google_new 
WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
GROUP BY mime_type
ORDER BY COUNT(*) DESC;

-- 9. Check mime type breakdown of Polyvagal Steering Group files
SELECT mime_type, COUNT(*) AS count
FROM sources_google_new 
WHERE root_drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'
GROUP BY mime_type
ORDER BY COUNT(*) DESC;

-- 10. Check main_video_id assignment for Dynamic Healing
SELECT 
    COUNT(*) AS total_records,
    COUNT(CASE WHEN main_video_id IS NOT NULL THEN 1 END) AS records_with_main_video_id,
    COUNT(CASE WHEN mime_type = 'video/mp4' THEN 1 END) AS mp4_files,
    COUNT(CASE WHEN mime_type = 'video/mp4' AND main_video_id IS NOT NULL THEN 1 END) AS mp4_with_main_video
FROM sources_google_new
WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

-- 11. Check main_video_id assignment for Polyvagal Steering
SELECT 
    COUNT(*) AS total_records,
    COUNT(CASE WHEN main_video_id IS NOT NULL THEN 1 END) AS records_with_main_video_id,
    COUNT(CASE WHEN mime_type = 'video/mp4' THEN 1 END) AS mp4_files,
    COUNT(CASE WHEN mime_type = 'video/mp4' AND main_video_id IS NOT NULL THEN 1 END) AS mp4_with_main_video
FROM sources_google_new
WHERE root_drive_id = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc';

-- 12. Check expert_document relationship integrity
SELECT COUNT(*) AS broken_relationships
FROM expert_documents ed
LEFT JOIN sources_google_new sg ON ed.source_id = sg.id
WHERE sg.id IS NULL AND ed.source_id IS NOT NULL;

-- 13. Detect orphaned files (files without root_drive_id)
SELECT COUNT(*) AS orphaned_files
FROM sources_google_new
WHERE root_drive_id IS NULL OR root_drive_id = '';

-- 14. Check potentially broken presentations (presentations without main_video_id)
SELECT COUNT(*) AS presentations_without_video
FROM sources_google_new
WHERE 
    root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
    AND mime_type = 'application/vnd.google-apps.folder'
    AND main_video_id IS NULL
    AND parent_folder_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';