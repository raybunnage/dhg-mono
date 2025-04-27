#!/bin/bash
# Experts CLI Pipeline
# Shell script wrapper for the Experts CLI utilities
#
# Available commands:
#   link-top-level-folders  List folders with videos for expert assignment
#   assign-expert           Assign an expert to a folder (interactive mode with -i)
#   assign-folder-experts   Interactively assign experts to high-level folders (path_depth = 0)
#   list-experts            List all experts with their mnemonics
#   add-expert              Add a new expert to the database
#   health-check            Check the health of the experts service infrastructure

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

# Special case for add-expert command to work around option parsing issues
if [ "$COMMAND" = "add-expert" ]; then
  shift  # remove the command argument
  
  # Extract parameters from command line arguments
  EXPERT_NAME=""
  FULL_NAME=""
  EXPERTISE=""
  MNEMONIC=""
  CORE_GROUP=false
  DRY_RUN=false
  VERBOSE=false
  
  # Parse arguments
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --expert-name)
        EXPERT_NAME="$2"
        shift 2
        ;;
      --full-name)
        FULL_NAME="$2"
        shift 2
        ;;
      --expertise)
        EXPERTISE="$2"
        shift 2
        ;;
      --mnemonic)
        MNEMONIC="$2"
        shift 2
        ;;
      --core-group)
        CORE_GROUP=true
        shift
        ;;
      --dry-run|-d)
        DRY_RUN=true
        shift
        ;;
      --verbose|-v)
        VERBOSE=true
        shift
        ;;
      *)
        echo "Unknown option: $1"
        shift
        ;;
    esac
  done
  
  # Validate required parameters
  if [ -z "$EXPERT_NAME" ]; then
    echo "Error: --expert-name is required"
    exit 1
  fi
  
  # Set up basic parameters
  PARAMS="--expert-name \"$EXPERT_NAME\""
  
  # Add optional parameters if provided
  if [ -n "$FULL_NAME" ]; then
    PARAMS="$PARAMS --full-name \"$FULL_NAME\""
  fi
  
  if [ -n "$EXPERTISE" ]; then
    PARAMS="$PARAMS --expertise \"$EXPERTISE\""
  fi
  
  if [ -n "$MNEMONIC" ]; then
    PARAMS="$PARAMS --mnemonic \"$MNEMONIC\""
  fi
  
  if [ "$CORE_GROUP" = "true" ]; then
    PARAMS="$PARAMS --core-group"
  fi
  
  if [ "$DRY_RUN" = "true" ]; then
    PARAMS="$PARAMS --dry-run"
  fi
  
  if [ "$VERBOSE" = "true" ]; then
    PARAMS="$PARAMS --verbose"
  fi
  
  # Execute the command with properly formatted parameters
  track_command "add-expert" "cd \"$ROOT_DIR\" && ts-node \"$CLI_DIR/add-expert-direct.ts\" $PARAMS"
else
  # Regular command execution for other commands
  track_command "$COMMAND" "ts-node $CLI_DIR/experts-cli.ts $*"
fi