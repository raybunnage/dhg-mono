# Google Sync Modular Architecture

## Overview

The Google sync command has been refactored from a monolithic 2+ minute operation into focused, fast commands that can be run independently or together. This provides better feedback loops, easier debugging, and more flexibility.

## Architecture

### Old Architecture (Legacy)
```
sync command → 2-3 minutes
├── Phase 1: Sync files from Google Drive
├── Phase 2: Create expert_documents records  
└── Phase 3: Update metadata for all files
```

### New Modular Architecture
```
sync-all (orchestrator)
├── sync-files         → < 30s (just file existence)
├── process-new-files  → < 10s (create expert_documents)
├── update-metadata    → variable (only changed files)
└── verify-deletions   → optional (safety checks)
```

## Commands

### 1. `sync-files` - Core Sync (Fast)
**Purpose**: Quickly check what's new or deleted  
**Duration**: < 30 seconds typical  
**Operations**:
- Lists all files from Google Drive
- Compares with database records
- Inserts new files (marked as `pending`)
- Marks missing files as deleted
- Respects active root_drive_id filter

**Usage**:
```bash
# Quick check for new files
./google-sync-cli.sh sync-files

# Preview mode (no changes)
./google-sync-cli.sh sync-files --dry-run

# With custom depth
./google-sync-cli.sh sync-files --max-depth 3
```

### 2. `process-new-files` - Process Additions
**Purpose**: Handle newly synced files  
**Duration**: < 10 seconds for 100 files  
**Operations**:
- Creates expert_documents records
- Sets processing status based on file type
- Identifies files needing classification
- Respects active root_drive_id filter

**Usage**:
```bash
# Process new files
./google-sync-cli.sh process-new-files

# Process specific number
./google-sync-cli.sh process-new-files --limit 50
```

### 3. `update-metadata` - Refresh Metadata
**Purpose**: Update metadata for existing files  
**Duration**: Variable based on changes  
**Operations**:
- Checks for file changes (size, modified time)
- Handles file renames
- Updates thumbnail links
- Extracts video metadata if available
- Respects active root_drive_id filter

**Usage**:
```bash
# Update changed files
./google-sync-cli.sh update-metadata

# Force update all files
./google-sync-cli.sh update-metadata --force --limit 100
```

### 4. `verify-deletions` - Deletion Management
**Purpose**: Safely handle deleted files  
**Duration**: Variable based on verification  
**Operations**:
- Verifies files marked as deleted
- Restores files that still exist
- Provides safety thresholds
- Detailed reporting
- Respects active root_drive_id filter

**Usage**:
```bash
# Verify deletions
./google-sync-cli.sh verify-deletions

# Restore files that still exist
./google-sync-cli.sh verify-deletions --restore

# Force deletion despite warnings
./google-sync-cli.sh verify-deletions --force
```

### 5. `sync-all` - Complete Pipeline
**Purpose**: Run all steps in sequence  
**Duration**: Combined duration of all steps  
**Operations**:
- Runs sync-files
- Runs process-new-files (if new files found)
- Runs update-metadata
- Generates comprehensive report
- Respects active root_drive_id filter

**Usage**:
```bash
# Complete sync pipeline
./google-sync-cli.sh sync-all

# Skip metadata update
./google-sync-cli.sh sync-all --skip-metadata

# Verbose with limits
./google-sync-cli.sh sync-all --verbose --limit 100
```

## Benefits

### 1. Faster Feedback Loops
- Know what's new in < 30 seconds
- Don't wait for full processing to see changes
- Quick iterations during development

### 2. Better Error Recovery
- If metadata update fails, files are already synced
- Can retry just the failed operation
- No need to re-run entire 2+ minute process

### 3. Flexible Scheduling
```bash
# Every 5 minutes: Quick sync check
*/5 * * * * ./google-sync-cli.sh sync-files

# Every 30 minutes: Process new files
*/30 * * * * ./google-sync-cli.sh process-new-files

# Every hour: Update metadata
0 * * * * ./google-sync-cli.sh update-metadata

# Daily: Verify deletions
0 2 * * * ./google-sync-cli.sh verify-deletions
```

### 4. Clear Mental Model
Each command has one clear purpose:
- `sync-files`: What's new or deleted?
- `process-new-files`: Prepare for classification
- `update-metadata`: Keep info current
- `verify-deletions`: Safety checks

## Migration Guide

### From Legacy `sync` Command

**Old way**:
```bash
./google-sync-cli.sh sync --verbose --limit 100
```

**New way (equivalent)**:
```bash
./google-sync-cli.sh sync-all --verbose --limit 100
```

**New way (optimized)**:
```bash
# Just check for new files
./google-sync-cli.sh sync-files

# Then process what you need
./google-sync-cli.sh process-new-files
```

### Common Workflows

**Daily sync**:
```bash
# Morning: Full sync
./google-sync-cli.sh sync-all

# Throughout day: Quick checks
./google-sync-cli.sh sync-files
./google-sync-cli.sh process-new-files
```

**Debug sync issues**:
```bash
# Check what would be synced
./google-sync-cli.sh sync-files --dry-run --verbose

# Process one file at a time
./google-sync-cli.sh process-new-files --limit 1 --verbose
```

**Handle deletions safely**:
```bash
# First verify
./google-sync-cli.sh verify-deletions --dry-run

# Then restore if needed
./google-sync-cli.sh verify-deletions --restore
```

## Root Drive Filtering

All commands respect the active `root_drive_id` filter from `user_filter_profiles`:

```sql
-- Set active filter
UPDATE user_filter_profiles SET is_active = true WHERE name = 'My Project';

-- Commands will only process files from the associated root_drive_id
```

## Performance Comparison

| Operation | Legacy `sync` | New Modular |
|-----------|--------------|-------------|
| Check for new files | 2-3 min | < 30s (`sync-files`) |
| Full sync + process | 2-3 min | ~1 min (`sync-all`) |
| Update single file | 2-3 min | < 5s (`update-metadata --limit 1`) |
| Verify deletions | Part of sync | Separate (`verify-deletions`) |

## Troubleshooting

### Files not syncing
1. Check active filter: Files might be filtered by root_drive_id
2. Run with `--verbose` to see what's happening
3. Check Google Drive permissions

### Slow performance
1. Use `--limit` to process fewer files
2. Run `sync-files` first to identify changes
3. Process in smaller batches

### Files incorrectly marked as deleted
1. Use `verify-deletions` to check
2. Use `--restore` flag to unmark
3. Check network/API issues

## Implementation Date

Created: January 25, 2025

## Related Documentation

- `/docs/cli-pipeline/google-sync-command-analysis.md` - Analysis that led to this refactoring
- `/scripts/cli-pipeline/google_sync/README.md` - General Google sync documentation