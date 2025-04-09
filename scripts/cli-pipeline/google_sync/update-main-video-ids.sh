#!/bin/bash
# Script to run the update-main-video-ids command, which sets main_video_id for presentations
# by recursively searching for MP4 files in folders and subfolders
# Usage: ./update-main-video-ids.sh [options]

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Process command line arguments
FOLDER_ID=""
VERBOSE=""
LIMIT=""
DRY_RUN=""
USE_GOOGLE=""

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
    --limit)
      LIMIT="--limit $2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="--dry-run"
      shift
      ;;
    --use-sources-google)
      USE_GOOGLE="--use-sources-google"
      shift
      ;;
    *)
      # Pass any unknown options directly to the TS script
      break
      ;;
  esac
done

echo "=== Updating Main Video IDs ==="
if [[ -n "$DRY_RUN" ]]; then
  echo "Mode: DRY RUN (no changes will be made)"
fi

# Run the command using index.ts with the CLI command structure
ts-node "$SCRIPT_DIR/index.ts" update-main-video-ids $FOLDER_ID $VERBOSE $LIMIT $DRY_RUN $USE_GOOGLE "$@"

if [ $? -eq 0 ]; then
  echo "=== Update completed successfully ==="
fi