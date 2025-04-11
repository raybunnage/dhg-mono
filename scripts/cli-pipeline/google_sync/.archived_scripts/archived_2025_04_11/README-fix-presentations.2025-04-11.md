# ARCHIVED on 2025-04-11 - Original file used with sources_google table
# Fix Presentations

This document explains how to use the repair-presentations command to fix presentations that are missing their main_video_id but have associated video files in presentation_assets.

## Problem

The sync-mp4-presentations.ts script identified that there were 60 presentations that need to be created. However, we discovered that there are many presentation records with NULL main_video_id. These presentations may already have associated video files through the presentation_assets table.

## Solution

The repair-presentations command will:
1. Find presentations with NULL main_video_id
2. Look for associated video assets in the presentation_assets table
3. Update the presentation's main_video_id with the video file's ID

## Usage

```bash
# Show what would be repaired without making changes
ts-node scripts/cli-pipeline/presentations/index.ts repair-presentations

# Actually repair the presentations
ts-node scripts/cli-pipeline/presentations/index.ts repair-presentations --no-dry-run

# Use the database function for faster repairs
ts-node scripts/cli-pipeline/presentations/index.ts repair-presentations --no-dry-run --db-function

# Generate SQL to fix presentations
ts-node scripts/cli-pipeline/presentations/index.ts repair-presentations --setup
```

## Implementation

The repair-presentations command uses the PresentationRepairService, which:
1. Queries for presentations with NULL main_video_id that have associated video assets
2. Updates each presentation with the appropriate video file ID

In dry-run mode, it shows what would be changed without making any actual updates.

## After Running

After running this repair command, you should run the sync-mp4-presentations.ts script again to see if there are still presentations that need to be created. The number should be significantly lower.