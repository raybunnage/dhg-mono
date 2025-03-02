-- Migration: Investigate Unexpected Large Sync
-- Description: SQL queries to investigate the unexpectedly large number of synced files

-- 1. Get a count of total synced files
SELECT COUNT(*) AS total_files 
FROM sources_google;

-- 2. Find the most recent sync operation and its details
SELECT * 
FROM sync_history
ORDER BY timestamp DESC
LIMIT 5;

-- 3. Count files by their parent folder to see hierarchy distribution
SELECT parent_folder_id, COUNT(*) as file_count
FROM sources_google
GROUP BY parent_folder_id
ORDER BY file_count DESC
LIMIT 20;

-- 4. Examine distribution of file types
SELECT mime_type, COUNT(*) as count
FROM sources_google
GROUP BY mime_type
ORDER BY count DESC
LIMIT 20;

-- 5. Check if there are duplicate files with the same name but different IDs
SELECT name, COUNT(*) as occurrences
FROM sources_google
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY occurrences DESC
LIMIT 20;

-- 6. Look for any folders that might contain an unexpectedly large number of nested items
WITH RECURSIVE folder_tree AS (
  -- Start with root folders
  SELECT 
    id, 
    drive_id,
    name, 
    parent_folder_id,
    1 as level
  FROM sources_google
  WHERE mime_type = 'application/vnd.google-apps.folder'
    AND parent_folder_id IS NULL
  
  UNION ALL
  
  -- Add child folders
  SELECT 
    c.id, 
    c.drive_id,
    c.name, 
    c.parent_folder_id,
    p.level + 1
  FROM sources_google c
  JOIN folder_tree p ON c.parent_folder_id = p.drive_id
  WHERE c.mime_type = 'application/vnd.google-apps.folder'
)
SELECT 
  f.drive_id, 
  f.name, 
  f.level,
  COUNT(s.id) as contained_files
FROM folder_tree f
LEFT JOIN sources_google s ON s.parent_folder_id = f.drive_id
GROUP BY f.drive_id, f.name, f.level
ORDER BY contained_files DESC
LIMIT 20;

-- 7. Find the most recently added files to understand what was just synced
SELECT 
  name,
  mime_type, 
  parent_folder_id,
  created_at
FROM sources_google
ORDER BY created_at DESC
LIMIT 100;

-- 8. Look at recursive syncing - check if subfolders were deeply traversed
WITH RECURSIVE folder_structure AS (
  -- Start with the specified folder (replace with the folder ID you used)
  SELECT 
    id, 
    drive_id,
    name, 
    parent_folder_id,
    mime_type,
    0 AS depth,
    ARRAY[name::text] AS path
  FROM sources_google
  WHERE drive_id = 'YOUR_FOLDER_ID_HERE' -- REPLACE THIS WITH YOUR ACTUAL FOLDER ID
  
  UNION ALL
  
  -- Recursively add all descendants
  SELECT 
    c.id, 
    c.drive_id,
    c.name, 
    c.parent_folder_id,
    c.mime_type,
    p.depth + 1,
    p.path || c.name::text
  FROM sources_google c
  JOIN folder_structure p ON c.parent_folder_id = p.drive_id
)
SELECT 
  depth, 
  count(*) as item_count
FROM folder_structure
GROUP BY depth
ORDER BY depth;

-- 9. Check files by their creation date to see if there's a spike
SELECT 
  DATE_TRUNC('hour', created_at) as creation_hour,
  COUNT(*) as files_added
FROM sources_google
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY creation_hour DESC;

-- 10. Find which folders were most recently synced 
SELECT DISTINCT parent_folder_id, COUNT(*) as file_count
FROM sources_google
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY parent_folder_id
ORDER BY file_count DESC
LIMIT 20;

-- 11. Investigate recursive traversal - see how deep the folder structure goes
WITH RECURSIVE folder_hierarchy AS (
  SELECT 
    id, 
    name,
    drive_id,
    parent_folder_id,
    1 AS depth,
    name::text AS path
  FROM sources_google
  WHERE mime_type = 'application/vnd.google-apps.folder'
    AND parent_folder_id IS NULL
  
  UNION ALL
  
  SELECT 
    c.id, 
    c.name,
    c.drive_id,
    c.parent_folder_id,
    p.depth + 1,
    (p.path || ' > ' || c.name)
  FROM sources_google c
  JOIN folder_hierarchy p ON c.parent_folder_id = p.drive_id
  WHERE c.mime_type = 'application/vnd.google-apps.folder'
)
SELECT 
  depth, 
  COUNT(*) as folder_count,
  MAX(path) as example_path
FROM folder_hierarchy
GROUP BY depth
ORDER BY depth;

-- 12. Clean up unwanted files if necessary (UNCOMMENT ONLY IF NEEDED)
-- DELETE FROM sources_google WHERE created_at > '2025-03-01 00:00:00' AND parent_folder_id = 'YOUR_FOLDER_ID';
-- DELETE FROM sync_history WHERE timestamp > '2025-03-01 00:00:00';