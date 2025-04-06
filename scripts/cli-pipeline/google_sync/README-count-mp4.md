# MP4 File Counter

This utility helps count and analyze MP4 and M4V files in a Google Drive folder or local directory. It's particularly useful for identifying how many video files need to be processed before syncing or downloading them.

## Usage

```bash
# Using the google-drive-cli.sh wrapper (preferred)
./google-drive-cli.sh count-mp4 <drive_id> [options]
./google-drive-cli.sh count-mp4 <path> --local [options]

# Direct execution
./count-mp4-files.ts <drive_id> [options]
./count-mp4-files.ts <path> --local [options]

# Using npm script
npm run count-mp4 -- <drive_id> [options]
npm run count-mp4 -- <path> --local [options]
```

## Options

- `--verbose`: Show detailed information about each file as it's found
- `--summary`: Show only the summary statistics (no folder breakdown)
- `--list`: List all MP4 files found, sorted by path
- `--local`: Treat the input as a local directory path instead of Drive ID

## Examples

```bash
# Basic usage - count MP4 files in a Google Drive folder
./google-drive-cli.sh count-mp4 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV

# You can also use named folder aliases
./google-drive-cli.sh count-mp4 dynamic-healing

# List all MP4 files in the Google Drive folder
./google-drive-cli.sh count-mp4 dynamic-healing --list

# Show only summary information
./google-drive-cli.sh count-mp4 dynamic-healing --summary

# Count MP4 files in a local directory
./google-drive-cli.sh count-mp4 /Users/username/Videos --local

# Show detailed information while scanning a local directory
./google-drive-cli.sh count-mp4 /Users/username/Videos --local --verbose
```

## Output

The script provides:

1. Total count of MP4/M4V files
2. Total size of all MP4/M4V files
3. Distribution of files by folder
4. (Optional) Complete list of all files found

## Integration with Google Drive Sync

This tool complements the Google Drive sync functionality by helping you:

1. Identify how many video files would be synced from a local directory
2. Estimate storage requirements for video files
3. Locate video files that need to be processed or uploaded

When planning to sync a large number of videos to Google Drive or when checking how many videos have been downloaded, this tool provides a quick assessment without having to manually count files.