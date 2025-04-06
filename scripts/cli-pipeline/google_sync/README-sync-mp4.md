# Sync MP4 Presentations

This document explains how to use the sync-mp4-presentations.ts script to synchronize MP4 files from Google Drive with presentation records.

## Problem Diagnosis

We discovered the following:

1. There are 177 total MP4 files in the sources_google table
2. 112 of those MP4 files are in the Dynamic Healing Discussion Group folder
3. There are 112 total presentations in the database
4. 53 presentations have main_video_id set to MP4 files in the folder
5. 59 presentations have NULL main_video_id and no associated assets
6. This explains why the script needs to create around 60 new presentations

The issue was that the sync-mp4-presentations.ts script was not correctly filtering MP4 files by folder, so it was trying to create presentations for ALL MP4 files, not just those in the Dynamic Healing Discussion Group.

## Solution

We fixed the sync-mp4-presentations.ts script to properly filter files by the specified folder. Now it correctly:
1. Finds MP4 files in the Dynamic Healing Discussion Group
2. Checks which ones already have presentations
3. Creates presentations for the remaining MP4 files

## Usage

```bash
# Dry run to see what would be synced without making changes
ts-node scripts/cli-pipeline/google_sync/sync-mp4-presentations.ts --dry-run

# Actually create the presentations
ts-node scripts/cli-pipeline/google_sync/sync-mp4-presentations.ts

# Specify a different folder
ts-node scripts/cli-pipeline/google_sync/sync-mp4-presentations.ts --folder-id <folder-id>
```

## Implementation

The script uses the following logic:
1. Gets MP4 files by MIME type and file extension from sources_google
2. Filters to only include files in the specified folder
3. Checks which MP4 files already have presentations
4. Creates new presentations for MP4 files without presentations

The filtering logic has been improved to handle different path formats in the database:
- Files with parent_folder_id matching the folder ID
- Files with parent_path containing the folder name
- Files with parent_path starting with the folder name
- Files with parent_path containing the folder path (with or without leading slash)

## Diagnostic Script

Use the diagnose-presentations.ts script to analyze the current state of presentations and MP4 files:

```bash
ts-node scripts/cli-pipeline/google_sync/diagnose-presentations.ts
```

This provides detailed information about:
- Total presentations
- Presentations with/without main_video_id
- MP4 files in the Dynamic Healing Discussion Group
- Presentation assets