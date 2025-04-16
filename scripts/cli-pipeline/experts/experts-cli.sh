#!/bin/bash
# Experts CLI Pipeline
# Shell script wrapper for the Experts CLI utilities

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_DIR="$SCRIPT_DIR"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="experts"
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

# Change to the project root directory (important for relative paths)
cd "$ROOT_DIR" || { echo "Error: Could not change to project root directory"; exit 1; }

# Use the first argument as the command name or default to "main"
COMMAND="${1:-main}"
track_command "$COMMAND" "ts-node $CLI_DIR/experts-cli.ts $*"