#\!/bin/bash
# Script to update main_video_id for multiple folder-video mappings
# Processes all the mappings in a single run

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Default values
DRY_RUN=""
VERBOSE=""

# Process command line args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN="--dry-run"
      shift
      ;;
    --verbose)
      VERBOSE="--verbose"
      shift
      ;;
    *)
      # Pass any unknown options to the next script
      break
      ;;
  esac
done

# All the mappings to process
declare -a MAPPINGS=(
  "'2023-05-03-Sullivan': 'Sullivan.Ballantyne.5.3.23.mp4'"
  "'2022-04-20-Tauben': 'Tauben.Sullivan.4.20.22.mp4'"
  "'2022-09-21-Sue Carter - Sex, love, and oxytocin': 'Sue Carter talk 9-21-2022.mp4'"
  "'2020-10-21-Lederman-Relationship Connection': 'Matt and Alona.10.21.20.mp4'"
  "'2024-04-03-Lederman-NonViolent Commun': 'Lederman.4.4.24.mp4'"
  "'2024-01-24-Naviaux': 'Naviaux.DR.1.24.24.mp4'"
  "'2021-02-10-Eagle': 'Amster.Eagle.2.10.21.mp4'"
  "'2021-08-18-Mel Pohl - addiction': '8.18.21.Mel Pohl.mp4'"
  "'2021-1-27-Garbho-Q&A-f': 'Gharbo.1.28.21.mp4'"
  "'2023-12-06-Napadow-Patient': 'video1168985783.mp4'"
  "'2024-04-17-Naviaux-Basics of mitochondria': 'Navaux.4.17.24.mp4'"
  "'2020-06-03-Vagal state and vagal stimulation': '6.3.20.Vagal Stim.mp4'"
  "'2024-11-06 - Sutphin - aging': 'Sutphinb.10.6.24.mp4'"
  "'2022-11-2 - Peter Staats.Overview of Vagal Stimulation': '11.2.22.Staats.mp4'"
  "'2021-02-03-Wolovsky-Cues of Safety': 'Kate Wolovsky.2.3.21.mp4'"
  "'2024-02-21-Where do we go from here.Carter.Clawson,Hanscom': 'DHDG.2.21.24.open Discussion.mp4'"
  "'2024-02-04-Grinevich-oxytocin': 'Valery Grinevich 2-4-2024 video.mp4'"
  "'2023-09-20-Lane': 'Emotional vs physical pain.mp4'"
  "'2024-05-22-Cook': 'Cook.Clawson.5.22.244.mp4'"
)

# Count mappings
TOTAL_MAPPINGS=${#MAPPINGS[@]}
echo "Preparing to process $TOTAL_MAPPINGS folder-video mappings"

# Process each mapping
CURRENT=1
for MAPPING in "${MAPPINGS[@]}"; do
  echo "Processing mapping $CURRENT of $TOTAL_MAPPINGS: $MAPPING"
  
  # Run the original update-folder-video-mapping.sh script for each mapping
  "$SCRIPT_DIR/google-drive-cli.sh" update-folder-video-mapping --mapping "$MAPPING" $DRY_RUN $VERBOSE
  
  RESULT=$?
  if [ $RESULT -eq 0 ]; then
    echo "=== Mapping $CURRENT completed successfully ==="
  else
    echo "=== Mapping $CURRENT failed with error code $RESULT ==="
  fi
  
  echo ""
  ((CURRENT++))
done

echo "=== All $TOTAL_MAPPINGS mappings processed ==="
