#!/bin/bash
# Script to run the report-main-video-ids command, which searches for MP4 files
# in folders and their subfolders, prioritizing "Presentation" folders
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
    *)
      # Pass any unknown options directly to the TS script
      break
      ;;
  esac
done

echo "=== Generating Main Video IDs Report ==="
echo "Output file: $OUTPUT"

# Run the command using index.ts with the CLI command structure
ts-node "$SCRIPT_DIR/index.ts" report-main-video-ids $FOLDER_ID $VERBOSE --output "$OUTPUT" $LIMIT "$@"

if [ $? -eq 0 ]; then
  echo "=== Report generated successfully ==="
  echo "Report written to: $OUTPUT"
fi