#!/bin/bash
# Script to update main_video_id based on a folder-to-video mapping
# This script allows you to easily connect a folder with an MP4 file

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Default values
DRY_RUN=""
VERBOSE=""
MAPPINGS=()

# Parse command line args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mapping)
      # Add mapping to array
      MAPPINGS+=("$2")
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

if [[ ${#MAPPINGS[@]} -eq 0 ]]; then
  echo "Error: at least one --mapping parameter is required"
  echo "Usage: update-folder-video-mapping.sh --mapping '2022-04-20-Tauben': 'Tauben.Sullivan.4.20.22.mp4' [--mapping 'folder2': 'file2.mp4'] [--dry-run] [--verbose]"
  exit 1
fi

# Make sure the Python script is executable
chmod +x "$SCRIPT_DIR/update-folder-video-mapping.py"

# Process each mapping
TOTAL_MAPPINGS=${#MAPPINGS[@]}
CURRENT=1

for MAPPING in "${MAPPINGS[@]}"; do
  echo "Processing mapping $CURRENT of $TOTAL_MAPPINGS: $MAPPING"
  
  # Run the Python script for each mapping
  python3 "$SCRIPT_DIR/update-folder-video-mapping.py" --mapping "$MAPPING" $DRY_RUN $VERBOSE "$@"
  
  RESULT=$?
  if [ $RESULT -eq 0 ]; then
    echo "=== Mapping $CURRENT completed successfully ==="
  else
    echo "=== Mapping $CURRENT failed with error code $RESULT ==="
  fi
  
  echo ""
  ((CURRENT++))
done

echo "=== All mappings processed ==="