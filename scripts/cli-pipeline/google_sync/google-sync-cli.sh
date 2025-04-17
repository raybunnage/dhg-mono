#!/bin/bash
# Script to run the Google Sync CLI
# Usage: ./google-sync-cli.sh <command> [options]

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="google_sync"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Check if we have a TS tracking wrapper
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    # Fallback to direct execution without tracking
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Handle specific commands that might need special treatment
if [ "$1" = "count-mp4" ]; then
  shift
  track_command "count-mp4" "ts-node $SCRIPT_DIR/count-mp4-files.ts $*"
  exit $?
fi

if [ "$1" = "health-check" ]; then
  shift
  track_command "health-check" "$SCRIPT_DIR/health-check.sh $*"
  exit $?
fi

if [ "$1" = "classify-docs-service" ]; then
  shift
  track_command "classify-docs-service" "ts-node $SCRIPT_DIR/classify-missing-docs-with-service.ts $*"
  exit $?
fi

if [ "$1" = "test-prompt-service" ]; then
  shift
  track_command "test-prompt-service" "ts-node $SCRIPT_DIR/test-prompt-service.ts $*"
  exit $?
fi

if [ "$1" = "fix-orphaned-docx" ]; then
  shift
  track_command "fix-orphaned-docx" "ts-node $SCRIPT_DIR/fix-orphaned-docx.ts $*"
  exit $?
fi

if [ "$1" = "report-main-video-ids" ]; then
  shift
  track_command "report-main-video-ids" "ts-node $SCRIPT_DIR/report-main-video-ids.ts $*"
  exit $?
fi

# Run the TypeScript file with ts-node - capture command from args
COMMAND="${1:-main}"
track_command "$COMMAND" "ts-node $SCRIPT_DIR/index.ts $*"