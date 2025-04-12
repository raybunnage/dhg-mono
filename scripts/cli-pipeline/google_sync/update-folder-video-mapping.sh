#!/bin/bash
# Script to update main_video_id based on a folder-to-video mapping
# This script allows you to easily connect a folder with an MP4 file

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Default values
DRY_RUN=""
VERBOSE=""
MAPPING=""

# Parse command line args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mapping)
      MAPPING="$2"
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
      # Pass any unknown options to the script
      break
      ;;
  esac
done

if [[ -z "$MAPPING" ]]; then
  echo "Error: --mapping parameter is required"
  echo "Usage: update-folder-video-mapping.sh --mapping '2022-04-20-Tauben': 'Tauben.Sullivan.4.20.22.mp4' [--dry-run] [--verbose]"
  exit 1
fi

# Run the TypeScript script
ts-node "$SCRIPT_DIR/update-folder-video-mapping.ts" --mapping "$MAPPING" $DRY_RUN $VERBOSE "$@"

if [ $? -eq 0 ]; then
  echo "=== Command completed successfully ==="
fi