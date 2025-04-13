# Google Drive Sources Migration Plan

## Overview

This document outlines the plan to create an improved `sources_google2` table that addresses data consistency issues in the current `sources_google` table. The migration will fix metadata inconsistencies, properly represent the recursive file/folder structure, and clean up unused or duplicated fields while maintaining referential integrity with dependent tables.

## Current Issues

1. **Metadata inconsistency**: Incomplete metadata makes it difficult to link files back to their parent folders and root drives
2. **Recursive structure problems**: Folder hierarchies and file relationships are not properly captured
3. **Field duplication**: Some information exists both in dedicated columns and the metadata JSON
4. **Unused fields**: Several audio-related fields and others aren't being used
5. **Naming inconsistency**: `deleted` field should be `is_deleted` to match soft-delete convention

## Root Cause Analysis: Missing Metadata for Dynamic Healing Discussion Group Files

Investigation reveals a specific issue with metadata for files in the Dynamic Healing Discussion Group folder (ID: `1wriOM2j2IglnMcejplqG_XcCxSIfoRMV`). Currently, only about half of the 800+ files have correct `root_drive_id` values linking them to this root folder.

### Key findings:

1. **Incomplete hierarchical relationships**: When files were imported, not all parent-child relationships were properly captured. Files exist in the database but lack the metadata needed to link them back to their root folder.

2. **Tracking gaps**: The `root_drive_id` field, which should identify the top-level folder a file belongs to, is missing for approximately 400 files.

3. **Identification challenge**: Files can be found when searching directly by ID, but they can't be identified as part of the Dynamic Healing Discussion Group through folder traversal queries.

4. **Path inconsistencies**: Some files have partial path information but lack consistent structure needed for reliable traversal of the folder hierarchy.

5. **Synchronization limitations**: The current sync process in `sync-and-update-metadata.ts` finds 802 files but the database structure doesn't maintain proper relationships for all of them.

## Immediate Fixes for Metadata Issues

We need a two-step approach to completely fix the missing metadata:

1. **Run a full sync with increased folder depth**: The `sync-and-update-metadata.ts` script can find all 830 files when using a higher max-depth value and unlimited records:
   ```
   npx ts-node scripts/cli-pipeline/google_sync/sync-and-update-metadata.ts --max-depth 4 --limit 1000
   ```
   This will directly access Google Drive using the service account and properly sync all files, correctly populating parent-child relationships and paths.

2. **Then fix remaining metadata with `update-root-drive-id.ts`**: After the sync refreshes file relationships, run:
   ```
   npx ts-node scripts/cli-pipeline/google_sync/update-root-drive-id.ts
   ```
   
   This script uses multiple comprehensive approaches to find all files related to the root folder:
   - Direct hierarchical traversal (following parent-child relationships)
   - Path-based matching with various patterns
   - Name-based matching for related files
   - MIME type filters to catch specific file types
   - Analysis of transcript files that might be outside the standard hierarchy

## Long-term Migration Strategy

The full migration will follow a careful, incremental approach with validation at each step:

1. Create a new `sources_google2` table with an improved schema
2. Copy and clean data while preserving original IDs
3. Fix parent-child relationships and path structures
4. Validate the new table for completeness and consistency
5. Back up the original table before any replacement

## Implementation Plan

### Step 1: Create the new table schema

```sql
CREATE TABLE IF NOT EXISTS public.sources_google2 (
    -- Core identity fields (preserved from original)
    id uuid PRIMARY KEY, -- Maintain same IDs for referential integrity with expert_documents
    drive_id text NOT NULL UNIQUE,
    name text NOT NULL,
    mime_type text NOT NULL,
    
    -- Enhanced hierarchy fields with proper constraints
    root_drive_id text NOT NULL, -- Now required to ensure every file has a root
    parent_folder_id text, -- Renamed for clarity from parent_id
    
    -- Path structure to represent full hierarchical path
    path text NOT NULL, -- Now required for consistent traversal
    path_array text[], -- Store path segments for powerful querying and traversal
    path_depth integer, -- Track hierarchy depth explicitly
    
    -- Is this a root folder
    is_root boolean DEFAULT false,
    
    -- Soft delete
    is_deleted boolean DEFAULT false, -- Renamed from deleted for consistency
    
    -- Metadata and file attributes
    metadata jsonb,
    size bigint, -- Renamed from file_size for consistency with original
    modified_time timestamptz,
    web_view_link text,
    thumbnail_link text,
    
    -- Processing and sync fields
    content_extracted boolean DEFAULT false,
    extracted_content jsonb,
    extraction_error text,
    
    -- Audio specific fields maintained for compatibility
    audio_bitrate integer,
    audio_channels integer,
    audio_duration_seconds integer,
    audio_extracted boolean DEFAULT false,
    audio_extraction_path text,
    audio_quality_metrics jsonb,
    
    -- Foreign keys to improve relationships
    document_type_id uuid REFERENCES public.document_types(id),
    expert_id uuid REFERENCES public.experts(id),
    
    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    last_indexed timestamptz,
    
    -- Sync fields
    sync_id text,
    sync_status text,
    sync_error text -- Renamed from sync_message for consistency
);

-- Add indexes for performance and relationships
CREATE INDEX IF NOT EXISTS sources_google2_drive_id_idx ON public.sources_google2 (drive_id);
CREATE INDEX IF NOT EXISTS sources_google2_root_drive_id_idx ON public.sources_google2 (root_drive_id);
CREATE INDEX IF NOT EXISTS sources_google2_parent_folder_id_idx ON public.sources_google2 (parent_folder_id);
CREATE INDEX IF NOT EXISTS sources_google2_mime_type_idx ON public.sources_google2 (mime_type);
CREATE INDEX IF NOT EXISTS sources_google2_path_idx ON public.sources_google2 USING gin (path_array);
CREATE INDEX IF NOT EXISTS sources_google2_name_idx ON public.sources_google2 (name);
CREATE INDEX IF NOT EXISTS sources_google2_document_type_id_idx ON public.sources_google2 (document_type_id);
CREATE INDEX IF NOT EXISTS sources_google2_expert_id_idx ON public.sources_google2 (expert_id);
```

### Step 2: Backup existing table

```sql
-- Backup the original table before making any changes
CREATE TABLE IF NOT EXISTS public.sources_google_backup AS 
SELECT * FROM public.sources_google;
```

### Step 3: Copy and clean the data

```sql
-- First pass: Copy basic data from original table with complete data cleanup
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
    content_extracted, extracted_content, extraction_error,
    
    -- Audio specific fields 
    audio_bitrate, audio_channels, audio_duration_seconds,
    audio_extracted, audio_extraction_path, audio_quality_metrics,
    
    -- Foreign keys
    document_type_id, expert_id,
    
    -- Timestamps
    created_at, updated_at, last_indexed,
    
    -- Sync fields
    sync_id, sync_status, sync_error
)
SELECT 
    -- Core identity fields
    id, name, mime_type, drive_id,
    
    -- Enhanced hierarchy - CRITICAL: Set default root_drive_id for Dynamic Healing Group folder
    COALESCE(root_drive_id, 
             CASE WHEN drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' THEN drive_id
                  WHEN path LIKE '%Dynamic Healing Discussion Group%' THEN '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
                  ELSE drive_id END) AS root_drive_id,
    parent_folder_id,
    
    -- Paths - COALESCE ensures no NULLs
    COALESCE(path, '/' || name) AS path,
    is_root,
    
    -- Parse path into array and compute depth 
    string_to_array(COALESCE(path, '/' || name), '/') AS path_array,
    array_length(string_to_array(COALESCE(path, '/' || name), '/'), 1) AS path_depth,
    
    -- Soft delete
    COALESCE(deleted, false) AS is_deleted,
    
    -- Metadata and file attributes
    metadata,
    COALESCE(size, (metadata->>'size')::bigint) AS size,
    modified_time, web_view_link, thumbnail_link,
    
    -- Processing fields
    content_extracted, extracted_content, extraction_error,
    
    -- Audio specific fields
    audio_bitrate, audio_channels, audio_duration_seconds,
    audio_extracted, audio_extraction_path, audio_quality_metrics,
    
    -- Foreign keys
    document_type_id, expert_id,
    
    -- Timestamps
    created_at, updated_at, last_indexed,
    
    -- Sync fields
    sync_id, sync_status, sync_error
FROM 
    public.sources_google;
    
-- Add a special update to fix any remaining null root_drive_id values
UPDATE public.sources_google2
SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
WHERE root_drive_id IS NULL 
  OR root_drive_id = '';
  
-- Fix paths that don't start with a slash
UPDATE public.sources_google2
SET path = '/' || path
WHERE path NOT LIKE '/%';

-- Regenerate path_array for any rows where it might be wrong
UPDATE public.sources_google2
SET path_array = string_to_array(path, '/'),
    path_depth = array_length(string_to_array(path, '/'), 1);
```

### Step 4: Fix the recursive relationships and paths

```sql
-- Enhanced recursive CTE to build proper paths with multiple root detection approaches
WITH RECURSIVE folder_hierarchy AS (
    -- Base case: root folders (multiple identification approaches)
    SELECT 
        id, 
        drive_id,
        name,
        parent_folder_id,
        '/' || name AS path,
        1 AS level,
        drive_id AS root_drive_id
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
        p.root_drive_id -- Inherit root_drive_id from parent
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

-- Additional comprehensive fix for files by name/path pattern
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

-- Special fix for transcript files that might be outside the hierarchy
UPDATE sources_google2 s2
SET root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
WHERE 
    (
        name ILIKE '%transcript%' OR
        path ILIKE '%transcript%'
    )
    AND mime_type IN ('text/plain', 'application/vnd.google-apps.document')
    AND (root_drive_id IS NULL OR root_drive_id = '' OR root_drive_id = drive_id);
```

### Step 5: Handle the Dynamic Healing Discussion Group folder specifically

```sql
-- Find the "Dynamic Healing Discussion Group" folder ID
DO $$
DECLARE
    dhg_folder_id text;
BEGIN
    SELECT drive_id INTO dhg_folder_id
    FROM sources_google2
    WHERE name = 'Dynamic Healing Discussion Group' 
      AND mime_type = 'application/vnd.google-apps.folder';

    -- Update root_drive_id using comprehensive pattern matching, similar to update-root-drive-id.ts
    -- Start with direct children via parent_folder_id
    UPDATE sources_google2
    SET root_drive_id = dhg_folder_id
    WHERE root_drive_id IS NULL
      AND parent_folder_id = dhg_folder_id;
      
    -- Match by path patterns with variations
    UPDATE sources_google2
    SET root_drive_id = dhg_folder_id
    WHERE root_drive_id IS NULL
      AND (
          path LIKE '%/Dynamic Healing Discussion Group/%' OR
          path LIKE '%/Dynamic-Healing-Discussion-Group/%' OR
          path LIKE '%/Dynamic_Healing_Discussion_Group/%' OR
          name LIKE '%Dynamic Healing%'
      );
      
    -- Match transcript files specifically
    UPDATE sources_google2
    SET root_drive_id = dhg_folder_id
    WHERE root_drive_id IS NULL
      AND (
          name LIKE '%transcript%' OR
          name LIKE '%Transcript%' OR
          path LIKE '%transcript%' OR
          path LIKE '%Transcript%'
      )
      AND (
          mime_type = 'text/plain' OR
          mime_type = 'application/vnd.google-apps.document'
      );
      
    -- Match by MIME types for video and audio files
    UPDATE sources_google2
    SET root_drive_id = dhg_folder_id
    WHERE root_drive_id IS NULL
      AND path LIKE '%Dynamic Healing%'
      AND (
          mime_type = 'video/mp4' OR
          mime_type = 'audio/x-m4a'
      );
END $$;
```

### Step 6: Final cleanup and verification

```sql
-- Update metadata to ensure consistency with column values
UPDATE sources_google2
SET metadata = jsonb_set(
    metadata,
    '{parentId}',
    to_jsonb(COALESCE(parent_id, 'null'::text))
);

UPDATE sources_google2
SET metadata = jsonb_set(
    metadata,
    '{rootDriveId}',
    to_jsonb(COALESCE(root_drive_id, 'null'::text))
);

-- Update metadata to ensure size consistency
UPDATE sources_google2
SET metadata = jsonb_set(
    metadata,
    '{size}',
    to_jsonb(file_size)
)
WHERE file_size IS NOT NULL;

-- Count records with missing or null important fields
SELECT
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE root_drive_id IS NULL) AS missing_root_drive,
    COUNT(*) FILTER (WHERE parent_id IS NULL) AS missing_parent,
    COUNT(*) FILTER (WHERE path IS NULL) AS missing_path
FROM sources_google2;
```

## Validation Steps

Before replacing the original table, perform these validation checks:

1. **Count Comparison**:
   ```sql
   SELECT COUNT(*) FROM sources_google;
   SELECT COUNT(*) FROM sources_google2;
   ```
   Ensure the counts match.

2. **ID Integrity**:
   ```sql
   SELECT COUNT(*) FROM sources_google sg
   LEFT JOIN sources_google2 sg2 ON sg.id = sg2.id
   WHERE sg2.id IS NULL;
   ```
   Should return 0.

3. **Root Drive Improvement**:
   ```sql
   SELECT 
       COUNT(*) FILTER (WHERE sg.root_drive_id IS NOT NULL) AS original_with_root,
       COUNT(*) FILTER (WHERE sg2.root_drive_id IS NOT NULL) AS new_with_root
   FROM sources_google sg
   JOIN sources_google2 sg2 ON sg.id = sg2.id;
   ```
   Verify the new table has more complete root_drive_id values.

4. **Path Completeness**:
   ```sql
   SELECT 
       COUNT(*) FILTER (WHERE sg2.path IS NULL) AS missing_paths
   FROM sources_google2 sg2;
   ```
   Ensure all records have paths where appropriate.
   
5. **Dynamic Healing Files Verification**:
   ```sql
   -- Should show close to 830 files (the count found by our sync script)
   SELECT COUNT(*) 
   FROM sources_google2 
   WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
   
   -- Breakdown by mime type
   SELECT mime_type, COUNT(*) 
   FROM sources_google2 
   WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
   GROUP BY mime_type
   ORDER BY COUNT(*) DESC;
   ```
   Verify we have properly linked all files to the Dynamic Healing folder.
   
6. **Expert Document Relationship Integrity**:
   ```sql
   -- Ensure all expert documents can still find their source
   SELECT COUNT(*) 
   FROM expert_documents ed
   LEFT JOIN sources_google2 sg ON ed.source_id = sg.id
   WHERE sg.id IS NULL;
   ```
   Should return 0, indicating all expert documents have their source preserved.

## Implementation Strategy

1. **Development Testing**:
   - Implement these changes in a development environment first
   - Verify all queries work as expected
   - Test dependent applications against the new table structure

2. **Migration Execution**:
   - Schedule downtime for the migration
   - Create a full database backup
   - Execute the migration scripts
   - Validate the results with the checks above
   - Update application code to use the new table name

3. **Fallback Plan**:
   - Keep the original table as `sources_google_backup`
   - If issues arise, revert to using the original table
   - Document all issues for resolution in a future migration attempt

## Post-Migration Tasks

1. **Rename tables to complete migration**:
   ```sql
   -- First rename the original table
   ALTER TABLE sources_google RENAME TO sources_google_deprecated;
   
   -- Then rename the new table to the original name
   ALTER TABLE sources_google2 RENAME TO sources_google;
   
   -- Update the sequence if needed
   SELECT setval(pg_get_serial_sequence('sources_google', 'id'), 
               (SELECT MAX(id) FROM sources_google));
   ```

2. **Create views for backward compatibility** (if needed):
   ```sql
   -- Create a view that maps new columns to old names
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
       size,
       modified_time,
       web_view_link,
       thumbnail_link,
       -- Map other fields as needed
       created_at,
       updated_at
   FROM
       sources_google;
   ```

3. **Update application code references**:
   - Update references in TypeScript types
   - Update all queries that select from the sources_google table
   - Pay special attention to the column renames:
     - `deleted` → `is_deleted`
     - `parent_id` → `parent_folder_id`
     - `file_size` → `size`
     - `sync_error` → `sync_message`

4. **Create monitoring for data integrity**:
   ```sql
   -- Create a monitoring function that runs daily
   CREATE OR REPLACE FUNCTION public.check_sources_google_integrity()
   RETURNS TABLE (
       check_name text,
       status text,
       details text
   ) AS $$
   BEGIN
       -- Check for orphaned files (no root_drive_id)
       RETURN QUERY
       SELECT 
           'missing_root_drive_id' AS check_name,
           CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END AS status,
           COUNT(*)::text AS details
       FROM 
           sources_google
       WHERE 
           root_drive_id IS NULL OR root_drive_id = '';
       
       -- Check for other integrity issues
       -- Add more checks as needed
   END;
   $$ LANGUAGE plpgsql;
   ```

5. **Enable automated depth-4 syncs**:
   - Modify the sync scripts to use a depth of 4 by default
   - Add automatic root_drive_id population for new files

## Future Considerations

1. **Foreign Key Constraints**: Consider adding proper foreign key constraints to enforce the relationship between files and their parent folders.

2. **Triggers**: Implement triggers to automatically update paths when parent-child relationships change.

3. **Views**: Create backward-compatible views for any dependencies that cannot be immediately updated.

4. **Metadata Consistency Monitoring**: Implement regular checks to identify and fix metadata inconsistencies before they become problematic.

5. **Enhance update-root-drive-id.ts**: Modify the script to run automatically as part of the sync process to ensure all new files are properly linked to their root folders.

## Timeline and Resource Requirements

Estimated timeline:
- Immediate fix with update-root-drive-id.ts: 1-2 hours
- Preparation and testing for full migration: 2-3 days
- Migration execution: 1-2 hours (during low-traffic period)
- Validation and monitoring: 1 day

Resource requirements:
- Database administrator
- Application developer(s) for code updates
- Tester(s) for validation

## Conclusion: Addressing the Root Cause

Our investigation revealed the direct cause of the metadata issue: the original sync process had a limited folder depth (default of 3), while our testing showed that a depth of 4 is needed to capture all 830 files in the Dynamic Healing Discussion Group folder. Additionally, the metadata linking these files to their root folder wasn't consistently populated.

The immediate fix is a two-phase approach:
1. Run a full sync with `sync-and-update-metadata.ts` using greater depth (4) and higher limit (1000) to properly discover all files
2. Use `update-root-drive-id.ts` to ensure all files have the proper root_drive_id set

This will resolve the immediate issue of "missing" files that actually exist in the database but can't be found through folder traversal queries.

The long-term solution involves the complete migration to `sources_google2` with a better schema design that enforces proper parent-child relationships, consistent path structures, and explicit root folder associations. This will prevent similar issues from occurring in the future and provide a more reliable foundation for file management and retrieval operations.

In summary:
- Current record count: ~451 with proper root_drive_id
- Expected after fix: 830 files with proper root_drive_id
- Root cause: Folder depth limitation (3) and incomplete metadata assignment
- Solution: Two-phase sync and update approach with increased depth (4)