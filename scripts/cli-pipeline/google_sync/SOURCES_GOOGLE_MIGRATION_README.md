# Sources Google Migration Guide

This folder contains scripts to migrate the `sources_google` table to an improved `sources_google2` schema that addresses metadata issues and enhances path structures.

## Overview

The migration addresses several issues in the current `sources_google` table:

1. **Metadata inconsistency**: Incomplete metadata made it difficult to link files back to their parent folders and root drives
2. **Recursive structure problems**: Folder hierarchies and file relationships were not properly captured
3. **Missing Features**: Main video ID associations were not explicitly tracked

## Migration Scripts

The migration is divided into multiple phases for reliability and validation:

1. `create_sources_google2.sql` - Creates the new table schema with improved structure
2. `migrate_sources_google2_phase1.sql` - Initial data copying with metadata cleanup
3. `migrate_sources_google2_phase2.sql` - Comprehensive recursive traversal for hierarchy and main_video_id population
4. `validate_sources_google2_migration.sql` - Validates the migration results
5. `finalize_sources_google2_migration.sql` - Renames tables and creates backward compatibility
6. `run_sources_google2_migration.sh` - Master script that runs all steps with validation

## Key Improvements

### 1. Required root_drive_id
Every file now has a populated `root_drive_id` linking it to a root folder. This ensures no files become "orphaned" in the system.

### 2. Enhanced Path Structure
The table now stores both the text path and an array representation of path segments for more efficient querying and traversal.

### 3. Main Video ID Associations
Files are now linked to their presentation video through the `main_video_id` field, making it easy to find all related files for a presentation.

### 4. Consistent Naming
Column names are more consistent: `deleted` → `is_deleted`, `parent_id` → `parent_folder_id`, etc.

### 5. Optimized Indexes
Indexes are provided for all key query patterns, including a GIN index on `path_array` for efficient path traversal.

## Dynamic Healing Discussion Group Files

Special handling is provided for files in the Dynamic Healing Discussion Group folder:

1. **Root Folder ID**: `1wriOM2j2IglnMcejplqG_XcCxSIfoRMV`
2. **Detection Methods**: Multiple complementary approaches find all ~830 related files
3. **Main Video ID**: For each presentation folder, the MP4 file is identified and all related files are linked to it

## Usage Instructions

### Running the Full Migration

To run the complete migration process with validation:

```bash
cd /scripts/cli-pipeline/google_sync
./run_sources_google2_migration.sh
```

This script will:
1. Check your database connection
2. Create a backup of the original table
3. Execute each phase of the migration
4. Validate results between phases
5. Prompt you before finalizing the changes

### Running Individual Phases

You can also run individual phases manually if needed:

```bash
# Create the new table
psql $DATABASE_URL -f create_sources_google2.sql

# Run phase 1
psql $DATABASE_URL -f migrate_sources_google2_phase1.sql

# Run phase 2
psql $DATABASE_URL -f migrate_sources_google2_phase2.sql

# Validate
psql $DATABASE_URL -f validate_sources_google2_migration.sql

# Finalize (only after thorough validation)
psql $DATABASE_URL -f finalize_sources_google2_migration.sql
```

## Verification

After migration, you should expect:

1. At least 830 files associated with the Dynamic Healing Group
2. All files should have a non-null `root_drive_id`
3. Presentation folders should have the correct `main_video_id` set
4. All existing expert_document relationships should be preserved
5. Path information should be complete and consistent

## Rollback Plan

If issues are encountered after finalization:

1. The original table is preserved as `sources_google_deprecated`
2. You can revert with: `ALTER TABLE sources_google_deprecated RENAME TO sources_google;`

## Future Maintenance

This migration establishes a foundation for better file organization. To maintain it:

1. Always set `root_drive_id` when syncing new files
2. Update `main_video_id` values when adding new presentations
3. Ensure paths are consistently structured with proper separators
4. Use the path array functions for efficient traversal

For any issues, contact the database administrator.
