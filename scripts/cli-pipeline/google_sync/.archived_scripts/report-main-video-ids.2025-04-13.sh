#!/bin/bash
# Script to run the report-main-video-ids command for sources_google
# This script searches for MP4 files in folders at path_depth=1 and their subfolders,
# prioritizing "Presentation" folders, and can update main_video_id for all related files.
# Usage: ./report-main-video-ids.sh [options]

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Default path for report output
DEFAULT_OUTPUT="$SCRIPT_DIR/../../../docs/script-reports/main-video-ids-report.md"

# Process command line arguments
FOLDER_ID=""
VERBOSE=""
OUTPUT="$DEFAULT_OUTPUT"
LIMIT=""
UPDATE_DB=""

# Parse command line args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --folder-id)
      FOLDER_ID="--folder-id $2"
      shift 2
      ;;
    --verbose)
      VERBOSE="--verbose"
      shift
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    --limit)
      LIMIT="--limit $2"
      shift 2
      ;;
    --update-db)
      UPDATE_DB="--update-db"
      shift
      ;;
    --dry-run)
      # dry-run is the default, but kept for backward compatibility
      shift
      ;;
    *)
      # Pass any unknown options directly to the TS script
      break
      ;;
  esac
done

echo "=== Generating Main Video IDs Report (sources_google) ==="
echo "Output file: $OUTPUT"
if [[ -n "$UPDATE_DB" ]]; then
  echo "Mode: UPDATE - Will update main_video_id values in the database"
else
  echo "Mode: REPORT ONLY - Will not modify the database"
fi

# Run the command using the TS file directly
ts-node "$SCRIPT_DIR/report-main-video-ids.ts" $FOLDER_ID $VERBOSE --output "$OUTPUT" $LIMIT $UPDATE_DB "$@"

if [ $? -eq 0 ]; then
  echo "=== Report generated successfully ==="
  echo "Report written to: $OUTPUT"
fi