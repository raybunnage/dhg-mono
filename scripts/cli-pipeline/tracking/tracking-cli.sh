#!/bin/bash

# Command Tracking CLI
# Tracks and manages CLI pipeline command executions
#
# Available commands:
#   list                List recent command executions
#   stats               Show command execution statistics
#   init                Initialize the command_history table in the database
#   test                Add a test record to the command_history table
#   health-check        Check the health of the command tracking service

# Get directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${PROJECT_ROOT}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="tracking"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # For the tracking CLI itself, we don't want to create an infinite loop
  # with tracking commands tracking themselves, so we just execute directly
  eval "$full_command"
}

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.development" ]; then
  source "$PROJECT_ROOT/.env.development"
  export SUPABASE_URL
  export SUPABASE_SERVICE_ROLE_KEY
  export SUPABASE_ANON_KEY
  # Export other necessary environment variables
fi

# Make script executable
chmod +x "$SCRIPT_DIR/tracking-cli.sh"

# Change to the root directory
cd "$PROJECT_ROOT"

# Use the first argument as the command name or default to "main"
COMMAND="${1:-main}"

# Handle health-check command specially
if [ "$COMMAND" = "health-check" ]; then
  track_command "$COMMAND" "$SCRIPT_DIR/health-check.sh"
else
  CMD="NODE_PATH=\"$PROJECT_ROOT/node_modules\" npx ts-node -P \"$PROJECT_ROOT/tsconfig.json\" \"$SCRIPT_DIR/cli.ts\" $*"
  track_command "$COMMAND" "$CMD"
fi