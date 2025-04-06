# MP4 to Presentations Sync

This utility ensures there is a 1:1 relationship between MP4 files in Google Drive and the presentations table in the database. It scans for MP4 files in a specified folder and creates corresponding presentation records for any MP4 files that don't have one yet.

## Purpose

The presentations table serves as a source of truth for video content. This tool helps maintain consistency by ensuring that every MP4 file in Google Drive has a corresponding presentation record, with proper metadata like title, filename, folder path, and associations.

## Usage

```bash
# Using the google-drive-cli.sh wrapper (preferred)
./google-drive-cli.sh sync-mp4-presentations [options]

# Direct execution
./sync-mp4-presentations.ts [options]
```

## Options

- `--dry-run`: Show what would be synced without making changes
- `--folder-id <id>`: Specify a Google Drive folder ID (default: Dynamic Healing Discussion Group)
- `--verbose`: Show detailed logs
- `--limit <n>`: Limit processing to n records (useful for testing)

## Examples

```bash
# Basic usage - check what would be created without making changes
./google-drive-cli.sh sync-mp4-presentations --dry-run

# Sync all MP4 files in Dynamic Healing Discussion Group to presentations
./google-drive-cli.sh sync-mp4-presentations

# Specify a different folder by ID
./google-drive-cli.sh sync-mp4-presentations --folder-id 1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc

# Limit the number of files processed (for testing)
./google-drive-cli.sh sync-mp4-presentations --limit 10

# Show detailed logs while running
./google-drive-cli.sh sync-mp4-presentations --verbose
```

## How It Works

The script performs the following steps:

1. Retrieves information about the specified Google Drive folder
2. Finds all MP4 files within that folder and its subfolders
3. Checks which MP4 files already have associated presentation records
4. Creates new presentation records for any MP4 files that don't have one
5. Automatically extracts and sets useful metadata such as:
   - Title (derived from filename)
   - Folder path
   - Recording date (extracted from filename or using modified time)
   - Presenter name (extracted from filename when possible)

## Output

The script provides:

1. Count of total MP4 files found in the folder
2. Count of existing presentations
3. Count of new presentations created
4. Detailed logs for each file processed (in verbose mode)

## Integration with Other Commands

This command complements the other presentation-related commands:

- `count-mp4`: First use this to find how many MP4 files exist
- `sync-mp4-presentations`: Then use this to ensure all MP4 files have presentation records
- `mp4-experts`: Finally use this to create expert documents from presentations

This workflow ensures complete coverage of your video content in the database.