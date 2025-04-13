# ARCHIVED on 2025-04-11 - Original file used with sources_google table
# Create Presentations from Expert Documents

This document explains how to use the create-presentations-from-expert-docs.ts script to create presentations from existing expert documents.

## Problem Context

We discovered the following:

1. There are 112 MP4 files in the Dynamic Healing Discussion Group folder
2. Only 53 of these have presentations with main_video_id set
3. However, there are approximately 108-142 expert documents for these MP4 files
4. This means we can create presentations for MP4 files using existing expert documents

## Solution

This script:
1. Finds MP4 files in the Dynamic Healing Discussion Group folder
2. Identifies which ones have "Video Summary Transcript" expert documents
3. Checks which ones don't already have presentations
4. Creates presentations for these MP4 files, linking them to the expert documents

## Usage

```bash
# Dry run to see what would be created without making changes
ts-node scripts/cli-pipeline/google_sync/create-presentations-from-expert-docs.ts --dry-run

# Create presentations for MP4 files with expert documents
ts-node scripts/cli-pipeline/google_sync/create-presentations-from-expert-docs.ts

# Limit to a certain number of presentations
ts-node scripts/cli-pipeline/google_sync/create-presentations-from-expert-docs.ts --limit 10

# See detailed logs
ts-node scripts/cli-pipeline/google_sync/create-presentations-from-expert-docs.ts --verbose
```

## Implementation

The script:
1. Gets expert documents of type "Video Summary Transcript"
2. Filters to only include those for MP4 files in the Dynamic Healing Discussion Group folder
3. Checks which ones don't already have presentations
4. Creates presentations for these MP4 files
5. Creates presentation_asset records linking the presentations to the expert documents

## After Running

After running this script, there should be fewer MP4 files without presentations.

In test runs, we found 2 files (out of a sample of 10) that had expert documents but no presentations. Extrapolating to the full set, we might be able to create presentations for approximately 20-30 MP4 files using existing expert documents.

Then, for any remaining MP4 files, you can use the sync-mp4-presentations.ts script to create presentations without expert documents.