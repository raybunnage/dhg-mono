#!/bin/bash
# Script to update main_video_id based on a path_array
# This script allows you to easily connect a folder with an MP4 file using a path_array

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Default values
DRY_RUN=""
VERBOSE=""
PATH_ARRAY=""

# Parse command line args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --path-array)
      PATH_ARRAY="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="--dry-run"
      shift
      ;;
    --verbose)
      VERBOSE="--verbose"
      shift
      ;;
    *)
      # Pass any unknown options to the TS script
      break
      ;;
  esac
done

if [[ -z "$PATH_ARRAY" ]]; then
  echo "Error: --path-array parameter is required"
  echo "Usage: update-path-array-video.sh --path-array '[\"folder\",\"subfolder\",\"file.mp4\"]' [--dry-run] [--verbose]"
  exit 1
fi

echo "=== Update Main Video ID from Path Array ==="
echo "Path Array: $PATH_ARRAY"
if [[ -n "$DRY_RUN" ]]; then
  echo "Mode: DRY RUN (no changes will be made)"
fi

# Run the command using the TS file
ts-node "$SCRIPT_DIR/update-path-array-video.ts" --path-array "$PATH_ARRAY" $DRY_RUN $VERBOSE "$@"

if [ $? -eq 0 ]; then
  echo "=== Command completed successfully ==="
fi